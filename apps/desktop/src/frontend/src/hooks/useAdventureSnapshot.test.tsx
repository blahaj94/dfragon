// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { SeatAdventures } from '../lib/adventure-snapshot'
import type { SearchMode } from '../types/search-mode'
import { useAdventureSnapshot } from './useAdventureSnapshot'

let container: HTMLDivElement
let root: Root

const typed = { seat: 0, value: '' }

function Harness({
  screen,
  adventures,
  startedRounds
}: {
  screen: SearchMode
  adventures: SeatAdventures
  startedRounds: number
}): React.JSX.Element {
  const { active, marks, round, adventureInputs, take, clear, changeAdventure } =
    useAdventureSnapshot(screen, adventures, startedRounds)

  return (
    <>
      <button type="button" id="take" onClick={take} />
      <button type="button" id="clear" onClick={clear} />
      <button type="button" id="type" onClick={() => changeAdventure(typed.seat, typed.value)} />
      <output>{JSON.stringify({ active, marks, round })}</output>
      <data>{JSON.stringify(adventureInputs)}</data>
    </>
  )
}

async function render(
  adventures: SeatAdventures,
  startedRounds = 0,
  screen: SearchMode = 'party'
): Promise<void> {
  await act(async () =>
    root.render(<Harness screen={screen} adventures={adventures} startedRounds={startedRounds} />)
  )
}

async function press(id: 'take' | 'clear' | 'type'): Promise<void> {
  await act(async () => container.querySelector<HTMLButtonElement>(`#${id}`)!.click())
}

function shown(): { active: boolean; marks: unknown[]; round: number | null } {
  return JSON.parse(container.querySelector('output')!.textContent!)
}

async function typeAdventure(seat: number, value: string): Promise<void> {
  Object.assign(typed, { seat, value })
  await press('type')
}

function adventureInputs(): (string | null)[] {
  return JSON.parse(container.querySelector('data')!.textContent!)
}

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

it('켜기 전에는 표시가 없고, 켠 순간의 자리를 저장해 이후 자리와 비교한다', async () => {
  await render(['가', '나'])
  expect(shown()).toEqual({ active: false, marks: [null, null], round: null })

  await press('take')
  expect(shown()).toEqual({ active: true, marks: [null, null], round: 1 })

  await render(['나', '가'])
  expect(shown().marks).toEqual([
    { kind: 'moved', seat: 2 },
    { kind: 'moved', seat: 1 }
  ])
})

it('지우면 저장한 자리를 잊고 표시를 걷는다', async () => {
  await render(['가', '나'])
  await press('take')
  await render(['나', '새'])
  expect(shown().marks).toEqual([{ kind: 'moved', seat: 2 }, { kind: 'absent' }])

  await press('clear')

  expect(shown()).toEqual({ active: false, marks: [null, null], round: null })
})

it('스냅샷은 localStorage에 쓰지 않고 다시 마운트해도 같은 화면의 스냅샷으로 남는다', async () => {
  const setItem = vi.spyOn(Storage.prototype, 'setItem')
  await render(['가', '나'])
  await press('take')
  expect(setItem).not.toHaveBeenCalled()

  await act(async () => root.unmount())
  root = createRoot(container)
  await render(['나', '가'])

  expect(shown()).toEqual({
    active: true,
    marks: [
      { kind: 'moved', seat: 2 },
      { kind: 'moved', seat: 1 }
    ],
    round: 1
  })
})

it('파티와 공대는 스냅샷을 따로 가진다', async () => {
  await render(['가'], 0, 'party')
  await press('take')

  await render(['가'], 0, 'raid')
  expect(shown().active).toBe(false)

  await press('take')
  await press('clear')
  await render(['가'], 0, 'party')
  expect(shown().active).toBe(true)
})

it('켠 순간은 1번째 회차이고 켜 둔 동안 시작한 회차마다 번호가 하나씩 오른다', async () => {
  await render(['가'], 5)
  expect(shown().round).toBeNull()

  await press('take')
  expect(shown().round).toBe(1)

  await render(['가'], 6)
  expect(shown().round).toBe(2)
  await render(['가'], 7)
  expect(shown().round).toBe(3)
})

it('끄면 번호를 지우고 다시 켜면 1번째부터 센다', async () => {
  await render(['가'], 0)
  await press('take')
  await render(['가'], 2)
  expect(shown().round).toBe(3)

  await press('clear')
  expect(shown().round).toBeNull()
  await render(['가'], 4)
  expect(shown().round).toBeNull()

  await press('take')
  expect(shown().round).toBe(1)
  await render(['가'], 5)
  expect(shown().round).toBe(2)
})

it('켠 회차에는 모험단 없이 저장한 자리만 입력을 열고, 적은 모험단을 그 자리의 스냅샷으로 비교한다', async () => {
  await render(['가', null], 0)
  await press('take')
  expect(adventureInputs()).toEqual([null, ''])
  await typeAdventure(1, ' 별빛 ')
  expect(adventureInputs()).toEqual([null, ' 별빛 '])

  await render(['별빛', '가'], 1)
  expect(adventureInputs()).toEqual([null, null])
  expect(shown().marks).toEqual([
    { kind: 'moved', seat: 2 },
    { kind: 'moved', seat: 1 }
  ])
})

it('끄고 다시 켜면 전에 적은 모험단을 지우고 빈 입력으로 시작한다', async () => {
  await render(['가', null], 0)
  await press('take')
  await typeAdventure(1, '별빛')

  await press('clear')
  await press('take')

  expect(adventureInputs()).toEqual([null, ''])
  await render(['가', '별빛'], 1)
  expect(shown().marks).toEqual([null, { kind: 'absent' }])
})
