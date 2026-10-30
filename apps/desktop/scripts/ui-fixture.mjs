import { app, BrowserWindow, ipcMain, nativeTheme, session } from 'electron'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

// Debug launchers such as Playwright insert Electron flags before the entry script.
const entryIndex = process.argv.findIndex(
  (argument) => resolve(argument) === fileURLToPath(import.meta.url)
)
const fixtureArguments = process.argv.slice(entryIndex + 1)
const mode = fixtureArguments[0] ?? 'desktop'
const theme = fixtureArguments[1] ?? 'system'
const MVP_MODE = 'mvp'
const isMvp = mode === MVP_MODE
const isModeValid = ['desktop', 'example', MVP_MODE].includes(mode)
const isThemeValid = ['system', 'light', 'dark'].includes(theme)
const isInputInvalid = !isModeValid || !isThemeValid
if (isInputInvalid) {
  throw new Error(`Use desktop|example|${MVP_MODE} and system|light|dark`)
}

const previewDocument = new URL('../out/frontend/mvp-preview.html', import.meta.url)
const devRendererUrl = process.env['DFRAGON_MVP_RENDERER_URL']
if (isMvp && devRendererUrl != null) {
  const url = new URL(devRendererUrl)
  if (url.protocol !== 'http:' || url.hostname !== '127.0.0.1' || url.username || url.password) {
    throw new Error('MVP development renderer must use a loopback HTTP server')
  }
  previewDocument.href = new URL('/mvp-preview.html', url).href
}

const userData = mkdtempSync(join(tmpdir(), 'dfragon-ui-fixture-'))
app.setPath('userData', userData)
app.setName('던삐삐 UI fixture')
nativeTheme.themeSource = theme
app.on('window-all-closed', () => app.quit())
app.on('quit', () => rmSync(userData, { recursive: true, force: true }))

app.whenReady().then(async () => {
  session.defaultSession.setPermissionCheckHandler(() => false)
  session.defaultSession.setPermissionRequestHandler((_contents, _permission, callback) =>
    callback(false)
  )

  const title = `던삐삐 UI fixture — ${mode}, ${theme}`
  const width = isMvp ? 900 : 1100
  const height = isMvp ? 600 : 800
  const window = new BrowserWindow({
    title,
    width,
    height,
    show: false,
    webPreferences: {
      preload: fileURLToPath(
        new URL('../node_modules/.tmp/ui-fixture/scripts/ui-fixture-preload.cjs', import.meta.url)
      ),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false
    }
  })
  window.on('page-title-updated', (event) => event.preventDefault())
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))

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
  let target
  if (isExample) {
    target = new URL('../../../packages/ui/dist-examples/index.html', import.meta.url)
  } else {
    const path = isMvp ? '../out/frontend/mvp-preview.html' : '../out/frontend/index.html'
    target = new URL(path, import.meta.url)
  }

  try {
    const load =
      isMvp && devRendererUrl != null
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
