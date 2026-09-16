import { EventEmitter } from 'node:events'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createAuthBrowser } from './browser-window'
import type { AuthBrowser } from './types'

const electron = vi.hoisted(() => ({ BrowserWindow: vi.fn(), fromPartition: vi.fn() }))
vi.mock('electron', () => ({
  BrowserWindow: electron.BrowserWindow,
  session: { fromPartition: electron.fromPartition }
}))
const origin = 'https://api.synthetic.test'
const target = 'ldb.dev://auth/callback'
const url = `${origin}/auth/login/authorize?ticket=synthetic`
class TestWindow extends EventEmitter {
  destroyed = false
  webContents = Object.assign(new EventEmitter(), { setWindowOpenHandler: vi.fn() })
  loadURL = vi.fn(async () => undefined)
  show = vi.fn()
  focus = vi.fn()
  isDestroyed = (): boolean => this.destroyed
  close = (): void => {
    this.destroyed = true
    this.emit('closed')
  }
}
class TestSession extends EventEmitter {
  setPermissionRequestHandler = vi.fn()
  setPermissionCheckHandler = vi.fn()
  webRequest = { onBeforeRequest: vi.fn() }
  clearStorageData = vi.fn(async () => undefined)
}
type Login = NonNullable<Parameters<AuthBrowser['open']>[1]>
function fixture(): {
  window: TestWindow
  session: TestSession
  controller: AbortController
  activate: ReturnType<typeof vi.fn<() => void>>
  login: Login
  browser: AuthBrowser
} {
  const window = new TestWindow(),
    session = new TestSession(),
    controller = new AbortController()
  electron.BrowserWindow.mockImplementation(function () {
    return window
  })
  electron.fromPartition.mockReturnValue(session)
  const activate = vi.fn<() => void>()
  const login: NonNullable<Parameters<AuthBrowser['open']>[1]> = {
    signal: controller.signal,
    onClosed: vi.fn(),
    onReturn: vi.fn(async (_url, onClaimed) => onClaimed())
  }
  return {
    window,
    session,
    controller,
    activate,
    login,
    browser: createAuthBrowser(origin, target, activate)
  }
}
beforeEach(() => vi.clearAllMocks())
describe('isolated authentication window', () => {
  it('has no preload, persistent partition or native privileges; rejects external resources and popups', async () => {
    const f = fixture()
    await f.browser.open(url, f.login)
    const options = electron.BrowserWindow.mock.calls[0][0]
    expect(options.webPreferences).toEqual({
      session: f.session,
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      webviewTag: false,
      devTools: false
    })
    expect(electron.fromPartition.mock.calls[0][0]).toMatch(/^ldb-auth-/)
    expect(f.session.setPermissionCheckHandler.mock.calls[0][0]()).toBe(false)
    const request = f.session.webRequest.onBeforeRequest.mock.calls[0][0]
    const verdict = vi.fn()
    request({ url: 'https://untrusted.invalid/' }, verdict)
    expect(verdict).toHaveBeenCalledWith({ cancel: true })
    request({ url: `${origin}/auth/passkeys/client.js` }, verdict)
    expect(verdict).toHaveBeenLastCalledWith({ cancel: false })
    expect(f.window.webContents.setWindowOpenHandler.mock.calls[0][0]()).toEqual({ action: 'deny' })
    const event = { preventDefault: vi.fn() }
    f.window.webContents.emit('will-navigate', event, 'file:///etc/passwd')
    expect(event.preventDefault).toHaveBeenCalledOnce()
    expect(f.login.onReturn).not.toHaveBeenCalled()
  })
  it('activates the main window before closing on a claimed callback without cancelling the exchange', async () => {
    const f = fixture()
    f.activate.mockImplementation(() => expect(f.window.destroyed).toBe(false))
    await f.browser.open(url, f.login)
    const event = { preventDefault: vi.fn() }
    f.window.webContents.emit('will-navigate', event, `${target}?code=synthetic`)
    expect(event.preventDefault).toHaveBeenCalledOnce()
    expect(f.login.onReturn).toHaveBeenCalledWith(`${target}?code=synthetic`, expect.any(Function))
    expect(f.activate).toHaveBeenCalledOnce()
    expect(f.window.destroyed).toBe(true)
    expect(f.login.onClosed).not.toHaveBeenCalled()
    expect(f.session.clearStorageData).toHaveBeenCalledOnce()
  })
  it('manual close cancels its attempt; app cancellation closes without another callback', async () => {
    const f = fixture()
    await f.browser.open(url, f.login)
    f.window.close()
    expect(f.login.onClosed).toHaveBeenCalledOnce()
    const next = fixture()
    await next.browser.open(url, next.login)
    next.controller.abort()
    expect(next.window.destroyed).toBe(true)
    expect(next.login.onClosed).not.toHaveBeenCalled()
  })
  it('reports a load failure to the coordinator without first cancelling its attempt', async () => {
    const f = fixture()
    f.window.loadURL.mockRejectedValueOnce(new Error('Network unavailable'))
    await expect(f.browser.open(url, f.login)).rejects.toThrow('Authentication window unavailable')
    expect(f.window.destroyed).toBe(true)
    expect(f.login.onClosed).not.toHaveBeenCalled()
    expect(f.session.clearStorageData).toHaveBeenCalledOnce()
  })
  it('does not open an untrusted or already-cancelled request', async () => {
    const f = fixture()
    await expect(f.browser.open('http://api.synthetic.test/auth/login', f.login)).rejects.toThrow()
    f.controller.abort()
    await expect(f.browser.open(url, f.login)).rejects.toThrow()
    expect(electron.BrowserWindow).not.toHaveBeenCalled()
  })
})
