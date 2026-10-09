declare global {
  interface Window {
    api: typeof import('./api/capture')
    auth?: typeof import('./api/auth')
    search: typeof import('./api/search')
    manualSearch: typeof import('./api/manual-search')
    developer: typeof import('./api/developer')
    versions: typeof import('./api/versions')
    desktopShortcut: typeof import('./api/desktop-shortcut')
    ocrCollection: typeof import('./api/ocr-collection')
    diagnostics: typeof import('./api/diagnostics')
    updateNotice: typeof import('./api/update-notice')
  }
}

export {}
