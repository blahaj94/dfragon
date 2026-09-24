import { createRequire } from 'node:module'
import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { describe, expect, it } from 'vitest'
import distribution from '../build/distribution-auth.json' with { type: 'json' }
import development from '../build/development-auth.json' with { type: 'json' }

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
      'electron-builder.development.mjs',
      null
    )
    await validateConfiguration(developmentConfig, debugLogger)

    for (const [config, auth] of [
      [productionConfig, distribution],
      [developmentConfig, development]
    ]) {
      expect(config.appId).toBe(auth.appIdentity)
      const installer = await readFile(join(desktopProjectDir, config.nsis.include), 'utf8')
      expect(installer).toContain(
        `!define DFRAGON_PROTOCOL_SCHEME "${new URL(auth.returnTarget).protocol.slice(0, -1)}"`
      )
      expect(config.publish).toBeNull()
      expect(config.win.target).toEqual([{ target: 'nsis', arch: ['x64'] }])
    }
    expect(productionConfig.nsis.oneClick).toBe(true)
    expect(productionConfig.extraMetadata.name).toBe('dfragon')
    expect(developmentConfig.extraMetadata.name).toBe('@dfragon/desktop')
    expect(developmentConfig.protocols).toEqual([
      { name: 'DFRAGON development login', schemes: ['dfragon.dev'] }
    ])
    expect(developmentConfig.nsis.oneClick).toBe(true)
    expect(productionConfig.nsis.include).toBe('build/distribution-installer.nsh')
    expect(developmentConfig.nsis.include).toBe('build/development-installer.nsh')
    expect(productionConfig.appId).not.toBe(developmentConfig.appId)
    expect(productionConfig.win.executableName).not.toBe(developmentConfig.win.executableName)
  })
})
