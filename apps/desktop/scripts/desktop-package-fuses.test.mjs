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

describe('desktop package fuse configuration', () => {
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
      const installer = await readFile(join(desktopProjectDir, config.nsis.include), 'utf8')
      expect(installer).toContain(
        `!define DFRAGON_PROTOCOL_SCHEME "${new URL(channel.identity.auth.returnTarget).protocol.slice(0, -1)}"`
      )
      expect(config.publish).toBeNull()
      expect(config.win.target).toEqual([{ target: 'nsis', arch: ['x64'] }])
    }
    expect(productionConfig.nsis.oneClick).toBe(true)
    expect(productionConfig.protocols).toBeUndefined()
    expect(developmentConfig.protocols).toEqual([
      { name: 'DFragon development login', schemes: ['dfragon.dev'] }
    ])
    expect(developmentConfig.nsis.oneClick).toBe(true)
    expect(productionConfig.appId).not.toBe(developmentConfig.appId)
    expect(productionConfig.win.executableName).not.toBe(developmentConfig.win.executableName)
  })
})
