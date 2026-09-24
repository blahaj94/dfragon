// @vitest-environment jsdom

import { act, useEffect } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { DeveloperSample } from '../../../preload/common/types/developer'
import type { DeveloperSamplesApi } from '../lib/developer-samples-machine'
import { useDeveloperSamples } from './useDeveloperSamples'

type HookValue = ReturnType<typeof useDeveloperSamples>
type SamplesApi = DeveloperSamplesApi

function deferred<T>(): {
  promise: Promise<T>
  resolve: (value: T) => void
  reject: (error: unknown) => void
} {
  let resolve!: (value: T) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}

function sample(id: string, text: string | null = null): DeveloperSample {
  return {
    id,
    createdAt: '2026-09-24T00:00:00.000Z',
    width: 120,
    height: 40,
    text,
    excluded: false,
    source: null
  } as DeveloperSample
}

let container: HTMLDivElement
let root: Root
let mounted: boolean
let current: HookValue
let renderCount: number

function Harness(): null {
  const value = useDeveloperSamples()
  useEffect(() => {
    current = value
    renderCount += 1
  })
  return null
}

function installApi(api: SamplesApi): void {
  Object.defineProperty(window, 'developer', { configurable: true, value: api })
}

async function renderHook(): Promise<void> {
  await act(async () => root.render(<Harness />))
}

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
  mounted = true
  current = undefined as unknown as HookValue
  renderCount = 0
})

afterEach(async () => {
  if (mounted) {
    await act(async () => root.unmount())
  }
  Reflect.deleteProperty(window, 'developer')
  container.remove()
  vi.unstubAllGlobals()
})

it('keeps the list error and retries successfully on refresh', async () => {
  const rows = [sample('one')]
  const api: SamplesApi = {
    listSamples: vi
      .fn()
      .mockRejectedValueOnce(new Error('read failed'))
      .mockResolvedValueOnce(rows),
    saveLabel: vi.fn(),
    setSampleExcluded: vi.fn()
  }
  installApi(api)
  await renderHook()

  expect(current.loading).toBe(false)
  expect(current.samples).toEqual([])
  expect(current.error).toBe('테스트 이미지를 불러오지 못했습니다. 다시 불러와 주세요.')

  await act(async () => current.refresh())

  expect(api.listSamples).toHaveBeenCalledTimes(2)
  expect(current.samples).toEqual(rows)
  expect(current.error).toBe('')
})

it('ignores refresh and saves while the initial list is pending', async () => {
  const pendingList = deferred<DeveloperSample[]>()
  const rows = [sample('one')]
  const saved = sample('one', '저장한 정답')
  const api: SamplesApi = {
    listSamples: vi.fn().mockReturnValue(pendingList.promise),
    saveLabel: vi.fn().mockResolvedValue(saved),
    setSampleExcluded: vi.fn()
  }
  installApi(api)
  await renderHook()

  expect(current.loading).toBe(true)
  await act(async () => current.refresh())
  await expect(current.saveLabel('one', '저장한 정답')).resolves.toBeNull()
  expect(api.listSamples).toHaveBeenCalledOnce()
  expect(api.saveLabel).not.toHaveBeenCalled()

  await act(async () => pendingList.resolve(rows))
  expect(current.loading).toBe(false)
  expect(current.samples).toEqual(rows)

  await act(async () => {
    await expect(current.saveLabel('one', '저장한 정답')).resolves.toEqual(saved)
  })
  expect(api.saveLabel).toHaveBeenCalledExactlyOnceWith('one', '저장한 정답')
  expect(current.samples).toEqual([saved])
})

it('returns null for a duplicate save while the first save is pending', async () => {
  const original = sample('one', '기존 정답')
  const pendingSave = deferred<DeveloperSample>()
  const api: SamplesApi = {
    listSamples: vi.fn().mockResolvedValue([original]),
    saveLabel: vi.fn().mockReturnValue(pendingSave.promise),
    setSampleExcluded: vi.fn()
  }
  installApi(api)
  await renderHook()

  let firstSave!: Promise<DeveloperSample | null>
  await act(async () => {
    firstSave = current.saveLabel('one', '첫 변경')
  })
  expect(current.saving).toBe(true)

  await expect(current.saveLabel('one', '중복 변경')).resolves.toBeNull()
  expect(api.saveLabel).toHaveBeenCalledExactlyOnceWith('one', '첫 변경')

  const saved = sample('one', '첫 변경')
  pendingSave.resolve(saved)
  await act(async () => expect(firstSave).resolves.toEqual(saved))
  expect(current.samples).toEqual([saved])
  expect(current.saving).toBe(false)
})

it('ignores refresh during a save so stale list data cannot replace saved metadata', async () => {
  const original = sample('one', 'old label')
  const updated = sample('one', 'new label')
  const pendingSave = deferred<DeveloperSample>()
  const api: SamplesApi = {
    listSamples: vi.fn().mockResolvedValue([original]),
    saveLabel: vi.fn().mockReturnValue(pendingSave.promise),
    setSampleExcluded: vi.fn()
  }
  installApi(api)
  await renderHook()

  let saving!: Promise<DeveloperSample | null>
  await act(async () => {
    saving = current.saveLabel(original.id, updated.text)
  })
  await act(async () => current.refresh())
  expect(api.listSamples).toHaveBeenCalledOnce()

  pendingSave.resolve(updated)
  await act(async () => expect(saving).resolves.toEqual(updated))
  expect(current.samples).toEqual([updated])
})

it('preserves existing samples and reports the original save error message', async () => {
  const original = sample('one', 'known label')
  const api: SamplesApi = {
    listSamples: vi.fn().mockResolvedValue([original]),
    saveLabel: vi.fn().mockRejectedValue(new Error('write failed')),
    setSampleExcluded: vi.fn()
  }
  installApi(api)
  await renderHook()

  let saving!: Promise<DeveloperSample | null>
  await act(async () => {
    saving = current.saveLabel(original.id, 'draft label')
  })
  await act(async () => expect(saving).resolves.toBeNull())

  expect(current.samples).toEqual([original])
  expect(current.error).toBe('저장하지 못했습니다. 입력은 유지됩니다. 다시 시도해 주세요.')
})

it('resolves a pending save as null on unmount and ignores its late result', async () => {
  const original = sample('one')
  const pendingSave = deferred<DeveloperSample>()
  const api: SamplesApi = {
    listSamples: vi.fn().mockResolvedValue([original]),
    saveLabel: vi.fn().mockReturnValue(pendingSave.promise),
    setSampleExcluded: vi.fn()
  }
  installApi(api)
  await renderHook()

  let saving!: Promise<DeveloperSample | null>
  await act(async () => {
    saving = current.saveLabel('one', '늦은 정답')
  })
  const rendersBeforeUnmount = renderCount

  await act(async () => {
    root.unmount()
    mounted = false
  })
  await expect(saving).resolves.toBeNull()

  pendingSave.resolve(sample('one', '늦은 정답'))
  await act(async () => Promise.resolve())
  expect(renderCount).toBe(rendersBeforeUnmount)
})
