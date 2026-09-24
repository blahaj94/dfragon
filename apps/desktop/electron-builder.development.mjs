import development from './build/development-auth.json' with { type: 'json' }

/** @type {import('electron-builder').Configuration} */
export default {
  extends: './electron-builder.yml',
  appId: development.appIdentity,
  productName: 'DFRAGON Development',
  extraMetadata: { name: '@dfragon/desktop' },
  directories: { output: 'dist/development' },
  protocols: [
    {
      name: 'DFRAGON development login',
      schemes: [new URL(development.returnTarget).protocol.slice(0, -1)]
    }
  ],
  win: {
    executableName: 'dfragon-dev'
  },
  nsis: {
    perMachine: false,
    runAfterFinish: false,
    include: 'build/development-installer.nsh'
  },
  publish: null
}
