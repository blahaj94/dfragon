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
  await render({
    state: 'success',
    character: { ...previous, name: '수동이름' },
    onLookup: lookup
  })
  expect(input.value).toBe('수동이름')
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

it('검색 상태를 꺾쇠 상태와 오른쪽 위 표시로 보이고 상태 이름을 글자로 다시 쓰지 않는다', async () => {
  await render({ state: 'success', character: found })
  expect(card().getAttribute('data-state')).toBe('default')
  expect(statusMark()).toBeNull()

  await render({ state: 'failure', character: undefined })
  expect(card().getAttribute('data-state')).toBe('failure')
  expect(card().querySelector('[role="img"][aria-label="검색 실패"]')?.textContent).toBe('!')
  expect(visibleText()).not.toContain('검색 실패')
  expect(card().textContent).toContain('검색 실패')

  await render({ state: 'empty', character: undefined })
  expect(card().getAttribute('data-state')).toBe('failure')
  expect(visibleText()).toContain('검색 결과가 없습니다')

  // 대기 모래시계는 두지 않고 상태 이름은 보조 기술에만 전한다.
  await render({ state: 'waiting-portrait', character: undefined })
  expect(card().getAttribute('data-state')).toBe('waiting')
  expect(statusMark()).toBeNull()
  expect(card().textContent).toContain('얼굴 인식 대기')

  await render({ state: 'idle', character: undefined })
  expect(card().getAttribute('data-state')).toBe('waiting')
  expect(statusMark()).toBeNull()
})

// 카드 바로 아래의 장식 요소 수. 꺾쇠 네 개와 스냅샷에 없는 모험단의 덮는 층이 여기 들어간다.
function decorationCount(): number {
  return card().querySelectorAll(':scope > span[aria-hidden="true"]').length
}

it('머리 줄은 서버 선택을 품은 이름 칸, 상태 표시, 스냅샷 칩 순서이고 자리 번호는 없다', async () => {
  await render({
    state: 'failure',
    character: undefined,
    nickname: '실패이름',
    snapshotMark: { kind: 'moved', seat: 2 }
  })
  const input = card().querySelector('input')!
  const selects = card().querySelectorAll('select')
  const mark = card().querySelector('[role="img"][aria-label="검색 실패"]')!
  const chip = card().querySelector('[role="img"][aria-label="스냅샷 순번 2"]')!
  expect(selects).toHaveLength(1)
  expect(input.parentElement!.contains(selects[0])).toBe(true)
  expect(input.compareDocumentPosition(mark) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0)
  expect(mark.compareDocumentPosition(chip) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0)
  expect(visibleText()).not.toMatch(/0[1-4]/)

  // 입력할 수 없고 캐릭터도 찾지 못한 자리는 서버 선택을 숨긴다.
  await render({ state: 'idle', character: undefined, inputEnabled: false })
  expect(card().querySelector('select')).toBeNull()
  expect(card().querySelector('input')!.disabled).toBe(true)

  // 빈 자리의 이름 칸은 얼굴 인식을 기다리는 자리와 다른 테두리다.
  const vacantField = card().querySelector('input')!.parentElement!.className
  await render({ state: 'waiting-portrait', character: undefined, inputEnabled: false })
  expect(card().querySelector('input')!.parentElement!.className).not.toBe(vacantField)
})

it('스냅샷과 자리가 다른 카드는 이름 칸 뒤에 스냅샷 순번 칩을 보이고 카드 조작은 그대로 쓴다', async () => {
  const lookup = vi.fn()
  await render({ state: 'success', character: found, onLookup: lookup })
  const decorations = decorationCount()
  await render({
    state: 'success',
    character: found,
    onLookup: lookup,
    snapshotMark: { kind: 'moved', seat: 3 }
  })
  const chip = card().querySelector('[role="img"][aria-label="스냅샷 순번 3"]')!
  const server = card().querySelector('select')!
  expect(chip.textContent).toBe('3')
  expect(server.compareDocumentPosition(chip) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0)
  expect(card().querySelector('[aria-label="스냅샷에 없는 모험단"]')).toBeNull()
  expect(decorationCount()).toBe(decorations)
  expect(card().getAttribute('data-state')).toBe('default')
  await act(async () => {
    server.value = 'bakal'
    server.dispatchEvent(new Event('change', { bubbles: true }))
  })
  expect(lookup).toHaveBeenCalledExactlyOnceWith('찾은이름', 'bakal')
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

it('명성과 장비 점수를 라벨과 값으로 두고 0과 알 수 없음을 구분하며 소속을 보인다', async () => {
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
  // 서버 순위는 지웠다.
  expect(card().textContent).not.toContain('서버 순위')

  await render({ state: 'success', character: found })
  const scoreValue = statValue('장비 점수')
  expect(scoreValue.querySelector('[aria-hidden="true"]')?.textContent).toBe('330,556')
  expect(scoreValue.textContent).toContain('DFragon 계산값')
})

it('검색 응답에 없는 길드, 명성, 장비 점수는 0이나 빈칸 대신 -로 보인다', async () => {
  await render({
    state: 'success',
    character: { ...found, guild: null, fame: null, card: null }
  })
  const values = [statValue('명성'), statValue('장비 점수')]
  expect(values.map((value) => value.textContent)).toEqual(['-', '-'])
  expect(values.some((value) => value.querySelector('[aria-hidden="true"]') != null)).toBe(false)
  expect(card().textContent).toContain('찾은모험단-')
})

it('상위, 랭커 단계를 꺾쇠 상태와 단계 색 숫자로 보이고 단계 이름을 보조 기술에 전한다', async () => {
  await render({ state: 'success', character: found })
  const defaultValue = statValue('명성').className
  expect(card().textContent).not.toContain('단계')

  await render({ state: 'success', character: { ...found, tier: 'top' } })
  expect(card().getAttribute('data-state')).toBe('top')
  expect(card().textContent).toContain('상위 단계')
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

it('캐릭터 면 하나만 두어 면 탭, 스탯 한 줄, 상세 열기 버튼이 없다', async () => {
  await render({ state: 'success', character: found })
  expect(container.querySelector('[role="tab"]')).toBeNull()
  expect(container.querySelector('[aria-label="1번 캐릭터 상세 열기"]')).toBeNull()
  expect([...card().querySelectorAll('dt')].map((term) => term.textContent)).toEqual([
    '명성',
    '장비 점수'
  ])
  expect(card().textContent).toContain('찾은직업')

  await render({ state: 'success', character: { ...found, card: bufferCard } })
  expect([...card().querySelectorAll('dt')].map((term) => term.textContent)).toEqual([
    '명성',
    '버프 점수'
  ])
  expect(statValue('버프 점수').querySelector('[aria-hidden="true"]')?.textContent).toBe('55,358')
  expect(statValue('버프 점수').textContent).toContain('게임 버프 점수')
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
    character: { ...found, card: { ...dealerCard, role: null } }
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
      approximate: null,
      versions: { package: 'dnfscore', rulesRev: 'rev12', bundleId: 'phase31-rev12' }
    }
  }
  await render({ state: 'success', character: { ...found, card: skipped } })
  const score = statValue('장비 점수')
  expect(score.firstChild?.textContent).toBe('-')
  expect(score.textContent).toBe('-계산하지 못함, 아이템을 판별하지 못함')
  expect(card().textContent).not.toContain('ValueError')
})

it('엔진이 근사값을 낸 장비 점수는 ≈를 붙여 역할 색으로 보이고 근사값이라는 뜻을 보조 기술로 전한다', async () => {
  const approximate: CardValues = {
    ...dealerCard,
    score: {
      calculator: 'equipment',
      value: null,
      skipped: { kind: 'resolution', message: 'ValueError: switching item has no candidate' },
      approximate: {
        value: 321000,
        source: 'input_gate_diagnostic',
        warning: '근사값, 1% 밖일 가능성 높음: ValueError: switching item has no candidate'
      },
      versions: { package: 'dnfscore-native 0.3.0', rulesRev: 'rev14', bundleId: 'phase32-rev14' }
    }
  }
  await render({ state: 'success', character: { ...found, card: approximate } })
  const score = statValue('장비 점수')
  const description =
    '근사값, 아이템을 판별하지 못함. 입력값 차이를 무시하고 계산한 값이라 게임 장비 점수와 1% 넘게 다를 수 있습니다.'
  expect(score.querySelector('[aria-hidden="true"]')?.textContent).toBe('≈321,000')
  expect(score.getAttribute('title')).toBe(description)
  expect(score.textContent).toContain(description)
  expect(toneClassesOf(score)).toEqual(['dealer'])
  expect(card().textContent).not.toContain('ValueError')
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

it('미리보기 조회가 실패해도 후보 줄은 남는다', async () => {
  const picker = { choices, shownServerId: 'cain', previewServerId: null }
  await render({ state: 'failure', character: undefined, picker, onPickCandidate: vi.fn() })

  expect(card().querySelector('[role="group"]')).not.toBeNull()
  expect(card().getAttribute('data-state')).toBe('failure')
})
