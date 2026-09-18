// @vitest-environment jsdom
import { act } from 'react'
import { beforeEach, afterEach, expect, it, vi } from 'vitest'
import {
  createRendererFixture,
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

it('카메라에서 시작하고 모달·로그인 상태가 바뀌어도 캡처와 카드 인식값을 유지한다', async () => {
  const f = createRendererFixture()
  media.crops.mockReturnValue([document.createElement('canvas'), null, null, null])
  await f.mount(
    <ColorThemeProvider>
      <App />
    </ColorThemeProvider>
  )
  const cards = [...f.container.querySelectorAll('article')]
  await click('화면 캡처')
  expect(document.querySelector('[role="dialog"]')).not.toBeNull()
  await select('game')
  expect(f.getDisplayMedia).toHaveBeenCalledOnce()
  expect(document.body.textContent).toContain('캡처 중 · 1920×1080')
  await f.cycle(3)
  expect(f.container.querySelector<HTMLInputElement>('[aria-label="1번 캐릭터 이름"]')!.value).toBe(
    'ALICE'
  )
  await click('닫기')
  expect(f.resources.track.stop).not.toHaveBeenCalled()
  await f.emitAuth(authSnapshot({ revision: 2, signedIn: false }))
  expect([...f.container.querySelectorAll('article')]).toEqual(cards)
  expect(f.resources.track.stop).not.toHaveBeenCalled()
  await click('화면 캡처')
  expect(document.body.textContent).toContain('캡처 중지')
  await click('캡처 중지')
  expect(f.resources.track.stop).toHaveBeenCalledOnce()
  expect(f.resources.worker.terminate).toHaveBeenCalledOnce()
  expect(f.container.querySelector<HTMLInputElement>('[aria-label="1번 캐릭터 이름"]')!.value).toBe(
    ''
  )
  await select('game')
  expect(f.getDisplayMedia).toHaveBeenCalledTimes(2)
})

it('캡처 중 다른 창을 선택하면 기존 stream을 정리하고 새 대상으로 시작한다', async () => {
  const f = createRendererFixture()
  await f.mount(
    <ColorThemeProvider>
      <App />
    </ColorThemeProvider>
  )
  await click('화면 캡처')
  await select('game')
  await select('next')
  expect(f.capture.selectCaptureSource).toHaveBeenLastCalledWith('next')
  expect(f.getDisplayMedia).toHaveBeenCalledTimes(2)
  expect(f.resources.track.stop).toHaveBeenCalledOnce()
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
  expect(f.getDisplayMedia).not.toHaveBeenCalled()
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
  expect(f.getDisplayMedia).not.toHaveBeenCalled()
  expect(document.body.textContent).toContain('캡처를 중지했습니다.')
  expect(document.body.textContent).not.toContain('캡처 시작을 눌러 주세요.')
})
