// @vitest-environment jsdom
import { act, type ComponentProps } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { CharacterCard } from './CharacterCard'
import type { ServerSelect } from '../components/ServerSelect'
import type { CardCharacter } from '../types/cards'

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

async function render(props: Partial<ComponentProps<typeof CharacterCard>> = {}): Promise<void> {
  await act(async () =>
    root.render(<CharacterCard state="idle" slot={1} inputEnabled basicOnly {...props} />)
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
    equipment: [],
    oath: []
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
        state="pending"
        slot={1}
        nickname="다음OCR"
        inputEnabled
        basicOnly
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
  equipmentScore: 414806,
  serverRank: 18240,
  equipment: [],
  oath: []
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
  await render({ state: 'success', character: { ...found, fame: 0, equipmentScore: undefined } })
  const terms = [...card().querySelectorAll('dt')]
  expect(terms.map((term) => term.textContent)).toEqual(['명성', '장비 점수'])
  const [fame, score] = terms.map((term) => term.nextElementSibling!)
  expect(fame.querySelector('[aria-hidden="true"]')?.textContent).toBe('0')
  expect(score.textContent).toBe('-')
  expect(card().textContent).toContain('찾은모험단')
  expect(card().textContent).toContain('찾은길드')
  expect(card().textContent).toContain('서버 순위 18240위')

  await render({ state: 'success', character: found })
  expect(card().querySelectorAll('dd')[1].querySelector('[aria-hidden="true"]')?.textContent).toBe(
    '414,806'
  )
})

it('검색 응답에 없는 길드, 서버 순위, 명성, 장비 점수는 0이나 빈칸 대신 -로 보인다', async () => {
  await render({
    state: 'success',
    character: { ...found, guild: null, serverRank: null, fame: null, equipmentScore: null }
  })
  const values = [...card().querySelectorAll('dd')]
  expect(values.map((value) => value.textContent)).toEqual(['-', '-'])
  expect(values.some((value) => value.querySelector('[aria-hidden="true"]') != null)).toBe(false)
  expect(card().textContent).toContain('찾은모험단-')
  expect(card().textContent).toContain('서버 순위 없음')
  expect(card().textContent).not.toContain('#')
})

it('상위, 랭커 단계를 꺾쇠 상태와 단계 색 숫자로 보이고 단계 이름을 보조 기술에 전한다', async () => {
  await render({ state: 'success', character: found })
  const defaultValue = card().querySelector('dd')!.className
  expect(card().textContent).not.toContain('단계')

  await render({ state: 'success', character: { ...found, tier: 'top' } })
  expect(card().getAttribute('data-state')).toBe('top')
  expect(card().textContent).toContain('상위 단계')
  expect(card().textContent).toContain('서버 순위 18240위')
  const topValue = card().querySelector('dd')!.className
  expect(topValue).not.toBe(defaultValue)

  await render({ state: 'success', character: { ...found, tier: 'ranker' } })
  expect(card().getAttribute('data-state')).toBe('ranker')
  expect(card().textContent).toContain('랭커 단계')
  expect(card().querySelector('dd')!.className).not.toBe(topValue)

  // 조회 실패에는 단계를 보이지 않고, 이름을 고치면 단계보다 수정 중 표시가 앞선다.
  await render({ state: 'failure', character: { ...found, tier: 'ranker' } })
  expect(card().getAttribute('data-state')).toBe('failure')
  expect(card().textContent).not.toContain('랭커 단계')
  await render({ state: 'success', character: { ...found, tier: 'ranker' } })
  await enterName('고친이름')
  expect(card().getAttribute('data-state')).toBe('selected')
})

it('면 탭으로 장비, 서약, 투자 현황을 고르고 이름과 서버는 캐릭터 면에만 둔다', async () => {
  const character: CardCharacter = {
    ...found,
    equipment: [{ id: 'WEAPON', label: '무기', rarityColor: '#ffb400', enhancement: '+13' }]
  }
  await render({ state: 'success', character, basicOnly: false })
  expect(faceTab('캐릭터').getAttribute('aria-selected')).toBe('true')
  expect(container.querySelector('input')).not.toBeNull()

  await act(async () => faceTab('장비').click())
  expect(faceTab('장비').getAttribute('aria-selected')).toBe('true')
  expect(container.querySelector('input')).toBeNull()
  expect(container.querySelector('[aria-label="1번 서버"]')).toBeNull()
  expect(container.querySelector('[role="tabpanel"] [title="무기"]')).not.toBeNull()

  await act(async () => faceTab('투자 현황').click())
  expect(container.querySelector('[role="tabpanel"] table')).not.toBeNull()
})

it('접힌 동안은 캐릭터 면을 보이고 펼치면 고른 면으로 돌아온다', async () => {
  await render({ state: 'success', character: found, basicOnly: false })
  await act(async () => faceTab('서약').click())
  expect(container.querySelector('input')).toBeNull()

  await render({ state: 'success', character: found, basicOnly: false, collapsed: true })
  expect(container.querySelector<HTMLInputElement>('input')?.value).toBe('찾은이름')
  expect(faceTab('캐릭터').getAttribute('aria-selected')).toBe('true')

  await render({ state: 'success', character: found, basicOnly: false, collapsed: false })
  expect(faceTab('서약').getAttribute('aria-selected')).toBe('true')
  expect(container.querySelector('input')).toBeNull()
})
