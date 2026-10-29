declare global {
  interface Window {
    api: typeof import('./api/capture')
    search: typeof import('./api/search')
    raidSearch: typeof import('./api/raid-search')
    desktopShortcut: typeof import('./api/desktop-shortcut')
    diagnostics: typeof import('./api/diagnostics')
    updateNotice: typeof import('./api/update-notice')
    todayGrade: typeof import('./api/today-grade')
    windowChrome: typeof import('./api/window-chrome')
  }
}

export {}
