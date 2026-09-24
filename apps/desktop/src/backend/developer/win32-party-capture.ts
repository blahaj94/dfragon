import { win32 as win32Path } from 'node:path'
import { createRequire } from 'node:module'
import { detectPartyFrameGeometry, PartyFrameGeometryError } from './party-frame-geometry'
import { MAX_IMAGE_DIMENSION, MAX_IMAGE_PIXELS } from './persistence'
import { bgrxToRgba } from './win32-capture'

export type PartyFrameSlot = {
  slot: 1 | 2 | 3 | 4
  width: number
  height: number
  rgba: Buffer
}

export type PartyFrameCapture = {
  width: number
  height: number
  scale: number
  capturedAt: string
  slots: PartyFrameSlot[]
}

type Rect = { left: number; top: number; right: number; bottom: number }
type ScreenRect = { x: number; y: number; width: number; height: number }
type DetectedPartySlot = {
  slot: 1 | 2 | 3 | 4
  x: number
  y: number
  width: number
  height: number
  coverage: { x: number; y: number; width: number; height: number }
}
type GameWindow = {
  hwnd: bigint
  pid: number
  client: ScreenRect
}
type ObscuringWindow = { hwnd: bigint; rect: Rect }

type Koffi = typeof import('koffi')
type Win32PartyApi = {
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
const MIN_CLIENT_WIDTH = 1067
const MAX_CLIENT_WIDTH = 1920
const MIN_CLIENT_HEIGHT = 600
const MAX_CLIENT_HEIGHT = 1080
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
  return {
    koffi,
    enumWindowsProc,
    SetThreadDpiAwarenessContext: user32.func(
      'void * __stdcall SetThreadDpiAwarenessContext(void *context)'
    ),
    EnumWindows: user32.func('__stdcall', 'EnumWindows', 'int32_t', [
      koffi.pointer(enumWindowsProc),
      'intptr_t'
    ]),
    IsWindowVisible: user32.func('int __stdcall IsWindowVisible(void *hwnd)'),
    IsIconic: user32.func('int __stdcall IsIconic(void *hwnd)'),
    GetForegroundWindow: user32.func('void * __stdcall GetForegroundWindow()'),
    GetWindow: user32.func('void * __stdcall GetWindow(void *hwnd, uint32_t command)'),
    GetWindowThreadProcessId: user32.func(
      'uint32_t __stdcall GetWindowThreadProcessId(void *hwnd, _Out_ uint32_t *processId)'
    ),
    GetClientRect: user32.func('int __stdcall GetClientRect(void *hwnd, _Out_ void *rect)'),
    ClientToScreen: user32.func('int __stdcall ClientToScreen(void *hwnd, _Inout_ void *point)'),
    GetWindowRect: user32.func('int __stdcall GetWindowRect(void *hwnd, _Out_ void *rect)'),
    GetSystemMetrics: user32.func('int __stdcall GetSystemMetrics(int index)'),
    OpenProcess: kernel32.func(
      'void * __stdcall OpenProcess(uint32_t desiredAccess, int inheritHandle, uint32_t processId)'
    ),
    GetCurrentProcess: kernel32.func('void * __stdcall GetCurrentProcess()'),
    OpenProcessToken: advapi32.func(
      'int __stdcall OpenProcessToken(void *process, uint32_t access, _Out_ void **token)'
    ),
    GetTokenInformation: advapi32.func(
      'int __stdcall GetTokenInformation(void *token, int informationClass, _Out_ void *information, uint32_t informationLength, _Out_ uint32_t *returnLength)'
    ),
    QueryFullProcessImageNameW: kernel32.func(
      'int __stdcall QueryFullProcessImageNameW(void *process, uint32_t flags, _Out_ uint16_t *imagePath, _Inout_ uint32_t *characterCount)'
    ),
    CloseHandle: kernel32.func('int __stdcall CloseHandle(void *handle)'),
    GetDC: user32.func('void * __stdcall GetDC(void *hwnd)'),
    ReleaseDC: user32.func('int __stdcall ReleaseDC(void *hwnd, void *dc)'),
    CreateCompatibleDC: gdi32.func('void * __stdcall CreateCompatibleDC(void *dc)'),
    CreateDIBSection: gdi32.func(
      'void * __stdcall CreateDIBSection(void *dc, const void *info, uint32_t usage, _Out_ void **bits, void *section, uint32_t offset)'
    ),
    SelectObject: gdi32.func('void * __stdcall SelectObject(void *dc, void *object)'),
    BitBlt: gdi32.func(
      'int __stdcall BitBlt(void *target, int x, int y, int width, int height, void *source, int sourceX, int sourceY, uint32_t operation)'
    ),
    GdiFlush: gdi32.func('int __stdcall GdiFlush()'),
    DeleteObject: gdi32.func('int __stdcall DeleteObject(void *object)'),
    DeleteDC: gdi32.func('int __stdcall DeleteDC(void *dc)'),
    DwmGetWindowAttribute: dwmapi.func(
      'int32_t __stdcall DwmGetWindowAttribute(void *hwnd, uint32_t attribute, _Out_ void *value, uint32_t size)'
    ),
    GetLastError: kernel32.func('uint32_t __stdcall GetLastError()')
  } as Win32PartyApi
}

let win32PartyApi: Win32PartyApi | undefined

function getApi(): Win32PartyApi {
  return (win32PartyApi ??= loadWin32PartyApi())
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

function readRect(api: Win32PartyApi, hwnd: bigint, getRect: Win32PartyApi['GetWindowRect']): Rect {
  const buffer = Buffer.alloc(16)
  if (!getRect(hwnd, buffer)) {
    throw nativeFailure(api, getRect === api.GetClientRect ? 'GetClientRect' : 'GetWindowRect')
  }
  return {
    left: buffer.readInt32LE(0),
    top: buffer.readInt32LE(4),
    right: buffer.readInt32LE(8),
    bottom: buffer.readInt32LE(12)
  }
}

function clientScreenOrigin(api: Win32PartyApi, hwnd: bigint): { x: number; y: number } {
  const point = Buffer.alloc(8)
  if (!api.ClientToScreen(hwnd, point)) {
    throw nativeFailure(api, 'ClientToScreen')
  }
  return { x: point.readInt32LE(0), y: point.readInt32LE(4) }
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

function isValidClientSize(width: number, height: number): boolean {
  return (
    width >= MIN_CLIENT_WIDTH &&
    width <= MAX_CLIENT_WIDTH &&
    height >= MIN_CLIENT_HEIGHT &&
    height <= MAX_CLIENT_HEIGHT
  )
}

function clientRectOnScreen(api: Win32PartyApi, hwnd: bigint): ScreenRect | null {
  const rect = readRect(api, hwnd, api.GetClientRect)
  const width = rect.right - rect.left
  const height = rect.bottom - rect.top
  if (rect.left !== 0 || rect.top !== 0 || !isValidClientSize(width, height)) {
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
  if (matches.length !== 1) {
    throw new Error('DEVELOPER_CAPTURE_UNAVAILABLE')
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
      throw new Error('DEVELOPER_CAPTURE_UNAVAILABLE')
    }
    seen.add(current)
    if (api.IsWindowVisible(current) && !api.IsIconic(current) && !isWindowCloaked(api, current)) {
      windows.push({ hwnd: current, rect: readRect(api, current, api.GetWindowRect) })
    }
    current = api.GetWindow(current, GW_HWNDPREV)
  }
  if (current) {
    throw new Error('DEVELOPER_CAPTURE_UNAVAILABLE')
  }
  return windows
}

function isWindowCloaked(api: Win32PartyApi, hwnd: bigint): boolean {
  const value = Buffer.alloc(4)
  const result = api.DwmGetWindowAttribute(hwnd, DWMWA_CLOAKED, value, value.length)
  return result >= 0 && value.readUInt32LE(0) !== 0
}

function rectsIntersect(left: Rect, right: Rect): boolean {
  return (
    left.left < right.right &&
    right.left < left.right &&
    left.top < right.bottom &&
    right.top < left.bottom
  )
}

/** Validates detector output without filling gaps between independently detected frames. */
export function hasValidDetectedPartySlots(
  value: unknown,
  frameWidth: number,
  frameHeight: number
): value is DetectedPartySlot[] {
  if (
    !Number.isSafeInteger(frameWidth) ||
    !Number.isSafeInteger(frameHeight) ||
    frameWidth <= 0 ||
    frameHeight <= 0 ||
    !Array.isArray(value) ||
    value.length < 1 ||
    value.length > 4
  ) {
    return false
  }

  const seenSlots = new Set<number>()
  return value.every((candidate) => {
    if (candidate == null || typeof candidate !== 'object' || Array.isArray(candidate)) {
      return false
    }
    const slot = candidate as Record<string, unknown>
    const coverage = slot.coverage
    const slotNumber = slot.slot
    const cropX = slot.x
    const cropY = slot.y
    const cropWidth = slot.width
    const cropHeight = slot.height
    if (
      (slotNumber !== 1 && slotNumber !== 2 && slotNumber !== 3 && slotNumber !== 4) ||
      seenSlots.has(slotNumber) ||
      !Number.isSafeInteger(cropX) ||
      !Number.isSafeInteger(cropY) ||
      !Number.isSafeInteger(cropWidth) ||
      !Number.isSafeInteger(cropHeight) ||
      (cropX as number) < 0 ||
      (cropY as number) < 0 ||
      (cropWidth as number) <= 0 ||
      (cropHeight as number) <= 0 ||
      (cropX as number) + (cropWidth as number) > frameWidth ||
      (cropY as number) + (cropHeight as number) > frameHeight ||
      coverage == null ||
      typeof coverage !== 'object' ||
      Array.isArray(coverage)
    ) {
      return false
    }
    const visibleRegion = coverage as Record<string, unknown>
    const x = visibleRegion.x
    const y = visibleRegion.y
    const width = visibleRegion.width
    const height = visibleRegion.height
    if (
      !Number.isSafeInteger(x) ||
      !Number.isSafeInteger(y) ||
      !Number.isSafeInteger(width) ||
      !Number.isSafeInteger(height) ||
      (x as number) < 0 ||
      (y as number) < 0 ||
      (width as number) <= 0 ||
      (height as number) <= 0 ||
      (x as number) + (width as number) > frameWidth ||
      (y as number) + (height as number) > frameHeight
    ) {
      return false
    }
    seenSlots.add(slotNumber)
    return true
  })
}

function isPartyRegionCovered(
  client: ScreenRect,
  slots: DetectedPartySlot[],
  windowsAbove: ObscuringWindow[]
): boolean {
  const slotRects = slots.map((slot) => {
    const { coverage } = slot
    return {
      left: client.x + coverage.x,
      top: client.y + coverage.y,
      right: client.x + coverage.x + coverage.width,
      bottom: client.y + coverage.y + coverage.height
    }
  })
  return windowsAbove.some(({ rect }) => slotRects.some((slot) => rectsIntersect(rect, slot)))
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
    throw new Error('DEVELOPER_CAPTURE_UNAVAILABLE')
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
    throw new Error('DEVELOPER_CAPTURE_UNAVAILABLE')
  }
  return { rgba: pixels, capturedAt }
}

function cropSlot(
  frame: Buffer,
  frameWidth: number,
  slot: {
    slot: 1 | 2 | 3 | 4
    x: number
    y: number
    width: number
    height: number
  }
): PartyFrameSlot {
  const output = Buffer.allocUnsafe(slot.width * slot.height * 4)
  const rowBytes = slot.width * 4
  for (let row = 0; row < slot.height; row += 1) {
    const sourceStart = ((slot.y + row) * frameWidth + slot.x) * 4
    frame.copy(output, row * rowBytes, sourceStart, sourceStart + rowBytes)
  }
  return { slot: slot.slot, width: slot.width, height: slot.height, rgba: output }
}

function capturePartyFrameWithApi(api: Win32PartyApi): PartyFrameCapture {
  return withPerMonitorV2(api, () => {
    const gameWindowBefore = findDnfGameWindow(api)
    assertClientInsideVirtualScreen(api, gameWindowBefore.client)
    const windowsAboveBefore = getWindowsAbove(api, gameWindowBefore.hwnd)
    const { rgba, capturedAt } = copyVisibleClient(api, gameWindowBefore.client)
    const gameWindowAfter = findDnfGameWindow(api)
    if (!sameGameWindow(gameWindowBefore, gameWindowAfter)) {
      throw new Error('DEVELOPER_CAPTURE_UNAVAILABLE')
    }
    const windowsAboveAfter = getWindowsAbove(api, gameWindowAfter.hwnd)
    const { scale, slots } = detectPartyFrameGeometry({
      width: gameWindowAfter.client.width,
      height: gameWindowAfter.client.height,
      rgba
    })
    if (
      !Number.isFinite(scale) ||
      scale <= 0 ||
      !hasValidDetectedPartySlots(
        slots,
        gameWindowAfter.client.width,
        gameWindowAfter.client.height
      )
    ) {
      throw new Error('DEVELOPER_PARTY_SLOTS_NOT_FOUND')
    }
    if (
      isPartyRegionCovered(gameWindowBefore.client, slots, windowsAboveBefore) ||
      isPartyRegionCovered(gameWindowAfter.client, slots, windowsAboveAfter)
    ) {
      throw new Error('DEVELOPER_CAPTURE_UNAVAILABLE')
    }
    if (
      gameWindowAfter.client.width > MAX_IMAGE_DIMENSION ||
      gameWindowAfter.client.height > MAX_IMAGE_DIMENSION ||
      gameWindowAfter.client.width * gameWindowAfter.client.height > MAX_IMAGE_PIXELS
    ) {
      throw new Error('DEVELOPER_CAPTURE_UNAVAILABLE')
    }
    return {
      width: gameWindowAfter.client.width,
      height: gameWindowAfter.client.height,
      scale,
      capturedAt,
      slots: slots.map((slot) => cropSlot(rgba, gameWindowAfter.client.width, slot))
    }
  })
}

/** Captures one fresh DNF client frame synchronously, returning only detected raw slot crops. */
export function capturePartyFrame(): PartyFrameCapture {
  if (process.platform !== 'win32') {
    throw new Error('DEVELOPER_CAPTURE_UNAVAILABLE')
  }
  try {
    return capturePartyFrameWithApi(getApi())
  } catch (error) {
    if (error instanceof PartyFrameGeometryError) {
      throw new Error('DEVELOPER_PARTY_SLOTS_NOT_FOUND', { cause: error })
    }
    if (error instanceof Error && error.message.startsWith('DEVELOPER_')) {
      throw error
    }
    throw new Error('DEVELOPER_CAPTURE_UNAVAILABLE', { cause: error })
  }
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
      throw new Error('DEVELOPER_CAPTURE_UNAVAILABLE')
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
      throw new Error('DEVELOPER_CAPTURE_UNAVAILABLE')
    }
    elevated = elevation.readUInt32LE(0) !== 0
  } catch {
    // Close any acquired token before reporting a failed or throwing native query.
  }
  if (token[0] && !api.CloseHandle(token[0])) {
    throw new Error('DEVELOPER_CAPTURE_UNAVAILABLE')
  }
  if (elevated === undefined) {
    throw new Error('DEVELOPER_CAPTURE_UNAVAILABLE')
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
      throw new Error('DEVELOPER_CAPTURE_UNAVAILABLE')
    }
    gameElevated = readProcessElevation(api, gameProcess)
    const currentProcess = api.GetCurrentProcess()
    if (!currentProcess) {
      throw new Error('DEVELOPER_CAPTURE_UNAVAILABLE')
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
    throw new Error('DEVELOPER_CAPTURE_UNAVAILABLE')
  }
  if (gameElevated && !appElevated) {
    throw new Error('DEVELOPER_ADMIN_REQUIRED')
  }
}

/** Rejects a known elevation mismatch before arming the DNF-only Print Screen shortcut. */
export function assertDnfShortcutAccess(): void {
  if (process.platform !== 'win32') {
    throw new Error('DEVELOPER_CAPTURE_UNAVAILABLE')
  }
  try {
    const api = getApi()
    withPerMonitorV2(api, () => {
      const gameWindow = findDnfGameWindow(api)
      assertShortcutProcessAccess(api, gameWindow.pid)
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'DEVELOPER_ADMIN_REQUIRED') {
      throw error
    }
    throw new Error('DEVELOPER_CAPTURE_UNAVAILABLE')
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

/** Pure region predicate kept exportable for deterministic coverage tests. */
export function partySlotCoverageIntersectsWindow(
  client: ScreenRect,
  coverage: { x: number; y: number; width: number; height: number },
  window: Rect
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
