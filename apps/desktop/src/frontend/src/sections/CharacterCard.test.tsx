// @vitest-environment jsdom
import { act, type ComponentProps } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { CharacterCard } from './CharacterCard'
import type { ServerSelect } from '../components/ServerSelect'

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
