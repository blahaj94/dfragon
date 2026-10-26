// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import App from './App'
import { CAPTURE_ID, searchSnapshot } from '../../preload/api/search-test-fixture'
import type { SearchApi } from '../../preload/common/types/search'
import { emptySearchSlots } from './lib/slots'
import { ColorThemeProvider } from './components/ColorThemeProvider'
import type { WindowChromeApi } from '../../preload/common/types/window-chrome'

let root: Root
let container: HTMLDivElement

beforeEach(() => {
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
    selectCaptureSource: vi.fn(async () => null),
    notifyStableNicknameDetected: vi.fn()
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
  // 로고는 이미지 대신 brand.logo 면의 마크이고, 푸터가 없다. 캡처 상태는 상단 바 상태 칩이 보이며
  // 파티 머리는 캡처 진행 문구를 되풀이하지 않는다.
  expect(container.querySelectorAll('img')).toHaveLength(0)
  expect(container.querySelector('footer')).toBeNull()
  expect(container.querySelector('main')?.firstElementChild?.tagName).toBe('HEADER')
  expect(container.querySelector('header')?.textContent).toContain('창 미감지')
  // 상단 바의 live region은 화면 밖 캡처 안내 하나뿐이고 칩 자체는 알리지 않는다.
  expect(
    [...container.querySelectorAll('header [role="status"]')].map((region) =>
      region.hasAttribute('data-capture-announcer')
    )
  ).toEqual([true])
  expect(container.querySelector('[aria-label="미리보기 상태"]')).toBeNull()
  expect(container.textContent).not.toContain('닉네임 수정')
  const partyHeading = container.querySelector('h1')!
  expect(partyHeading.textContent).toBe('파티')
  expect(partyHeading.parentElement?.querySelector('[role="status"]')?.textContent).toBe('')
  const chip = container.querySelector<HTMLButtonElement>('header button[aria-label^="화면 캡처"]')!
  expect(chip.getAttribute('aria-label')).toBe('화면 캡처, 창 미감지')
  expect(chip.disabled).toBe(false)
  expect(document.querySelector('[role="dialog"]')).toBeNull()
  // 로그인, 설정, 개발자 도구는 없다.
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

it('검색 하위 메뉴에서 공대를 고르면 공대 12자리를 보이고 자리별 조회는 파티 검색과 따로 보낸다', async () => {
  let raidSnapshot = searchSnapshot({ captureId: null, slots: emptySearchSlots(12) })
  const raidControl = vi.fn<SearchApi['controlCharacterSearch']>(async (command) => {
    if (command.action === 'begin') {
      raidSnapshot = { ...raidSnapshot, captureId: CAPTURE_ID, revision: raidSnapshot.revision + 1 }
    }

    return { ok: true, snapshot: raidSnapshot }
  })
  // 파티 카드의 서버 지정 조회 채널. 공대 자리 조회가 이쪽으로 가지 않는지 확인한다.
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

  await act(async () => trigger.click())
  const raid = [...document.querySelectorAll<HTMLElement>('[role="menuitemradio"]')].find(
    (item) => item.textContent === '공대'
  )!
  await act(async () => raid.click())
  expect(trigger.textContent).toBe('검색공대')
  expect(raidSection.hidden).toBe(false)
  const raidCards = [...raidSection.querySelectorAll('article')]
  expect(raidCards).toHaveLength(12)
  expect(raidCards.every((card) => card.getAttribute('data-state') === 'waiting')).toBe(true)
  // 자리마다 속한 파티를 설명으로 전한다.
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

  // 빈 공대 자리에서 이름을 넣고 서버를 고르면 공대 검색 채널로 그 자리만 조회한다.
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
  // 숨긴 공대 카드도 자리별 입력을 유지한다.
  expect(input.value).toBe('열번째')
})

it('파티 머리의 접기 버튼은 카드 영역을 가리키고 접은 뒤 창 높이를 400으로 요청한다', async () => {
  const setContentHeight = vi.fn<WindowChromeApi['setContentHeight']>(async () => {})
  Object.defineProperty(window, 'windowChrome', {
    configurable: true,
    value: { setContentHeight }
  })
  try {
    await act(async () =>
      root.render(
        <ColorThemeProvider>
          <App />
        </ColorThemeProvider>
      )
    )
    const fold = container.querySelector<HTMLButtonElement>('[aria-label="카드 접기"]')!
    const cards = container.querySelector('[aria-label="파티 캐릭터"]')!
    expect(fold.getAttribute('aria-expanded')).toBe('true')
    expect(fold.getAttribute('aria-controls')).toBe(cards.id)

    await act(async () => fold.click())
    expect(fold.getAttribute('aria-label')).toBe('카드 펼치기')
    expect(fold.getAttribute('aria-expanded')).toBe('false')
    await vi.waitFor(() => expect(setContentHeight).toHaveBeenCalledExactlyOnceWith(400))
    expect(container.querySelectorAll('[aria-label="파티 캐릭터"] article')).toHaveLength(4)
  } finally {
    Reflect.deleteProperty(window, 'windowChrome')
  }
})
