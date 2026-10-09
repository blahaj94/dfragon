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

async function click(label: string): Promise<void> {
  const button = [...document.querySelectorAll('button')].find(
    (b) => b.textContent === label || b.getAttribute('aria-label') === label
  )
  expect(button).toBeDefined()
  await act(async () => button!.click())
}
async function select(id: string): Promise<void> {
  const trigger = document.querySelector<HTMLButtonElement>('button[aria-haspopup="menu"]')!
  await act(async () => trigger.click())
  const label = id === 'game' ? 'Synthetic game' : 'Next game'
  const option = [...document.querySelectorAll<HTMLElement>('[role="menuitemradio"]')].find(
    (item) => item.getAttribute('aria-label') === label
  )
  expect(option).toBeDefined()
  await act(async () => option!.click())
}

it('앱 시작 때 실행 중인 던파가 하나면 자동으로 캡처와 OCR을 준비한다', async () => {
  const f = createRendererFixture()
  f.capture.listCaptureSources.mockResolvedValue([{ id: 'game', name: '던전앤파이터' }])
  await f.mount(
    <ColorThemeProvider>
      <App />
    </ColorThemeProvider>
  )
  expect(f.capture.listCaptureSources).toHaveBeenCalledOnce()
  expect(f.readCaptureFrame).toHaveBeenCalledOnce()
  expect(media.worker).toHaveBeenCalledOnce()
  await click('화면 캡처')
  expect(document.querySelector('button[aria-haspopup="menu"]')?.textContent).toContain(
    '던전앤파이터'
  )
  expect(document.body.textContent).toContain('캡처 중, 1920×1080')
  expect(f.capture.selectCaptureSource).toHaveBeenCalledWith('game')
  expect(f.readCaptureFrame).toHaveBeenCalledOnce()
})

it('카메라에서 시작하고 모달, 로그인 상태가 바뀌어도 캡처와 카드 인식값을 유지한다', async () => {
  const f = createRendererFixture()
  media.crops.mockReturnValue([document.createElement('canvas'), null, null, null])
  await f.mount(
    <ColorThemeProvider>
      <App />
    </ColorThemeProvider>
  )
  await click('화면 캡처')
  expect(document.querySelector('[role="dialog"]')).not.toBeNull()
  await select('game')
  expect(f.readCaptureFrame).toHaveBeenCalledOnce()
  expect(document.body.textContent).toContain('캡처 중, 1920×1080')
  await f.cycle(3)
  expect(f.capture.notifyOcrCandidatesDetected).toHaveBeenCalledOnce()
  expect(f.capture.notifyOcrCandidatesDetected).toHaveBeenCalledWith(
    expect.objectContaining({
      nickname: 'ALICE',
      candidateNicknames: ['ALICE'],
      portrait: null
    })
  )
  expect(f.capture.notifyStableNicknameDetected).not.toHaveBeenCalled()
  expect(f.container.textContent).toContain('얼굴 인식 대기')
  expect(f.container.querySelector<HTMLInputElement>('[aria-label="1번 캐릭터 이름"]')!.value).toBe(
    'ALICE'
  )
  await click('닫기')
  const cards = [...f.container.querySelectorAll('article')]

  await f.emitAuth(authSnapshot({ revision: 2, signedIn: false }))
  expect(
    [...f.container.querySelectorAll('article')].every((card, index) => card === cards[index])
  ).toBe(true)

  await click('화면 캡처')
  expect(document.body.textContent).toContain('캡처 중지')
  await click('캡처 중지')

  expect(f.resources.worker.terminate).toHaveBeenCalledOnce()
  expect(f.container.querySelector<HTMLInputElement>('[aria-label="1번 캐릭터 이름"]')!.value).toBe(
    ''
  )
  await select('game')
  expect(
    f.search.controlCharacterSearch.mock.calls.filter(([input]) => input.action === 'begin')
  ).toHaveLength(2)
})

it('캡처 중 다른 창을 선택하면 기존 stream을 정리하고 새 대상으로 시작한다', async () => {
  const f = createRendererFixture()
  const next = captureResources()
  f.readCaptureFrame.mockResolvedValueOnce(f.resources.frame).mockResolvedValueOnce(next.frame)
  media.worker.mockResolvedValueOnce(f.resources.worker).mockResolvedValueOnce(next.worker)
  await f.mount(
    <ColorThemeProvider>
      <App />
    </ColorThemeProvider>
  )
  await click('화면 캡처')
  await select('game')
  const firstLoop = media.loop.mock.calls[0][0]
  await select('next')
  expect(f.capture.selectCaptureSource).toHaveBeenLastCalledWith('next')
  expect(f.readCaptureFrame).toHaveBeenCalledTimes(2)

  expect(f.resources.worker.terminate).toHaveBeenCalledOnce()
  expect(firstLoop.signal.aborted).toBe(true)

  expect(next.worker.terminate).not.toHaveBeenCalled()
  expect(document.querySelector('button[aria-haspopup="menu"]')?.textContent).toContain('Next game')

  expect(document.body.textContent).toContain('캡처 중, 1920×1080')

  await click('캡처 중지')

  expect(next.worker.terminate).toHaveBeenCalledOnce()
  expect(media.loop.mock.calls[1][0].signal.aborted).toBe(true)

  expect(f.resources.worker.terminate).toHaveBeenCalledOnce()
})

it('연속 창 선택에서 먼저 고른 창의 늦은 등록은 현재 캡처를 교체하지 않는다', async () => {
  const f = createRendererFixture()
  const firstSelection = Promise.withResolvers<{ id: string; name: string }>()
  f.capture.selectCaptureSource.mockReturnValueOnce(firstSelection.promise)
  await f.mount(
    <ColorThemeProvider>
      <App />
    </ColorThemeProvider>
  )
  await click('화면 캡처')
  await select('game')
  expect(f.readCaptureFrame).not.toHaveBeenCalled()

  await select('next')
  expect(f.readCaptureFrame).toHaveBeenCalledOnce()
  expect(document.querySelector('button[aria-haspopup="menu"]')?.textContent).toContain('Next game')
  await act(async () => firstSelection.resolve({ id: 'game', name: 'Synthetic game' }))

  expect(f.readCaptureFrame).toHaveBeenCalledOnce()
  expect(media.worker).toHaveBeenCalledOnce()

  expect(document.querySelector('button[aria-haspopup="menu"]')?.textContent).toContain('Next game')
  expect(document.body.textContent).toContain('캡처 중, 1920×1080')
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
  await click('화면 캡처')
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
  await click('화면 캡처')
  expect(document.body.textContent).toContain('조회 실패')
  f.capture.listCaptureSources.mockResolvedValue([])
  await click('캡처할 프로세스 선택')
  const refresh = [...document.querySelectorAll<HTMLElement>('[role="menuitem"]')].find((item) =>
    item.textContent?.includes('창 목록 새로고침')
  )!
  await act(async () => refresh.click())
  expect(document.body.textContent).toContain('창 미감지')
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
  await click('화면 캡처')
  await select('game')
  expect(document.body.textContent).toContain('준비 중')
  expect(document.querySelector('button[aria-haspopup="menu"]')?.textContent).toContain(
    'Synthetic game'
  )
  await click('캡처 중지')
  expect(document.body.textContent).toContain('캡처를 중지했습니다.')
  expect(document.body.textContent).not.toContain('준비 중')
  await act(async () => selection.resolve({ id: 'game', name: 'Synthetic game' }))
  expect(f.readCaptureFrame).not.toHaveBeenCalled()
  expect(document.body.textContent).toContain('캡처를 중지했습니다.')
  expect(document.body.textContent).not.toContain('캡처 시작을 눌러 주세요.')
})
