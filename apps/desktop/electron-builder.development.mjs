import channels from './build/channels.json' with { type: 'json' }

const { packaging, identity } = channels.development

/** @type {import('electron-builder').Configuration} */
export default {
  extends: './electron-builder.yml',
  appId: identity.appIdentity,
  productName: packaging.productName,
  extraMetadata: { name: packaging.packageName },
  directories: { output: packaging.output },
  protocols: [
    {
      name: 'DFragon development login',
      schemes: [new URL(identity.returnTarget).protocol.slice(0, -1)]
    }
  ],
  win: {
    executableName: packaging.executableName
  },
  nsis: {
    perMachine: false,
    runAfterFinish: false,
    include: packaging.installerInclude
  },
  publish: null
}
