// @vitest-environment jsdom
import { act, type ComponentProps } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { ColorThemeProvider } from '../../components/ColorThemeProvider'
import { PartyPage } from './PartyPage'
import type { SnapshotMark } from '../../lib/adventure-snapshot'
import type { CardCharacter, SlotState } from '../../types/cards'

const CHARACTER_NAME_INPUT_SELECTOR = 'input[aria-label$="번 캐릭터 이름"]'

function statText(scope: Element, label: string): string | null {
  const term = [...scope.querySelectorAll('dt')].find((item) => item.textContent === label)
  const value = term?.nextElementSibling
  const shown = value?.querySelector('[aria-hidden="true"]') ?? value

  if (shown == null) {
    return null
  }

  return shown.textContent
}

let root: Root
let container: HTMLDivElement
const character: CardCharacter = {
  characterId: 'matched-id',
  name: '선택된이름',
  serverId: 'cain',
  adventure: '모험단',
  job: '직업',
  level: 115,
  fame: 0,
  card: null,
  image: 'https://img-api.neople.co.kr/df/servers/cain/characters/matched-id?zoom=1'
}

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({ matches: false }))
  )
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})
afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  vi.unstubAllGlobals()
})

type RenderProps = Omit<ComponentProps<typeof PartyPage>, 'slots'> & {
  slots: SlotState[]
  characters?: (CardCharacter | null)[]
  nicknames?: (string | null)[]
  slotNotices?: (string | undefined)[]
  retryEnabled?: boolean[]
  snapshotMarks?: (SnapshotMark | undefined)[]
}

async function render({
  slots,
  characters,
  nicknames,
  slotNotices,
  retryEnabled,
  snapshotMarks,
  ...props
}: RenderProps): Promise<void> {
  const cards = slots.map((state, index) => {
    const character = characters?.[index] ?? undefined
    const nickname = nicknames?.[index] ?? undefined

    return {
      state,
      character,
      nickname,
      notice: slotNotices?.[index],
      retryEnabled: retryEnabled?.[index],
      snapshotMark: snapshotMarks?.[index]
    }
  })
  await act(async () =>
    root.render(
      <ColorThemeProvider>
        <PartyPage {...props} slots={cards} />
      </ColorThemeProvider>
    )
  )
}

it('비동기 식별 성공은 OCR 첫 이름 대신 선택된 이름과 서버를 표시한다', async () => {
  await render({
    slots: ['pending', 'idle', 'idle', 'idle'],
    nicknames: ['OCR첫후보']
  })
  expect(container.querySelector<HTMLInputElement>(CHARACTER_NAME_INPUT_SELECTOR)?.value).toBe(
    'OCR첫후보'
  )
  await render({
    slots: ['success', 'idle', 'idle', 'idle'],
    characters: [character],
    nicknames: ['OCR첫후보']
  })

  const slot = container.querySelector('article')!
  expect(slot.querySelector<HTMLInputElement>(CHARACTER_NAME_INPUT_SELECTOR)?.value).toBe(
    '선택된이름'
  )
  expect(slot.textContent).toContain('카인')
  expect(statText(slot, '명성')).toBe('0')
  expect(statText(slot, '장비')).toBe('-')
  expect(slot.getAttribute('data-state')).toBe('default')
  expect(slot.querySelector('[aria-label="이름 수정 중"]')).toBeNull()
  expect(slot.querySelector('img')?.getAttribute('src')).toBe(character.image)
  expect(slot.querySelector('[role="tab"]')).toBeNull()
  expect(slot.querySelector('[aria-label="1번 캐릭터 상세 열기"]')).toBeNull()
})

it('네 슬롯의 서로 다른 선택과 대기 상태를 독립적으로 표시한다', async () => {
  await render({
    slots: ['success', 'success', 'pending', 'idle'],
    characters: [
      character,
      { ...character, characterId: 'another-id', name: '다른이름', fame: null },
      null,
      null
    ],
    nicknames: [null, null, '검색중', null]
  })
  const slots = container.querySelectorAll('article')
  expect(slots[0].querySelector<HTMLInputElement>(CHARACTER_NAME_INPUT_SELECTOR)?.value).toBe(
    '선택된이름'
  )
  expect(slots[1].querySelector<HTMLInputElement>(CHARACTER_NAME_INPUT_SELECTOR)?.value).toBe(
    '다른이름'
  )
  expect(statText(slots[1], '명성')).toBe('-')
  expect(slots[2].getAttribute('aria-busy')).toBe('true')
  expect(slots[3].getAttribute('aria-busy')).not.toBe('true')
  expect([...slots].map((slot) => slot.getAttribute('data-state'))).toEqual([
    'default',
    'default',
    'default',
    'waiting'
  ])
  expect(slots[2].querySelector('img')).toBeNull()
  expect(slots[3].querySelector('img')).toBeNull()
  expect(slots[2].querySelector('[aria-label="3번 캐릭터 상세 열기"]')).toBeNull()
  expect(slots[2].querySelector('[role="tablist"]')).toBeNull()
})

it('재시도 버튼은 제한 대기와 진행 중에는 잠기고 해당 슬롯만 요청한다', async () => {
  const retry = vi.fn()
  const props: RenderProps = {
    slots: ['failure', 'idle', 'idle', 'idle'],
    actions: { retrySlot: retry },
    slotNotices: ['12초 후 다시 시도할 수 있습니다.'],
    retryEnabled: [false]
  }
  await render(props)
  const findRetry = (): HTMLButtonElement =>
    [...container.querySelectorAll('button')].find((button) =>
      button.textContent?.includes('다시 시도')
    )!
  expect(findRetry().disabled).toBe(true)
  await act(async () => findRetry().click())
  expect(retry).not.toHaveBeenCalled()
  await render({
    ...props,
    retryEnabled: [true],
    slotNotices: ['검색 요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.']
  })
  await act(async () => findRetry().click())
  expect(retry).toHaveBeenCalledExactlyOnceWith(0)
})

it('슬롯 번호대로 스냅샷 표시를 그 슬롯의 카드에 전한다', async () => {
  await render({
    slots: ['success', 'success', 'success', 'idle'],
    characters: [character, character, character],
    snapshotMarks: [undefined, { kind: 'moved', seat: 1 }, { kind: 'absent' }]
  })

  const slots = [...container.querySelectorAll('article')]
  expect(
    slots.map((slot) =>
      slot.querySelector('[role="img"][aria-label^="스냅샷"]')?.getAttribute('aria-label')
    )
  ).toEqual([undefined, '스냅샷 순번 1', '스냅샷에 없는 모험단', undefined])
})
