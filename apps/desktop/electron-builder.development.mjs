import development from './build/development-auth.json' with { type: 'json' }

/** @type {import('electron-builder').Configuration} */
export default {
  extends: './electron-builder.yml',
  appId: development.appIdentity,
  productName: 'LDB Development',
  directories: { output: 'dist/development' },
  protocols: [
    {
      name: 'LDB development login',
      schemes: [new URL(development.returnTarget).protocol.slice(0, -1)]
    }
  ],
  win: {
    executableName: 'ldb-dev',
    target: [{ target: 'nsis', arch: ['x64'] }]
  },
  nsis: { perMachine: false, runAfterFinish: false },
  publish: null
}
