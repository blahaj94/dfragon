// @vitest-environment jsdom
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { PARTY_COLLAPSE_TRANSITION_MS, usePartyCollapse } from './usePartyCollapse'
import type { WindowChromeApi } from '../../../preload/common/types/window-chrome'

let container: HTMLDivElement
let root: Root
function Harness(): React.JSX.Element {
  const { collapsed, toggleCollapsed } = usePartyCollapse()

  return <button type="button" aria-expanded={!collapsed} onClick={toggleCollapsed} />
}

function toggle(): void {
  container.querySelector('button')!.click()
}

function isCollapsed(): boolean {
  return container.querySelector('button')!.getAttribute('aria-expanded') === 'false'
}

function installApi(setContentHeight: WindowChromeApi['setContentHeight']): void {
  Object.defineProperty(window, 'windowChrome', { value: { setContentHeight }, configurable: true })
}

function stubReducedMotion(matches: boolean): void {
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({ matches: matches && query === '(prefers-reduced-motion: reduce)' }))
  )
}

beforeEach(async () => {
  vi.useFakeTimers()
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  stubReducedMotion(false)
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(async () => root.unmount())
  Reflect.deleteProperty(window, 'windowChrome')
  container.remove()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

it('처음 렌더링에서는 창 높이를 바꾸지 않는다', async () => {
  const setContentHeight = vi.fn(async () => {})
  installApi(setContentHeight)
  await act(async () => root.render(<Harness />))
  await act(async () => vi.runAllTimers())

  expect(isCollapsed()).toBe(false)
  expect(setContentHeight).not.toHaveBeenCalled()
})

it('접으면 카드 전환이 끝난 뒤 창을 400으로 줄이고, 펼치면 바로 800으로 늘린다', async () => {
  const setContentHeight = vi.fn(async () => {})
  installApi(setContentHeight)
  await act(async () => root.render(<Harness />))

  await act(async () => toggle())
  expect(isCollapsed()).toBe(true)
  await act(async () => vi.advanceTimersByTime(PARTY_COLLAPSE_TRANSITION_MS - 1))
  expect(setContentHeight).not.toHaveBeenCalled()
  await act(async () => vi.advanceTimersByTime(1))
  expect(setContentHeight.mock.calls).toEqual([[400]])

  await act(async () => toggle())
  await act(async () => vi.advanceTimersByTime(0))
  expect(isCollapsed()).toBe(false)
  expect(setContentHeight.mock.calls).toEqual([[400], [800]])
})

it('동작 줄이기 설정에서는 접을 때도 기다리지 않고 창을 줄인다', async () => {
  stubReducedMotion(true)
  const setContentHeight = vi.fn(async () => {})
  installApi(setContentHeight)
  await act(async () => root.render(<Harness />))

  await act(async () => toggle())
  await act(async () => vi.advanceTimersByTime(0))

  expect(setContentHeight.mock.calls).toEqual([[400]])
})

it('접힘 전환 중에 다시 펼치면 늦은 400 요청을 보내지 않는다', async () => {
  const setContentHeight = vi.fn(async () => {})
  installApi(setContentHeight)
  await act(async () => root.render(<Harness />))

  await act(async () => toggle())
  await act(async () => vi.advanceTimersByTime(PARTY_COLLAPSE_TRANSITION_MS / 2))
  await act(async () => toggle())
  await act(async () => vi.runAllTimers())

  expect(setContentHeight.mock.calls).toEqual([[800]])
})

it('preload 연결이 없는 미리보기에서도 접힘 상태는 바뀐다', async () => {
  await act(async () => root.render(<Harness />))
  await act(async () => toggle())
  await act(async () => vi.runAllTimers())

  expect(isCollapsed()).toBe(true)
})

it('main이 거부해도 처리되지 않은 Promise 거부를 남기지 않는다', async () => {
  const rejections: unknown[] = []
  const onRejection = (reason: unknown): void => {
    rejections.push(reason)
  }
  process.on('unhandledRejection', onRejection)
  try {
    installApi(vi.fn(async () => Promise.reject(new Error('WINDOW_CHROME_NOT_ALLOWED'))))
    await act(async () => root.render(<Harness />))
    await act(async () => toggle())
    await act(async () => vi.runAllTimers())
    vi.useRealTimers()
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(isCollapsed()).toBe(true)
    expect(rejections).toEqual([])
  } finally {
    process.off('unhandledRejection', onRejection)
  }
})

it('전환 시간은 tokens.css의 상태 전환 시간과 같다', () => {
  const tokensCss = readFileSync(
    resolve(__dirname, '../../../../../../packages/ui/tokens.css'),
    'utf8'
  )

  expect(tokensCss).toContain(`--df-dur-state: ${PARTY_COLLAPSE_TRANSITION_MS}ms;`)
})
