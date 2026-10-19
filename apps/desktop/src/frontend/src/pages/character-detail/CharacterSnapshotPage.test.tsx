// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import * as stylex from '@stylexjs/stylex'
import type { CharacterDetailSnapshot } from '../../../../preload/common/types/character-detail'
import { styles as skillTreeStyles } from '../../components/SkillTree.style'
import { bufferCard, dealerCard } from '../../testing/fixtures/character-cards'
import { toneClassesOf } from '../../testing/test-support/score-tone-class'
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
  // 무기와 상의의 설명 상자 문구. 나머지 아이템은 아이템 상세를 받지 못한 경우다.
  itemTexts: {
    '4f7c8199cd7a85492e985ebb5daa2da8': {
      explain: '[용을 베는 자]\n스킬 퀵슬롯의 빈 슬롯이 3개 이상일 때 검은 용의 힘 발동',
      buff: '30레벨 버프 스킬 Lv +3\n50레벨 액티브 스킬 Lv +4',
      flavor: '그 피로 세상을 멸할 힘을 얻는다.'
    },
    '2d23a5dc389016bdc3a3e3fd142b38ce': {
      explain: null,
      buff: '30레벨 버프 스킬 Lv +1',
      flavor: null
    }
  },
  // 웨펀마스터 배치의 스킬 몇 개만 익힌 경우다. 나머지 배치 스킬은 레벨 0으로 보인다.
  skills: {
    jobId: '41f1cdc2ff58bb5fdc287be0db2a8df3',
    jobGrowId: '37495b941da3b1661bc900e68ef3b2c6',
    learned: {
      eb71e1d82d92c7e1d40500a0dcd77aa6: {
        name: '귀참',
        level: 60,
        description: '무기에 귀신을 소환하여 전방 넓은 범위에 강력한 베기를 행한다.',
        coolTime: 6,
        vpNames: [],
        vpName: null
      },
      cfacda0647b9a0f595df2c2aad30c18d: {
        name: '발도',
        level: 43,
        description: '준비 동작을 행한 뒤\n무기를 뽑아 넓게 벤다.',
        coolTime: 15,
        vpNames: ['명가의 손놀림', '속전속결'],
        vpName: '속전속결'
      },
      '4f2e001e9a19eb7bae50ad1840dfb329': {
        name: '극 귀검술 : 폭풍식',
        level: 15,
        description: null,
        coolTime: 135,
        vpNames: [],
        vpName: null
      },
      '8b08f9504167a9c0f3a1d29d71b7943e': {
        name: '천제극섬',
        level: 5,
        description: null,
        coolTime: 270,
        vpNames: [],
        vpName: null
      }
    }
  },
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

// 값 칸 요소. 숫자의 색 class를 읽을 때 쓴다.
function fieldElement(label: string): Element {
  const term = [...container.querySelectorAll('dt')].find((item) => item.textContent === label)

  return term!.nextElementSibling!
}

it('머리의 딜러 점수는 장비 점수 라벨과 파랑이다', async () => {
  installRead(async () => snapshot)
  await render()

  expect(toneClassesOf(fieldElement('장비 점수'))).toEqual(['dealer'])
  expect(toneClassesOf(fieldElement('명성'))).toEqual([])
})

it('머리의 버퍼 점수는 버프 점수 라벨과 초록이고 장비 점수 라벨은 없다', async () => {
  installRead(async () => ({ ...snapshot, card: bufferCard }))
  await render()

  expect(field('버프 점수')).toBe('55,358')
  expect(fieldElement('버프 점수').textContent).toContain('게임 버프 점수')
  expect(toneClassesOf(fieldElement('버프 점수'))).toEqual(['buffer'])
  expect([...container.querySelectorAll('dt')].map((term) => term.textContent)).not.toContain(
    '장비 점수'
  )
})

it('역할을 모르는 카드의 머리 점수는 장비 점수 라벨과 기본색이다', async () => {
  installRead(async () => ({ ...snapshot, card: { ...dealerCard, role: null, stats: null } }))
  await render()

  expect(field('장비 점수')).toBe('330,556')
  expect(toneClassesOf(fieldElement('장비 점수'))).toEqual([])
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

// 열린 설명 상자 안의 칸. 위치 지정 요소 안의 설명 상자 본체가 칸을 순서대로 둔다.
function tipBlocks(): Element[] {
  const blocks = openTip()?.firstElementChild?.children ?? []

  return [...blocks]
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
  // 캔버스 상세 창 보드처럼 이름과 부위 뒤에 아이템 설명, 마법부여, 버프 스킬, 플레이버 순이다.
  const blocks = tipBlocks()
    .slice(2)
    .map((block) => block.textContent)
  expect(blocks).toEqual([
    '[용을 베는 자]스킬 퀵슬롯의 빈 슬롯이 3개 이상일 때 검은 용의 힘 발동',
    expect.stringMatching(/^마법부여모든 속성 강화 15/),
    '30레벨 버프 스킬 Lv +3\n50레벨 액티브 스킬 Lv +4',
    '그 피로 세상을 멸할 힘을 얻는다.'
  ])
  expect(tipBlocks()[2].firstElementChild?.textContent).toBe('[용을 베는 자]')

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

it('설명 상자 문구가 없는 아이템은 이름과 부위, 마법부여만 보인다', async () => {
  installRead(async () => snapshot)
  await render()
  const shoulder = container.querySelectorAll<HTMLElement>('ul[aria-label="장비"] > li')[1]

  await act(async () => {
    shoulder.dispatchEvent(new PointerEvent('pointerenter', { pointerType: 'mouse' }))
    shoulder.dispatchEvent(new MouseEvent('mouseenter'))
  })
  await vi.waitFor(() => expect(openTip()).not.toBeNull())

  const blocks = tipBlocks().map((block) => block.textContent)
  expect(blocks).toHaveLength(3)
  expect(blocks[1]).toMatch(/^머리어깨 · /)
  expect(blocks[2]).toMatch(/^마법부여/)
})

// StyleX의 atomic class는 선언에서 정해지므로 컴포넌트와 같은 스타일의 class가 붙었는지로 칸 모양을 확인한다.
function hasStyle(element: Element | null, style: stylex.StyleXStyles): boolean {
  const classes = element?.className.toString().split(' ') ?? []
  const expected = stylex.props(style).className?.split(' ') ?? []

  return expected.length > 0 && expected.every((name) => classes.includes(name))
}

// StyleX가 동적 스타일 값을 둔 inline 변수. 동적 스타일은 값과 상관없이 같은 class를 쓰므로 값은 여기서 읽는다.
function styleVar(element: Element, name: string): string {
  if (!(element instanceof HTMLElement)) {
    return ''
  }

  return element.style.getPropertyValue(name).trim()
}

// 스킬 칸의 grid 열.
function gridColumnOf(element: HTMLElement): string {
  return styleVar(element, '--x-gridColumn')
}

async function openSkillTab(): Promise<HTMLElement> {
  const tab = [...container.querySelectorAll<HTMLElement>('[role="tab"]')].find(
    (item) => item.textContent === '스킬'
  )!
  await act(async () => tab.click())

  return container.querySelector<HTMLElement>('[aria-label="스킬트리"]')!
}

function skillCell(label: string): HTMLElement {
  return container.querySelector<HTMLElement>(`li[aria-label="${label}"]`)!
}

it('스킬 탭은 직업 배치의 공통과 습득 레벨 행에 스킬을 정해진 열로 둔다', async () => {
  installRead(async () => snapshot)
  await render()
  const tree = await openSkillTab()

  expect(container.textContent).not.toContain('스킬 정보는 아직 연결하지 않았습니다.')
  const rows = [...tree.querySelectorAll('ul')]
  expect(rows.map((row) => row.getAttribute('aria-label'))).toEqual([
    '공통',
    '1레벨',
    '5레벨',
    '10레벨',
    '15레벨',
    '20레벨',
    '25레벨',
    '30레벨',
    '35레벨',
    '40레벨',
    '45레벨',
    '50레벨',
    '60레벨',
    '70레벨',
    '80레벨',
    '95레벨',
    '100레벨'
  ])
  expect(rows[1].querySelector('[aria-hidden="true"]')?.textContent).toBe('1')
  expect([...rows[1].querySelectorAll('li[aria-label]')].map((cell) => cell.ariaLabel)).toEqual([
    '방어구 마스터리, 0레벨',
    '귀참, 60레벨',
    '어퍼 슬래쉬, 0레벨',
    '신속한 무기 교체, 0레벨'
  ])
  // 귀참은 4번째 열(grid 열 5), 신속한 무기 교체는 10번째 열(grid 열 11)이다.
  // StyleX 동적 스타일은 열마다 같은 class에 inline 변수로 값을 넣으므로 변수 값을 읽는다.
  expect(gridColumnOf(skillCell('귀참, 60레벨'))).toBe('5')
  expect(gridColumnOf(skillCell('신속한 무기 교체, 0레벨'))).toBe('11')
  expect(tree.querySelectorAll('li[aria-label]')).toHaveLength(58)
})

it('익히지 않은 스킬은 아이콘을 흐리게 그리고, 각성기는 크림 칸이다', async () => {
  installRead(async () => snapshot)
  await render()
  await openSkillTab()

  const off = skillCell('차지 버스트, 0레벨')
  const learned = skillCell('발도, 43레벨')
  const [offIcon, offLevel] = off.children
  const [learnedIcon] = learned.children
  // 아이콘은 sprite 한 장의 28 × 28 칸을 배경으로 자른다. 스킬마다 칸 위치가 다르다.
  expect(styleVar(offIcon, '--x-backgroundImage')).toMatch(/packages\/icons\/skills\.webp/)
  expect(styleVar(offIcon, '--x-backgroundPosition')).toMatch(/^(-\d+|0)px (-\d+|0)px$/)
  expect(
    styleVar(offIcon, '--x-backgroundPosition')
      .split(' ')
      .every((value) => Number.parseInt(value, 10) % 28 === 0)
  ).toBe(true)
  expect(styleVar(learnedIcon, '--x-backgroundPosition')).not.toBe(
    styleVar(offIcon, '--x-backgroundPosition')
  )
  expect(hasStyle(offIcon, skillTreeStyles.iconOff)).toBe(true)
  expect(hasStyle(offLevel, skillTreeStyles.levelOff)).toBe(true)
  expect(hasStyle(learnedIcon, skillTreeStyles.iconOff)).toBe(false)
  expect(hasStyle(skillCell('극 귀검술 : 폭풍식, 15레벨'), skillTreeStyles.awakening)).toBe(true)
  expect(hasStyle(skillCell('천제극섬, 5레벨'), skillTreeStyles.awakening)).toBe(true)
  expect(hasStyle(learned, skillTreeStyles.awakening)).toBe(false)
})

it('스킬 칸에 마우스를 올리면 이름, 레벨, 종류와 쿨타임, 설명, VP 칩을 설명 상자로 보인다', async () => {
  installRead(async () => snapshot)
  await render()
  await openSkillTab()
  const cell = skillCell('발도, 43레벨')

  await act(async () => {
    cell.dispatchEvent(new PointerEvent('pointerenter', { pointerType: 'mouse' }))
    cell.dispatchEvent(new MouseEvent('mouseenter'))
  })
  await vi.waitFor(() => expect(openTip()).not.toBeNull())

  expect(document.querySelector('[role="tooltip"]')).toBe(openTip()?.firstElementChild)
  expect(tipBlocks().map((block) => block.textContent)).toEqual([
    '발도43',
    '액티브 · 35레벨 · 15초',
    '준비 동작을 행한 뒤\n무기를 뽑아 넓게 벤다.',
    '명가의 손놀림속전속결 (고른 VP)'
  ])
  const chips = tipBlocks()[3].children
  expect(hasStyle(chips[0], skillTreeStyles.vpChipSelected)).toBe(false)
  expect(hasStyle(chips[1], skillTreeStyles.vpChipSelected)).toBe(true)
})

it('익히지 않은 스킬의 설명 상자는 배치의 이름, 종류와 습득 레벨만 보인다', async () => {
  installRead(async () => snapshot)
  await render()
  await openSkillTab()
  const cell = skillCell('차지 버스트, 0레벨')

  await act(async () => {
    cell.dispatchEvent(new PointerEvent('pointerenter', { pointerType: 'mouse' }))
    cell.dispatchEvent(new MouseEvent('mouseenter'))
  })
  await vi.waitFor(() => expect(openTip()).not.toBeNull())

  expect(tipBlocks().map((block) => block.textContent)).toEqual(['차지 버스트0', '액티브 · 40레벨'])
})

it('방향키로 이웃 스킬 칸에 포커스를 옮기고 그 칸의 설명 상자를 연다', async () => {
  installRead(async () => snapshot)
  await render()
  await openSkillTab()
  const start = skillCell('귀참, 60레벨')

  await act(async () => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }))
    start.focus()
  })
  await act(async () => {
    start.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }))
  })

  expect(document.activeElement?.ariaLabel).toBe('어퍼 슬래쉬, 0레벨')
  await vi.waitFor(() => expect(openTip()?.textContent).toContain('어퍼 슬래쉬'))

  await act(async () => {
    document.activeElement?.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true })
    )
  })
  // 공통 행에서 열 5에 가장 가까운 칸은 열 5의 크리티컬 히트다.
  expect(document.activeElement?.ariaLabel).toBe('크리티컬 히트, 0레벨')
})

it.each([
  ['스킬 값을 받지 못하면', null, '스킬 정보를 받지 못했습니다.'],
  [
    '직업 배치가 없으면',
    { jobId: 'unknown-job', jobGrowId: 'unknown-grow', learned: {} },
    '이 전직의 스킬 배치는 아직 준비하지 않았습니다.'
  ]
])('%s 스킬 탭에 빈 스킬트리 대신 안내를 둔다', async (_, skills, notice) => {
  installRead(async () => ({ ...snapshot, skills }))
  await render()
  await openSkillTab()

  expect(container.querySelector('[aria-label="스킬트리"]')).toBeNull()
  expect(container.querySelector('[role="tabpanel"]')?.textContent).toBe(notice)
})
