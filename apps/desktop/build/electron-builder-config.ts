import type { Configuration } from 'electron-builder'
import { channels, type Channel, type ChannelName } from './channels'

function readInstallerInclude(
  packaging: Channel['packaging']
): Pick<NonNullable<Configuration['nsis']>, 'include'> {
  if (packaging.installerInclude == null) {
    return {}
  }

  return { include: packaging.installerInclude }
}

export function createBuilderConfig(name: ChannelName): Configuration {
  const { packaging, identity } = channels[name]
  const installerInclude = readInstallerInclude(packaging)
  const artifactPrefix = packaging.artifactPrefix ?? '${productName}'

  return {
    appId: identity.appIdentity,
    productName: packaging.productName,
    extraMetadata: { name: packaging.packageName },
    directories: { buildResources: 'build', output: packaging.output },
    files: [
      'out/**',
      'resources/**',
      'package.json',
      '!**/{.env,.env.*,.npmrc,*.pem,*.key,*.pfx,*.p12}',
      // The renderer bundles onnxruntime-web and loads its WASM from out/frontend/ocr/ort, so the
      // installed package is never read at runtime. Leaving it out keeps about 138MB out of app.asar.
      '!node_modules/onnxruntime-web/**'
    ],
    asarUnpack: ['resources/**'],
    win: {
      executableName: packaging.executableName,
      requestedExecutionLevel: 'requireAdministrator',
      target: [{ target: 'nsis', arch: ['x64'] }]
    },
    nsis: {
      language: '1042',
      oneClick: true,
      artifactName: `${artifactPrefix}-\${version}-\${arch}-setup.\${ext}`,
      shortcutName: '${productName}',
      uninstallDisplayName: '${productName}',
      createDesktopShortcut: 'always',
      perMachine: false,
      runAfterFinish: false,
      ...installerInclude
    },
    portable: {
      artifactName: `${artifactPrefix}-\${version}-\${arch}-portable.\${ext}`,
      requestExecutionLevel: 'admin'
    },
    mac: {
      entitlementsInherit: 'build/entitlements.mac.plist',
      extendInfo: [
        { NSCameraUsageDescription: "Application requests access to the device's camera." },
        { NSMicrophoneUsageDescription: "Application requests access to the device's microphone." },
        {
          NSDocumentsFolderUsageDescription:
            "Application requests access to the user's Documents folder."
        },
        {
          NSDownloadsFolderUsageDescription:
            "Application requests access to the user's Downloads folder."
        }
      ],
      notarize: false
    },
    dmg: { artifactName: `${artifactPrefix}-\${version}.\${ext}` },
    linux: {
      target: ['AppImage', 'snap', 'deb'],
      maintainer: 'electronjs.org',
      category: 'Utility'
    },
    appImage: { artifactName: `${artifactPrefix}-\${version}.\${ext}` },
    npmRebuild: false,
    electronFuses: {
      enableNodeOptionsEnvironmentVariable: false,
      enableNodeCliInspectArguments: false
    },
    publish: null
  }
}
