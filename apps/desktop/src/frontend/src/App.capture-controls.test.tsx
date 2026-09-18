// @vitest-environment jsdom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import PartyCapture from './sections/capture/PartyCapture'

const capture = vi.hoisted(() => ({
  sources: [{ id: 'example-window', name: 'Example window' }],
  selectedSourceId: '',
  sourceRegistered: false,
  starting: false,
  search: {
    ready: true,
    slots: [],
    retryPending: [],
    connectionFailed: false,
    captureActive: false
  },
  retrySearch: vi.fn(),
  intervalSeconds: 3,
  stableNicknames: [null, null, null, null],
  status: 'Ready',
  selectSource: vi.fn(),
  refreshSources: vi.fn(),
  setIntervalSeconds: vi.fn(),
  startCapture: vi.fn(),
  stopCapture: vi.fn()
}))

// Renderer 연결만 검증하며 capture hook·IPC·media/OCR는 실행하지 않는다.
vi.mock('./sections/capture/usePartyCapture', () => ({ usePartyCapture: () => capture }))

let container: HTMLDivElement
let root: Root

beforeEach(async () => {
  vi.clearAllMocks()
  capture.sourceRegistered = false
  capture.search.captureActive = false
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
  await act(async () => root.render(<PartyCapture />))
})

afterEach(async () => {
  await act(async () => root.unmount())
  container.remove()
})

function button(text: string): HTMLButtonElement {
  const result = Array.from(container.querySelectorAll('button')).find((candidate) => {
    const hasLabel = candidate.textContent === text
    return hasLabel
  })
  const isMissing = result == null
  if (isMissing) {
    throw new Error(`Expected renderer button: ${text}`)
  }
  return result
}

it('refreshes the window list while idle and disables refresh during capture', async () => {
  await act(async () => button('창 목록 새로고침').click())
  expect(capture.refreshSources).toHaveBeenCalledExactlyOnceWith()

  capture.search.captureActive = true
  await act(async () => root.render(<PartyCapture />))
  expect(button('창 목록 새로고침').disabled).toBe(true)
  await act(async () => button('창 목록 새로고침').click())
  expect(capture.refreshSources).toHaveBeenCalledTimes(1)
})

it('preserves selection values and numeric OCR interval callback', async () => {
  const [source, interval] = container.querySelectorAll('select')

  await act(async () => {
    source.value = 'example-window'
    source.dispatchEvent(new Event('change', { bubbles: true }))
    interval.value = '5'
    interval.dispatchEvent(new Event('change', { bubbles: true }))
  })

  expect(capture.selectSource).toHaveBeenCalledExactlyOnceWith('example-window')
  expect(capture.setIntervalSeconds).toHaveBeenCalledExactlyOnceWith(5)
})

it('blocks unregistered Start and preserves registered Start and Stop callbacks', async () => {
  await act(async () => button('캡처 시작').click())
  expect(capture.startCapture).not.toHaveBeenCalled()

  capture.sourceRegistered = true
  await act(async () => root.render(<PartyCapture />))
  await act(async () => {
    button('캡처 시작').click()
    button('캡처 중지').click()
  })

  expect(capture.startCapture).toHaveBeenCalledExactlyOnceWith()
  expect(capture.stopCapture).toHaveBeenCalledExactlyOnceWith()
})
