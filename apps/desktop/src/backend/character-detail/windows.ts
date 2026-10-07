import { BrowserWindow, ipcMain, session, type IpcMainInvokeEvent } from 'electron'
import { pathToFileURL } from 'node:url'
import { addHandler } from '../ipc'
import { validateDevRendererUrl } from '../renderer-document'
import { createCharacterDetailSnapshot } from './snapshot'
import type { CharacterDetails } from '../../preload/common/types/character'
import type { CharacterDetailSnapshot } from '../../preload/common/types/character-detail'

type DetailEntry = {
  window: BrowserWindow
  snapshot: CharacterDetailSnapshot
  ready: boolean
  discardedForStaleSelection: boolean
  isCurrent: () => boolean
  loaded: Promise<boolean>
}

type DetailWindows = {
  open: (details: CharacterDetails, isCurrent: () => boolean) => Promise<boolean>
  dispose: () => void
}

const owners = new WeakMap<BrowserWindow, DetailWindows>()

export function registerCharacterDetailWindows({
  owner,
  entry,
  preload,
  devUrl
}: {
  owner: BrowserWindow
  entry: string
  preload: string
  devUrl?: string
}): DetailWindows {
  const documentUrl =
    devUrl === undefined
      ? pathToFileURL(entry).href
      : new URL('/character-detail.html', validateDevRendererUrl(devUrl)).href
  const detailSession = session.fromPartition(`character-detail-${owner.id}`)
  detailSession.setPermissionCheckHandler(() => false)
  detailSession.setPermissionRequestHandler((_contents, _permission, callback) => callback(false))
  detailSession.setDisplayMediaRequestHandler((_request, callback) => callback({}))
  const entries = new Map<string, DetailEntry>()
  let disposed = false

  function ownerAlive(): boolean {
    return !disposed && !owner.isDestroyed() && !owner.webContents.isDestroyed()
  }

  function read(event: IpcMainInvokeEvent, ...args: unknown[]): CharacterDetailSnapshot {
    if (!ownerAlive() || args.length !== 0) {
      throw new Error('CHARACTER_DETAIL_NOT_ALLOWED')
    }
    const detail = Array.from(entries.values()).find(
      (candidate) => candidate.window.webContents === event.sender
    )
    if (
      detail === undefined ||
      detail.window.isDestroyed() ||
      event.sender.isDestroyed() ||
      (!detail.ready && !detail.isCurrent())
    ) {
      throw new Error('CHARACTER_DETAIL_NOT_ALLOWED')
    }
    const frame = event.senderFrame
    if (
      frame == null ||
      frame !== event.sender.mainFrame ||
      frame.isDestroyed() ||
      frame.detached ||
      frame.url !== documentUrl
    ) {
      throw new Error('CHARACTER_DETAIL_NOT_ALLOWED')
    }

    return structuredClone(detail.snapshot)
  }

  async function open(details: CharacterDetails, isCurrent: () => boolean): Promise<boolean> {
    if (!ownerAlive() || !isCurrent()) {
      return false
    }
    const snapshot = createCharacterDetailSnapshot(details)
    const key = `${snapshot.character.serverId}:${snapshot.character.characterId}`
    const previous = entries.get(key)
    if (
      previous !== undefined &&
      !previous.ready &&
      !previous.isCurrent() &&
      !previous.window.isDestroyed()
    ) {
      previous.discardedForStaleSelection = true
      previous.window.destroy()
    }

    if (previous !== undefined && !previous.window.isDestroyed()) {
      const loaded = await previous.loaded
      if (!loaded && previous.discardedForStaleSelection && ownerAlive() && isCurrent()) {
        return open(details, isCurrent)
      }

      if (!loaded || !ownerAlive() || !isCurrent() || previous.window.isDestroyed()) {
        return false
      }
      reveal(previous.window)

      return true
    }
    const window = new BrowserWindow({
      width: 540,
      height: 650,
      minWidth: 360,
      minHeight: 460,
      show: false,
      autoHideMenuBar: true,
      title: `${snapshot.character.characterName} (${snapshot.character.serverName}) - 캐릭터 정보`,
      webPreferences: {
        preload,
        session: detailSession,
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
        webviewTag: false
      }
    })
    const detail: DetailEntry = {
      window,
      snapshot: structuredClone(snapshot),
      ready: false,
      discardedForStaleSelection: false,
      isCurrent,
      loaded: Promise.resolve(false)
    }
    entries.set(key, detail)
    window.on('page-title-updated', (event) => event.preventDefault())
    window.once('closed', () => {
      if (entries.get(key) === detail) {
        entries.delete(key)
      }
    })
    window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
    window.webContents.on('will-navigate', (event) => event.preventDefault())
    window.webContents.on('will-redirect', (event) => event.preventDefault())
    window.webContents.on('will-attach-webview', (event) => event.preventDefault())
    window.webContents.on('did-navigate', (_event, url) => {
      if (url !== documentUrl && !window.isDestroyed()) {
        window.destroy()
      }
    })
    window.webContents.on('render-process-gone', () => {
      if (!window.isDestroyed()) {
        window.destroy()
      }
    })

    detail.loaded = load()

    return detail.loaded

    async function load(): Promise<boolean> {
      try {
        if (devUrl === undefined) {
          await window.loadFile(entry)
        } else {
          await window.loadURL(documentUrl)
        }

        if (!ownerAlive() || window.isDestroyed()) {
          if (!window.isDestroyed()) {
            window.destroy()
          }

          return false
        }

        if (!isCurrent()) {
          detail.discardedForStaleSelection = true
          window.destroy()

          return false
        }
        detail.ready = true
        reveal(window)

        return true
      } catch {
        if (!window.isDestroyed()) {
          window.destroy()
        }

        return false
      }
    }
  }

  function dispose(): void {
    if (disposed) {
      return
    }
    disposed = true
    owners.delete(owner)
    ipcMain.removeHandler('readCharacterDetail')
    owner.removeListener('closed', dispose)
    for (const detail of entries.values()) {
      if (!detail.window.isDestroyed()) {
        detail.window.destroy()
      }
    }
    entries.clear()
  }

  const windows = { open, dispose }
  addHandler('readCharacterDetail', read)
  owners.set(owner, windows)
  owner.once('closed', dispose)

  return windows
}

function reveal(window: BrowserWindow): void {
  if (window.isMinimized()) {
    window.restore()
  }
  window.show()
  window.focus()
}

export async function openSelectedCharacterDetail(
  owner: BrowserWindow,
  details: CharacterDetails,
  isCurrent: () => boolean
): Promise<boolean> {
  const windows = owners.get(owner)
  if (windows === undefined) {
    return false
  }

  return windows.open(details, isCurrent)
}
