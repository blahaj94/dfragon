import type { Configuration } from 'electron-builder'
import { channels, type Channel, type ChannelName } from './channels'

// NSIS registers the Windows protocol through the channel's include; this declaration covers macOS.
function readProtocolDeclaration(
  packaging: Channel['packaging'],
  identity: Channel['identity']
): Pick<Configuration, 'protocols'> {
  const { auth } = identity
  if (packaging.protocolName == null || auth == null) {
    return {}
  }
  const scheme = new URL(auth.returnTarget).protocol.slice(0, -1)

  return { protocols: [{ name: packaging.protocolName, schemes: [scheme] }] }
}

// NSIS registers the protocol through this include, not the top-level protocols option.
function readInstallerInclude(
  packaging: Channel['packaging']
): Pick<NonNullable<Configuration['nsis']>, 'include'> {
  if (packaging.installerInclude == null) {
    return {}
  }

  return { include: packaging.installerInclude }
}

/**
 * channels.json의 채널 하나로 electron-builder 설정을 만든다.
 * 채널과 무관한 packaging 정책은 여기 한 곳에 두고, 진입 파일은 채널만 고른다.
 */
export function createBuilderConfig(name: ChannelName): Configuration {
  const { packaging, identity } = channels[name]
  const protocolDeclaration = readProtocolDeclaration(packaging, identity)
  const installerInclude = readInstallerInclude(packaging)
  // 파일명은 공백 없는 접두어가 필요한 채널만 따로 정하고, 나머지는 electron-builder가 앱 이름으로 채운다.
  const artifactPrefix = packaging.artifactPrefix ?? '${productName}'

  return {
    appId: identity.appIdentity,
    productName: packaging.productName,
    extraMetadata: { name: packaging.packageName },
    directories: { buildResources: 'build', output: packaging.output },
    ...protocolDeclaration,
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
