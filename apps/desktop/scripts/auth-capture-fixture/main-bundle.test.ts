import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { createContext, runInContext } from 'node:vm'
import { resolveConfig } from 'electron-vite'
import { build } from 'vite'
import { expect, it, vi } from 'vitest'

const requireDependency = createRequire(import.meta.url)

it.each([
  ['src/backend/auth/http.ts', 'createAuthHttpClient'],
  ['src/backend/search/http.ts', 'createSearchHttp']
])('제품 main 설정으로 빌드한 %s는 실제 Ky export로 초기화된다', async (entry, factory) => {
  const resolved = await resolveConfig(
    { configFile: 'electron.vite.config.ts', logLevel: 'silent' },
    'build',
    'dfragon-development'
  )
  const main = resolved.config!.main!
  const output = await build({
    ...main,
    logLevel: 'silent',
    build: { ...main.build, write: false, lib: { entry: resolve(entry), formats: ['cjs'] } }
  })
  const bundles = Array.isArray(output) ? output : [output]
  expect(bundles).toHaveLength(1)
  const bundle = bundles[0]
  if (!('output' in bundle)) {
    throw new Error('Expected completed HTTP client build')
  }
  const chunks = bundle.output.filter((item) => item.type === 'chunk')
  expect(chunks).toHaveLength(1)
  const environment = mainEnvironment()
  runInContext(chunks[0].code, environment.context)
  // Native profile failures previously let the full-main smoke skip this initialization.
  expect(() =>
    environment.context.exports[factory]({ apiOrigin: 'https://api.example.test' })
  ).not.toThrow()
})

function mainEnvironment(): {
  context: ReturnType<typeof createContext>
  bootstrap: () => Promise<void> | undefined
  error: ReturnType<typeof vi.fn>
  getPath: ReturnType<typeof vi.fn>
} {
  let bootstrap: Promise<void> | undefined
  const error = vi.fn()
  const getPath = vi.fn(() => resolve('synthetic-app-data'))
  const session = {
    setPermissionCheckHandler: vi.fn(),
    setPermissionRequestHandler: vi.fn(),
    setDisplayMediaRequestHandler: vi.fn(),
    webRequest: { onBeforeRequest: vi.fn() }
  }
  const electron = {
    app: {
      getPath,
      setPath: vi.fn(),
      setName: vi.fn(),
      on: vi.fn(),
      quit: vi.fn(),
      exit: vi.fn(),
      whenReady: () => ({
        then: (start: () => void | Promise<void>): Promise<void> => {
          bootstrap = Promise.resolve().then(start)
          return bootstrap
        }
      })
    },
    BrowserWindow: class {
      static getAllWindows(): never[] {
        return []
      }
      on = vi.fn()
      show = vi.fn()
      destroy = vi.fn()
      isDestroyed = (): boolean => false
      loadFile = vi.fn().mockResolvedValue(undefined)
      loadURL = vi.fn().mockResolvedValue(undefined)
      webContents = {
        mainFrame: { url: '', isDestroyed: () => false },
        isDestroyed: () => false,
        session,
        on: vi.fn(),
        send: vi.fn(),
        setWindowOpenHandler: vi.fn()
      }
    },
    ipcMain: { handle: vi.fn(), removeHandler: vi.fn() },
    desktopCapturer: { getSources: vi.fn() },
    session: { defaultSession: session },
    Menu: { buildFromTemplate: vi.fn(), setApplicationMenu: vi.fn() },
    systemPreferences: { getMediaAccessStatus: () => 'granted' }
  }
  const requireModule = (name: string): unknown => {
    const isElectron = name === 'electron'
    if (isElectron) {
      return electron
    }
    const isToolkit = name === '@electron-toolkit/utils'
    if (isToolkit) {
      return {
        electronApp: { setAppUserModelId: vi.fn() },
        optimizer: { watchWindowShortcuts: vi.fn() },
        is: { dev: false }
      }
    }
    if (name === 'koffi') {
      return {
        ...requireDependency(name),
        load: (): never => {
          throw new Error('Synthetic native module unavailable')
        }
      }
    }
    // Ky와 다른 Node dependency는 mock하지 않고 설치된 package를 CJS로 읽는다.
    return requireDependency(name)
  }
  const context = createContext({
    require: requireModule,
    exports: {},
    Buffer,
    URL,
    Request,
    Response,
    AbortController,
    TextEncoder,
    TextDecoder,
    performance,
    setTimeout,
    clearTimeout,
    __dirname: resolve('out/auth-capture-fixture/main'),
    process: {
      ppid: 424242,
      platform: process.platform,
      argv: ['electron', 'synthetic-main.cjs'],
      env: {
        DFRAGON_AUTH_CAPTURE_PROFILE: join(tmpdir(), 'dfragon-auth-capture-fixture-unit01'),
        DFRAGON_AUTH_CAPTURE_LAUNCHER_PID: '424242'
      }
    },
    console: { log: vi.fn(), error, warn: vi.fn() }
  })
  return { context, bootstrap: () => bootstrap, error, getPath }
}

it.each([
  ['electron.vite.config.ts', 'production'],
  ['scripts/auth-capture-fixture.config.ts', 'production'],
  ['electron.vite.config.ts', 'dfragon-development']
])('%s의 %s main bundle은 기존 composition을 초기화할 수 있다', async (configFile, mode) => {
  const resolved = await resolveConfig({ configFile, logLevel: 'silent' }, 'build', mode)
  const main = resolved.config?.main
  expect(main).toBeDefined()
  const output = await build({
    ...main,
    logLevel: 'silent',
    build: { ...main!.build, write: false }
  })
  const isOutputArray = Array.isArray(output)
  const bundles = isOutputArray ? output : [output]
  const chunks: string[] = []
  for (const bundle of bundles) {
    const hasOutput = 'output' in bundle
    if (!hasOutput) {
      throw new Error('Expected completed main build')
    }
    for (const item of bundle.output) {
      const isChunk = item.type === 'chunk'
      if (isChunk) {
        chunks.push(item.code)
      }
    }
  }
  expect(chunks).toHaveLength(1)
  const environment = mainEnvironment()
  if (mode === 'dfragon-development') {
    // Exercise the built-in tuple on an OS-style cold launch without auth env vars.
    // This isolated bundle has no Win32 module; native loading must fail before profile IO.
    environment.context.process.platform = 'win32'
    environment.context.process.env = {}
  }
  environment.context.__dirname = dirname(resolve(main!.build!.outDir!, 'main.cjs'))
  runInContext(chunks[0], environment.context)
  let failure: string | null = null
  try {
    await environment.bootstrap()
  } catch (error) {
    // VM의 다른 realm Error도 고정된 초기화 실패 원인으로 비교한다. Stack은 기록하지 않는다.
    failure = String(error)
  }
  expect(failure).toBeNull()
  expect(environment.error).not.toHaveBeenCalled()
  if (mode === 'dfragon-development') {
    expect(environment.getPath).toHaveBeenCalledExactlyOnceWith('appData')
  } else {
    expect(environment.getPath).not.toHaveBeenCalled()
  }
})
