// @vitest-environment jsdom
import { act } from 'react'
import { beforeEach, afterEach, expect, it, vi } from 'vitest'
import {
  createRendererFixture,
  captureResources,
  authSnapshot,
  media
} from './testing/fixtures/search-renderer-test-fixture'
import App from './App'
import { ColorThemeProvider } from './components/ColorThemeProvider'

beforeEach(() => {
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({ matches: false }))
  )
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe(): void {
        return
      }
      unobserve(): void {
        return
      }
      disconnect(): void {
        return
      }
    }
  )
})
afterEach(() => vi.unstubAllGlobals())

// 상단 내비의 검색 하위 메뉴도 menu trigger이므로 캡처 대화상자 안의 창 선택만 찾는다.
const CAPTURE_SOURCE_TRIGGER = '[role="dialog"] button[aria-haspopup="menu"]'

async function click(label: string): Promise<void> {
  const button = [...document.querySelectorAll('button')].find(
    (b) => b.textContent === label || b.getAttribute('aria-label') === label
  )
  expect(button).toBeDefined()
  await act(async () => button!.click())
}
// 상단 바의 게임 연결 상태 칩이 캡처 대화상자를 연다. 칩의 이름은 현재 상태를 함께 담는다.
async function openCaptureDialog(): Promise<void> {
  const chip = document.querySelector<HTMLButtonElement>(
    'main > header button[aria-label^="화면 캡처, "]'
  )
  expect(chip).not.toBeNull()
  await act(async () => chip!.click())
}
async function select(id: string): Promise<void> {
  const trigger = document.querySelector<HTMLButtonElement>(CAPTURE_SOURCE_TRIGGER)!
  await act(async () => trigger.click())
  const label = id === 'game' ? 'Synthetic game' : 'Next game'
  const option = [...document.querySelectorAll<HTMLElement>('[role="menuitemradio"]')].find(
    (item) => item.getAttribute('aria-label') === label
  )
  expect(option).toBeDefined()
  await act(async () => option!.click())
}

// 캡처 대화상자 문구가 섞이지 않도록 대화상자를 뺀 상단 바 글자만 읽는다.
function topBarText(): string | null {
  const header = document.querySelector('main > header')!.cloneNode(true) as HTMLElement
  for (const dialog of header.querySelectorAll('[role="dialog"]')) {
    dialog.remove()
  }

  return header.textContent
}

it('앱 시작 때 던파가 하나면 등록만 하고 Alt+R 전까지 기다린다', async () => {
  const f = createRendererFixture()
  f.capture.listCaptureSources.mockResolvedValue([{ id: 'game', name: '던전앤파이터' }])
  await f.mount(
    <ColorThemeProvider>
      <App />
    </ColorThemeProvider>
  )
  expect(f.capture.selectCaptureSource).toHaveBeenCalledWith('game')
  expect(f.readCaptureFrame).not.toHaveBeenCalled()
  expect(media.worker).not.toHaveBeenCalled()
  expect(f.search.controlCharacterSearch).not.toHaveBeenCalledWith({ action: 'begin' })
  await openCaptureDialog()
  expect(document.querySelector(CAPTURE_SOURCE_TRIGGER)?.textContent).toContain('던전앤파이터')
  expect(document.querySelector('[role="dialog"]')?.textContent).toContain(
    'Alt+R을 눌러 파티를 인식해 주세요.'
  )
  expect(topBarText()).toContain('창 감지됨')
})

it('창 선택 뒤 Alt+R로 한 번 인식하고 모달, 로그인 변경 뒤에도 이름과 검색 수명을 유지한다', async () => {
  const f = createRendererFixture()
  media.crops.mockReturnValue([document.createElement('canvas'), null, null, null])
  const pending = Promise.withResolvers<Awaited<ReturnType<typeof f.resources.worker.recognize>>>()
  f.resources.worker.recognize.mockReturnValueOnce(pending.promise)
  await f.mount(
    <ColorThemeProvider>
      <App />
    </ColorThemeProvider>
  )
  await openCaptureDialog()
  await select('game')
  expect(f.readCaptureFrame).not.toHaveBeenCalled()
  await f.restart()
  expect(topBarText()).toContain('인식 중')
  await act(async () =>
    pending.resolve({
      data: {
        text: 'ALICE',
        confidence: 1,
        candidates: [{ nickname: 'ALICE', rank: 1, modelScore: 1 }]
      }
    })
  )
  expect(f.readCaptureFrame).toHaveBeenCalledOnce()
  expect(topBarText()).toContain('인식 완료')
  expect(f.capture.notifyOcrCandidatesDetected).toHaveBeenCalledExactlyOnceWith(
    expect.objectContaining({ nickname: 'ALICE', candidateNicknames: ['ALICE'], portrait: null })
  )
  expect(f.capture.notifyStableNicknameDetected).not.toHaveBeenCalled()
  expect(f.container.textContent).toContain('얼굴 인식 대기')
  expect(f.container.querySelector<HTMLInputElement>('[aria-label="1번 캐릭터 이름"]')!.value).toBe(
    'ALICE'
  )
  const captureId = f.current().captureId
  expect(captureId).not.toBeNull()
  await click('닫기')
  const cards = [...f.container.querySelectorAll('article')]
  await f.emitAuth(authSnapshot({ revision: 2, signedIn: false }))
  expect(
    [...f.container.querySelectorAll('article')].every((card, index) => card === cards[index])
  ).toBe(true)
  expect(f.container.querySelector<HTMLInputElement>('[aria-label="1번 캐릭터 이름"]')!.value).toBe(
    'ALICE'
  )
  expect(f.search.controlCharacterSearch).not.toHaveBeenCalledWith({ action: 'end', captureId })
  await openCaptureDialog()
  await click('캡처 중지')
  expect(f.search.controlCharacterSearch).toHaveBeenCalledWith({ action: 'end', captureId })
  expect(f.container.querySelector<HTMLInputElement>('[aria-label="1번 캐릭터 이름"]')!.value).toBe(
    ''
  )
  await f.restart()
  expect(f.readCaptureFrame).toHaveBeenCalledOnce()
  await select('game')
  expect(f.readCaptureFrame).toHaveBeenCalledOnce()
  await f.restart()
  expect(
    f.search.controlCharacterSearch.mock.calls.filter(([input]) => input.action === 'begin')
  ).toHaveLength(2)
})

it('다른 창 선택은 진행 중 OCR을 취소하고 새 창만 등록한다', async () => {
  const f = createRendererFixture()
  const next = captureResources()
  const pending = Promise.withResolvers<Awaited<ReturnType<typeof f.resources.worker.recognize>>>()
  media.crops.mockReturnValue([document.createElement('canvas'), null, null, null])
  f.resources.worker.recognize.mockReturnValueOnce(pending.promise)
  media.worker.mockResolvedValueOnce(f.resources.worker).mockResolvedValueOnce(next.worker)
  await f.mount(
    <ColorThemeProvider>
      <App />
    </ColorThemeProvider>
  )
  await openCaptureDialog()
  await select('game')
  await f.restart()
  const signal = media.worker.mock.calls[0][0] as AbortSignal
  await select('next')
  expect(signal.aborted).toBe(true)
  expect(f.capture.selectCaptureSource).toHaveBeenLastCalledWith('next')
  expect(f.readCaptureFrame).toHaveBeenCalledOnce()
  await act(async () =>
    pending.resolve({
      data: {
        text: 'OLD',
        confidence: 1,
        candidates: [{ nickname: 'OLD', rank: 1, modelScore: 1 }]
      }
    })
  )
  expect(f.resources.worker.terminate).toHaveBeenCalledOnce()
  expect(f.capture.notifyOcrCandidatesDetected).not.toHaveBeenCalled()
  expect(document.querySelector(CAPTURE_SOURCE_TRIGGER)?.textContent).toContain('Next game')
  expect(document.querySelector('[role="dialog"]')?.textContent).toContain(
    'Alt+R을 눌러 파티를 인식해 주세요.'
  )
  await f.restart()
  expect(f.readCaptureFrame).toHaveBeenCalledTimes(2)
  expect(topBarText()).toContain('인식 완료')
  expect(next.worker.terminate).toHaveBeenCalledOnce()
})

it('연속 창 선택에서 이전 등록의 늦은 응답은 현재 선택을 바꾸거나 캡처하지 않는다', async () => {
  const f = createRendererFixture()
  const firstSelection = Promise.withResolvers<{ id: string; name: string }>()
  f.capture.selectCaptureSource.mockReturnValueOnce(firstSelection.promise)
  await f.mount(
    <ColorThemeProvider>
      <App />
    </ColorThemeProvider>
  )
  await openCaptureDialog()
  await select('game')
  await select('next')
  await act(async () => firstSelection.resolve({ id: 'game', name: 'Synthetic game' }))
  expect(f.readCaptureFrame).not.toHaveBeenCalled()
  expect(media.worker).not.toHaveBeenCalled()
  expect(document.querySelector(CAPTURE_SOURCE_TRIGGER)?.textContent).toContain('Next game')
  expect(document.querySelector('[role="dialog"]')?.textContent).toContain(
    'Alt+R을 눌러 파티를 인식해 주세요.'
  )
})

it('창 등록 중 화면을 해제하면 늦은 완료가 캡처나 OCR을 시작하지 않는다', async () => {
  const f = createRendererFixture()
  const selection = Promise.withResolvers<{ id: string; name: string }>()
  f.capture.selectCaptureSource.mockReturnValueOnce(selection.promise)
  await f.mount(
    <ColorThemeProvider>
      <App />
    </ColorThemeProvider>
  )
  await openCaptureDialog()
  await select('game')
  await f.unmount()
  await act(async () => selection.resolve({ id: 'game', name: 'Synthetic game' }))

  expect(f.capture.selectCaptureSource).toHaveBeenLastCalledWith('')
  expect(f.readCaptureFrame).not.toHaveBeenCalled()
  expect(media.worker).not.toHaveBeenCalled()
  expect(f.search.controlCharacterSearch).not.toHaveBeenCalledWith({ action: 'begin' })
  expect(document.querySelector('[role="dialog"]')).toBeNull()
})

it('빈 목록과 조회 실패를 표시하고 새로고침으로 복구한다', async () => {
  const f = createRendererFixture()
  f.capture.listCaptureSources.mockRejectedValue(new Error('List failed'))
  await f.mount(
    <ColorThemeProvider>
      <App />
    </ColorThemeProvider>
  )
  await openCaptureDialog()
  expect(document.querySelector('[role="dialog"]')?.textContent).toContain('조회 실패')
  expect(topBarText()).toContain('조회 실패')
  f.capture.listCaptureSources.mockResolvedValue([])
  await click('게임 창 선택')
  const refresh = [...document.querySelectorAll<HTMLElement>('[role="menuitem"]')].find((item) =>
    item.textContent?.includes('창 목록 새로고침')
  )!
  await act(async () => refresh.click())
  expect(document.querySelector('[role="dialog"]')?.textContent).toContain('창 미감지')
  expect(topBarText()).toContain('창 미감지')
  expect(f.readCaptureFrame).not.toHaveBeenCalled()
})

it('창 등록 대기 중에도 중지할 수 있고 늦은 완료가 중지 상태를 덮어쓰지 않는다', async () => {
  const f = createRendererFixture()
  const selection = Promise.withResolvers<{ id: string; name: string }>()
  f.capture.selectCaptureSource.mockReturnValueOnce(selection.promise)
  await f.mount(
    <ColorThemeProvider>
      <App />
    </ColorThemeProvider>
  )
  await openCaptureDialog()
  await select('game')
  expect(document.querySelector('[role="dialog"]')?.textContent).toContain('준비 중')
  expect(topBarText()).toContain('준비 중')
  expect(document.querySelector(CAPTURE_SOURCE_TRIGGER)?.textContent).toContain('Synthetic game')
  await click('캡처 중지')
  expect(document.querySelector('[role="dialog"]')?.textContent).toContain('캡처를 중지했습니다.')
  expect(document.body.textContent).not.toContain('준비 중')
  await act(async () => selection.resolve({ id: 'game', name: 'Synthetic game' }))
  expect(f.readCaptureFrame).not.toHaveBeenCalled()
  expect(document.querySelector('[role="dialog"]')?.textContent).toContain('캡처를 중지했습니다.')
  expect(document.body.textContent).not.toContain('캡처 시작을 눌러 주세요.')
})
