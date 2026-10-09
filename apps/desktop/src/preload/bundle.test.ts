import { runInNewContext } from 'node:vm'
import { build, normalizePath } from 'vite'
import { resolve } from 'node:path'
import { resolveConfig } from 'electron-vite'
import { expect, it, vi } from 'vitest'
import { AUTH_AVAILABLE_ARGUMENT } from './common/types/auth'

it('electron.vite.config.ts의 실제 preload 산출물은 외부 package require 없이 feature API를 노출한다', async () => {
  const resolved = await resolveConfig(
    { configFile: 'electron.vite.config.ts', logLevel: 'silent' },
    'build',
    'production'
  )
  const preload = resolved.config?.preload
  expect(preload).toBeDefined()
  const modules = new Set<string>()
  const output = await build({
    ...preload,
    logLevel: 'silent',
    plugins: [
      ...(preload?.plugins ?? []),
      {
        name: 'observe-preload-source-dependencies',
        generateBundle(): void {
          for (const id of this.getModuleIds()) {
            modules.add(normalizePath(id))
          }
        }
      }
    ],
    build: { ...preload!.build, write: false }
  })
  // 로컬 dist가 남아 있어도 CI의 깨끗한 checkout과 같은 소스 의존성을 요구한다.
  expect(modules.has(normalizePath(resolve('../../packages/lib/src/index.ts')))).toBe(true)
  const libraryBuild = normalizePath(resolve('../../packages/lib/dist')) + '/'
  expect([...modules].some((id) => id.startsWith(libraryBuild))).toBe(false)
  const isOutputArray = Array.isArray(output)
  const bundles = isOutputArray ? output : [output]
  const chunks = new Map<string, string>()
  for (const bundle of bundles) {
    const hasOutput = 'output' in bundle
    if (!hasOutput) {
      throw new Error('Expected completed preload build')
    }
    for (const item of bundle.output) {
      const isChunk = item.type === 'chunk'
      if (isChunk) {
        chunks.set(item.fileName, item.code)
      }
    }
  }
  expect([...chunks.keys()].sort()).toEqual(['character-detail.js', 'index.js'])
  const expose = vi.fn()
  // Native sandbox 전체 대신 이 preload가 필요로 하는 require 경계와 실행을 검사한다.
  const requireModule = (name: string): unknown => {
    const isElectron = name === 'electron'
    if (!isElectron) {
      throw new Error(`Sandbox preload cannot require ${name}`)
    }

    const invoke = vi.fn()
    const on = vi.fn()
    const removeListener = vi.fn()

    return {
      contextBridge: { exposeInMainWorld: expose },
      ipcRenderer: { invoke, on, removeListener }
    }
  }
  const runPreload = (code: string, argv: string[]): string[] => {
    expose.mockClear()
    expect(() =>
      runInNewContext(code, { require: requireModule, exports: {}, process: { argv } })
    ).not.toThrow()

    return expose.mock.calls.map(([name]) => name)
  }
  const mainApis = [
    'api',
    'auth',
    'search',
    'manualSearch',
    'developer',
    'versions',
    'desktopShortcut',
    'ocrCollection',
    'diagnostics',
    'updateNotice'
  ]
  for (const [fileName, code] of chunks) {
    const exposedApis = runPreload(code, ['electron', AUTH_AVAILABLE_ARGUMENT])
    const expectedApis = fileName === 'character-detail.js' ? ['characterDetail'] : mainApis
    expect(exposedApis).toEqual(expectedApis)
    if (fileName === 'character-detail.js') {
      expect(Object.keys(expose.mock.calls[0][1])).toEqual(['read'])
    }
  }
  // 로그인 설정이 없는 main은 인증 IPC를 등록하지 않고 인자도 넘기지 않는다.
  const withoutAuth = runPreload(chunks.get('index.js')!, ['electron'])
  expect(withoutAuth).toEqual(mainApis.filter((name) => name !== 'auth'))
})
