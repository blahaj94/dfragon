// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { useClipboardCopy } from '../hooks/useClipboardCopy'
import { ClipboardCopyButton } from './ClipboardCopyButton'

const FAILURE = '클립보드에 복사하지 못했습니다.'

let root: Root
let container: HTMLDivElement
let writeText: ReturnType<typeof vi.fn<Window['desktopClipboard']['writeText']>>

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  writeText = vi.fn<Window['desktopClipboard']['writeText']>(async () => {})
  vi.stubGlobal('desktopClipboard', { writeText })
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

function Harness({ text }: { text: string }): React.JSX.Element {
  const clipboard = useClipboardCopy(text)

  return <ClipboardCopyButton status={clipboard.status} onCopy={clipboard.copy} />
}

async function render(text = '[퍼리조아, 시로코, 검은전투늑대], []'): Promise<void> {
  await act(async () => root.render(<Harness text={text} />))
}

function button(): HTMLButtonElement {
  return container.querySelector<HTMLButtonElement>('button[aria-label="클립보드로 복사"]')!
}

function showsCopyIcon(): boolean {
  return button().querySelector('rect') != null
}

function failure(): string | null {
  const message = container.querySelector('p[title]')
  if (message == null) {
    return null
  }

  return message.textContent
}

it('이름과 title이 클립보드로 복사인 버튼을 누르면 지금 글자를 쓰고 잠깐 체크 아이콘을 보인다', async () => {
  vi.useFakeTimers()
  await render('[]')
  expect(button().title).toBe('클립보드로 복사')
  expect(showsCopyIcon()).toBe(true)

  await act(async () => button().click())

  expect(writeText).toHaveBeenCalledExactlyOnceWith('[]')
  expect(showsCopyIcon()).toBe(false)
  expect(container.textContent).toContain('클립보드로 복사했습니다.')
  await act(async () => vi.advanceTimersByTime(1500))
  expect(showsCopyIcon()).toBe(true)
  expect(container.textContent).not.toContain('클립보드로 복사했습니다.')
})

it('체크 아이콘이 보이는 동안 다시 복사하면 그때부터 1.5초 동안 체크를 유지한다', async () => {
  vi.useFakeTimers()
  await render()

  await act(async () => button().click())
  await act(async () => vi.advanceTimersByTime(1000))
  await act(async () => button().click())
  await act(async () => vi.advanceTimersByTime(1000))
  expect(showsCopyIcon()).toBe(false)

  await act(async () => vi.advanceTimersByTime(500))
  expect(showsCopyIcon()).toBe(true)
})

it('쓰기가 실패하면 ! 오류 문구를 보이고 다음 복사가 성공하면 걷는다', async () => {
  writeText.mockRejectedValueOnce(new Error('CLIPBOARD_NOT_ALLOWED'))
  await render()

  await act(async () => button().click())
  expect(failure()).toBe(`!${FAILURE}`)
  expect(container.querySelector('[data-clipboard-announcer]')?.textContent).toBe(FAILURE)
  expect(container.querySelectorAll('[role="status"]')).toHaveLength(1)
  expect(showsCopyIcon()).toBe(true)

  await act(async () => button().click())
  expect(failure()).toBeNull()
  expect(showsCopyIcon()).toBe(false)
})

it('연달아 누르면 늦게 끝난 앞 복사의 실패가 마지막 성공을 덮지 않는다', async () => {
  const first = Promise.withResolvers<void>()
  writeText.mockReturnValueOnce(first.promise)
  await render()

  await act(async () => button().click())
  await act(async () => button().click())
  expect(showsCopyIcon()).toBe(false)
  await act(async () => first.reject(new Error('late failure')))

  expect(failure()).toBeNull()
  expect(showsCopyIcon()).toBe(false)
})
