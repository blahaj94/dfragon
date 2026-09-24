// @vitest-environment jsdom

import { act, useEffect } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { useDeveloperPartyCollection } from './useDeveloperPartyCollection'

const collection = {
  armed: true,
  slots: [1, 2, 3, 4] as const,
  revision: 0,
  lastSavedAt: null,
  error: null
}

let root: Root
let current: ReturnType<typeof useDeveloperPartyCollection>

function Harness(): null {
  const value = useDeveloperPartyCollection()
  useEffect(() => {
    current = value
  }, [value])
  return null
}

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  vi.useFakeTimers()
  const container = document.createElement('div')
  root = createRoot(container)
})

afterEach(async () => {
  await act(async () => root.unmount())
  Reflect.deleteProperty(window, 'developer')
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

it('clears the previous frame when a later preview request rejects', async () => {
  const response = {
    frame: {
      width: 1920,
      height: 1080,
      scale: 1,
      capturedAt: '2026-09-24T00:00:00.000Z',
      slots: []
    },
    previewError: null,
    collection
  }
  const developer = {
    setPartyCollectionSlots: vi.fn(async () => collection),
    previewParty: vi
      .fn()
      .mockResolvedValueOnce(response)
      .mockRejectedValueOnce(new Error('offline'))
  }
  Object.defineProperty(window, 'developer', { configurable: true, value: developer })

  await act(async () => root.render(<Harness />))
  expect(current.frame).toMatchObject({ width: 1920, height: 1080 })

  await act(async () => {
    await vi.advanceTimersByTimeAsync(1000)
  })

  expect(current.frame).toBeNull()
  expect(current.previewError).toBe('preview-failed')
  expect(current.collection).toEqual(collection)
})
