// @vitest-environment jsdom
import { act, type ComponentProps } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { CharacterCard } from './CharacterCard'
import type { ServerSelect } from '../components/ServerSelect'
import { bufferCard, dealerCard } from '../testing/fixtures/character-cards'
import { toneClassesOf } from '../testing/test-support/score-tone-class'
import type { SlotCard } from '../lib/slot-cards'
import type { CardCharacter, CharacterCard as CardValues } from '../types/cards'

vi.mock('../components/ServerSelect', () => ({
  ServerSelect: ({
    value,
    onValueChange,
    label,
    disabled,
    options
  }: ComponentProps<typeof ServerSelect>) => (
    <select
      aria-label={label}
      value={value}
      disabled={disabled}
      onChange={(event) => onValueChange(event.target.value)}
    >
      <option value="">서버 선택</option>
      {options.map(({ id, label }) => (
        <option key={id} value={id}>
          {label}
        </option>
      ))}
    </select>
  )
}))

let root: Root
let container: HTMLDivElement
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})
afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
})

// 카드 값과 나머지 props를 한 객체로 받아 카드 값만 `card`로 묶는다.
type RenderProps = Partial<SlotCard> & Partial<Omit<ComponentProps<typeof CharacterCard>, 'card'>>

async function render({
  state = 'idle',
  character,
  nickname,
  notice,
  loading,
  snapshotMark,
  retryEnabled,
  retryPending,
  picker,
  ...props
}: RenderProps = {}): Promise<void> {
  const card = {
    state,
    character,
    nickname,
    notice,
    loading,
    snapshotMark,
    retryEnabled,
    retryPending,
    picker
  }
  await act(async () => root.render(<CharacterCard slot={1} inputEnabled {...props} card={card} />))
}

async function enterName(value: string): Promise<HTMLInputElement> {
  const input = container.querySelector('input')!
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })

  return input
}

it('결과가 없어도 이름과 서버를 수정하고 서버 변경 또는 Enter로 조회한다', async () => {
  const lookup = vi.fn()
  await render({ onLookup: lookup })
  const input = await enterName('수동이름')
  const select = container.querySelector('select')!
  expect(input.disabled).toBe(false)
  expect(select.disabled).toBe(false)
  await act(async () => {
    select.value = 'cain'
    select.dispatchEvent(new Event('change', { bubbles: true }))
  })
  expect(lookup).toHaveBeenCalledExactlyOnceWith('수동이름', 'cain')
  await enterName('새이름')
  await act(async () =>
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
  )
  expect(lookup).toHaveBeenLastCalledWith('새이름', 'cain')
})

it('한글 조합 중 Enter는 조회하지 않고 서버 없는 입력은 안내한다', async () => {
  const lookup = vi.fn()
  await render({ onLookup: lookup })
  const input = await enterName('이름')
  await act(async () =>
    input.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, isComposing: true })
    )
  )
  expect(lookup).not.toHaveBeenCalled()
  await act(async () =>
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
  )
  expect(container.textContent).toContain('서버를 선택해 주세요.')
  expect(lookup).not.toHaveBeenCalled()
})

it('OCR 중과 후보 검색 중에 같은 카드의 Progress Circle을 표시한다', async () => {
  await render({ loading: true })
  expect(container.querySelector('[aria-label="1번 캐릭터 확인 중"] svg')).not.toBeNull()
  expect(container.querySelector('article')?.getAttribute('aria-busy')).toBe('true')
  await render({ state: 'pending' })
  expect(container.querySelector('[aria-label="1번 캐릭터 확인 중"] svg')).not.toBeNull()
  await render({ state: 'failure' })
  expect(container.querySelector('[aria-label="1번 캐릭터 확인 중"]')).toBeNull()
})

it('OCR 갱신이 사용자가 수정 중인 이름을 덮어쓰지 않는다', async () => {
  await render({ nickname: 'OCR이름' })
  const input = await enterName('직접수정')
  await render({ nickname: '뒤늦은OCR' })
  expect(input.value).toBe('직접수정')
})

it('제출한 수동 이름은 검색 대기와 실패 중 이전 OCR이나 캐릭터로 바뀌지 않는다', async () => {
  const lookup = vi.fn()
  const previous: CardCharacter = {
    name: '이전OCR',
    serverId: 'cain',
    adventure: '',
    job: '',
    fame: null,
    card: null
  }
  await render({ state: 'success', character: previous, onLookup: lookup })
  const input = await enterName('수동이름')
  await act(async () =>
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
  )
  expect(lookup).toHaveBeenLastCalledWith('수동이름', 'cain')

  await render({ state: 'pending', nickname: '이전OCR', onLookup: lookup })
  expect(input.value).toBe('수동이름')
  await render({ state: 'failure', nickname: '이전OCR', onLookup: lookup })
  expect(input.value).toBe('수동이름')
  await act(async () =>
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
  )
  expect(lookup).toHaveBeenCalledTimes(2)
  expect(lookup).toHaveBeenLastCalledWith('수동이름', 'cain')

  await render({ state: 'success', character: previous, onLookup: lookup })
  expect(input.value).toBe('수동이름')
  const details = vi.fn()
  await render({
    state: 'success',
    character: { ...previous, name: '수동이름' },
    onLookup: lookup,
    onDetail: details
  })
  expect(input.value).toBe('수동이름')
  expect(
    container.querySelector<HTMLButtonElement>('[aria-label="1번 캐릭터 상세 열기"]')!.disabled
  ).toBe(false)
  await act(async () =>
    root.render(
      <CharacterCard
        key="new-round"
        card={{ state: 'pending', nickname: '다음OCR' }}
        slot={1}
        inputEnabled
        onLookup={lookup}
      />
    )
  )
  expect(container.querySelector('input')!.value).toBe('다음OCR')
})

const found: CardCharacter = {
  name: '찾은이름',
  serverId: 'cain',
  adventure: '찾은모험단',
  guild: '찾은길드',
  job: '찾은직업',
  fame: 125850,
  card: dealerCard
}

function card(): HTMLElement {
  return container.querySelector('article')!
}

// 오른쪽 위의 상태 표시. 그림 칸의 이미지 대체 표시는 제외한다.
function statusMark(): Element | null {
  return card().querySelector('[role="img"]:not([aria-label$="이미지 없음"])')
}

// 화면에 보이는 글자. 보조 기술용 알림 영역은 뺀다.
function visibleText(): string {
  const copy = card().cloneNode(true) as HTMLElement
  for (const live of copy.querySelectorAll('[aria-live]')) {
    live.remove()
  }

  if (copy.textContent == null) {
    return ''
  }

  return copy.textContent
}

// 명성과 점수 칸의 값. 스탯 한 줄의 dt와 섞이지 않도록 라벨로 찾는다.
function statValue(label: string): HTMLElement {
  const term = [...card().querySelectorAll('dt')].find((item) => item.textContent === label)!

  return term.nextElementSibling as HTMLElement
}

function faceTab(label: string): HTMLButtonElement {
  return [...container.querySelectorAll<HTMLButtonElement>('[role="tab"]')].find(
    (tab) => tab.textContent === label
  )!
}

it('검색 상태를 꺾쇠 상태와 오른쪽 위 표시로 보이고 상태 이름을 글자로 다시 쓰지 않는다', async () => {
  await render({ state: 'success', character: found, onDetail: vi.fn() })
  expect(card().getAttribute('data-state')).toBe('default')
  expect(statusMark()).toBeNull()

  await render({ state: 'failure', character: undefined })
  expect(card().getAttribute('data-state')).toBe('failure')
  expect(card().querySelector('[role="img"][aria-label="검색 실패"]')?.textContent).toBe('!')
  expect(visibleText()).not.toContain('검색 실패')
  expect(card().textContent).toContain('검색 실패')
  const detail = card().querySelector<HTMLButtonElement>('[aria-label="1번 캐릭터 상세 열기"]')
  expect(detail?.disabled).toBe(true)

  await render({ state: 'empty', character: undefined })
  expect(card().getAttribute('data-state')).toBe('failure')
  expect(visibleText()).toContain('검색 결과가 없습니다')

  await render({ state: 'waiting-portrait', character: undefined })
  expect(card().getAttribute('data-state')).toBe('waiting')
  expect(card().querySelector('[role="img"][aria-label="얼굴 인식 대기"] svg')).not.toBeNull()
  expect(card().querySelector('[aria-label="1번 캐릭터 상세 열기"]')).toBeNull()

  await render({ state: 'idle', character: undefined })
  expect(card().getAttribute('data-state')).toBe('waiting')
  expect(statusMark()).toBeNull()
})

// 카드 바로 아래의 장식 요소 수. 꺾쇠 네 개와 스냅샷에 없는 모험단의 덮는 층이 여기 들어간다.
function decorationCount(): number {
  return card().querySelectorAll(':scope > span[aria-hidden="true"]').length
}

it('스냅샷과 자리가 다른 카드는 서버 칩 뒤에 스냅샷 순번 칩을 보이고 카드 조작은 그대로 쓴다', async () => {
  const detail = vi.fn()
  await render({ state: 'success', character: found, onDetail: detail })
  const decorations = decorationCount()
  await render({
    state: 'success',
    character: found,
    onDetail: detail,
    snapshotMark: { kind: 'moved', seat: 3 }
  })
  const chip = card().querySelector('[role="img"][aria-label="스냅샷 순번 3"]')!
  const server = card().querySelector('select')!
  expect(chip.textContent).toBe('3')
  expect(server.compareDocumentPosition(chip) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0)
  expect(card().querySelector('[aria-label="스냅샷에 없는 모험단"]')).toBeNull()
  expect(decorationCount()).toBe(decorations)
  expect(card().getAttribute('data-state')).toBe('default')
  await act(async () =>
    card().querySelector<HTMLButtonElement>('[aria-label="1번 캐릭터 상세 열기"]')!.click()
  )
  expect(detail).toHaveBeenCalledOnce()
})

it('스냅샷에 없는 모험단 카드는 ! 칩과 카드를 덮는 장식 층을 보이고 꺾쇠 상태는 그대로 둔다', async () => {
  await render({ state: 'success', character: found })
  const decorations = decorationCount()
  await render({ state: 'success', character: found, snapshotMark: { kind: 'absent' } })

  const chip = card().querySelector('[role="img"][aria-label="스냅샷에 없는 모험단"]')!
  expect(chip.textContent).toBe('!')
  expect(decorationCount()).toBe(decorations + 1)
  expect(card().getAttribute('data-state')).toBe('default')
  expect(card().querySelector('[aria-label^="스냅샷 순번"]')).toBeNull()
})

it('스냅샷 표시를 걷으면 칩과 덮는 층이 함께 사라진다', async () => {
  await render({ state: 'success', character: found })
  const decorations = decorationCount()
  await render({ state: 'success', character: found, snapshotMark: { kind: 'absent' } })
  await render({ state: 'success', character: found })

  expect(card().querySelector('[aria-label^="스냅샷"]')).toBeNull()
  expect(decorationCount()).toBe(decorations)
})

it('이름에 들어가거나 고치는 동안 선택 상태와 수정 중 표시를 보이고 조회하면 돌아온다', async () => {
  const lookup = vi.fn()
  await render({ state: 'success', character: found, onLookup: lookup })
  const input = container.querySelector('input')!
  await act(async () => input.focus())
  expect(card().getAttribute('data-state')).toBe('selected')
  expect(card().querySelector('[role="img"][aria-label="이름 수정 중"]')).not.toBeNull()
  await act(async () => input.blur())
  expect(card().getAttribute('data-state')).toBe('default')

  await enterName('고친이름')
  expect(card().getAttribute('data-state')).toBe('selected')
  expect(card().textContent).toContain('Enter로 조회')
  await act(async () =>
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
  )
  expect(lookup).toHaveBeenCalledExactlyOnceWith('고친이름', 'cain')
  await render({ state: 'pending', nickname: '고친이름', onLookup: lookup })
  expect(card().getAttribute('data-state')).toBe('default')
  expect(statusMark()).toBeNull()
})

it('명성과 장비 점수를 라벨과 값으로 두고 0과 알 수 없음을 구분하며 소속과 순위를 보인다', async () => {
  await render({
    state: 'success',
    character: { ...found, fame: 0, card: { ...dealerCard, score: null } }
  })
  const fame = statValue('명성')
  const score = statValue('장비 점수')
  expect(fame.querySelector('[aria-hidden="true"]')?.textContent).toBe('0')
  expect(score.textContent).toBe('-')
  expect(card().textContent).toContain('찾은모험단')
  expect(card().textContent).toContain('찾은길드')
  expect(card().textContent).toContain('서버 순위 18240위, DFragon이 수집한 캐릭터 52,310명 기준')
  expect(visibleText()).toContain('#18240')

  await render({ state: 'success', character: found })
  const scoreValue = statValue('장비 점수')
  expect(scoreValue.querySelector('[aria-hidden="true"]')?.textContent).toBe('330,556')
  expect(scoreValue.textContent).toContain('DFragon 계산값')
})

it('검색 응답에 없는 길드, 서버 순위, 명성, 장비 점수는 0이나 빈칸 대신 -로 보인다', async () => {
  await render({
    state: 'success',
    character: { ...found, guild: null, fame: null, card: null }
  })
  const values = [statValue('명성'), statValue('장비 점수')]
  expect(values.map((value) => value.textContent)).toEqual(['-', '-'])
  expect(values.some((value) => value.querySelector('[aria-hidden="true"]') != null)).toBe(false)
  expect(card().textContent).toContain('찾은모험단-')
  expect(card().textContent).toContain('서버 순위 없음')
  expect(card().textContent).not.toContain('#')
})

it('상위, 랭커 단계를 꺾쇠 상태와 단계 색 숫자로 보이고 단계 이름을 보조 기술에 전한다', async () => {
  await render({ state: 'success', character: found })
  const defaultValue = statValue('명성').className
  expect(card().textContent).not.toContain('단계')

  await render({ state: 'success', character: { ...found, tier: 'top' } })
  expect(card().getAttribute('data-state')).toBe('top')
  expect(card().textContent).toContain('상위 단계')
  expect(card().textContent).toContain('서버 순위 18240위')
  const topValue = statValue('명성').className
  expect(topValue).not.toBe(defaultValue)

  await render({ state: 'success', character: { ...found, tier: 'ranker' } })
  expect(card().getAttribute('data-state')).toBe('ranker')
  expect(card().textContent).toContain('랭커 단계')
  expect(statValue('명성').className).not.toBe(topValue)

  // 조회 실패에는 단계를 보이지 않고, 이름을 고치면 단계보다 수정 중 표시가 앞선다.
  await render({ state: 'failure', character: { ...found, tier: 'ranker' } })
  expect(card().getAttribute('data-state')).toBe('failure')
  expect(card().textContent).not.toContain('랭커 단계')
  await render({ state: 'success', character: { ...found, tier: 'ranker' } })
  await enterName('고친이름')
  expect(card().getAttribute('data-state')).toBe('selected')
})

it('면 탭은 캐릭터, 장비, 기타 세 개이고 면을 바꿔도 머리의 서버 선택과 상세 열기는 그대로다', async () => {
  const detail = vi.fn()
  const lookup = vi.fn()
  await render({ state: 'success', character: found, onDetail: detail, onLookup: lookup })
  expect([...container.querySelectorAll('[role="tab"]')].map((tab) => tab.textContent)).toEqual([
    '캐릭터',
    '장비',
    '기타'
  ])
  expect(faceTab('캐릭터').getAttribute('aria-selected')).toBe('true')
  expect(container.querySelector('[aria-label="1번 캐릭터 이름"]')).not.toBeNull()

  await act(async () => faceTab('장비').click())
  expect(faceTab('장비').getAttribute('aria-selected')).toBe('true')
  // 이름 입력은 캐릭터 면에만 두고, 머리의 서버 선택과 상세 열기는 어느 면에서나 같은 자리에 남는다.
  expect(container.querySelector('[aria-label="1번 캐릭터 이름"]')).toBeNull()
  expect(container.querySelector('[aria-label="1번 서버"]')).not.toBeNull()
  const server = container.querySelector<HTMLSelectElement>('[aria-label="1번 서버"]')!
  await act(async () => {
    server.value = 'bakal'
    server.dispatchEvent(new Event('change', { bubbles: true }))
  })
  // 장비 면에서 서버를 바꾸면 찾은 이름으로 다시 조회하고, 결과가 오면 고른 장비 면으로 돌아온다.
  expect(lookup).toHaveBeenCalledExactlyOnceWith('찾은이름', 'bakal')
  await render({ state: 'pending', nickname: '찾은이름', onDetail: detail, onLookup: lookup })
  expect(faceTab('캐릭터').getAttribute('aria-selected')).toBe('true')
  const moved: CardCharacter = { ...found, serverId: 'bakal' }
  await render({ state: 'success', character: moved, onDetail: detail, onLookup: lookup })
  expect(faceTab('장비').getAttribute('aria-selected')).toBe('true')
  await act(async () =>
    container.querySelector<HTMLButtonElement>('[aria-label="1번 캐릭터 상세 열기"]')!.click()
  )
  expect(detail).toHaveBeenCalledOnce()
  expect(faceTab('장비').getAttribute('aria-selected')).toBe('true')

  await act(async () => faceTab('기타').click())
  expect(container.querySelector('[role="tabpanel"] table')).not.toBeNull()
})

it('캐릭터 면은 직업과 역할 라벨의 스탯 한 줄을 보인다', async () => {
  await render({ state: 'success', character: found })
  const panel = container.querySelector('[role="tabpanel"]')!
  const terms = [...panel.querySelectorAll('dt')].map((term) => term.textContent)
  expect(terms).toEqual(['공격력 증가', '공격력 증폭', '크리티컬', '스위칭'])
  expect(panel.textContent).toContain('찾은직업')

  await render({ state: 'success', character: { ...found, card: bufferCard } })
  const bufferTerms = [...container.querySelectorAll('[role="tabpanel"] dt')].map(
    (term) => term.textContent
  )
  expect(bufferTerms).toEqual(['마을 지능', '30레벨 버프', '50레벨 버프', '스위칭'])
  expect(statValue('버프 점수').querySelector('[aria-hidden="true"]')?.textContent).toBe('55,358')
  expect(statValue('버프 점수').textContent).toContain('게임 버프 점수')
  expect([...card().querySelectorAll('dt')].map((term) => term.textContent)).not.toContain(
    '장비 점수'
  )
})

it('점수 숫자는 딜러 파랑, 버퍼 초록으로 칠하고 역할을 모르거나 값이 없으면 기본색이다', async () => {
  await render({ state: 'success', character: found })
  expect(toneClassesOf(statValue('장비 점수'))).toEqual(['dealer'])
  expect(toneClassesOf(statValue('명성'))).toEqual([])

  await render({ state: 'success', character: { ...found, card: bufferCard } })
  expect(toneClassesOf(statValue('버프 점수'))).toEqual(['buffer'])
  expect(toneClassesOf(statValue('명성'))).toEqual([])

  // 역할을 모르면 라벨은 장비 점수이고 색은 기본색이다.
  await render({
    state: 'success',
    character: { ...found, card: { ...dealerCard, role: null, stats: null } }
  })
  expect(statValue('장비 점수').querySelector('[aria-hidden="true"]')?.textContent).toBe('330,556')
  expect(toneClassesOf(statValue('장비 점수'))).toEqual([])

  // 값이 없어 -로 보이는 점수는 역할과 상관없이 같은 기본 색이다.
  await render({ state: 'success', character: { ...found, card: { ...dealerCard, score: null } } })
  const dealerMissing = statValue('장비 점수')
  expect(dealerMissing.textContent).toBe('-')
  expect(toneClassesOf(dealerMissing)).toEqual([])
  const missingClass = dealerMissing.className
  await render({ state: 'success', character: { ...found, card: { ...bufferCard, score: null } } })
  expect(statValue('버프 점수').textContent).toBe('-')
  expect(statValue('버프 점수').className).toBe(missingClass)
})

it('상위, 랭커 카드의 점수 숫자는 역할 색 대신 단계 색을 유지한다', async () => {
  await render({ state: 'success', character: { ...found, tier: 'top', card: bufferCard } })
  expect(toneClassesOf(statValue('버프 점수'))).toEqual(['top'])
  await render({ state: 'success', character: { ...found, tier: 'ranker' } })
  expect(toneClassesOf(statValue('장비 점수'))).toEqual(['ranker'])
})

it('계산하지 못한 장비 점수는 -에 사유 종류를 보조 기술로 전한다', async () => {
  const skipped: CardValues = {
    ...dealerCard,
    score: {
      calculator: 'equipment',
      value: null,
      skipped: { kind: 'resolution', message: 'ValueError: switching item has no candidate' },
      versions: { package: 'dnfscore', rulesRev: 'rev12', bundleId: 'phase31-rev12' }
    }
  }
  await render({ state: 'success', character: { ...found, card: skipped } })
  const score = statValue('장비 점수')
  expect(score.firstChild?.textContent).toBe('-')
  expect(score.textContent).toBe('-계산하지 못함, 아이템을 판별하지 못함')
  expect(card().textContent).not.toContain('ValueError')
})

it('장비 면은 세트와 서약 섹션, 묵언의 진의 단계 이름과 희귀도 개수를 보인다', async () => {
  await render({ state: 'success', character: found, initialFace: 1 })
  const set = container.querySelector('section[aria-label="세트"]')!
  expect(set.textContent).toContain('환상의 에테리얼 오브 아츠 세트')
  expect(set.textContent).toContain('세트 포인트')
  expect(set.textContent).toContain('2,625')
  expect(set.textContent).toContain('태초 3')
  // 115 세트는 대표 장비 그림 대신 번들한 세트 아이콘을 그림 이름과 함께 그린다.
  expect(set.querySelector('img')).toBeNull()
  expect(set.querySelector('[role="img"]')?.getAttribute('aria-label')).toBe(
    '환상의 에테리얼 오브 아츠 세트'
  )

  const oath = container.querySelector('section[aria-label="서약"]')!
  expect(oath.textContent).toContain('여우 : 초월')
  expect(oath.textContent).toContain('서약 포인트')
  const steps = [
    ...oath.querySelectorAll('[role="list"][aria-label="묵언의 진의"] [role="listitem"]')
  ]
  expect(steps.map((step) => step.getAttribute('aria-label'))).toEqual([
    '1단계 강인한 통찰',
    '2단계 포용의 권능',
    '3단계 심연의 고동',
    '4단계 신념의 대가',
    '5단계 이어진 걸음',
    '6단계 영원의 궤적',
    '7단계 만물의 흐름',
    '8단계 순례자의 길',
    '9단계 비어 있음'
  ])
})

it('기타 면은 12부위를 부위와 아이템 이름, 강화나 증폭 종류, 마법부여 등급 이름으로 전한다', async () => {
  await render({ state: 'success', character: found, initialFace: 2 })
  const table = container.querySelector('[role="tabpanel"] table')!
  expect(table.getAttribute('aria-label')).toBe('강화와 마법부여')
  const rows = [...table.querySelectorAll('tbody tr')]
  expect(rows).toHaveLength(12)
  const weapon = rows[0]
  expect(weapon.querySelector('th')?.textContent).toContain('무기, 검은 질병의 멸룡검 발뭉')
  expect(weapon.textContent).toContain('강화 13')
  expect(weapon.querySelector('[role="img"]')?.getAttribute('aria-label')).toBe('마법부여 종결')
  expect(rows[6].textContent).toContain('증폭 10')
  // 등급표에 없는 마법부여는 등급 그림 없이 `-`와 미평가로 전한다.
  expect(rows[9].querySelector('[role="img"]')).toBeNull()
  expect(rows[9].textContent).toContain('마법부여 미평가')
})

it('기타 면 행 왼쪽에 희귀도 표시의 장식 아이콘 칸을 두고 그림을 불러오지 못하면 빈 칸만 남긴다', async () => {
  await render({ state: 'success', character: found, initialFace: 2 })
  const weapon = container.querySelector('[role="tabpanel"] tbody tr')!
  const icon = weapon.querySelector('th [data-tone]')!
  expect(icon.getAttribute('data-tone')).toBe('primordial')
  expect(icon.getAttribute('aria-hidden')).toBe('true')
  const image = icon.querySelector('img')!
  expect(image.getAttribute('alt')).toBe('')
  expect(image.getAttribute('src')).toBe(
    'https://img-api.neople.co.kr/df/items/4f7c8199cd7a85492e985ebb5daa2da8'
  )
  // 이름 칸은 아이콘이 생겨도 부위와 아이템 이름을 보조 기술용 글자로 담는다.
  expect(weapon.querySelector('th')?.textContent).toContain('무기, 검은 질병의 멸룡검 발뭉')

  await act(async () => image.dispatchEvent(new Event('error')))
  expect(icon.querySelector('img')).toBeNull()
  expect(weapon.querySelector('th [data-tone="primordial"]')).toBe(icon)
})

it('카드 값이 아직 없어도 세 면을 고를 수 있고 각 면은 값 대신 없다는 안내와 -를 보인다', async () => {
  await render({ state: 'success', character: { ...found, card: null } })
  await act(async () => faceTab('장비').click())
  expect(container.querySelector('section[aria-label="세트"]')?.textContent).toContain(
    '세트 정보 없음'
  )
  expect(container.querySelector('section[aria-label="서약"]')?.textContent).toContain(
    '서약 정보 없음'
  )
  await act(async () => faceTab('기타').click())
  const weapon = container.querySelector('tbody tr')!
  expect(weapon.textContent).toContain('무기, 장착 정보 없음')
  expect(weapon.querySelector('th span[aria-hidden="true"]:not([data-tone])')?.textContent).toBe(
    '-'
  )
  // 장착 정보가 없어도 같은 크기의 빈 아이콘 칸은 남긴다.
  expect(weapon.querySelector('[data-tone="missing"]')).not.toBeNull()
  expect(weapon.querySelector('img')).toBeNull()
  expect(weapon.textContent).toContain('강화 정보 없음')
  expect(weapon.textContent).toContain('마법부여 없음')
})

it('조회를 마치지 않은 카드는 장비와 기타 면을 고를 수 없다', async () => {
  await render({ state: 'pending', character: found })
  expect(faceTab('장비').getAttribute('aria-disabled')).toBe('true')
  expect(faceTab('기타').getAttribute('aria-disabled')).toBe('true')
})

it('접힌 동안은 캐릭터 면을 보이고 펼치면 고른 면으로 돌아온다', async () => {
  await render({ state: 'success', character: found })
  await act(async () => faceTab('기타').click())
  expect(container.querySelector('input')).toBeNull()

  await render({ state: 'success', character: found, collapsed: true })
  expect(container.querySelector<HTMLInputElement>('input')?.value).toBe('찾은이름')
  expect(faceTab('캐릭터').getAttribute('aria-selected')).toBe('true')

  await render({ state: 'success', character: found, collapsed: false })
  expect(faceTab('기타').getAttribute('aria-selected')).toBe('true')
  expect(container.querySelector('input')).toBeNull()
})

const choices = [
  {
    characterId: 'cain-character',
    characterName: '찾은이름',
    serverId: 'cain',
    serverName: '카인',
    fame: 125850,
    adventureName: '찾은모험단',
    face: { x: 150, y: 50, width: 20, height: 20 }
  },
  {
    characterId: 'siroco-character',
    characterName: '찾은이름',
    serverId: 'siroco',
    serverName: '시로코',
    fame: 90000,
    adventureName: null,
    face: null
  }
]

function candidateTile(server: string): HTMLButtonElement {
  return [...card().querySelectorAll<HTMLButtonElement>('[role="group"] button')].find((button) =>
    button.getAttribute('aria-label')?.startsWith(server)
  )!
}

it('후보 줄은 후보마다 얼굴 창, 모험단, 서버를 보이고 지금 보이는 후보를 눌린 상태로 둔다', async () => {
  const pick = vi.fn()
  await render({
    state: 'success',
    character: found,
    picker: { choices, shownServerId: 'cain', previewServerId: null },
    onPickCandidate: pick
  })

  expect(card().querySelector('[role="group"]')?.getAttribute('aria-label')).toBe('1번 후보 고르기')
  expect(candidateTile('카인').getAttribute('aria-label')).toBe('카인, 찾은모험단')
  expect(candidateTile('카인').getAttribute('aria-pressed')).toBe('true')
  expect(candidateTile('시로코').getAttribute('aria-label')).toBe('시로코, 모험단 정보 없음')
  expect(candidateTile('시로코').getAttribute('aria-pressed')).toBe('false')
  expect(candidateTile('카인').querySelector('img')?.getAttribute('src')).toBe(
    'https://img-api.neople.co.kr/df/servers/cain/characters/cain-character?zoom=1'
  )
  expect(candidateTile('시로코').querySelector('img')).toBeNull()
  expect(card().getAttribute('data-state')).toBe('default')

  await act(async () => candidateTile('시로코').click())
  expect(pick).toHaveBeenCalledExactlyOnceWith('siroco')
})

it('미리보기 중이면 카드를 선택 상태로 보이고 그 후보에 한 번 더 누르면 확정이라고 알린다', async () => {
  await render({
    state: 'success',
    character: found,
    picker: { choices, shownServerId: 'siroco', previewServerId: 'siroco' },
    onPickCandidate: vi.fn()
  })

  expect(card().getAttribute('data-state')).toBe('selected')
  expect(card().querySelector('[aria-label="후보 미리보기 중"]')).not.toBeNull()
  expect(candidateTile('시로코').getAttribute('aria-label')).toBe(
    '시로코, 모험단 정보 없음, 미리보기 중, 한 번 더 누르면 확정'
  )
})

it('접힌 카드는 작은 후보 타일로 고르고, 모험단을 모르는 후보는 서버를 대신 보인다', async () => {
  const pick = vi.fn()
  const picker = { choices, shownServerId: 'cain', previewServerId: null }
  await render({
    state: 'success',
    character: found,
    picker,
    collapsed: true,
    onPickCandidate: pick
  })

  const groups = card().querySelectorAll('[role="group"]')
  expect(groups).toHaveLength(1)
  expect(groups[0].getAttribute('aria-label')).toBe('1번 후보 고르기')
  expect(card().querySelector('[aria-label^="외형으로 확정하지 못함"]')).toBeNull()
  expect(candidateTile('카인').getAttribute('aria-pressed')).toBe('true')
  expect(candidateTile('카인').textContent).toBe('찾은모험단')
  expect(candidateTile('시로코').textContent).toBe('—시로코')
  await act(async () => candidateTile('시로코').click())
  expect(pick).toHaveBeenCalledExactlyOnceWith('siroco')
})

it('후보 타일이 있는 접힌 카드는 이름 위에 흐르는 글자를 겹치고, 고치는 동안과 펼친 카드에는 겹치지 않는다', async () => {
  const picker = { choices, shownServerId: 'cain', previewServerId: null }
  await render({ state: 'success', character: found, picker, collapsed: true })
  const input = container.querySelector<HTMLInputElement>('input')!
  const overlay = (): Element | null =>
    input.parentElement!.querySelector('span[aria-hidden="true"]')

  expect(overlay()?.textContent).toBe('찾은이름')

  await act(async () => input.focus())
  expect(overlay()).toBeNull()

  await render({ state: 'success', character: found, picker })
  expect(container.querySelector('input')!.parentElement!.querySelector('span')).toBeNull()
})

it('미리보기 조회가 실패해도 후보 줄은 남는다', async () => {
  const picker = { choices, shownServerId: 'cain', previewServerId: null }
  await render({ state: 'failure', character: undefined, picker, onPickCandidate: vi.fn() })

  expect(card().querySelector('[role="group"]')).not.toBeNull()
  expect(card().getAttribute('data-state')).toBe('failure')
})
