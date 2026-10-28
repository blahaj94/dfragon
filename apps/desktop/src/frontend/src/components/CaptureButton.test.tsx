// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { CaptureButton } from './CaptureButton'

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

function button(): HTMLButtonElement {
  return container.querySelector<HTMLButtonElement>('[aria-label="공대 캡처, 단축키 Alt R"]')!
}

it('누를 수 있을 때만 회차 시작을 요청한다', async () => {
  const onClick = vi.fn()
  await act(async () => root.render(<CaptureButton target="공대" disabled onClick={onClick} />))
  expect(button().disabled).toBe(true)
  await act(async () => button().click())
  expect(onClick).not.toHaveBeenCalled()
  await act(async () =>
    root.render(<CaptureButton target="공대" disabled={false} onClick={onClick} />)
  )
  await act(async () => button().click())
  expect(onClick).toHaveBeenCalledOnce()
})
