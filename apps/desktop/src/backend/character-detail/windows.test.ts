import { EventEmitter } from 'node:events'
import { pathToFileURL } from 'node:url'
import type { BrowserWindow, IpcMainInvokeEvent } from 'electron'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { CharacterDetails } from '../../preload/common/types/character'
import type { CharacterDetailSnapshot } from '../../preload/common/types/character-detail'
import { deferred } from '../auth/auth-test-fixtures'
import { openSelectedCharacterDetail, registerCharacterDetailWindows } from './windows'

type ReadHandler = (event: IpcMainInvokeEvent, ...args: unknown[]) => CharacterDetailSnapshot

const electron = vi.hoisted(() => {
  const BrowserWindow = vi.fn()
  const fromPartition = vi.fn()
  const handle = vi.fn()
  const removeHandler = vi.fn()

  return { BrowserWindow, fromPartition, handle, removeHandler }
})

vi.mock('electron', () => ({
  BrowserWindow: electron.BrowserWindow,
  ipcMain: { handle: electron.handle, removeHandler: electron.removeHandler },
  session: { fromPartition: electron.fromPartition }
}))

const ENTRY = '/synthetic/app/character-detail.html'
const PRELOAD = '/synthetic/app/character-detail.js'
const DOCUMENT_URL = pathToFileURL(ENTRY).href

class TestFrame {
  url = DOCUMENT_URL
  detached = false
  destroyed = false
  isDestroyed = (): boolean => this.destroyed
}

class TestWebContents extends EventEmitter {
  mainFrame = new TestFrame()
  destroyed = false
  isDestroyed = (): boolean => this.destroyed
  setWindowOpenHandler = vi.fn()
}

class TestWindow extends EventEmitter {
  id = 1
  destroyed = false
  minimized = false
  webContents = new TestWebContents()
  loadFile = vi.fn<BrowserWindow['loadFile']>().mockResolvedValue()
  loadURL = vi.fn<BrowserWindow['loadURL']>().mockResolvedValue()
  show = vi.fn()
  focus = vi.fn()
  restore = vi.fn(() => {
    this.minimized = false
  })
  isDestroyed = (): boolean => this.destroyed
  isMinimized = (): boolean => this.minimized
  destroy = vi.fn(() => {
    this.destroyed = true
    this.webContents.destroyed = true
    this.emit('closed')
  })
}

function details(characterId = 'character-1'): CharacterDetails {
  return {
    character: {
      serverId: 'cain',
      characterId,
      characterName: '가나',
      serverName: '카인',
      fame: 71000
    },
    status: { status: [], buff: null },
    equipment: { equipment: [], setItemInfo: [] },
    avatar: null,
    creature: null,
    oath: null,
    mistAssimilation: null,
    skillStyle: null,
    buff: { equipment: null, avatar: null, creature: null },
    sections: {},
    freshness: {
      lastSuccessfulFetchAt: '2026-10-07T00:00:00.000Z',
      expiresAt: '2026-10-07T00:05:00.000Z'
    }
  }
}

type Windows = ReturnType<typeof registerCharacterDetailWindows>
const registrations: Windows[] = []

function fixture(devUrl?: string): {
  owner: TestWindow
  ownerWindow: BrowserWindow
  created: TestWindow[]
  windows: Windows
  read: (window: TestWindow, ...args: unknown[]) => CharacterDetailSnapshot
  invokeRead: (event: Partial<IpcMainInvokeEvent>, ...args: unknown[]) => CharacterDetailSnapshot
  session: {
    setPermissionCheckHandler: ReturnType<typeof vi.fn>
    setPermissionRequestHandler: ReturnType<typeof vi.fn>
    setDisplayMediaRequestHandler: ReturnType<typeof vi.fn>
  }
} {
  const owner = new TestWindow()
  // Electron이 생성하는 객체 경계만 대역으로 바꾸고 창 수명과 이벤트는 직접 실행한다.
  const ownerWindow = owner as unknown as BrowserWindow
  const created: TestWindow[] = []
  const session = {
    setPermissionCheckHandler: vi.fn(),
    setPermissionRequestHandler: vi.fn(),
    setDisplayMediaRequestHandler: vi.fn()
  }
  electron.BrowserWindow.mockImplementation(function () {
    const window = new TestWindow()
    created.push(window)

    return window
  })
  electron.fromPartition.mockReturnValue(session)
  const windows = registerCharacterDetailWindows({
    owner: ownerWindow,
    entry: ENTRY,
    preload: PRELOAD,
    devUrl
  })
  registrations.push(windows)
  const handler = electron.handle.mock.calls[0][1] as ReadHandler
  const invokeRead = (
    event: Partial<IpcMainInvokeEvent>,
    ...args: unknown[]
  ): CharacterDetailSnapshot => {
    return handler(event as IpcMainInvokeEvent, ...args)
  }
  const read = (window: TestWindow, ...args: unknown[]): CharacterDetailSnapshot => {
    return invokeRead(
      {
        sender: window.webContents as unknown as IpcMainInvokeEvent['sender'],
        senderFrame: window.webContents.mainFrame as unknown as IpcMainInvokeEvent['senderFrame']
      },
      ...args
    )
  }

  return { owner, ownerWindow, created, windows, read, invokeRead, session }
}

beforeEach(() => vi.clearAllMocks())
afterEach(() => {
  for (const windows of registrations.splice(0)) {
    windows.dispose()
  }
})

describe('캐릭터별 상세 창 수명', () => {
  it('같은 캐릭터는 복원하고 포커스하며 처음 연 snapshot을 유지한다', async () => {
    const f = fixture()
    const source = details()
    expect(await openSelectedCharacterDetail(f.ownerWindow, source, () => true)).toBe(true)
    const window = f.created[0]
    const original = f.read(window)
    Object.assign(source.character, { characterName: '바뀐 이름', fame: 80000 })
    Object.assign(source.freshness, { expiresAt: '2026-10-07T01:00:00.000Z' })
    window.minimized = true

    expect(await f.windows.open(source, () => true)).toBe(true)
    expect(f.created).toHaveLength(1)
    expect(window.restore).toHaveBeenCalledOnce()
    expect(window.show).toHaveBeenCalledTimes(2)
    expect(window.focus).toHaveBeenCalledTimes(2)
    expect(f.read(window)).toEqual(original)
    Object.assign(original.character, { characterName: 'renderer 변경' })
    expect(f.read(window).character.characterName).toBe('가나')
  })

  it('서버나 캐릭터 ID가 다르면 각각 열고 하나를 닫아도 다른 창을 유지한다', async () => {
    const f = fixture()
    const second = details('character-2')
    const otherServer = details()
    await f.windows.open(details(), () => true)
    await f.windows.open(second, () => true)
    await f.windows.open(
      {
        ...otherServer,
        character: { ...otherServer.character, serverId: 'hilder', serverName: '힐더' }
      },
      () => true
    )

    expect(f.created).toHaveLength(3)
    expect(f.created.map((window) => f.read(window).character)).toMatchObject([
      { serverId: 'cain', characterId: 'character-1' },
      { serverId: 'cain', characterId: 'character-2' },
      { serverId: 'hilder', characterId: 'character-1' }
    ])
    f.created[0].destroy()
    expect(f.created[1].destroyed).toBe(false)
    expect(f.created[2].destroyed).toBe(false)
    expect(await f.windows.open(details(), () => true)).toBe(true)
    expect(f.created).toHaveLength(4)
  })

  it('같은 캐릭터를 로드 중 다시 열어도 하나의 로드가 끝난 후 같은 창을 표시한다', async () => {
    const f = fixture()
    const loaded = deferred<void>()
    electron.BrowserWindow.mockImplementationOnce(function () {
      const window = new TestWindow()
      window.loadFile.mockImplementationOnce(() => loaded.promise)
      f.created.push(window)

      return window
    })
    const first = f.windows.open(details(), () => true)
    const second = f.windows.open(details(), () => true)
    expect(f.created).toHaveLength(1)
    expect(f.created[0].show).not.toHaveBeenCalled()
    loaded.resolve()

    expect(await first).toBe(true)
    expect(await second).toBe(true)
    expect(f.created[0].loadFile).toHaveBeenCalledOnce()
  })

  it('로드 실패한 창은 폐기하고 같은 캐릭터를 다시 열 수 있다', async () => {
    const f = fixture()
    electron.BrowserWindow.mockImplementationOnce(function () {
      const window = new TestWindow()
      window.loadFile.mockRejectedValueOnce(new Error('synthetic load failure'))
      f.created.push(window)

      return window
    })

    expect(await f.windows.open(details(), () => true)).toBe(false)
    expect(f.created[0].destroy).toHaveBeenCalledOnce()
    expect(f.created[0].show).not.toHaveBeenCalled()
    expect(await f.windows.open(details(), () => true)).toBe(true)
    expect(f.created).toHaveLength(2)
  })

  it('오래된 선택의 로딩 창은 폐기하고 같은 캐릭터의 새 선택으로 다시 연다', async () => {
    const f = fixture()
    const loaded = deferred<void>()
    let current = true
    electron.BrowserWindow.mockImplementationOnce(function () {
      const window = new TestWindow()
      window.loadFile.mockImplementationOnce(() => loaded.promise)
      f.created.push(window)

      return window
    })
    const first = f.windows.open(details(), () => current)
    current = false
    const updated = details()
    Object.assign(updated.character, { fame: 80000 })
    expect(await f.windows.open(updated, () => true)).toBe(true)
    expect(f.created).toHaveLength(2)
    expect(f.created[0].destroyed).toBe(true)
    expect(f.read(f.created[1]).character.fame).toBe(80000)
    loaded.resolve()
    expect(await first).toBe(false)
    expect(f.created[1].destroyed).toBe(false)
  })

  it('두 번째 선택이 로드를 기다린 뒤 첫 선택만 만료되면 두 번째 정보로 다시 연다', async () => {
    const f = fixture()
    const loaded = deferred<void>()
    let firstCurrent = true
    electron.BrowserWindow.mockImplementationOnce(function () {
      const window = new TestWindow()
      window.loadFile.mockReturnValueOnce(loaded.promise)
      f.created.push(window)

      return window
    })
    const first = f.windows.open(details(), () => firstCurrent)
    const updated = details()
    Object.assign(updated.character, { fame: 80000 })
    const second = f.windows.open(updated, () => true)
    expect(f.created).toHaveLength(1)
    firstCurrent = false
    loaded.resolve()

    expect(await first).toBe(false)
    expect(await second).toBe(true)
    expect(f.created).toHaveLength(2)
    expect(f.created[0].destroyed).toBe(true)
    expect(f.created[0].show).not.toHaveBeenCalled()
    expect(f.read(f.created[1]).character.fame).toBe(80000)
    expect(f.created[1].show).toHaveBeenCalledOnce()
  })

  it.each(['로드 실패', '사용자 닫기', '메인 종료'] as const)(
    '다른 선택이 로드를 함께 기다려도 %s 이후에는 자동으로 다시 열지 않는다',
    async (reason) => {
      const f = fixture()
      const loaded = deferred<void>()
      let firstCurrent = true
      electron.BrowserWindow.mockImplementationOnce(function () {
        const window = new TestWindow()
        window.loadFile.mockReturnValueOnce(loaded.promise)
        f.created.push(window)

        return window
      })
      const first = f.windows.open(details(), () => firstCurrent)
      const second = f.windows.open(details(), () => true)
      firstCurrent = false
      if (reason === '로드 실패') {
        loaded.reject(new Error('synthetic load failure'))
      } else {
        if (reason === '사용자 닫기') {
          f.created[0].destroy()
        } else {
          f.owner.destroy()
        }
        loaded.resolve()
      }

      expect(await first).toBe(false)
      expect(await second).toBe(false)
      expect(f.created).toHaveLength(1)
      expect(f.created[0].show).not.toHaveBeenCalled()
    }
  )

  it('로드 중 선택이 바뀌면 snapshot 읽기와 늦은 창 표시를 막는다', async () => {
    const f = fixture()
    const loaded = deferred<void>()
    let current = true
    electron.BrowserWindow.mockImplementationOnce(function () {
      const window = new TestWindow()
      window.loadFile.mockImplementationOnce(() => loaded.promise)
      f.created.push(window)

      return window
    })
    const opening = f.windows.open(details(), () => current)
    expect(f.read(f.created[0]).character.characterId).toBe('character-1')
    current = false
    expect(() => f.read(f.created[0])).toThrow('CHARACTER_DETAIL_NOT_ALLOWED')
    loaded.resolve()

    expect(await opening).toBe(false)
    expect(f.created[0].destroy).toHaveBeenCalledOnce()
    expect(f.created[0].show).not.toHaveBeenCalled()
  })

  it('이미 열린 비교 창은 캡처 선택이 바뀐 뒤에도 기존 정보를 읽을 수 있다', async () => {
    const f = fixture()
    let current = true
    await f.windows.open(details(), () => current)
    current = false

    expect(f.read(f.created[0]).character.characterId).toBe('character-1')
    expect(f.created[0].destroyed).toBe(false)
    expect(await f.windows.open(details('character-2'), () => current)).toBe(false)
    expect(f.created).toHaveLength(1)
  })

  it('메인 close가 취소되면 유지하고 closed에서 모든 상세 창과 IPC를 정리한다', async () => {
    const f = fixture()
    await f.windows.open(details(), () => true)
    await f.windows.open(details('character-2'), () => true)
    const closeEvent = { preventDefault: vi.fn() }
    f.owner.on('close', (event) => event.preventDefault())
    f.owner.emit('close', closeEvent)

    expect(closeEvent.preventDefault).toHaveBeenCalledOnce()
    expect(f.created.every((window) => !window.destroyed)).toBe(true)
    expect(f.read(f.created[0]).character.characterId).toBe('character-1')
    expect(electron.removeHandler).not.toHaveBeenCalled()
    f.owner.destroy()
    expect(f.created.every((window) => window.destroyed)).toBe(true)
    expect(electron.removeHandler).toHaveBeenCalledExactlyOnceWith('readCharacterDetail')
    expect(f.owner.listenerCount('closed')).toBe(0)
    expect(await openSelectedCharacterDetail(f.ownerWindow, details(), () => true)).toBe(false)
    f.windows.dispose()
    expect(electron.removeHandler).toHaveBeenCalledOnce()
  })

  it('메인 종료 후 늦게 로드가 끝나도 창을 다시 표시하지 않는다', async () => {
    const f = fixture()
    const loaded = deferred<void>()
    electron.BrowserWindow.mockImplementationOnce(function () {
      const window = new TestWindow()
      window.loadFile.mockImplementationOnce(() => loaded.promise)
      f.created.push(window)

      return window
    })
    const opening = f.windows.open(details(), () => true)
    f.owner.destroy()
    loaded.resolve()

    expect(await opening).toBe(false)
    expect(f.created[0].show).not.toHaveBeenCalled()
    expect(f.created[0].destroy).toHaveBeenCalledOnce()
  })
})

describe('캐릭터 상세 창 IPC와 문서 경계', () => {
  it.each([
    'sender',
    'subframe',
    'document',
    'detached',
    'frame-destroyed',
    'sender-destroyed',
    'window-destroyed',
    'owner-destroyed',
    'owner-webcontents-destroyed',
    'extra-argument'
  ] as const)('%s 경계가 유효하지 않으면 snapshot을 노출하지 않는다', async (boundary) => {
    const f = fixture()
    await f.windows.open(details(), () => true)
    const window = f.created[0]
    const sender = window.webContents
    const frame = sender.mainFrame
    const event: Partial<IpcMainInvokeEvent> = {
      sender: sender as unknown as IpcMainInvokeEvent['sender'],
      senderFrame: frame as unknown as IpcMainInvokeEvent['senderFrame']
    }
    const args: unknown[] = []
    switch (boundary) {
      case 'sender':
        Object.assign(event, { sender: f.owner.webContents })
        break
      case 'subframe':
        Object.assign(event, { senderFrame: new TestFrame() })
        break
      case 'document':
        frame.url = `${DOCUMENT_URL}?other-document=1`
        break
      case 'detached':
        frame.detached = true
        break
      case 'frame-destroyed':
        frame.destroyed = true
        break
      case 'sender-destroyed':
        sender.destroyed = true
        break
      case 'window-destroyed':
        window.destroyed = true
        break
      case 'owner-destroyed':
        f.owner.destroyed = true
        break
      case 'owner-webcontents-destroyed':
        f.owner.webContents.destroyed = true
        break
      case 'extra-argument':
        args.push(undefined)
        break
    }

    expect(() => f.invokeRead(event, ...args)).toThrow('CHARACTER_DETAIL_NOT_ALLOWED')
  })

  it('전용 preload와 비영속 session을 사용하고 권한, 팝업, 탐색을 차단한다', async () => {
    const f = fixture()
    await f.windows.open(details(), () => true)
    const window = f.created[0]

    expect(electron.BrowserWindow.mock.calls[0][0].webPreferences).toEqual({
      preload: PRELOAD,
      session: f.session,
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      webviewTag: false
    })
    expect(electron.BrowserWindow.mock.calls[0][0].title).toBe('가나 (카인) - 캐릭터 정보')
    const titleEvent = { preventDefault: vi.fn() }
    window.emit('page-title-updated', titleEvent)
    expect(titleEvent.preventDefault).toHaveBeenCalledOnce()
    expect(electron.fromPartition.mock.calls[0][0].startsWith('persist:')).toBe(false)
    expect(f.session.setPermissionCheckHandler.mock.calls[0][0]()).toBe(false)
    const permissionResult = vi.fn()
    f.session.setPermissionRequestHandler.mock.calls[0][0](
      window.webContents,
      'media',
      permissionResult
    )
    expect(permissionResult).toHaveBeenCalledWith(false)
    const displayResult = vi.fn()
    f.session.setDisplayMediaRequestHandler.mock.calls[0][0]({}, displayResult)
    expect(displayResult).toHaveBeenCalledWith({})
    expect(window.webContents.setWindowOpenHandler.mock.calls[0][0]()).toEqual({ action: 'deny' })
    for (const eventName of ['will-navigate', 'will-redirect', 'will-attach-webview']) {
      const event = { preventDefault: vi.fn() }
      window.webContents.emit(eventName, event)
      expect(event.preventDefault).toHaveBeenCalledOnce()
    }
    expect(window.loadFile).toHaveBeenCalledWith(ENTRY)
  })

  it.each(['foreign-document', 'renderer-gone'] as const)(
    '%s 이후에는 창을 폐기한다',
    async (cause) => {
      const f = fixture()
      await f.windows.open(details(), () => true)
      const window = f.created[0]
      if (cause === 'foreign-document') {
        window.webContents.emit('did-navigate', {}, 'https://untrusted.example/')
      } else {
        window.webContents.emit('render-process-gone')
      }

      expect(window.destroy).toHaveBeenCalledOnce()
      expect(() => f.read(window)).toThrow('CHARACTER_DETAIL_NOT_ALLOWED')
    }
  )

  it('개발 환경에서는 고정 상세 entry만 로드하고 해당 main frame에서 읽는다', async () => {
    const f = fixture('http://localhost:5173')
    await f.windows.open(details(), () => true)
    const window = f.created[0]
    const url = 'http://localhost:5173/character-detail.html'
    window.webContents.mainFrame.url = url

    expect(window.loadURL).toHaveBeenCalledWith(url)
    expect(window.loadFile).not.toHaveBeenCalled()
    expect(f.read(window).character.characterId).toBe('character-1')
  })
})
