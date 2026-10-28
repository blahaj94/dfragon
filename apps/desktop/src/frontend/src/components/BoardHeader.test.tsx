// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { BoardHeader } from './BoardHeader'

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

it('start 내용을 end 내용보다 앞에 둔다', async () => {
  await act(async () =>
    root.render(<BoardHeader start={<h1>파티</h1>} end={<button type="button">캡처</button>} />)
  )
  const heading = container.querySelector('h1')!
  const button = container.querySelector('button')!
  expect(heading.compareDocumentPosition(button) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0)
})
