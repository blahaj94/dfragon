// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { useWindowChromeTheme } from './useWindowChromeTheme'
import type { WindowChromeApi } from '../../../preload/common/types/window-chrome'

function Harness({ light }: { light: boolean }): null {
  useWindowChromeTheme(light)

  return null
}

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
  Reflect.deleteProperty(window, 'windowChrome')
  container.remove()
  vi.unstubAllGlobals()
})

function installApi(setTheme: WindowChromeApi['setTheme']): void {
  Object.defineProperty(window, 'windowChrome', { value: { setTheme }, configurable: true })
}

it('처음 테마와 바뀐 테마를 차례로 main에 전달한다', async () => {
  const setTheme = vi.fn(async () => {})
  installApi(setTheme)

  await act(async () => root.render(<Harness light={false} />))
  await act(async () => root.render(<Harness light />))

  expect(setTheme.mock.calls).toEqual([['dark'], ['light']])
})

it('테마가 그대로면 다시 렌더링해도 다시 보내지 않는다', async () => {
  const setTheme = vi.fn(async () => {})
  installApi(setTheme)

  await act(async () => root.render(<Harness light />))
  await act(async () => root.render(<Harness light />))

  expect(setTheme.mock.calls).toEqual([['light']])
})

it('preload 연결이 없는 미리보기에서는 아무것도 보내지 않고 렌더링을 마친다', async () => {
  await expect(act(async () => root.render(<Harness light />))).resolves.toBeUndefined()
})

it('main이 거부해도 처리되지 않은 Promise 거부를 남기지 않는다', async () => {
  // jsdom은 window의 unhandledrejection을 보내지 않으므로 Node process 이벤트로 확인한다.
  // vi.fn은 반환한 Promise의 결과를 기록하려고 처리기를 붙이므로 거부를 일반 함수로 돌려준다.
  const rejected = vi.fn()
  process.on('unhandledRejection', rejected)
  installApi(() => Promise.reject(new Error('WINDOW_CHROME_NOT_ALLOWED')))

  try {
    await act(async () => root.render(<Harness light={false} />))
    await new Promise((resolve) => setTimeout(resolve, 10))
  } finally {
    process.off('unhandledRejection', rejected)
  }
  expect(rejected).not.toHaveBeenCalled()
})
