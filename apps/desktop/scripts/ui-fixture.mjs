import { app, BrowserWindow, ipcMain, nativeTheme, session } from 'electron'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const mode = process.argv[2] ?? 'desktop'
const theme = process.argv[3] ?? 'system'
const isModeValid = ['desktop', 'example', 'mvp'].includes(mode)
const isThemeValid = ['system', 'light', 'dark'].includes(theme)
const isInputInvalid = !isModeValid || !isThemeValid
if (isInputInvalid) {
  throw new Error('Use desktop|example|mvp and system|light|dark')
}

const previewDocument = new URL('../out/frontend/mvp-preview.html', import.meta.url)
const devRendererUrl = process.env['LDB_MVP_RENDERER_URL']
if (mode === 'mvp' && devRendererUrl != null) {
  const url = new URL(devRendererUrl)
  if (url.protocol !== 'http:' || url.hostname !== '127.0.0.1' || url.username || url.password) {
    throw new Error('MVP development renderer must use a loopback HTTP server')
  }
  previewDocument.href = new URL('/mvp-preview.html', url).href
}

const userData = mkdtempSync(join(tmpdir(), 'ldb-ui-fixture-'))
app.setPath('userData', userData)
app.setName('LDB UI fixture')
nativeTheme.themeSource = theme
app.on('window-all-closed', () => app.quit())
app.on('quit', () => rmSync(userData, { recursive: true, force: true }))

app.whenReady().then(async () => {
  session.defaultSession.setPermissionCheckHandler(() => false)
  session.defaultSession.setPermissionRequestHandler((_contents, _permission, callback) =>
    callback(false)
  )

  const window = new BrowserWindow({
    title: `LDB UI fixture — ${mode} · ${theme}`,
    width: mode === 'mvp' ? 900 : 1100,
    height: mode === 'mvp' ? 600 : 800,
    show: false,
    webPreferences: {
      preload: fileURLToPath(
        new URL('../node_modules/.tmp/ui-fixture/ui-fixture-preload.cjs', import.meta.url)
      ),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false
    }
  })
  window.on('page-title-updated', (event) => event.preventDefault())
  window.webContents.setWindowOpenHandler(({ url }) => {
    const requested = new URL(url)
    const allowed = previewDocument
    const isPreviewDetail =
      mode === 'mvp' &&
      requested.protocol === allowed.protocol &&
      requested.host === allowed.host &&
      requested.pathname === allowed.pathname &&
      requested.searchParams.get('detail') === 'sample'
    if (!isPreviewDetail) {
      return { action: 'deny' }
    }
    return {
      action: 'allow',
      overrideBrowserWindowOptions: {
        show: true,
        width: 1120,
        height: 680,
        useContentSize: true,
        webPreferences: { contextIsolation: true, sandbox: true, nodeIntegration: false }
      }
    }
  })
  window.webContents.on('did-create-window', (child) => {
    child.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
    child.webContents.once('did-finish-load', () => {
      child.webContents.on('will-navigate', (event) => event.preventDefault())
    })
    const closeChild = child.destroy.bind(child)
    window.once('closed', closeChild)
    child.once('closed', () => window.removeListener('closed', closeChild))
  })

  const isolated = new Promise((resolve, reject) => {
    const deadline = setTimeout(
      () => reject(new Error('UI fixture isolation was not confirmed')),
      5000
    )
    ipcMain.once('ui-fixture-ready', (event) => {
      const isExpectedRenderer = event.sender === window.webContents
      if (!isExpectedRenderer) {
        return
      }
      clearTimeout(deadline)
      resolve()
    })
  })
  const isExample = mode === 'example'
  const target = isExample
    ? new URL('../../../packages/ui/dist-examples/index.html', import.meta.url)
    : new URL(
        mode === 'mvp' ? '../out/frontend/mvp-preview.html' : '../out/frontend/index.html',
        import.meta.url
      )

  try {
    const load =
      mode === 'mvp' && devRendererUrl != null
        ? window.loadURL(`${previewDocument.href}?theme=${theme}`)
        : window.loadFile(fileURLToPath(target), { query: { theme } })
    await Promise.all([load, isolated])
    window.show()
    console.log(`UI fixture ready: ${mode}, ${theme}; native media disabled`)
  } catch (error) {
    window.destroy()
    app.quit()
    throw error
  }
})
