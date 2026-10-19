// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { CharacterDetailSnapshot } from '../../../../preload/common/types/character-detail'
import { dealerCard } from '../../testing/fixtures/character-cards'
import { CharacterSnapshotPage } from './CharacterSnapshotPage'

const snapshot: CharacterDetailSnapshot = {
  character: {
    serverId: 'cain',
    characterId: 'matched-id',
    characterName: '선택한캐릭터',
    serverName: '카인',
    adventureName: '함께하는모험단',
    jobName: '귀검사(남)',
    jobGrowName: '眞 웨펀마스터',
    level: 115,
    fame: 78000,
    imageUrl: 'https://img-api.neople.co.kr/df/servers/cain/characters/matched-id?zoom=1',
    guildName: '함께하는길드'
  },
  card: dealerCard,
  freshness: {
    lastSuccessfulFetchAt: '2026-10-07T01:00:00.000Z',
    expiresAt: '2026-10-07T02:00:00.000Z'
  }
}

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  Reflect.deleteProperty(window, 'characterDetail')
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

function installRead(read: () => Promise<CharacterDetailSnapshot>): void {
  Object.defineProperty(window, 'characterDetail', {
    configurable: true,
    value: { read }
  })
}

async function render(): Promise<void> {
  await act(async () => {
    root.render(<CharacterSnapshotPage />)
  })
}

// 값 칸에 보이는 글자. 숫자 값은 보조 기술용 최종값을 따로 두므로 화면에 그린 글자만 읽는다.
function field(label: string): string | null | undefined {
  const term = [...container.querySelectorAll('dt')].find((item) => item.textContent === label)
  const value = term?.nextElementSibling
  const drawn = value?.querySelector('[aria-hidden="true"]')
  if (drawn != null) {
    return drawn.textContent
  }

  return value?.firstChild?.textContent
}

// 목록 줄의 보조 기술 이름(부위와 아이템 이름).
function rowLabels(list: string): string[] {
  const rows = container.querySelectorAll(`ul[aria-label="${list}"] > li`)

  return [...rows].map(
    (row) => row.querySelector(':scope > span > [aria-hidden="true"] + span')?.textContent ?? ''
  )
}

it('창에 전달된 캐릭터의 서버, 순위, 조회 시각, 소속, 이름과 명성, 장비 점수를 머리에 보인다', async () => {
  vi.useFakeTimers({ now: Date.parse('2026-10-07T01:00:12.000Z'), toFake: ['Date'] })
  installRead(async () => snapshot)

  await render()

  const header = container.querySelector('header')!
  expect(header.textContent).toContain('카인')
  expect(header.textContent).toContain('#18240')
  expect(header.textContent).toContain('서버 순위 18240위, DFragon이 수집한 캐릭터 52,310명 기준')
  expect(header.querySelector('time')?.dateTime).toBe('2026-10-07T01:00:00.000Z')
  expect(header.querySelector('time')?.textContent).toBe('마지막 조회 12초 전')
  expect(container.querySelector('h1')?.textContent).toBe('선택한캐릭터')
  expect(container.textContent).toContain('함께하는모험단')
  expect(container.textContent).toContain('함께하는길드')
  expect(container.textContent).toContain('眞 웨펀마스터')
  expect(field('명성')).toBe('78,000')
  expect(field('장비 점수')).toBe('330,556')
  expect(container.querySelector('img')?.getAttribute('src')).toBe(snapshot.character.imageUrl)
})

it('장비 탭은 세트와 장비 12줄, 서약 본체와 결정 12줄을 카드 값으로 채운다', async () => {
  installRead(async () => snapshot)

  await render()

  const tabs = [...container.querySelectorAll('[role="tab"]')].map((tab) => tab.textContent)
  expect(tabs).toEqual(['장비', '스킬'])
  expect(container.textContent).toContain('환상의 에테리얼 오브 아츠 세트')
  expect(container.querySelector('[aria-label="세트 포인트 2,625"]')).not.toBeNull()
  const equipment = rowLabels('장비')
  expect(equipment).toHaveLength(12)
  expect(equipment.slice(0, 2)).toEqual([
    '무기, 검은 질병의 멸룡검 발뭉',
    expect.stringMatching(/^머리어깨, /)
  ])
  const weapon = container.querySelector('ul[aria-label="장비"] > li')!
  expect(weapon.textContent).toContain(
    '모든 속성 강화 15 · 물리 공격력 30 · 마법 공격력 30 · 독립 공격력 30'
  )
  expect(weapon.textContent).toContain('강화 13')
  const oath = rowLabels('서약과 결정')
  expect(oath).toHaveLength(12)
  expect(oath[0]).toBe('서약, 강림한 여우 서약')
  expect(oath[1]).toBe('서약 결정, 여우 : 완전한 광휘 결정')
  expect(container.querySelectorAll('[aria-label="묵언의 진의"] [role="listitem"]')).toHaveLength(9)
  expect(container.querySelector('[aria-label="9단계 비어 있음"]')).not.toBeNull()
})

it('카드 값이 없으면 점수와 순위, 세트와 서약, 12부위를 값 없이 보인다', async () => {
  installRead(async () => ({ ...snapshot, card: null }))

  await render()

  expect(field('장비 점수')).toBe('-')
  expect(container.querySelector('header')?.textContent).toContain('서버 순위 없음')
  expect(container.textContent).toContain('세트 정보 없음')
  expect(container.textContent).toContain('서약 정보 없음')
  expect(rowLabels('장비')).toHaveLength(12)
  expect(rowLabels('장비').every((label) => label.endsWith(', 장착 정보 없음'))).toBe(true)
  // 장착 정보가 없는 줄은 포커스와 설명 상자가 없다.
  expect(container.querySelectorAll('ul[aria-label="장비"] > li[tabindex]')).toHaveLength(0)
  expect(rowLabels('서약과 결정')).toEqual([])
})

it('없는 소속과 전직은 `-`로 두고 명성 0은 보존한다', async () => {
  installRead(async () => ({
    ...snapshot,
    character: {
      ...snapshot.character,
      adventureName: null,
      guildName: null,
      jobGrowName: null,
      fame: 0
    }
  }))

  await render()

  expect(container.textContent).toContain('- 모험단')
  expect(container.textContent).toContain('- 길드')
  expect(field('명성')).toBe('0')
})

it('명성 null을 숫자로 바꾸지 않고 `-`로 표시한다', async () => {
  installRead(async () => ({
    ...snapshot,
    character: { ...snapshot.character, fame: null }
  }))

  await render()

  expect(field('명성')).toBe('-')
})

it('머리의 닫기 버튼으로 창을 닫는다', async () => {
  installRead(async () => snapshot)
  const close = vi.spyOn(window, 'close').mockImplementation(() => {})

  await render()
  await act(async () =>
    container.querySelector<HTMLButtonElement>('button[aria-label="닫기"]')!.click()
  )

  expect(close).toHaveBeenCalledOnce()
})

it('스냅샷 수신을 기다린 뒤 재렌더링해도 처음 열린 캐릭터를 유지한다', async () => {
  let resolve!: (value: CharacterDetailSnapshot) => void
  const pending = new Promise<CharacterDetailSnapshot>((accept) => {
    resolve = accept
  })
  const read = vi.fn<() => Promise<CharacterDetailSnapshot>>().mockReturnValue(pending)
  const fetch = vi.fn()
  vi.stubGlobal('fetch', fetch)
  installRead(read)
  await render()
  expect(container.querySelector('[role="status"]')?.textContent).toContain('불러오는 중')

  await act(async () => resolve(snapshot))
  read.mockResolvedValue({
    ...snapshot,
    character: { ...snapshot.character, characterName: '다음캐릭터' }
  })
  await render()

  expect(container.querySelector('h1')?.textContent).toBe('선택한캐릭터')
  expect(read).toHaveBeenCalledOnce()
  expect(fetch).not.toHaveBeenCalled()
})

it('조회 실패는 내부 오류를 노출하지 않는 안내를 표시하고 창을 닫을 수 있다', async () => {
  installRead(async () => {
    throw new Error('internal sensitive failure')
  })
  const close = vi.spyOn(window, 'close').mockImplementation(() => {})

  await render()

  expect(container.querySelector('[role="alert"]')?.textContent).toContain(
    '캐릭터 정보를 불러오지 못했습니다.'
  )
  expect(container.textContent).not.toContain('internal sensitive failure')
  expect(container.querySelector('img')).toBeNull()
  await act(async () => container.querySelector<HTMLButtonElement>('button')!.click())
  expect(close).toHaveBeenCalledOnce()
})

it('전용 preload가 없는 경우에도 오류 안내를 표시한다', async () => {
  await render()

  expect(container.querySelector('[role="alert"]')?.textContent).toContain(
    '캐릭터 정보를 불러오지 못했습니다.'
  )
})

// 열린 설명 상자. Base UI가 문서 body 아래에 그린다.
function openTip(): Element | null {
  return document.querySelector('[data-open]')
}

it('장비 줄에 마우스를 올리면 부위와 희귀도, 마법부여를 설명 상자로 보이고 떠나면 닫는다', async () => {
  installRead(async () => snapshot)
  await render()
  const weapon = container.querySelector<HTMLElement>('ul[aria-label="장비"] > li')!

  await act(async () => {
    weapon.dispatchEvent(new PointerEvent('pointerenter', { pointerType: 'mouse' }))
    weapon.dispatchEvent(new MouseEvent('mouseenter'))
  })
  await vi.waitFor(() => expect(openTip()).not.toBeNull())
  expect(openTip()?.textContent).toContain('무기 · 태초')
  expect(openTip()?.textContent).toContain('마법부여모든 속성 강화 15')
  expect(weapon.hasAttribute('data-popup-open')).toBe(true)

  await act(async () => weapon.dispatchEvent(new MouseEvent('mouseleave')))
  await vi.waitFor(() => expect(weapon.hasAttribute('data-popup-open')).toBe(false))
})

it('키보드로 서약 결정 줄에 포커스하면 설명 상자를 보인다', async () => {
  installRead(async () => snapshot)
  await render()
  const crystal = container.querySelectorAll<HTMLElement>('ul[aria-label="서약과 결정"] > li')[1]

  await act(async () => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }))
    crystal.focus()
  })

  await vi.waitFor(() => expect(openTip()?.textContent).toContain('서약 결정 · 에픽'))
})
