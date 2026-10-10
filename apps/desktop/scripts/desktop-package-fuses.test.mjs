import { createRequire } from 'node:module'
import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import channels from '../build/channels.json' with { type: 'json' }

const require = createRequire(new URL('../package.json', import.meta.url))
const electronBuilderEntry = require.resolve('electron-builder')
const electronBuilderPackageDir = dirname(dirname(electronBuilderEntry))
const appBuilderConfigModulePath = join(
  dirname(electronBuilderPackageDir),
  'app-builder-lib',
  'out',
  'util',
  'config',
  'config.js'
)

const desktopProjectDir = fileURLToPath(new URL('..', import.meta.url))
const debugLogger = {
  isEnabled: false,
  add: () => undefined
}

// electron-builder.ts는 DFRAGON_CHANNEL로 채널을 고르므로 실행 환경의 값과 무관하게 배포 채널을 읽는다.
beforeAll(() => {
  vi.stubEnv('DFRAGON_CHANNEL', '')
})
afterAll(() => {
  vi.unstubAllEnvs()
})

// NSIS는 줄 단위 명령이다. 따옴표 안의 실행 명령은 보존하고 들여쓰기, 주석만 제외한다.
function readNsisStatements(source) {
  return source.split(/\r?\n/).flatMap((line) => {
    const tokens = line.match(/"[^"]*"|'[^']*'|`[^`]*`|;.*$|[^\s;]+/g) ?? []
    const statement = tokens.filter((token) => !token.startsWith(';'))
    if (statement.length === 0) {
      return []
    }

    return [statement]
  })
}

describe('desktop package fuse configuration', () => {
  it.each([
    ['development', 'dfragon.dev'],
    ['distribution', 'dfragon']
  ])('%s installer는 scheme 정의 뒤 legacy cleanup만 include한다', async (channel, scheme) => {
    const source = await readFile(join(desktopProjectDir, `build/${channel}-installer.nsh`), 'utf8')
    const includeLine = '!include "${BUILD_RESOURCES_DIR}\\legacy-protocol-cleanup.nsh"'
    expect(source.split(/\r?\n/)).toContain(includeLine)
    expect(readNsisStatements(source)).toEqual([
      ['!define', 'DFRAGON_LEGACY_PROTOCOL_SCHEME', `"${scheme}"`],
      ['!include', '"${BUILD_RESOURCES_DIR}\\legacy-protocol-cleanup.nsh"']
    ])
  })

  it('NSIS cleanup은 실행 명령이 일치하는 HKCU 키만 지우고 두 hook에서 호출한다', async () => {
    const source = await readFile(
      join(desktopProjectDir, 'build/legacy-protocol-cleanup.nsh'),
      'utf8'
    )
    const statements = readNsisStatements(source)
    const key = '"${DFRAGON_LEGACY_PROTOCOL_KEY}"'
    const command = '\'"$INSTDIR\\${APP_EXECUTABLE_FILENAME}" "%1"\''
    const definitions = []
    const macros = new Map()
    let current = definitions
    for (const statement of statements) {
      const [instruction, name] = statement
      if (instruction === '!macro') {
        expect(current).toBe(definitions)
        expect(macros.has(name)).toBe(false)
        current = []
        macros.set(name, current)
      } else if (instruction === '!macroend') {
        expect(current).not.toBe(definitions)
        current = definitions
      } else {
        current.push(statement)
      }
    }
    expect(current).toBe(definitions)
    expect(definitions).toHaveLength(2)
    expect(definitions).toEqual(
      expect.arrayContaining([
        [
          '!define',
          'DFRAGON_LEGACY_PROTOCOL_KEY',
          '"Software\\Classes\\${DFRAGON_LEGACY_PROTOCOL_SCHEME}"'
        ],
        ['!define', 'DFRAGON_LEGACY_PROTOCOL_COMMAND', command]
      ])
    )
    expect([...macros.keys()].sort()).toEqual([
      'cleanupDfragonLegacyProtocol',
      'customInstall',
      'customUnInstall'
    ])
    const cleanup = macros.get('cleanupDfragonLegacyProtocol')
    // ReadRegStr의 목적 레지스터 이름은 계약이 아니며, 읽은 값과 비교한 값이 같아야 한다.
    const register = cleanup?.[0]?.[1]
    expect(register).toMatch(/^\$(?:R[0-9]|[0-9])$/)
    expect(cleanup).toEqual([
      [
        'ReadRegStr',
        register,
        'HKCU',
        '"${DFRAGON_LEGACY_PROTOCOL_KEY}\\shell\\open\\command"',
        '""'
      ],
      ['${If}', register, '==', "'${DFRAGON_LEGACY_PROTOCOL_COMMAND}'"],
      ['DeleteRegKey', 'HKCU', key],
      ['${EndIf}']
    ])
    for (const hook of ['customInstall', 'customUnInstall']) {
      expect(macros.get(hook)).toEqual([['!insertmacro', 'cleanupDfragonLegacyProtocol']])
    }
  })

  it('loads and validates the packaging configuration with app-builder-lib', async () => {
    const { getConfig, validateConfiguration } = await import(
      pathToFileURL(appBuilderConfigModulePath).href
    )
    const configuration = await getConfig(desktopProjectDir, null, null)

    await validateConfiguration(configuration, debugLogger)

    expect(configuration.electronFuses).toEqual({
      enableNodeOptionsEnvironmentVariable: false,
      enableNodeCliInspectArguments: false
    })
  })

  it('keeps effective production and development installer identities separate with publishing disabled', async () => {
    const { getConfig, validateConfiguration } = await import(
      pathToFileURL(appBuilderConfigModulePath).href
    )
    const productionConfig = await getConfig(desktopProjectDir, null, null)
    const developmentConfig = await getConfig(
      desktopProjectDir,
      'electron-builder.development.ts',
      null
    )
    await validateConfiguration(developmentConfig, debugLogger)

    for (const [config, channel] of [
      [productionConfig, channels.distribution],
      [developmentConfig, channels.development]
    ]) {
      expect(config.appId).toBe(channel.identity.appIdentity)
      expect(config.productName).toBe(channel.packaging.productName)
      expect(config.win.executableName).toBe(channel.packaging.executableName)
      expect(config.extraMetadata.name).toBe(channel.packaging.packageName)
      expect(config.nsis.include).toBe(channel.packaging.installerInclude)
      expect(config.directories.output).toBe(channel.packaging.output)
      expect(config.protocols).toBeUndefined()
      expect(config.publish).toBeNull()
      expect(config.win.target).toEqual([{ target: 'nsis', arch: ['x64'] }])
    }
    expect(productionConfig.nsis.oneClick).toBe(true)
    expect(productionConfig.protocols).toBeUndefined()
    expect(developmentConfig.nsis.oneClick).toBe(true)
    expect(productionConfig.appId).not.toBe(developmentConfig.appId)
    expect(productionConfig.win.executableName).not.toBe(developmentConfig.win.executableName)
  })

  it('test 채널 진입 파일은 로그인 protocol과 NSIS include 없이 test identity로 패키징한다', async () => {
    const { getConfig, validateConfiguration } = await import(
      pathToFileURL(appBuilderConfigModulePath).href
    )
    const testConfig = await getConfig(desktopProjectDir, 'electron-builder.test-channel.ts', null)
    await validateConfiguration(testConfig, debugLogger)

    expect(testConfig.appId).toBe(channels.test.identity.appIdentity)
    expect(testConfig.productName).toBe(channels.test.packaging.productName)
    expect(testConfig.win.executableName).toBe(channels.test.packaging.executableName)
    expect(testConfig.directories.output).toBe(channels.test.packaging.output)
    expect(testConfig.protocols).toBeUndefined()
    expect(testConfig.nsis).not.toHaveProperty('include')
    expect(testConfig.publish).toBeNull()
    expect(testConfig.electronFuses).toEqual({
      enableNodeOptionsEnvironmentVariable: false,
      enableNodeCliInspectArguments: false
    })
  })
})
