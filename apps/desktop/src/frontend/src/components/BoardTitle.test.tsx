// @vitest-environment jsdom
import { act, type ComponentProps } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { BoardTitle } from './BoardTitle'

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

async function render(props: Partial<ComponentProps<typeof BoardTitle>> = {}): Promise<void> {
  await act(async () =>
    root.render(<BoardTitle label="파티" filled={2} total={4} round={null} {...props} />)
  )
}

it('제목 바로 뒤에 찾은 슬롯 수와 전체 수를 보인다', async () => {
  await render({ label: '공대', filled: 2, total: 12 })
  const heading = container.querySelector('h1')!
  expect(heading.textContent).toBe('공대')
  expect(heading.nextElementSibling?.textContent).toBe('2/12')
})

it('스냅샷 회차가 있으면 슬롯 수 바로 뒤에 회차 번호를 보이고 없으면 숨긴다', async () => {
  await render({ round: null })
  expect(container.querySelector('[aria-label$="번째 파티"]')).toBeNull()

  await render({ round: 2 })
  const round = container.querySelector('[aria-label="2번째 파티"]')!
  expect(round.textContent).toBe('#2')
  expect(round.previousElementSibling?.textContent).toBe('2/4')
})
