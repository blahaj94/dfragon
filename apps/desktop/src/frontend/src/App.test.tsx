// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import App from './App'
import { stubIdleDesktopBridges } from './testing/fixtures/idle-desktop-bridges'
import { CAPTURE_ID, searchSnapshot } from '../../preload/api/search-test-fixture'
import type { SearchApi } from '../../preload/common/types/search'
import { emptySearchSlots } from './lib/slots'
import { ColorThemeProvider } from './components/ColorThemeProvider'
import type { UpdateNoticeApi } from '../../preload/common/types/update-notice'
import type { WindowChromeApi } from '../../preload/common/types/window-chrome'

let root: Root
let container: HTMLDivElement

beforeEach(() => {
  stubIdleDesktopBridges()
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({ matches: false }))
  )
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
  vi.stubGlobal('api', {
    listCaptureSources: vi.fn(async () => []),
    selectCaptureSource: vi.fn(async () => null)
  })
  vi.stubGlobal('search', {
    controlCharacterSearch: vi.fn(async () => {
      const snapshot = searchSnapshot({ captureId: null })

      return { ok: true, snapshot }
    }),
    onCharacterSearchChanged: vi.fn(() => () => {})
  })
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  delete document.documentElement.dataset.theme
  vi.unstubAllGlobals()
})

it('기본 앱은 빈 카드 네 개에서 이름과 서버를 바로 수정할 수 있다', async () => {
  await act(async () =>
    root.render(
      <ColorThemeProvider>
        <App />
      </ColorThemeProvider>
    )
  )

  const slots = container.querySelectorAll('[aria-label="파티 캐릭터"] article')
  expect(slots).toHaveLength(4)
  for (const [index, slot] of [...slots].entries()) {
    expect(slot.getAttribute('aria-label')).toBe(`${index + 1}번 슬롯`)
    const input = slot.querySelector('input')!
    expect(input.value).toBe('')
    expect(input.disabled).toBe(false)
    expect(
      slot.querySelector<HTMLButtonElement>(`[aria-label="${index + 1}번 서버"]`)!.disabled
    ).toBe(false)
    expect(slot.querySelector('[aria-label*="상세 열기"]')).toBeNull()
    expect(slot.querySelector('img')).toBeNull()
  }
  expect(container.querySelector('form')).toBeNull()
  expect(container.querySelectorAll('img')).toHaveLength(0)
  expect(container.querySelector('footer')).toBeNull()
  expect(container.querySelector('main')?.firstElementChild?.tagName).toBe('HEADER')
  expect(container.querySelector('header')?.textContent).toContain('창 미감지')
  expect(container.querySelector('[aria-label="미리보기 상태"]')).toBeNull()
  expect(container.textContent).not.toContain('닉네임 수정')
  const partyHeading = container.querySelector('h1')!
  expect(partyHeading.textContent).toBe('파티')
  expect(partyHeading.closest('main > header')).not.toBeNull()
  expect(partyHeading.nextElementSibling?.textContent).toBe('0/4')
  expect(container.querySelector('[aria-label="카드 접기"]')).toBeNull()
  const partyNotice = partyHeading.parentElement!.querySelector('[role="status"]')!
  expect(partyNotice.textContent).toBe('')
  expect([...container.querySelectorAll('header [role="status"]')]).toEqual([
    partyNotice,
    container.querySelector('header [data-capture-announcer]')
  ])
  const chip = container.querySelector<HTMLButtonElement>('header button[aria-label^="화면 캡처"]')!
  expect(chip.getAttribute('aria-label')).toBe('화면 캡처, 창 미감지')
  expect(chip.disabled).toBe(false)
  expect(document.querySelector('[role="dialog"]')).toBeNull()
  expect(container.querySelector('header')?.textContent).not.toContain('로그인')
  expect(container.querySelector('header [aria-label="설정"]')).toBeNull()
})

it('시스템 설정이 라이트여도 새 기본 화면은 다크 테마로 시작한다', async () => {
  vi.mocked(window.matchMedia).mockReturnValue({ matches: true } as MediaQueryList)
  await act(async () =>
    root.render(
      <ColorThemeProvider>
        <App />
      </ColorThemeProvider>
    )
  )
  expect(document.documentElement.dataset.theme).toBe('dark')
  expect(container.querySelector('header [aria-label$="테마"]')).toBeNull()
})

it('새 버전 알림은 카드 위가 아닌 상단 바 칩으로 보이고 메뉴의 닫기로 사라지며 창 높이는 그대로다', async () => {
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
  const dismissUpdateNotice = vi.fn<UpdateNoticeApi['dismissUpdateNotice']>(async () => ({
    revision: 2,
    notice: null
  }))
  vi.stubGlobal('updateNotice', {
    getUpdateNotice: vi.fn(async () => ({ revision: 1, notice: { tag: 'v1.2.0' } })),
    dismissUpdateNotice,
    openUpdateRelease: vi.fn(async () => {}),
    onUpdateNoticeChanged: vi.fn(() => () => {})
  } satisfies UpdateNoticeApi)
  const setContentHeight = vi.fn<WindowChromeApi['setContentHeight']>(async () => {})
  vi.stubGlobal('windowChrome', { setContentHeight })
  await act(async () =>
    root.render(
      <ColorThemeProvider>
        <App />
      </ColorThemeProvider>
    )
  )
  const header = container.querySelector('header')!
  const chip = [...header.querySelectorAll('button')].find(
    (button) => button.textContent === '새 버전 v1.2.0'
  )!
  const captureChip = header.querySelector('button[aria-label^="화면 캡처"]')!
  expect(chip.compareDocumentPosition(captureChip) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0)
  expect(container.querySelector('[aria-label="새 버전 알림"]')).toBeNull()
  expect(container.textContent?.match(/새 버전/g)).toHaveLength(1)

  await act(async () => chip.click())
  const dismiss = [...document.querySelectorAll<HTMLElement>('[role="menuitem"]')].find(
    (item) => item.textContent === '닫기'
  )!
  await act(async () => dismiss.click())
  expect(dismissUpdateNotice).toHaveBeenCalledExactlyOnceWith('v1.2.0')
  expect(header.textContent).not.toContain('새 버전')
  expect(setContentHeight.mock.calls).toEqual([[163]])
})

it('창 내용 높이를 파티 화면에서 163, 공대 화면에서 300으로 바꾼다', async () => {
  const setContentHeight = vi.fn<WindowChromeApi['setContentHeight']>(async () => {})
  vi.stubGlobal('windowChrome', { setContentHeight })
  await act(async () =>
    root.render(
      <ColorThemeProvider>
        <App />
      </ColorThemeProvider>
    )
  )
  expect(setContentHeight.mock.calls).toEqual([[163]])
  const trigger = container.querySelector<HTMLButtonElement>('nav button[aria-haspopup="menu"]')!
  const chooseScreen = async (name: string): Promise<void> => {
    await act(async () => trigger.click())
    const item = [...document.querySelectorAll<HTMLElement>('[role="menuitemradio"]')].find(
      (candidate) => candidate.textContent === name
    )!
    await act(async () => item.click())
  }

  await chooseScreen('공대')
  expect(setContentHeight.mock.calls).toEqual([[163], [300]])

  await chooseScreen('파티')
  expect(setContentHeight.mock.calls).toEqual([[163], [300], [163]])
})

it('창 높이를 바꾸지 못해도 화면을 바꿀 수 있다', async () => {
  const setContentHeight = vi.fn<WindowChromeApi['setContentHeight']>(async () => {
    throw new Error('Synthetic window height failure')
  })
  vi.stubGlobal('windowChrome', { setContentHeight })
  await act(async () =>
    root.render(
      <ColorThemeProvider>
        <App />
      </ColorThemeProvider>
    )
  )
  const trigger = container.querySelector<HTMLButtonElement>('nav button[aria-haspopup="menu"]')!
  await act(async () => trigger.click())
  const raid = [...document.querySelectorAll<HTMLElement>('[role="menuitemradio"]')].find(
    (item) => item.textContent === '공대'
  )!
  await act(async () => raid.click())

  expect(setContentHeight.mock.calls).toEqual([[163], [300]])
  expect(container.querySelector<HTMLElement>('section[aria-label="공대"]')!.hidden).toBe(false)
})

it('검색 하위 메뉴에서 공대를 고르면 공대 12자리를 보이고 자리별 조회는 파티 검색과 따로 보낸다', async () => {
  let raidSnapshot = searchSnapshot({ captureId: null, slots: emptySearchSlots(12) })
  const raidControl = vi.fn<SearchApi['controlCharacterSearch']>(async (command) => {
    if (command.action === 'begin') {
      raidSnapshot = { ...raidSnapshot, captureId: CAPTURE_ID, revision: raidSnapshot.revision + 1 }
    }

    return { ok: true, snapshot: raidSnapshot }
  })
  const partyManualControl = vi.fn<SearchApi['controlCharacterSearch']>(async () => ({
    ok: true,
    snapshot: searchSnapshot({ captureId: null })
  }))
  vi.stubGlobal('manualSearch', {
    controlCharacterSearch: partyManualControl,
    onCharacterSearchChanged: vi.fn<SearchApi['onCharacterSearchChanged']>(() => () => {})
  } satisfies SearchApi)
  vi.stubGlobal('raidSearch', {
    controlCharacterSearch: raidControl,
    onCharacterSearchChanged: vi.fn<SearchApi['onCharacterSearchChanged']>(() => () => {})
  } satisfies SearchApi)
  await act(async () =>
    root.render(
      <ColorThemeProvider>
        <App />
      </ColorThemeProvider>
    )
  )
  const cards = [...container.querySelectorAll('[aria-label="파티 캐릭터"] article')]
  const raidSection = container.querySelector<HTMLElement>('section[aria-label="공대"]')!
  expect(raidSection.hidden).toBe(true)
  const trigger = container.querySelector<HTMLButtonElement>('nav button[aria-haspopup="menu"]')!
  expect(trigger.getAttribute('aria-current')).toBe('page')
  expect(trigger.textContent).toBe('검색파티')
  await act(async () =>
    container.querySelector<HTMLButtonElement>('[aria-label="파티 모험단 순번 스냅샷"]')!.click()
  )

  await act(async () => trigger.click())
  const raid = [...document.querySelectorAll<HTMLElement>('[role="menuitemradio"]')].find(
    (item) => item.textContent === '공대'
  )!
  await act(async () => raid.click())
  expect(trigger.textContent).toBe('검색공대')
  expect(raidSection.hidden).toBe(false)
  expect([...container.querySelectorAll('header h1')].map((h1) => h1.textContent)).toEqual(['공대'])
  expect(container.querySelector('[aria-label="파티 모험단 순번 스냅샷"]')).toBeNull()
  const raidCards = [...raidSection.querySelectorAll('article')]
  expect(raidCards).toHaveLength(12)
  expect(raidCards.every((card) => card.getAttribute('data-state') === 'waiting')).toBe(true)
  expect(
    [...raidSection.querySelectorAll('[aria-label*="번 자리"]')].map(
      (seat) =>
        document.getElementById(seat.getAttribute('aria-describedby')!.split(' ')[0])!.textContent
    )
  ).toEqual([
    ...Array.from({ length: 4 }, () => '1파티'),
    ...Array.from({ length: 4 }, () => '2파티'),
    ...Array.from({ length: 4 }, () => '3파티')
  ])
  expect(container.querySelector('[aria-label="파티 캐릭터"]')!.closest('[hidden]')).not.toBeNull()

  const tenth = raidCards[9]
  const input = tenth.querySelector<HTMLInputElement>('[aria-label="10번 캐릭터 이름"]')!
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, '열번째')
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
  await act(async () => tenth.querySelector<HTMLButtonElement>('[aria-label="10번 서버"]')!.click())
  const siroco = [...document.querySelectorAll<HTMLElement>('[role="option"]')].find(
    (option) => option.textContent === '시로코'
  )!
  await act(async () => siroco.click())
  await vi.waitFor(() =>
    expect(raidControl).toHaveBeenCalledWith({
      action: 'lookup',
      captureId: CAPTURE_ID,
      slot: 9,
      observationRevision: 1,
      nickname: '열번째',
      serverId: 'siroco'
    })
  )
  expect(
    [
      ...vi.mocked(window.search.controlCharacterSearch).mock.calls,
      ...partyManualControl.mock.calls
    ].map(([call]) => call.action)
  ).not.toContain('lookup')

  await act(async () => trigger.click())
  const partyItem = [...document.querySelectorAll<HTMLElement>('[role="menuitemradio"]')].find(
    (item) => item.textContent === '파티'
  )!
  await act(async () => partyItem.click())
  expect(raidSection.hidden).toBe(true)
  expect(container.querySelector('[aria-label="파티 캐릭터"]')!.closest('[hidden]')).toBeNull()
  expect([...container.querySelectorAll('[aria-label="파티 캐릭터"] article')]).toEqual(cards)
  expect([...container.querySelectorAll('header h1')].map((h1) => h1.textContent)).toEqual(['파티'])
  expect(
    container.querySelector('[aria-label="파티 모험단 순번 스냅샷"]')!.getAttribute('aria-pressed')
  ).toBe('true')
  expect(input.value).toBe('열번째')
})
