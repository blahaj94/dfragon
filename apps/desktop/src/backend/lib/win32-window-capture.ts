import { win32 as win32Path } from 'node:path'
import { createRequire } from 'node:module'
import { isValidPartyFrameSize } from '@dfragon/lib'
import { bgrxToRgba } from './win32-pixels'

export const WINDOW_CAPTURE_ERRORS = {
  UNAVAILABLE: 'WINDOW_CAPTURE_UNAVAILABLE',
  NOT_FOUND: 'WINDOW_CAPTURE_NOT_FOUND',
  COVERED: 'WINDOW_CAPTURE_COVERED',
  ADMIN_REQUIRED: 'WINDOW_CAPTURE_ADMIN_REQUIRED'
} as const

export type WindowCaptureFrame = {
  width: number
  height: number
  rgba: Buffer
  capturedAt: string
  coveredRegions: ScreenRect[]
}

const RGBA_CHANNELS = 4
const WINDOW_SOURCE_ID_PATTERN = /^window:([1-9][0-9]*):[0-9]+$/
const MAX_WINDOW_HANDLE = 0xffffffffffffffffn

export type WindowRect = { left: number; top: number; right: number; bottom: number }
export type ScreenRect = { x: number; y: number; width: number; height: number }
type GameWindow = {
  hwnd: bigint
  pid: number
  client: ScreenRect
}
type ObscuringWindow = { hwnd: bigint; rect: WindowRect }

type Koffi = typeof import('koffi')
export type Win32PartyApi = {
  koffi: Koffi
  SetThreadDpiAwarenessContext: (context: number | bigint) => bigint | null
  EnumWindows: (callback: bigint, lParam: bigint) => number
  IsWindowVisible: (hwnd: bigint) => number
  IsIconic: (hwnd: bigint) => number
  GetForegroundWindow: () => bigint | null
  GetWindow: (hwnd: bigint, command: number) => bigint | null
  GetWindowThreadProcessId: (hwnd: bigint, processId: number[]) => number
  GetClientRect: (hwnd: bigint, rect: Buffer) => number
  ClientToScreen: (hwnd: bigint, point: Buffer) => number
  GetWindowRect: (hwnd: bigint, rect: Buffer) => number
  GetSystemMetrics: (index: number) => number
  OpenProcess: (access: number, inherit: number, processId: number) => bigint | null
  GetCurrentProcess: () => bigint | null
  OpenProcessToken: (process: bigint, access: number, token: Array<bigint | null>) => number
  GetTokenInformation: (
    token: bigint,
    informationClass: number,
    information: Buffer,
    informationLength: number,
    returnLength: number[]
  ) => number
  QueryFullProcessImageNameW: (
    process: bigint,
    flags: number,
    imagePath: Buffer,
    characterCount: number[]
  ) => number
  CloseHandle: (handle: bigint) => number
  GetDC: (hwnd: bigint | null) => bigint | null
  ReleaseDC: (hwnd: bigint | null, dc: bigint) => number
  CreateCompatibleDC: (dc: bigint) => bigint | null
  CreateDIBSection: (
    dc: bigint,
    info: Buffer,
    usage: number,
    bits: Array<bigint | null>,
    section: null,
    offset: number
  ) => bigint | null
  SelectObject: (dc: bigint, object: bigint) => bigint | null
  BitBlt: (
    target: bigint,
    x: number,
    y: number,
    width: number,
    height: number,
    source: bigint,
    sourceX: number,
    sourceY: number,
    operation: number
  ) => number
  GdiFlush: () => number
  DeleteObject: (object: bigint) => number
  DeleteDC: (dc: bigint) => number
  DwmGetWindowAttribute: (hwnd: bigint, attribute: number, value: Buffer, size: number) => number
  GetLastError: () => number
  enumWindowsProc: ReturnType<Koffi['proto']>
}

const DNF_EXECUTABLE = 'dnf.exe'
const PROCESS_QUERY_LIMITED_INFORMATION = 0x1000
const TOKEN_QUERY = 0x0008
const TOKEN_ELEVATION = 20
const PMV2_DPI_CONTEXT = -4n
const GW_HWNDPREV = 3
const SRCCOPY_CAPTUREBLT_NOMIRRORBITMAP = 0xc0cc0020
const DWMWA_CLOAKED = 14
const SM_XVIRTUALSCREEN = 76
const SM_YVIRTUALSCREEN = 77
const SM_CXVIRTUALSCREEN = 78
const SM_CYVIRTUALSCREEN = 79
const MAX_Z_ORDER_STEPS = 4096

function loadWin32PartyApi(): Win32PartyApi {
  const koffi = createRequire(__filename)('koffi') as Koffi
  const user32 = koffi.load('user32.dll')
  const kernel32 = koffi.load('kernel32.dll')
  const advapi32 = koffi.load('advapi32.dll')
  const gdi32 = koffi.load('gdi32.dll')
  const dwmapi = koffi.load('dwmapi.dll')
  const enumWindowsProc = koffi.proto('__stdcall', 'DFC_PARTY_ENUMWINDOWSPROC', 'int32_t', [
    'void *',
    'intptr_t'
  ])
  const SetThreadDpiAwarenessContext = user32.func(
    'void * __stdcall SetThreadDpiAwarenessContext(void *context)'
  )
  const EnumWindows = user32.func('__stdcall', 'EnumWindows', 'int32_t', [
    koffi.pointer(enumWindowsProc),
    'intptr_t'
  ])
  const IsWindowVisible = user32.func('int __stdcall IsWindowVisible(void *hwnd)')
  const IsIconic = user32.func('int __stdcall IsIconic(void *hwnd)')
  const GetForegroundWindow = user32.func('void * __stdcall GetForegroundWindow()')
  const GetWindow = user32.func('void * __stdcall GetWindow(void *hwnd, uint32_t command)')
  const GetWindowThreadProcessId = user32.func(
    'uint32_t __stdcall GetWindowThreadProcessId(void *hwnd, _Out_ uint32_t *processId)'
  )
  const GetClientRect = user32.func('int __stdcall GetClientRect(void *hwnd, _Out_ void *rect)')
  const ClientToScreen = user32.func(
    'int __stdcall ClientToScreen(void *hwnd, _Inout_ void *point)'
  )
  const GetWindowRect = user32.func('int __stdcall GetWindowRect(void *hwnd, _Out_ void *rect)')
  const GetSystemMetrics = user32.func('int __stdcall GetSystemMetrics(int index)')
  const OpenProcess = kernel32.func(
    'void * __stdcall OpenProcess(uint32_t desiredAccess, int inheritHandle, uint32_t processId)'
  )
  const GetCurrentProcess = kernel32.func('void * __stdcall GetCurrentProcess()')
  const OpenProcessToken = advapi32.func(
    'int __stdcall OpenProcessToken(void *process, uint32_t access, _Out_ void **token)'
  )
  const GetTokenInformation = advapi32.func(
    'int __stdcall GetTokenInformation(void *token, int informationClass, _Out_ void *information, uint32_t informationLength, _Out_ uint32_t *returnLength)'
  )
  const QueryFullProcessImageNameW = kernel32.func(
    'int __stdcall QueryFullProcessImageNameW(void *process, uint32_t flags, _Out_ uint16_t *imagePath, _Inout_ uint32_t *characterCount)'
  )
  const CloseHandle = kernel32.func('int __stdcall CloseHandle(void *handle)')
  const GetDC = user32.func('void * __stdcall GetDC(void *hwnd)')
  const ReleaseDC = user32.func('int __stdcall ReleaseDC(void *hwnd, void *dc)')
  const CreateCompatibleDC = gdi32.func('void * __stdcall CreateCompatibleDC(void *dc)')
  const CreateDIBSection = gdi32.func(
    'void * __stdcall CreateDIBSection(void *dc, const void *info, uint32_t usage, _Out_ void **bits, void *section, uint32_t offset)'
  )
  const SelectObject = gdi32.func('void * __stdcall SelectObject(void *dc, void *object)')
  const BitBlt = gdi32.func(
    'int __stdcall BitBlt(void *target, int x, int y, int width, int height, void *source, int sourceX, int sourceY, uint32_t operation)'
  )
  const GdiFlush = gdi32.func('int __stdcall GdiFlush()')
  const DeleteObject = gdi32.func('int __stdcall DeleteObject(void *object)')
  const DeleteDC = gdi32.func('int __stdcall DeleteDC(void *dc)')
  const DwmGetWindowAttribute = dwmapi.func(
    'int32_t __stdcall DwmGetWindowAttribute(void *hwnd, uint32_t attribute, _Out_ void *value, uint32_t size)'
  )
  const GetLastError = kernel32.func('uint32_t __stdcall GetLastError()')

  return {
    koffi,
    enumWindowsProc,
    SetThreadDpiAwarenessContext,
    EnumWindows,
    IsWindowVisible,
    IsIconic,
    GetForegroundWindow,
    GetWindow,
    GetWindowThreadProcessId,
    GetClientRect,
    ClientToScreen,
    GetWindowRect,
    GetSystemMetrics,
    OpenProcess,
    GetCurrentProcess,
    OpenProcessToken,
    GetTokenInformation,
    QueryFullProcessImageNameW,
    CloseHandle,
    GetDC,
    ReleaseDC,
    CreateCompatibleDC,
    CreateDIBSection,
    SelectObject,
    BitBlt,
    GdiFlush,
    DeleteObject,
    DeleteDC,
    DwmGetWindowAttribute,
    GetLastError
  } as Win32PartyApi
}

let win32PartyApi: Win32PartyApi | undefined

function getApi(): Win32PartyApi {
  if (win32PartyApi == null) {
    win32PartyApi = loadWin32PartyApi()
  }

  return win32PartyApi
}

function nativeFailure(api: Win32PartyApi, operation: string): Error {
  return new Error(`${operation} failed (Win32 ${api.GetLastError()}).`)
}

function withPerMonitorV2<T>(api: Win32PartyApi, action: () => T): T {
  const previousDpi = api.SetThreadDpiAwarenessContext(PMV2_DPI_CONTEXT)
  if (!previousDpi) {
    throw nativeFailure(api, 'SetThreadDpiAwarenessContext')
  }
  let value: T | undefined
  let actionError: unknown
  let actionFailed = false
  try {
    value = action()
  } catch (error) {
    actionFailed = true
    actionError = error
  }
  const restored = api.SetThreadDpiAwarenessContext(previousDpi)
  if (!restored) {
    const restoreError = nativeFailure(api, 'Restore thread DPI awareness')
    throw new AggregateError(
      actionFailed ? [actionError, restoreError] : [restoreError],
      'Windows party capture DPI cleanup failed.'
    )
  }

  if (actionFailed) {
    throw actionError
  }

  return value as T
}

function readRect(
  api: Win32PartyApi,
  hwnd: bigint,
  getRect: Win32PartyApi['GetWindowRect']
): WindowRect {
  const buffer = Buffer.alloc(16)
  if (!getRect(hwnd, buffer)) {
    throw nativeFailure(api, getRect === api.GetClientRect ? 'GetClientRect' : 'GetWindowRect')
  }
  const left = buffer.readInt32LE(0)
  const top = buffer.readInt32LE(4)
  const right = buffer.readInt32LE(8)
  const bottom = buffer.readInt32LE(12)

  return { left, top, right, bottom }
}

function clientScreenOrigin(api: Win32PartyApi, hwnd: bigint): { x: number; y: number } {
  const point = Buffer.alloc(8)
  if (!api.ClientToScreen(hwnd, point)) {
    throw nativeFailure(api, 'ClientToScreen')
  }
  const x = point.readInt32LE(0)
  const y = point.readInt32LE(4)

  return { x, y }
}

function getProcessId(api: Win32PartyApi, hwnd: bigint): number | null {
  const output = [0]
  if (!api.GetWindowThreadProcessId(hwnd, output) || output[0] <= 0) {
    return null
  }

  return output[0]
}

function getProcessImagePath(api: Win32PartyApi, processId: number): string | null {
  const process = api.OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, 0, processId)
  if (!process) {
    return null
  }
  let imagePath: string | null = null
  let queryError: unknown
  try {
    const pathBuffer = Buffer.alloc(32768 * 2)
    const characterCount = [32768]
    if (api.QueryFullProcessImageNameW(process, 0, pathBuffer, characterCount)) {
      const length = Math.min(characterCount[0], 32768)
      imagePath = pathBuffer.toString('utf16le', 0, length * 2)
    }
  } catch (error) {
    queryError = error
  }
  if (!api.CloseHandle(process)) {
    const closeError = nativeFailure(api, 'CloseHandle(process)')
    throw new AggregateError(
      queryError === undefined ? [closeError] : [queryError, closeError],
      'Windows process query cleanup failed.'
    )
  }

  if (queryError !== undefined) {
    throw queryError
  }

  return imagePath
}

function isDnfProcessWindow(api: Win32PartyApi, hwnd: bigint): { pid: number } | null {
  const pid = getProcessId(api, hwnd)
  if (pid === null) {
    return null
  }
  const imagePath = getProcessImagePath(api, pid)
  if (!imagePath || !isDnfExecutablePath(imagePath)) {
    return null
  }

  return { pid }
}

function clientRectOnScreen(api: Win32PartyApi, hwnd: bigint): ScreenRect | null {
  const rect = readRect(api, hwnd, api.GetClientRect)
  const width = rect.right - rect.left
  const height = rect.bottom - rect.top
  if (rect.left !== 0 || rect.top !== 0 || !isValidPartyFrameSize(width, height)) {
    return null
  }
  const origin = clientScreenOrigin(api, hwnd)

  return { ...origin, width, height }
}

function enumerateTopLevelWindows(api: Win32PartyApi): bigint[] {
  const windows: bigint[] = []
  let callbackError: unknown
  const callbackPointer = api.koffi.register((hwnd: bigint | null) => {
    try {
      if (hwnd) {
        windows.push(hwnd)
      }

      return 1
    } catch (error) {
      callbackError = error

      return 0
    }
  }, api.koffi.pointer(api.enumWindowsProc))
  let enumerationResult = 0
  try {
    enumerationResult = api.EnumWindows(callbackPointer, 0n)
  } finally {
    api.koffi.unregister(callbackPointer)
  }
  if (callbackError !== undefined) {
    throw callbackError
  }

  if (!enumerationResult) {
    throw nativeFailure(api, 'EnumWindows')
  }

  return windows
}

function findDnfGameWindow(api: Win32PartyApi): GameWindow {
  const matches: GameWindow[] = []
  for (const hwnd of enumerateTopLevelWindows(api)) {
    if (!api.IsWindowVisible(hwnd) || api.IsIconic(hwnd)) {
      continue
    }
    const client = clientRectOnScreen(api, hwnd)
    if (!client) {
      continue
    }
    const owner = isDnfProcessWindow(api, hwnd)
    if (owner) {
      matches.push({ hwnd, pid: owner.pid, client })
    }
  }
  if (matches.length === 0) {
    throw new Error(WINDOW_CAPTURE_ERRORS.NOT_FOUND)
  }

  if (matches.length !== 1) {
    throw new Error(WINDOW_CAPTURE_ERRORS.UNAVAILABLE)
  }

  return matches[0]
}

function sameGameWindow(first: GameWindow, second: GameWindow): boolean {
  return (
    first.hwnd === second.hwnd &&
    first.pid === second.pid &&
    first.client.x === second.client.x &&
    first.client.y === second.client.y &&
    first.client.width === second.client.width &&
    first.client.height === second.client.height
  )
}

function getWindowsAbove(api: Win32PartyApi, hwnd: bigint): ObscuringWindow[] {
  const windows: ObscuringWindow[] = []
  const seen = new Set<bigint>([hwnd])
  let current = api.GetWindow(hwnd, GW_HWNDPREV)
  for (let count = 0; current && count < MAX_Z_ORDER_STEPS; count += 1) {
    if (seen.has(current)) {
      throw new Error(WINDOW_CAPTURE_ERRORS.UNAVAILABLE)
    }
    seen.add(current)
    if (api.IsWindowVisible(current) && !api.IsIconic(current) && !isWindowCloaked(api, current)) {
      windows.push({ hwnd: current, rect: readRect(api, current, api.GetWindowRect) })
    }
    current = api.GetWindow(current, GW_HWNDPREV)
  }
  if (current) {
    throw new Error(WINDOW_CAPTURE_ERRORS.UNAVAILABLE)
  }

  return windows
}

function isWindowCloaked(api: Win32PartyApi, hwnd: bigint): boolean {
  const value = Buffer.alloc(4)
  const result = api.DwmGetWindowAttribute(hwnd, DWMWA_CLOAKED, value, value.length)

  return result >= 0 && value.readUInt32LE(0) !== 0
}

function rectsIntersect(left: WindowRect, right: WindowRect): boolean {
  return (
    left.left < right.right &&
    right.left < left.right &&
    left.top < right.bottom &&
    right.top < left.bottom
  )
}

function assertClientInsideVirtualScreen(api: Win32PartyApi, client: ScreenRect): void {
  const left = api.GetSystemMetrics(SM_XVIRTUALSCREEN)
  const top = api.GetSystemMetrics(SM_YVIRTUALSCREEN)
  const right = left + api.GetSystemMetrics(SM_CXVIRTUALSCREEN)
  const bottom = top + api.GetSystemMetrics(SM_CYVIRTUALSCREEN)
  if (
    client.x < left ||
    client.y < top ||
    client.x + client.width > right ||
    client.y + client.height > bottom
  ) {
    throw new Error(WINDOW_CAPTURE_ERRORS.UNAVAILABLE)
  }
}

function createBitmapInfo(width: number, height: number): Buffer {
  const bitmapInfo = Buffer.alloc(44)
  bitmapInfo.writeUInt32LE(40, 0)
  bitmapInfo.writeInt32LE(width, 4)
  bitmapInfo.writeInt32LE(-height, 8)
  bitmapInfo.writeUInt16LE(1, 12)
  bitmapInfo.writeUInt16LE(32, 14)

  return bitmapInfo
}

function copyVisibleClient(
  api: Win32PartyApi,
  client: ScreenRect
): { rgba: Buffer; capturedAt: string } {
  let screenDC: bigint | null = null
  let memoryDC: bigint | null = null
  let bitmap: bigint | null = null
  let previousBitmap: bigint | null = null
  let pixels: Buffer | undefined
  let capturedAt: string | undefined
  let captureError: unknown
  const cleanupErrors: Error[] = []

  const fail = (operation: string): Error => nativeFailure(api, operation)
  try {
    screenDC = api.GetDC(null)
    if (!screenDC) {
      throw fail('GetDC(desktop)')
    }
    memoryDC = api.CreateCompatibleDC(screenDC)
    if (!memoryDC) {
      throw fail('CreateCompatibleDC')
    }
    const bits: (bigint | null)[] = [null]
    bitmap = api.CreateDIBSection(
      screenDC,
      createBitmapInfo(client.width, client.height),
      0,
      bits,
      null,
      0
    )
    if (!bitmap || !bits[0]) {
      throw fail('CreateDIBSection')
    }
    previousBitmap = api.SelectObject(memoryDC, bitmap)
    if (!previousBitmap || previousBitmap === -1n || previousBitmap === 0xffffffffffffffffn) {
      previousBitmap = null
      throw fail('SelectObject')
    }
    capturedAt = new Date().toISOString()
    if (
      !api.BitBlt(
        memoryDC,
        0,
        0,
        client.width,
        client.height,
        screenDC,
        client.x,
        client.y,
        SRCCOPY_CAPTUREBLT_NOMIRRORBITMAP
      )
    ) {
      throw fail('BitBlt(client)')
    }

    if (!api.GdiFlush()) {
      throw fail('GdiFlush')
    }
    const bgrx = api.koffi.decode(
      bits[0],
      'uint8_t',
      client.width * client.height * 4
    ) as Uint8Array
    pixels = bgrxToRgba(bgrx)
  } catch (error) {
    captureError = error
  } finally {
    const clean = (operation: string, action: () => unknown): void => {
      try {
        if (!action()) {
          cleanupErrors.push(fail(operation))
        }
      } catch (error) {
        cleanupErrors.push(error instanceof Error ? error : new Error(String(error)))
      }
    }
    if (memoryDC && previousBitmap) {
      const dc = memoryDC
      const selected = previousBitmap
      clean('Restore selected bitmap', () => api.SelectObject(dc, selected))
    }

    if (memoryDC) {
      const dc = memoryDC
      clean('DeleteDC(memory)', () => api.DeleteDC(dc))
    }

    if (bitmap) {
      const image = bitmap
      clean('DeleteObject(bitmap)', () => api.DeleteObject(image))
    }

    if (screenDC) {
      const dc = screenDC
      clean('ReleaseDC(desktop)', () => api.ReleaseDC(null, dc))
    }
  }
  if (cleanupErrors.length) {
    throw new AggregateError(
      captureError === undefined ? cleanupErrors : [captureError, ...cleanupErrors],
      'Windows party capture resource cleanup failed.'
    )
  }

  if (!pixels) {
    throw captureError ?? new Error('Windows party capture returned no pixels.')
  }

  if (capturedAt === undefined) {
    throw new Error(WINDOW_CAPTURE_ERRORS.UNAVAILABLE)
  }

  return { rgba: pixels, capturedAt }
}

export type ShortcutAccessApi = Pick<
  Win32PartyApi,
  'OpenProcess' | 'GetCurrentProcess' | 'OpenProcessToken' | 'GetTokenInformation' | 'CloseHandle'
>

function readProcessElevation(api: ShortcutAccessApi, processHandle: bigint): boolean {
  const token: Array<bigint | null> = [null]
  let elevated: boolean | undefined
  try {
    if (!api.OpenProcessToken(processHandle, TOKEN_QUERY, token) || !token[0]) {
      throw new Error(WINDOW_CAPTURE_ERRORS.UNAVAILABLE)
    }
    const elevation = Buffer.alloc(4)
    const returnLength = [0]
    if (
      !api.GetTokenInformation(
        token[0],
        TOKEN_ELEVATION,
        elevation,
        elevation.length,
        returnLength
      ) ||
      returnLength[0] !== elevation.length
    ) {
      throw new Error(WINDOW_CAPTURE_ERRORS.UNAVAILABLE)
    }
    elevated = elevation.readUInt32LE(0) !== 0
  } catch {
    // Close any acquired token before reporting a failed or throwing native query.
  }
  if (token[0] && !api.CloseHandle(token[0])) {
    throw new Error(WINDOW_CAPTURE_ERRORS.UNAVAILABLE)
  }

  if (elevated === undefined) {
    throw new Error(WINDOW_CAPTURE_ERRORS.UNAVAILABLE)
  }

  return elevated
}

/** Checks native token access and closes owned handles before reporting a privilege mismatch. */
export function assertShortcutProcessAccess(api: ShortcutAccessApi, gameProcessId: number): void {
  let gameProcess: bigint | null = null
  let gameElevated = false
  let appElevated = false
  let queryFailed = false
  try {
    gameProcess = api.OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, 0, gameProcessId)
    if (!gameProcess) {
      throw new Error(WINDOW_CAPTURE_ERRORS.UNAVAILABLE)
    }
    gameElevated = readProcessElevation(api, gameProcess)
    const currentProcess = api.GetCurrentProcess()
    if (!currentProcess) {
      throw new Error(WINDOW_CAPTURE_ERRORS.UNAVAILABLE)
    }
    // GetCurrentProcess returns a pseudo-handle, which is not owned and must not be closed.
    appElevated = readProcessElevation(api, currentProcess)
  } catch {
    queryFailed = true
  } finally {
    if (gameProcess) {
      try {
        if (!api.CloseHandle(gameProcess)) {
          queryFailed = true
        }
      } catch {
        queryFailed = true
      }
    }
  }
  if (queryFailed) {
    throw new Error(WINDOW_CAPTURE_ERRORS.UNAVAILABLE)
  }

  if (gameElevated && !appElevated) {
    throw new Error(WINDOW_CAPTURE_ERRORS.ADMIN_REQUIRED)
  }
}

/** Rejects a known elevation mismatch before arming the DNF-only Print Screen shortcut. */
export function assertDnfShortcutAccess(): void {
  if (process.platform !== 'win32') {
    throw new Error(WINDOW_CAPTURE_ERRORS.UNAVAILABLE)
  }
  try {
    const api = getApi()
    withPerMonitorV2(api, () => {
      const gameWindow = findDnfGameWindow(api)
      assertShortcutProcessAccess(api, gameWindow.pid)
    })
  } catch (error) {
    if (error instanceof Error && error.message === WINDOW_CAPTURE_ERRORS.ADMIN_REQUIRED) {
      throw error
    }
    throw new Error(WINDOW_CAPTURE_ERRORS.UNAVAILABLE)
  }
}

/** True only when the foreground top-level window is owned by DNF.exe. */
export function isDnfForeground(): boolean {
  if (process.platform !== 'win32') {
    return false
  }
  try {
    const api = getApi()

    return withPerMonitorV2(api, () => {
      const hwnd = api.GetForegroundWindow()
      if (!hwnd || !api.IsWindowVisible(hwnd) || api.IsIconic(hwnd)) {
        return false
      }

      return findDnfGameWindow(api).hwnd === hwnd
    })
  } catch {
    return false
  }
}

/** Checks process ownership so all DFragon windows can use the product shortcuts. */
export function isCurrentProcessForeground(): boolean {
  if (process.platform !== 'win32') {
    return false
  }
  try {
    const api = getApi()
    const hwnd = api.GetForegroundWindow()
    if (!hwnd || !api.IsWindowVisible(hwnd) || api.IsIconic(hwnd)) {
      return false
    }
    const processId = [0]
    api.GetWindowThreadProcessId(hwnd, processId)

    return processId[0] === process.pid
  } catch {
    return false
  }
}

/** Pure region predicate kept exportable for deterministic coverage tests. */
export function partySlotCoverageIntersectsWindow(
  client: ScreenRect,
  coverage: { x: number; y: number; width: number; height: number },
  window: WindowRect
): boolean {
  return rectsIntersect(
    {
      left: client.x + coverage.x,
      top: client.y + coverage.y,
      right: client.x + coverage.x + coverage.width,
      bottom: client.y + coverage.y + coverage.height
    },
    window
  )
}

// Keep path handling explicitly Windows-aware even when these pure utilities are exercised on macOS.
export function isDnfExecutablePath(imagePath: string): boolean {
  return win32Path.basename(imagePath).toLowerCase() === DNF_EXECUTABLE
}

/** Electron이 열거한 창 ID에서 Windows 핸들을 읽는다. */
export function windowHandleFromSource(sourceId: string): bigint {
  const match = WINDOW_SOURCE_ID_PATTERN.exec(sourceId)
  if (match === null || match[0] !== sourceId) {
    throw new Error(WINDOW_CAPTURE_ERRORS.UNAVAILABLE)
  }
  const hwnd = BigInt(match[1])
  if (hwnd > MAX_WINDOW_HANDLE) {
    throw new Error(WINDOW_CAPTURE_ERRORS.UNAVAILABLE)
  }

  return hwnd
}

function readSelectedWindow(api: Win32PartyApi, hwnd: bigint): GameWindow {
  if (!api.IsWindowVisible(hwnd) || api.IsIconic(hwnd) || isWindowCloaked(api, hwnd)) {
    throw new Error(WINDOW_CAPTURE_ERRORS.NOT_FOUND)
  }
  const pid = getProcessId(api, hwnd)
  const client = clientRectOnScreen(api, hwnd)
  if (pid === null || client === null) {
    throw new Error(WINDOW_CAPTURE_ERRORS.NOT_FOUND)
  }

  return { hwnd, pid, client }
}

function coveredClientRegions(client: ScreenRect, windows: ObscuringWindow[]): ScreenRect[] {
  const regions: ScreenRect[] = []
  for (const { rect } of windows) {
    const x = Math.max(0, rect.left - client.x)
    const y = Math.max(0, rect.top - client.y)
    const right = Math.min(client.width, rect.right - client.x)
    const bottom = Math.min(client.height, rect.bottom - client.y)
    if (right > x && bottom > y) {
      const width = right - x
      const height = bottom - y
      regions.push({ x, y, width, height })
    }
  }

  return regions
}

function captureClient(
  api: Win32PartyApi,
  select: () => GameWindow,
  hideCoveredPixels: boolean
): WindowCaptureFrame {
  return withPerMonitorV2(api, () => {
    const before = select()
    assertClientInsideVirtualScreen(api, before.client)
    const coveredBefore = coveredClientRegions(before.client, getWindowsAbove(api, before.hwnd))
    const fullyCovered = coveredBefore.some(
      (region) =>
        region.x === 0 &&
        region.y === 0 &&
        region.width === before.client.width &&
        region.height === before.client.height
    )
    if (hideCoveredPixels && fullyCovered) {
      throw new Error(WINDOW_CAPTURE_ERRORS.COVERED)
    }
    const { rgba, capturedAt } = copyVisibleClient(api, before.client)
    const after = select()
    if (!sameGameWindow(before, after)) {
      throw new Error(WINDOW_CAPTURE_ERRORS.UNAVAILABLE)
    }
    const coveredAfter = coveredClientRegions(after.client, getWindowsAbove(api, after.hwnd))
    const coveredRegions = [...coveredBefore, ...coveredAfter]
    const { width, height } = after.client
    if (
      hideCoveredPixels &&
      coveredAfter.some((region) => region.width === width && region.height === height)
    ) {
      throw new Error(WINDOW_CAPTURE_ERRORS.COVERED)
    }

    if (hideCoveredPixels) {
      // 다른 창의 픽셀은 전달하지 않고 보이는 파티 영역의 인식은 이어간다.
      for (const region of coveredRegions) {
        for (let y = region.y; y < region.y + region.height; y += 1) {
          const start = (y * width + region.x) * RGBA_CHANNELS
          const end = start + region.width * RGBA_CHANNELS
          rgba.fill(0, start, end)
        }
      }
    }

    return { width, height, rgba, capturedAt, coveredRegions }
  })
}

export type WindowCaptureTarget = { hwnd: bigint; pid: number }

/** 선택 시점의 창과 프로세스를 결합해 핸들이 재사용돼도 다른 창을 읽지 않는다. */
export function selectWindowClient(sourceId: string): WindowCaptureTarget {
  if (process.platform !== 'win32') {
    throw new Error(WINDOW_CAPTURE_ERRORS.UNAVAILABLE)
  }
  const hwnd = windowHandleFromSource(sourceId)
  const api = getApi()
  const pid = getProcessId(api, hwnd)
  if (pid === null) {
    throw new Error(WINDOW_CAPTURE_ERRORS.NOT_FOUND)
  }

  return { hwnd, pid }
}

/** 선택한 창의 클라이언트 영역을 읽고 다른 창에 가려진 픽셀은 투명하게 제외한다. */
export function captureWindowClient(target: WindowCaptureTarget): WindowCaptureFrame {
  if (process.platform !== 'win32') {
    throw new Error(WINDOW_CAPTURE_ERRORS.UNAVAILABLE)
  }
  const api = getApi()

  return captureClient(
    api,
    () => {
      const window = readSelectedWindow(api, target.hwnd)
      if (window.pid !== target.pid) {
        throw new Error(WINDOW_CAPTURE_ERRORS.NOT_FOUND)
      }

      return window
    },
    true
  )
}

/** 개발자 수집용 DNF 창을 같은 GDI 구현으로 읽고 검출 영역의 가림 판단에 필요한 정보를 돌려준다. */
export function captureDnfClient(): WindowCaptureFrame {
  if (process.platform !== 'win32') {
    throw new Error(WINDOW_CAPTURE_ERRORS.UNAVAILABLE)
  }
  const api = getApi()

  return captureClient(api, () => findDnfGameWindow(api), false)
}

/** 프레임 안의 관심 영역이 캡처 전후에 다른 창과 겹쳤는지 검사한다. */
export function isCapturedRegionCovered(frame: WindowCaptureFrame, region: ScreenRect): boolean {
  return frame.coveredRegions.some(
    (covered) =>
      region.x < covered.x + covered.width &&
      covered.x < region.x + region.width &&
      region.y < covered.y + covered.height &&
      covered.y < region.y + region.height
  )
}
