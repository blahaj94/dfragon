// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { SeatAdventures } from '../lib/adventure-snapshot'
import { useAdventureSnapshot } from './useAdventureSnapshot'

let container: HTMLDivElement
let root: Root

function Harness({
  adventures,
  startedRounds
}: {
  adventures: SeatAdventures
  startedRounds: number
}): React.JSX.Element {
  const { active, marks, round, take, clear } = useAdventureSnapshot(adventures, startedRounds)

  return (
    <>
      <button type="button" id="take" onClick={take} />
      <button type="button" id="clear" onClick={clear} />
      <output>{JSON.stringify({ active, marks, round })}</output>
    </>
  )
}

async function render(adventures: SeatAdventures, startedRounds = 0): Promise<void> {
  await act(async () =>
    root.render(<Harness adventures={adventures} startedRounds={startedRounds} />)
  )
}

async function press(id: 'take' | 'clear'): Promise<void> {
  await act(async () => container.querySelector<HTMLButtonElement>(`#${id}`)!.click())
}

function shown(): { active: boolean; marks: unknown[]; round: number | null } {
  return JSON.parse(container.querySelector('output')!.textContent!)
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

it('스냅샷은 localStorage에 쓰지 않고 다시 마운트하면 사라진다', async () => {
  const setItem = vi.spyOn(Storage.prototype, 'setItem')
  await render(['가', '나'])
  await press('take')
  expect(setItem).not.toHaveBeenCalled()

  await act(async () => root.unmount())
  root = createRoot(container)
  await render(['가', '나'])

  expect(shown().active).toBe(false)
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
