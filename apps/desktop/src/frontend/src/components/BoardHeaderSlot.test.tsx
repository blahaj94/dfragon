// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { useBoardHeaderPortal } from '../hooks/useBoardHeaderPortal'
import { BoardHeaderSlot } from './BoardHeaderSlot'

let root: Root
let container: HTMLDivElement

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
})

function Screen(): React.JSX.Element {
  const { renderBoardHeader } = useBoardHeaderPortal()

  return <main>{renderBoardHeader(<h2>파티</h2>)}</main>
}

it('화면이 그린 머리 내용은 화면 안이 아니라 머리 자리 안에 들어간다', async () => {
  await act(async () =>
    root.render(
      <>
        <header>
          <BoardHeaderSlot />
        </header>
        <Screen />
      </>
    )
  )
  const heading = container.querySelector('h2')!
  expect(container.querySelector('header')!.contains(heading)).toBe(true)
  expect(container.querySelector('main')!.contains(heading)).toBe(false)
})

it('머리 자리가 없으면 화면은 머리 내용을 그리지 않는다', async () => {
  await act(async () => root.render(<Screen />))
  expect(container.querySelector('h2')).toBeNull()
})
