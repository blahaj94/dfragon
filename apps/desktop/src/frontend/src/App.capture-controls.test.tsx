// @vitest-environment jsdom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import PartyCapture from './sections/PartyCapture'

const capture = vi.hoisted(() => {
  const retrySearch = vi.fn()
  const selectSource = vi.fn()
  const refreshSources = vi.fn()
  const startCapture = vi.fn()
  const stopCapture = vi.fn()

  return {
    sources: [{ id: 'example-window', name: 'Example window' }],
    selectedSourceId: '',
    canStartCapture: false,
    recognizing: false,
    search: {
      ready: true,
      slots: [],
      retryPending: [],
      connectionFailed: false,
      captureActive: false
    },
    retrySearch,
    nicknames: [null, null, null, null],
    status: 'Ready',
    selectSource,
    refreshSources,
    startCapture,
    stopCapture
  }
})

// Renderer 연결만 검증하며 capture hook, IPC, media/OCR는 실행하지 않는다.
vi.mock('./hooks/usePartyCapture', () => ({ usePartyCapture: () => capture }))

let container: HTMLDivElement
let root: Root

beforeEach(async () => {
  vi.clearAllMocks()
  capture.canStartCapture = false
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

it('선택한 창을 전달하고 인식 간격 입력을 표시하지 않는다', async () => {
  const [source] = container.querySelectorAll('select')
  expect(container.querySelectorAll('select')).toHaveLength(1)

  await act(async () => {
    source.value = 'example-window'
    source.dispatchEvent(new Event('change', { bubbles: true }))
  })

  expect(capture.selectSource).toHaveBeenCalledExactlyOnceWith('example-window')
})

it('blocks Start when capture cannot start and preserves allowed Start and Stop callbacks', async () => {
  await act(async () => button('캡처 시작').click())
  expect(capture.startCapture).not.toHaveBeenCalled()

  capture.canStartCapture = true
  await act(async () => root.render(<PartyCapture />))
  await act(async () => {
    button('캡처 시작').click()
    button('캡처 중지').click()
  })

  expect(capture.startCapture).toHaveBeenCalledExactlyOnceWith()
  expect(capture.stopCapture).toHaveBeenCalledExactlyOnceWith()
})
