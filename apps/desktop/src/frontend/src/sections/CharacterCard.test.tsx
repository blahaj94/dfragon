// @vitest-environment jsdom
import { colors } from '@dfragon/ui/tokens.stylex'
import * as stylex from '@stylexjs/stylex'
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
  ServerSelect: ({ value, onValueChange, label, options }: ComponentProps<typeof ServerSelect>) => (
    <select
      aria-label={label}
      value={value}
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

const cardKey = { id: 'party-0', resetKey: '0' }

type RenderProps = Partial<SlotCard> & Partial<Omit<ComponentProps<typeof CharacterCard>, 'card'>>

async function render({
  state = 'idle',
  character,
  nickname,
  notice,
  loading,
  snapshotMark,
  snapshotAdventureInput,
  picker,
  scorePending,
  onLookup = vi.fn(),
  onPickCandidate = vi.fn(),
  onChangeSnapshotAdventure = vi.fn(),
  ...props
}: RenderProps = {}): Promise<void> {
  const card = {
    state,
    character,
    nickname,
    notice,
    loading,
    snapshotMark,
    snapshotAdventureInput,
    picker,
    scorePending
  }
  await act(async () =>
    root.render(
      <CharacterCard
        cardKey={cardKey}
        slot={1}
        onLookup={onLookup}
        onPickCandidate={onPickCandidate}
        onChangeSnapshotAdventure={onChangeSnapshotAdventure}
        {...props}
        card={card}
      />
    )
  )
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

it('OCR, 후보 검색, 상세 정보 순서로 진행 점을 하나씩 켜고 조회를 마치면 지운다', async () => {
  await render({ loading: true })
  expect(progressOf()).toEqual({ step: '이름 인식 중', dots: [activeDot, waitingDot, waitingDot] })
  expect(card().getAttribute('aria-busy')).toBe('true')
  await render({ state: 'pending', nickname: '인식이름' })
  expect(progressOf()).toEqual({ step: '캐릭터 검색 중', dots: [doneDot, activeDot, waitingDot] })
  await render({ state: 'success', character: found, scorePending: true })
  expect(progressOf()).toEqual({ step: '상세 정보 확인 중', dots: [doneDot, doneDot, activeDot] })
  expect(card().getAttribute('aria-busy')).toBe('false')
  await render({ state: 'success', character: found })
  expect(lookupProgress()).toBeNull()
  await render({ state: 'failure' })
  expect(lookupProgress()).toBeNull()
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
        cardKey={{ ...cardKey, resetKey: 'new-round' }}
        card={{ state: 'pending', nickname: '다음OCR' }}
        slot={1}
        onLookup={lookup}
        onPickCandidate={vi.fn()}
        onChangeSnapshotAdventure={vi.fn()}
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

function statusMark(): Element | null {
  return card().querySelector('[role="img"]:not([aria-label$="이미지 없음"])')
}

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

  await render({ state: 'idle', character: undefined })
  expect(card().getAttribute('data-state')).toBe('waiting')
  expect(statusMark()).toBeNull()
})

function decorationCount(): number {
  return card().querySelectorAll(':scope > span[aria-hidden="true"]').length
}

it('헤더 줄은 서버 선택을 품은 이름 칸, 상태 표시, 스냅샷 칩 순서이고 자리 번호는 없다', async () => {
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

  await render({ state: 'idle', character: undefined })
  const vacantField = card().querySelector('input')!.parentElement!.className
  await render({ state: 'pending', character: undefined })
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

it('스냅샷에 없는 모험단 카드는 ! 칩과 카드를 덮는 장식 레이어를 보이고 꺾쇠 상태는 그대로 둔다', async () => {
  await render({ state: 'success', character: found })
  const decorations = decorationCount()
  await render({ state: 'success', character: found, snapshotMark: { kind: 'absent' } })

  const chip = card().querySelector('[role="img"][aria-label="스냅샷에 없는 모험단"]')!
  expect(chip.textContent).toBe('!')
  expect(decorationCount()).toBe(decorations + 1)
  expect(card().getAttribute('data-state')).toBe('default')
  expect(card().querySelector('[aria-label^="스냅샷 순번"]')).toBeNull()
})

it('스냅샷 순번 칩 아이콘은 순번에 있으면 채우고 없으면 윤곽만 둔다', async () => {
  await render({
    state: 'success',
    character: found,
    snapshotMark: { kind: 'moved', seat: 2 }
  })
  const moved = card().querySelector('[aria-label="스냅샷 순번 2"] svg')!
  expect(moved.getAttribute('fill')).toBe('currentColor')

  await render({ state: 'success', character: found, snapshotMark: { kind: 'absent' } })
  const absent = card().querySelector('[aria-label="스냅샷에 없는 모험단"] svg')!
  expect(absent.getAttribute('fill')).toBe('none')
})

it('스냅샷 표시를 걷으면 칩과 오버레이가 함께 사라진다', async () => {
  await render({ state: 'success', character: found })
  const decorations = decorationCount()
  await render({ state: 'success', character: found, snapshotMark: { kind: 'absent' } })
  await render({ state: 'success', character: found })

  expect(card().querySelector('[aria-label^="스냅샷"]')).toBeNull()
  expect(decorationCount()).toBe(decorations)
})

function lookupProgress(): Element | null {
  return card().querySelector('[role="progressbar"][aria-label="1번 캐릭터 확인 중"]')
}

// jsdom은 색과 애니메이션을 계산하지 않으므로, 같은 StyleX 선언의 atomic class로 점이 켜졌는지와 깜박이는지 확인한다.
const dotStyles = stylex.create({
  lit: { backgroundColor: colors.signal },
  blinking: { animationIterationCount: 'infinite' }
})

type DotState = { lit: boolean; blinking: boolean }

const waitingDot: DotState = { lit: false, blinking: false }
const activeDot: DotState = { lit: false, blinking: true }
const doneDot: DotState = { lit: true, blinking: false }

function progressOf(): { step: string | null; dots: DotState[] } {
  const progress = lookupProgress()!
  const litClass = stylex.props(dotStyles.lit).className!
  const blinkingClass = stylex.props(dotStyles.blinking).className!
  const dots = [...progress.children].map((dot) => {
    const classes = dot.className.split(' ')
    const lit = classes.includes(litClass)
    const blinking = classes.includes(blinkingClass)

    return { lit, blinking }
  })
  const step = progress.getAttribute('aria-valuetext')

  return { step, dots }
}

it('이름에 들어가거나 고치는 동안 선택 상태로 보이되 진행 표시는 없고 조회하면 돌아온다', async () => {
  const lookup = vi.fn()
  await render({ state: 'success', character: found, onLookup: lookup })
  const input = container.querySelector('input')!
  await act(async () => input.focus())
  expect(card().getAttribute('data-state')).toBe('selected')
  expect(statusMark()).toBeNull()
  expect(lookupProgress()).toBeNull()
  expect(card().getAttribute('aria-busy')).toBe('false')
  await act(async () => input.blur())
  expect(card().getAttribute('data-state')).toBe('default')

  await enterName('고친이름')
  expect(card().getAttribute('data-state')).toBe('selected')
  expect(card().textContent).toContain('Enter로 조회')
  expect(statusMark()).toBeNull()
  expect(lookupProgress()).toBeNull()
  await act(async () =>
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
  )
  expect(lookup).toHaveBeenCalledExactlyOnceWith('고친이름', 'cain')
  await render({ state: 'pending', nickname: '고친이름', onLookup: lookup })
  expect(card().getAttribute('data-state')).toBe('default')
  expect(statusMark()).toBeNull()
  expect(lookupProgress()).not.toBeNull()
})

it('상세 정보까지 받은 찾은 카드는 캡처 인식 중에만 진행 표시를 보인다', async () => {
  await render({ state: 'success', character: found })
  await act(async () => container.querySelector('input')!.focus())
  expect(lookupProgress()).toBeNull()

  await render({ state: 'success', character: found, loading: true })
  expect(lookupProgress()).not.toBeNull()
  expect(card().getAttribute('aria-busy')).toBe('true')

  await render({ state: 'success', character: found, loading: false })
  expect(lookupProgress()).toBeNull()
  expect(card().getAttribute('aria-busy')).toBe('false')
})

function columnLines(): HTMLElement[] {
  const header = card().querySelector('input')!.closest('div:has(> div > div > input)')
  const column = header!.parentElement!

  return [...column.children] as HTMLElement[]
}

it('찾은 카드는 이름 칸, 모험단과 길드, 명성과 점수, 각성 표시를 뺀 직업을 차례로 둔다', async () => {
  await render({ state: 'success', character: { ...found, job: '眞 웨펀마스터' } })
  const lines = columnLines()
  expect(lines).toHaveLength(4)
  expect(lines[0].querySelector('input')?.value).toBe('찾은이름')
  expect(lines[1].textContent).toBe('찾은모험단찾은길드')
  expect(lines[2].querySelectorAll('dt')).toHaveLength(2)
  expect(lines[3].textContent).toBe('웨펀마스터')
  expect(card().querySelector('[aria-label="캐릭터 이미지 없음"]')).not.toBeNull()
})

it('찾은 카드의 안내는 직업 뒤에 두고, 고치는 동안에는 Enter 조회 안내를 둔다', async () => {
  await render({ state: 'success', character: found, notice: '명성으로 추정한 후보입니다.' })
  const note = columnLines()[3].querySelector('p')!
  expect(columnLines()[3].textContent).toBe('찾은직업명성으로 추정한 후보입니다.')
  expect(note.title).toBe('명성으로 추정한 후보입니다.')

  await render({ state: 'success', character: found })
  await enterName('고친이름')
  expect(columnLines()[3].textContent).toBe('찾은직업Enter로 조회')
})

it('찾지 못한 자리는 소속 줄에 안내를, 안내가 없으면 흐린 모험단을 둔다', async () => {
  await render({
    state: 'failure',
    nickname: '없는이름',
    notice: '캐릭터를 찾지 못했습니다.'
  })
  const lines = columnLines()
  expect(lines).toHaveLength(3)
  expect(lines[1].textContent).toBe('캐릭터를 찾지 못했습니다.')
  expect(lines[1].querySelector('p')?.title).toBe('캐릭터를 찾지 못했습니다.')

  await render({ state: 'idle', nickname: '인식이름' })
  expect(columnLines()).toHaveLength(3)
  const placeholder = columnLines()[1].firstElementChild!
  expect(placeholder.textContent).toBe('모험단')
  expect(placeholder.getAttribute('aria-hidden')).toBe('true')
})

it('스냅샷 모험단 입력이 열린 실패 카드는 소속 줄을 모험단 입력으로 바꾸고 안내를 툴팁으로 둔다', async () => {
  const change = vi.fn()
  await render({
    state: 'failure',
    nickname: '없는이름',
    notice: '캐릭터를 찾지 못했습니다.',
    snapshotAdventureInput: '별',
    onChangeSnapshotAdventure: change
  })

  const field = columnLines()[1].querySelector<HTMLInputElement>('input[aria-label="1번 모험단"]')!
  expect(field.value).toBe('별')
  expect(field.title).toBe('캐릭터를 찾지 못했습니다.')
  expect(columnLines()[1].querySelector('p')).toBeNull()
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(field, '별빛')
    field.dispatchEvent(new Event('input', { bubbles: true }))
  })
  expect(change).toHaveBeenCalledExactlyOnceWith('별빛')
})

it('명성과 장비 점수를 라벨과 값으로 두고 0과 알 수 없음을 구분하며 소속을 보인다', async () => {
  await render({
    state: 'success',
    character: { ...found, fame: 0, card: { ...dealerCard, score: null } }
  })
  const fame = statValue('명성')
  const score = statValue('장비')
  expect(fame.firstChild?.textContent).toBe('0')
  expect(score.textContent).toBe('-')
  expect(card().textContent).toContain('찾은모험단')
  expect(card().textContent).toContain('찾은길드')
  expect(card().textContent).not.toContain('서버 순위')

  await render({ state: 'success', character: found })
  const scoreValue = statValue('장비')
  expect(scoreValue.firstChild?.textContent).toBe('330,556')
  expect(scoreValue.textContent).toContain('던삐삐 계산값')
})

it('검색 응답에 없는 길드, 명성, 장비 점수는 0이나 빈칸 대신 -로 보인다', async () => {
  await render({
    state: 'success',
    character: { ...found, guild: null, fame: null, card: null }
  })
  const values = [statValue('명성'), statValue('장비')]
  expect(values.map((value) => value.textContent)).toEqual(['-', '-'])
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

  await render({ state: 'failure', character: { ...found, tier: 'ranker' } })
  expect(card().getAttribute('data-state')).toBe('failure')
  expect(card().textContent).not.toContain('랭커 단계')
  await render({ state: 'success', character: { ...found, tier: 'ranker' } })
  await enterName('고친이름')
  expect(card().getAttribute('data-state')).toBe('selected')
})

it('캐릭터 면 하나만 두어 면 탭과 상세 열기 버튼이 없고 명성과 짧은 점수 라벨을 한 줄에 둔다', async () => {
  await render({ state: 'success', character: found })
  expect(container.querySelector('[role="tab"]')).toBeNull()
  expect(container.querySelector('[aria-label="1번 캐릭터 상세 열기"]')).toBeNull()
  expect([...card().querySelectorAll('dt')].map((term) => term.textContent)).toEqual([
    '명성',
    '장비'
  ])
  expect(card().textContent).toContain('찾은직업')

  await render({ state: 'success', character: { ...found, card: bufferCard } })
  expect([...card().querySelectorAll('dt')].map((term) => term.textContent)).toEqual([
    '명성',
    '버프'
  ])
  expect(statValue('버프').firstChild?.textContent).toBe('55,358')
  expect(statValue('버프').textContent).toContain('게임 버프 점수')
})

it('점수 숫자는 딜러 파랑, 버퍼 초록으로 칠하고 역할을 모르거나 값이 없으면 기본색이다', async () => {
  await render({ state: 'success', character: found })
  expect(toneClassesOf(statValue('장비'))).toEqual(['dealer'])
  expect(toneClassesOf(statValue('명성'))).toEqual([])

  await render({ state: 'success', character: { ...found, card: bufferCard } })
  expect(toneClassesOf(statValue('버프'))).toEqual(['buffer'])
  expect(toneClassesOf(statValue('명성'))).toEqual([])

  await render({
    state: 'success',
    character: { ...found, card: { ...dealerCard, role: null } }
  })
  expect(statValue('장비').firstChild?.textContent).toBe('330,556')
  expect(toneClassesOf(statValue('장비'))).toEqual([])

  await render({ state: 'success', character: { ...found, card: { ...dealerCard, score: null } } })
  const dealerMissing = statValue('장비')
  expect(dealerMissing.textContent).toBe('-')
  expect(toneClassesOf(dealerMissing)).toEqual([])
  const missingClass = dealerMissing.className
  await render({ state: 'success', character: { ...found, card: { ...bufferCard, score: null } } })
  expect(statValue('버프').textContent).toBe('-')
  expect(statValue('버프').className).toBe(missingClass)
})

it('상위, 랭커 카드의 점수 숫자는 역할 색 대신 단계 색을 유지한다', async () => {
  await render({ state: 'success', character: { ...found, tier: 'top', card: bufferCard } })
  expect(toneClassesOf(statValue('버프'))).toEqual(['top'])
  await render({ state: 'success', character: { ...found, tier: 'ranker' } })
  expect(toneClassesOf(statValue('장비'))).toEqual(['ranker'])
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
  const score = statValue('장비')
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
      versions: { package: 'dnfscore-native 0.3.1', rulesRev: 'rev14', bundleId: 'phase32-rev14b' }
    }
  }
  await render({ state: 'success', character: { ...found, card: approximate } })
  const score = statValue('장비')
  const description =
    '근사값, 아이템을 판별하지 못함. 입력값 차이를 무시하고 계산한 값이라 게임 장비 점수와 1% 넘게 다를 수 있습니다.'
  expect(score.firstChild?.textContent).toBe('≈321,000')
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

function candidateWindow(): Element | null {
  return container.querySelector('[role="group"][aria-label="1번 후보 고르기"]')
}

function candidateTile(server: string): HTMLButtonElement {
  return [...candidateWindow()!.querySelectorAll<HTMLButtonElement>('button')].find((button) =>
    button.getAttribute('aria-label')?.startsWith(server)
  )!
}

function candidateChip(): HTMLButtonElement | null {
  const chip = [...card().querySelectorAll<HTMLButtonElement>('button')].find((button) =>
    button.textContent?.startsWith('후보')
  )
  if (chip === undefined) {
    return null
  }

  return chip
}

it('후보가 있으면 후보 창을 띄워 초상화로 고르고 지금 보이는 후보를 눌린 상태로 둔다', async () => {
  const pick = vi.fn()
  await render({
    state: 'success',
    character: found,
    picker: { choices, shownServerId: 'cain', previewServerId: null },
    onPickCandidate: pick
  })

  expect(candidateTile('카인').getAttribute('aria-label')).toBe('카인, 명성 125,850, 찾은모험단')
  expect(candidateTile('카인').getAttribute('aria-pressed')).toBe('true')
  expect(candidateTile('시로코').getAttribute('aria-pressed')).toBe('false')
  expect(card().getAttribute('data-state')).toBe('default')

  await act(async () => candidateTile('시로코').click())
  expect(pick).toHaveBeenCalledExactlyOnceWith('siroco')
})

it('미리보기 중이면 상세를 기다리던 카드여도 진행 표시 없이 선택 상태로 보이고 그 후보에 한 번 더 누르면 확정이라고 알린다', async () => {
  await render({
    state: 'success',
    character: found,
    scorePending: true,
    picker: { choices, shownServerId: 'siroco', previewServerId: 'siroco' },
    onPickCandidate: vi.fn()
  })

  expect(card().getAttribute('data-state')).toBe('selected')
  expect(statusMark()).toBeNull()
  expect(lookupProgress()).toBeNull()
  expect(candidateTile('시로코').getAttribute('aria-label')).toBe(
    '시로코, 명성 90,000, 모험단 정보 없음, 미리보기 중, 한 번 더 누르면 확정'
  )
})

it('닫기 X로 닫으면 스냅샷 칩 앞에 후보 수 칩이 남고, 칩을 누르면 창을 다시 연다', async () => {
  const picker = { choices, shownServerId: 'cain', previewServerId: null }
  await render({
    state: 'success',
    character: found,
    picker,
    snapshotMark: { kind: 'moved', seat: 3 },
    onPickCandidate: vi.fn()
  })
  const chip = candidateChip()!
  expect(chip.textContent).toBe('후보 2')
  expect(chip.getAttribute('aria-expanded')).toBe('true')
  expect(chip.getAttribute('aria-controls')).toBe(candidateWindow()!.id)
  const snapshot = card().querySelector('[aria-label="스냅샷 순번 3"]')!
  expect(chip.compareDocumentPosition(snapshot) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0)

  await act(async () =>
    container.querySelector<HTMLButtonElement>('[aria-label="1번 후보 창 닫기"]')!.click()
  )
  expect(candidateWindow()).toBeNull()
  expect(candidateChip()?.getAttribute('aria-expanded')).toBe('false')

  await render({
    state: 'success',
    character: found,
    picker: { ...picker, previewServerId: 'siroco', shownServerId: 'siroco' }
  })
  expect(candidateWindow()).toBeNull()

  await act(async () => candidateChip()!.click())
  expect(candidateWindow()).not.toBeNull()
  expect(candidateChip()?.getAttribute('aria-expanded')).toBe('true')
})

it('확정해 후보가 사라지면 후보 창과 칩이 함께 사라지고, 다음 후보는 열린 창으로 보인다', async () => {
  const picker = { choices, shownServerId: 'cain', previewServerId: null }
  await render({ state: 'success', character: found, picker })
  await act(async () =>
    container.querySelector<HTMLButtonElement>('[aria-label="1번 후보 창 닫기"]')!.click()
  )
  await render({ state: 'success', character: found })
  expect(candidateWindow()).toBeNull()
  expect(candidateChip()).toBeNull()

  await render({ state: 'success', character: found, picker })
  expect(candidateWindow()).not.toBeNull()
})

it('다음 회차에 새로 그린 카드는 닫았던 후보 창을 다시 연 채로 시작한다', async () => {
  const picker = { choices, shownServerId: 'cain', previewServerId: null }
  const card = { state: 'success' as const, character: found, picker }
  await act(async () =>
    root.render(
      <CharacterCard
        key="round-1"
        cardKey={{ ...cardKey, resetKey: 'round-1' }}
        card={card}
        slot={1}
        onLookup={vi.fn()}
        onPickCandidate={vi.fn()}
        onChangeSnapshotAdventure={vi.fn()}
      />
    )
  )
  await act(async () =>
    container.querySelector<HTMLButtonElement>('[aria-label="1번 후보 창 닫기"]')!.click()
  )
  expect(candidateWindow()).toBeNull()

  await act(async () =>
    root.render(
      <CharacterCard
        key="round-2"
        cardKey={{ ...cardKey, resetKey: 'round-2' }}
        card={card}
        slot={1}
        onLookup={vi.fn()}
        onPickCandidate={vi.fn()}
        onChangeSnapshotAdventure={vi.fn()}
      />
    )
  )
  expect(candidateWindow()).not.toBeNull()
})

it('같은 회차의 카드를 다시 그리면 닫았던 후보 창을 닫힌 채로 둔다', async () => {
  const picker = { choices, shownServerId: 'cain', previewServerId: null }
  await render({ state: 'success', character: found, picker })
  await act(async () =>
    container.querySelector<HTMLButtonElement>('[aria-label="1번 후보 창 닫기"]')!.click()
  )

  await act(async () => root.unmount())
  root = createRoot(container)
  await render({ state: 'success', character: found, picker })

  expect(candidateWindow()).toBeNull()
  expect(candidateChip()).not.toBeNull()
})

it('미리보기 조회가 실패해도 후보 창은 남는다', async () => {
  const picker = { choices, shownServerId: 'cain', previewServerId: null }
  await render({ state: 'failure', character: undefined, picker, onPickCandidate: vi.fn() })

  expect(candidateWindow()).not.toBeNull()
  expect(card().getAttribute('data-state')).toBe('failure')
})
