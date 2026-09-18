// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, expect, it, vi } from 'vitest'
import { SlotNicknameEditor } from './SlotNicknameEditor'
import { emptySearchSlots } from '../api/capture-search'

const roots: ReturnType<typeof createRoot>[] = []
afterEach(async () => {
  for (const root of roots.splice(0)) {
    await act(async () => root.unmount())
  }
  document.body.replaceChildren()
})

it('typed draft survives new OCR props; invalid and IME Enter do not submit', async () => {
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  roots.push(root)
  let slot = { ...emptySearchSlots()[0], nickname: 'SyntheticA' }
  const editing = {
    manualSlots: [false, false, false, false],
    editSlot: vi.fn(() => {
      editing.manualSlots[0] = true
    }),
    submitSlot: vi.fn(),
    resumeOcr: vi.fn()
  }
  const render = async (): Promise<void> => {
    await act(async () => root.render(<SlotNicknameEditor slot={slot} active editing={editing} />))
  }
  await render()
  await act(async () => container.querySelector('button')!.click())
  await render()
  const input = container.querySelector('input')!
  const setValue = async (value: string): Promise<void> => {
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value)
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })
  }
  expect(input.value).toBe('SyntheticA')
  await setValue('ManualName')
  slot = { ...slot, nickname: 'SyntheticB' }
  await render()
  expect(input.value).toBe('ManualName')
  const composing = new KeyboardEvent('keydown', {
    key: 'Enter',
    isComposing: true,
    bubbles: true,
    cancelable: true
  })
  await act(async () => {
    input.dispatchEvent(composing)
  })
  expect(composing.defaultPrevented).toBe(true)
  expect(editing.submitSlot).not.toHaveBeenCalled()
  await act(async () =>
    container
      .querySelector('form')!
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
  )
  expect(editing.submitSlot).toHaveBeenLastCalledWith(0, 'ManualName')
  await setValue(' ')
  editing.submitSlot.mockClear()
  await act(async () =>
    container
      .querySelector('form')!
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
  )
  expect(editing.submitSlot).not.toHaveBeenCalled()
  expect(input.getAttribute('aria-invalid')).toBe('true')
  const resume = [...container.querySelectorAll('button')].find(
    (button) => button.textContent === 'OCR 다시 사용'
  )!
  await act(async () => resume.click())
  expect(editing.resumeOcr).toHaveBeenCalledWith(0)
})
