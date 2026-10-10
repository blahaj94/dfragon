// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { StatusBadge } from './StatusBadge'

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
  vi.unstubAllGlobals()
})

it('announces only the state text when the caller asks for a status region', async () => {
  await act(async () =>
    root.render(
      <StatusBadge tone="positive" role="status">
        창 감지됨
      </StatusBadge>
    )
  )

  expect(container.querySelector('[role="status"]')!.textContent).toBe('창 감지됨')
})

it('adds no live region unless the caller asks for one', async () => {
  await act(async () => root.render(<StatusBadge tone="warning">파티원창 찾는 중</StatusBadge>))

  expect(container.textContent).toBe('파티원창 찾는 중')
  expect(container.querySelector('[role]')).toBeNull()
})
