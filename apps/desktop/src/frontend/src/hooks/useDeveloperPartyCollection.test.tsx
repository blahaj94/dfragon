// @vitest-environment jsdom

import { act, useEffect, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { DeveloperPartySlotNumber } from '../lib/developer-party'
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

function deferred<T>(): {
  promise: Promise<T>
  resolve: (value: T) => void
  reject: (reason: unknown) => void
} {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((accept, fail) => {
    resolve = accept
    reject = fail
  })
  return { promise, resolve, reject }
}

function Harness(): null {
  const [slots, setSlots] = useState<DeveloperPartySlotNumber[]>([1, 2, 3, 4])
  const value = useDeveloperPartyCollection(slots, setSlots, true, vi.fn())
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

it('keeps a failed collection command visible until a later command succeeds', async () => {
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
  const failedCommand = deferred<typeof collection>()
  let shouldFail = true
  const developer = {
    setPartyCollectionSlots: vi.fn((slots: number[] | null) => {
      if (slots == null) {
        return Promise.resolve(collection)
      }
      return shouldFail ? failedCommand.promise : Promise.resolve(collection)
    }),
    previewParty: vi.fn(async () => response)
  }
  Object.defineProperty(window, 'developer', { configurable: true, value: developer })

  await act(async () => root.render(<Harness />))
  expect(developer.setPartyCollectionSlots).toHaveBeenCalledWith([1, 2, 3, 4])

  await act(async () => {
    failedCommand.reject(new Error('IPC unavailable'))
    await Promise.resolve()
  })
  expect(current.commandError).toBe('수집 설정을 저장하지 못했습니다.')

  await act(async () => {
    await vi.advanceTimersByTimeAsync(1000)
  })
  expect(current.commandError).toBe('수집 설정을 저장하지 못했습니다.')

  shouldFail = false
  await act(async () => {
    current.setSlotIncluded(2, false)
    await Promise.resolve()
  })
  expect(current.commandError).toBe('')
})
