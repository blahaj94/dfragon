import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { expect, it } from 'vitest'
import { channels, type ChannelName } from './channels'
import { createBuilderConfig } from './electron-builder-config'

const CHANNEL_NAMES: readonly ChannelName[] = ['development', 'test', 'distribution']

const require = createRequire(new URL('../package.json', import.meta.url))
const electronBuilderPackageDir = dirname(dirname(require.resolve('electron-builder')))
const appBuilderConfigModulePath = join(
  dirname(electronBuilderPackageDir),
  'app-builder-lib',
  'out',
  'util',
  'config',
  'config.js'
)
const debugLogger = { isEnabled: false, add: () => undefined }

it.each(CHANNEL_NAMES)(
  '%s 채널 설정은 electron-builder schema를 통과하고 channels.json의 packaging 값을 쓴다',
  async (name) => {
    const { validateConfiguration } = await import(pathToFileURL(appBuilderConfigModulePath).href)
    const configuration = createBuilderConfig(name)
    const { packaging, identity } = channels[name]

    await validateConfiguration(configuration, debugLogger)
    expect(configuration.appId).toBe(identity.appIdentity)
    expect(configuration.productName).toBe(packaging.productName)
    expect(configuration.extraMetadata).toEqual({ name: packaging.packageName })
    expect(configuration.directories).toEqual({ buildResources: 'build', output: packaging.output })
    expect(configuration.win?.executableName).toBe(packaging.executableName)
    expect(configuration.publish).toBeNull()
    expect(configuration.protocols).toBeUndefined()
  }
)

it('설치형 배포, 개발 채널은 legacy cleanup NSIS include와 영문 파일명 접두어를 쓴다', () => {
  const development = createBuilderConfig('development')
  expect(development.nsis?.include).toBe('build/development-installer.nsh')
  expect(development.nsis?.artifactName).toBe('DFragon Development-${version}-${arch}-setup.${ext}')

  const distribution = createBuilderConfig('distribution')
  expect(distribution.nsis?.include).toBe('build/distribution-installer.nsh')
  expect(distribution.protocols).toBeUndefined()
  // Release workflow의 glob과 README가 이 파일명 형식에 의존한다.
  expect(distribution.portable?.artifactName).toBe('DFragon-${version}-${arch}-portable.${ext}')
  expect(distribution.nsis?.artifactName).toBe('DFragon-${version}-${arch}-setup.${ext}')
})

it('test 채널은 protocol과 NSIS include 없이 공백 없는 파일명 접두어를 쓴다', () => {
  const test = createBuilderConfig('test')
  expect(test.protocols).toBeUndefined()
  expect(test.nsis).not.toHaveProperty('include')
  // Windows Test Build workflow의 glob이 이 접두어에 의존한다.
  expect(test.portable?.artifactName).toBe('DFragon-Test-${version}-${arch}-portable.${ext}')
  expect(test.nsis?.artifactName).toBe('DFragon-Test-${version}-${arch}-setup.${ext}')
  expect(test.electronFuses).toEqual({
    enableNodeOptionsEnvironmentVariable: false,
    enableNodeCliInspectArguments: false
  })
})
