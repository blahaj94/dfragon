// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi, type Mocked } from 'vitest'
import type {
  DeveloperApi,
  DeveloperPartyCollectionStatus,
  DeveloperPartyPreviewFrame,
  DeveloperPartySlot,
  DeveloperSample
} from '../../../preload/common/types/developer'
import type { DeveloperWorkbenchSample } from '../lib/developer-party'
import { DeveloperWorkbench } from './DeveloperWorkbench'

const evaluation = vi.hoisted(() => ({
  evaluate: vi.fn(),
  setPreprocessing: vi.fn(),
  cancel: vi.fn()
}))

vi.mock('../hooks/useDeveloperEvaluation', () => ({
  useDeveloperEvaluation: () => ({
    results: {},
    running: false,
    canceled: false,
    preprocessing: 'party',
    progress: { done: 0, total: 0 },
    error: '',
    setPreprocessing: evaluation.setPreprocessing,
    evaluate: evaluation.evaluate,
    cancel: evaluation.cancel
  })
}))

function sample(
  id: string,
  createdAt: string,
  text: string | null,
  source: DeveloperWorkbenchSample['source'] = null,
  excluded = false
): DeveloperWorkbenchSample {
  return { id, createdAt, width: 100, height: 36, text, source, excluded }
}

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

function partyFrame(): DeveloperPartyPreviewFrame {
  return {
    width: 1920,
    height: 1080,
    scale: 1.25,
    capturedAt: '2026-09-24T00:00:00.000Z',
    slots: ([1, 2, 3, 4] as const).map((slot) => ({
      slot,
      width: 2,
      height: 2,
      rgba: new Uint8Array(16).fill(slot * 20)
    }))
  }
}

function installApi(rows: DeveloperWorkbenchSample[] = []): {
  api: Mocked<DeveloperApi>
  samples: DeveloperWorkbenchSample[]
  status: DeveloperPartyCollectionStatus
} {
  const samples = rows.map((row) => ({ ...row }))
  const status: DeveloperPartyCollectionStatus = {
    armed: false,
    slots: [],
    revision: 0,
    lastSavedAt: null as string | null,
    error: null as string | null
  }
  const api: Mocked<DeveloperApi> = {
    getSettings: vi.fn(async () => ({ enabled: true })),
    setEnabled: vi.fn(async (enabled: boolean) => ({ enabled })),
    listSamples: vi.fn(async () => samples.map((row) => ({ ...row })) as DeveloperSample[]),
    readImage: vi.fn(async (id: string) => `data:image/svg+xml,${id}`),
    addSample: vi.fn(async () => {
      throw new Error('not used in this test')
    }),
    saveLabel: vi.fn(async (id: string, text: string | null) => {
      const index = samples.findIndex((row) => row.id === id)
      const updated = { ...samples[index], text }
      samples[index] = updated
      return updated as DeveloperSample
    }),
    setSampleExcluded: vi.fn(async (id: string, excluded: boolean) => {
      const index = samples.findIndex((row) => row.id === id)
      const updated = { ...samples[index], excluded }
      samples[index] = updated
      return updated as DeveloperSample
    }),
    captureFrame: vi.fn(async () => ({
      pngDataUrl: 'data:image/png;base64,AA==',
      width: 1,
      height: 1
    })),
    previewParty: vi.fn(async () => ({
      frame: partyFrame(),
      previewError: null,
      collection: { ...status, armed: true, slots: [1, 2, 3, 4] as DeveloperPartySlot[] }
    })),
    setPartyCollectionSlots: vi.fn(async (slots: DeveloperPartySlot[] | null) => {
      status.armed = slots != null
      status.slots = slots ?? []
      return { ...status, slots: [...status.slots] }
    })
  }
  Object.defineProperty(window, 'developer', { configurable: true, value: api })
  return { api, samples, status }
}

function button(label: string): HTMLButtonElement {
  const result = [...container.querySelectorAll<HTMLButtonElement>('button')].find((candidate) =>
    candidate.textContent?.includes(label)
  )
  if (!result) {
    throw new Error(`Missing ${label} button`)
  }
  return result
}

async function click(label: string): Promise<void> {
  await act(async () => button(label).click())
}

function input(): HTMLInputElement {
  const result = container.querySelector<HTMLInputElement>('input[autocomplete="off"]')
  if (!result) {
    throw new Error('Missing label input')
  }
  return result
}

async function typeLabel(value: string): Promise<void> {
  await act(async () => {
    const field = input()
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
    setter?.call(field, value)
    field.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

let container: HTMLDivElement
let root: Root
let mounted: boolean

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  vi.stubGlobal(
    'ImageData',
    class SyntheticImageData {
      data: Uint8ClampedArray
      width: number
      height: number
      constructor(data: Uint8ClampedArray, width: number, height: number) {
        this.data = data
        this.width = width
        this.height = height
      }
    }
  )
  Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
    configurable: true,
    value: () => ({ putImageData: vi.fn() })
  })
  Object.defineProperty(HTMLCanvasElement.prototype, 'toDataURL', {
    configurable: true,
    value: (type: string) => `data:${type};base64,crop`
  })
  container = document.createElement('div')
  document.body.append(container)
  root = createRoot(container)
  mounted = true
  evaluation.evaluate.mockReset()
  evaluation.setPreprocessing.mockReset()
  evaluation.cancel.mockReset()
})

afterEach(async () => {
  if (mounted) {
    await act(async () => root.unmount())
  }
  Reflect.deleteProperty(window, 'developer')
  container.remove()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

it('arms only on the collection tab, previews four raw crops, and disarms on tab switch and unmount', async () => {
  const { api } = installApi()
  await act(async () => root.render(<DeveloperWorkbench onClose={vi.fn()} />))

  expect(api.setPartyCollectionSlots).toHaveBeenCalledWith([1, 2, 3, 4])
  expect(container.querySelectorAll('img[alt$="번 크롭 원본 미리보기"]')).toHaveLength(4)
  expect(container.querySelector('[aria-label="저장 포함"]')).toBeNull()
  expect(container.textContent).toContain('게임 화면 연결됨')
  expect(container.textContent).not.toContain('최근 저장')

  const secondCheckbox = container.querySelector<HTMLInputElement>(
    'input[aria-label="2번 크롭 저장"]'
  )!
  await act(async () => {
    secondCheckbox.click()
  })
  expect(api.setPartyCollectionSlots).toHaveBeenCalledWith([1, 3, 4])

  await click('정답 입력')
  expect(api.setPartyCollectionSlots).toHaveBeenCalledWith(null)
  expect(container.querySelector('#developer-collection-panel')).toBeNull()
  expect(container.querySelectorAll('[role="tabpanel"]')).toHaveLength(1)
  expect(container.textContent).toContain('저장된 크롭')
  expect(evaluation.evaluate).not.toHaveBeenCalled()

  await click('이미지 수집')
  expect(container.querySelector('#developer-labeling-panel')).toBeNull()
  expect(container.querySelector('#developer-collection-panel')).not.toBeNull()
  expect(container.querySelectorAll('[role="tabpanel"]')).toHaveLength(1)
  expect(api.setPartyCollectionSlots).toHaveBeenLastCalledWith([1, 3, 4])
  await act(async () => root.unmount())
  mounted = false
  expect(api.setPartyCollectionSlots).toHaveBeenLastCalledWith(null)
})

it('refreshes samples after collection disarm settles before the next preview poll', async () => {
  const { api, samples, status } = installApi()
  const pendingDisarm = deferred<DeveloperPartyCollectionStatus>()
  api.setPartyCollectionSlots.mockImplementation((slots) => {
    if (slots == null) {
      return pendingDisarm.promise
    }
    status.armed = true
    status.slots = slots
    return Promise.resolve({ ...status, slots: [...slots] })
  })

  await act(async () => root.render(<DeveloperWorkbench onClose={vi.fn()} />))
  expect(api.previewParty).toHaveBeenCalledTimes(1)
  expect(api.listSamples).toHaveBeenCalledTimes(1)

  samples.push(
    sample('captured-before-preview', '2026-09-24T00:00:01.000Z', null, {
      slot: 2,
      frameWidth: 1920,
      frameHeight: 1080,
      scale: 1
    })
  )
  status.revision = 1

  await click('정답 입력')
  expect(api.setPartyCollectionSlots).toHaveBeenLastCalledWith(null)
  expect(api.listSamples).toHaveBeenCalledTimes(1)
  expect(api.previewParty).toHaveBeenCalledTimes(1)

  await act(async () => {
    pendingDisarm.resolve({ ...status, armed: false, slots: [] })
    await pendingDisarm.promise
    await new Promise<void>((resolve) => setTimeout(resolve, 0))
  })

  expect(api.listSamples).toHaveBeenCalledTimes(2)
  expect(api.readImage).toHaveBeenCalledWith('captured-before-preview')
  expect(container.textContent).toContain('정답 미입력')
})

it('refreshes a Print Screen sample revision and displays its crop when labeling opens', async () => {
  vi.useFakeTimers()
  const { api, samples, status } = installApi()
  await act(async () => root.render(<DeveloperWorkbench onClose={vi.fn()} />))
  expect(api.listSamples).toHaveBeenCalledTimes(1)

  samples.push(
    sample('new-print-screen-crop', '2026-09-24T00:00:01.000Z', null, {
      slot: 1,
      frameWidth: 1067,
      frameHeight: 600,
      scale: 1
    })
  )
  status.revision = 1
  await act(async () => vi.advanceTimersByTimeAsync(1000))
  expect(api.listSamples).toHaveBeenCalledTimes(2)

  await click('정답 입력')
  expect(container.querySelector('#developer-collection-panel')).toBeNull()
  expect(container.querySelector('img[alt="선택한 저장 크롭"]')?.getAttribute('src')).toBe(
    'data:image/svg+xml,new-print-screen-crop'
  )
  expect(container.textContent).toContain('정답 미입력')
  expect(api.readImage).toHaveBeenCalledWith('new-print-screen-crop')
})

it('sends disarm immediately when the initial arm response is still pending', async () => {
  const pendingArm = deferred<DeveloperPartyCollectionStatus>()
  const { api } = installApi()
  api.setPartyCollectionSlots.mockImplementation((slots) =>
    slots == null
      ? Promise.resolve({ armed: false, slots: [], revision: 0, lastSavedAt: null, error: null })
      : pendingArm.promise
  )

  await act(async () => root.render(<DeveloperWorkbench onClose={vi.fn()} />))
  expect(api.setPartyCollectionSlots).toHaveBeenCalledTimes(1)
  await act(async () => {
    root.unmount()
    mounted = false
  })
  expect(api.setPartyCollectionSlots).toHaveBeenCalledTimes(2)
  expect(api.setPartyCollectionSlots).toHaveBeenLastCalledWith(null)

  pendingArm.resolve({
    armed: true,
    slots: [1, 2, 3, 4],
    revision: 0,
    lastSavedAt: null,
    error: null
  })
  await act(async () => Promise.resolve())
  expect(api.setPartyCollectionSlots).toHaveBeenCalledTimes(2)
})

it('keeps failed label drafts, skips without saving, and restores excluded samples', async () => {
  const rows = [
    sample('first', '2026-09-24T00:00:00.000Z', null),
    sample('second', '2026-09-24T00:00:01.000Z', null)
  ]
  const { api } = installApi(rows)
  api.saveLabel.mockRejectedValue(new Error('write failed'))
  await act(async () => root.render(<DeveloperWorkbench onClose={vi.fn()} />))
  await click('정답 입력')

  expect(input().value).toBe('')
  expect(button('저장하고 다음').disabled).toBe(true)
  await typeLabel('수동 정답')
  expect(button('저장하고 다음').disabled).toBe(false)
  await click('저장하고 다음')
  await act(async () => Promise.resolve())
  expect(input().value).toBe('수동 정답')
  expect(container.querySelector('[role="alert"]')?.textContent).toContain('입력은 유지됩니다')

  await click('건너뛰기')
  expect(api.saveLabel).toHaveBeenCalledExactlyOnceWith('first', '수동 정답')
  expect(input().value).toBe('')
  await click('미입력')
  await act(async () => Promise.resolve())
  expect(input().value).toBe('수동 정답')

  await click('학습에서 제외')
  await act(async () => Promise.resolve())
  expect(api.setSampleExcluded).toHaveBeenCalledExactlyOnceWith('first', true)
  await click('제외')
  expect(button('포함으로 복원')).toBeDefined()
  await click('포함으로 복원')
  await act(async () => Promise.resolve())
  expect(api.setSampleExcluded).toHaveBeenLastCalledWith('first', false)
  await click('미입력')
  await act(async () => Promise.resolve())
  expect(container.textContent).toContain('정답 미입력')
  expect(input().value).toBe('수동 정답')
  expect(evaluation.evaluate).not.toHaveBeenCalled()
})

it('moves to the next unlabeled image only after a successful save', async () => {
  const rows = [
    sample('first', '2026-09-24T00:00:00.000Z', null),
    sample('second', '2026-09-24T00:00:01.000Z', null)
  ]
  const { api } = installApi(rows)
  const pendingSave = deferred<DeveloperSample>()
  api.saveLabel.mockReturnValue(pendingSave.promise)
  await act(async () => root.render(<DeveloperWorkbench onClose={vi.fn()} />))
  await click('정답 입력')
  await typeLabel('완료 라벨')
  await click('저장하고 다음')

  expect(api.saveLabel).toHaveBeenCalledExactlyOnceWith('first', '완료 라벨')
  expect(input().value).toBe('완료 라벨')

  pendingSave.resolve({ ...rows[0], text: '완료 라벨' } as DeveloperSample)
  await act(async () => pendingSave.promise)
  expect(input().value).toBe('')
  expect(container.querySelector('[aria-label="저장된 테스트 이미지"]')?.textContent).not.toContain(
    '완료 라벨'
  )
  expect(evaluation.evaluate).not.toHaveBeenCalled()
})

it('keeps four participant rows and restores saved inclusion after a row becomes occupied again', async () => {
  vi.useFakeTimers()
  const { api } = installApi()
  const popup = {
    width: 20,
    height: 10,
    rgba: new Uint8Array(20 * 10 * 4),
    rows: ([1, 2, 3, 4] as const).map((slot) => ({
      slot,
      occupied: true,
      x: 5,
      y: slot * 2,
      width: 4,
      height: 1
    }))
  }
  let nextFrame = { ...partyFrame(), participantWindow: popup }
  api.previewParty.mockImplementation(async () => ({
    frame: nextFrame,
    previewError: null,
    collection: { armed: true, slots: [1, 2, 3, 4], revision: 0, lastSavedAt: null, error: null }
  }))
  await act(async () => root.render(<DeveloperWorkbench onClose={vi.fn()} />))
  await click('파티원창 크롭')
  expect(api.setPartyCollectionSlots).toHaveBeenLastCalledWith([1, 2, 3, 4], 'participants')
  expect(api.previewParty).toHaveBeenLastCalledWith('participants')
  const third = (): HTMLInputElement =>
    container.querySelector<HTMLInputElement>('input[aria-label="3번 파티원 닉네임 저장"]')!
  await act(async () => third().click())
  expect(third().checked).toBe(false)

  nextFrame = {
    ...nextFrame,
    slots: [],
    participantWindow: { ...popup, rows: popup.rows.map((row) => ({ ...row, occupied: false })) }
  }
  await act(async () => {
    await vi.advanceTimersByTimeAsync(1000)
  })
  expect(container.querySelectorAll('input:disabled')).toHaveLength(4)
  expect(third().checked).toBe(false)
  expect(container.textContent).toContain('현재 저장 대상 0개')

  nextFrame = {
    ...nextFrame,
    slots: [partyFrame().slots[2]],
    participantWindow: {
      ...popup,
      rows: popup.rows.map((row) => ({ ...row, occupied: row.slot === 3 }))
    }
  }
  await act(async () => {
    await vi.advanceTimersByTimeAsync(1000)
  })
  expect(container.querySelectorAll('input:disabled')).toHaveLength(3)
  expect(third().disabled).toBe(false)
  expect(third().checked).toBe(false)
  expect(container.querySelector('img[alt="3번 닉네임 원본 크롭"]')).not.toBeNull()
  await act(async () => third().click())
  expect(container.textContent).toContain('현재 저장 대상 1개')
  await click('정답 입력')
  expect(api.setPartyCollectionSlots).toHaveBeenLastCalledWith(null)
  expect(container.querySelector('#developer-participants-panel')).toBeNull()
})

it('rejects a late HUD preview after switching to participant collection', async () => {
  const { api, status } = installApi()
  const old = deferred<Awaited<ReturnType<DeveloperApi['previewParty']>>>()
  api.previewParty.mockReturnValueOnce(old.promise).mockResolvedValue({
    frame: null,
    previewError: 'DEVELOPER_PARTICIPANT_WINDOW_NOT_FOUND',
    collection: status
  })
  await act(async () => root.render(<DeveloperWorkbench onClose={vi.fn()} />))
  await click('파티원창 크롭')
  await act(async () =>
    old.resolve({ frame: partyFrame(), previewError: null, collection: status })
  )
  expect(container.querySelectorAll('img')).toHaveLength(0)
  expect(container.textContent).toContain('파티참가인원 창을 열어주세요.')
  expect(container.querySelectorAll('[role="tab"]')).toHaveLength(3)
})

it('rearms participant collection when the game appears after the initial access check failed', async () => {
  vi.useFakeTimers()
  const { api, status } = installApi()
  let gameVisible = false
  let attempts = 0
  api.setPartyCollectionSlots.mockImplementation(async (slots, kind) => {
    status.armed = slots != null
    status.slots = slots ?? []
    if (kind === 'participants' && ++attempts === 1) {
      status.armed = false
      status.error = 'DEVELOPER_CAPTURE_UNAVAILABLE'
    } else {
      status.error = null
    }
    return { ...status }
  })
  api.previewParty.mockImplementation(async (kind) => ({
    frame:
      kind !== 'participants' || !gameVisible
        ? null
        : {
            ...partyFrame(),
            participantWindow: { width: 1, height: 1, rgba: new Uint8Array(4), rows: [] }
          },
    previewError: gameVisible ? null : 'DEVELOPER_GAME_NOT_FOUND',
    collection: { ...status }
  }))
  await act(async () => root.render(<DeveloperWorkbench onClose={vi.fn()} />))
  await click('파티원창 크롭')
  expect(attempts).toBe(1)
  expect(container.textContent).toContain('던전앤파이터를 실행해주세요.')
  gameVisible = true
  await act(async () => {
    await vi.advanceTimersByTimeAsync(1000)
  })
  expect(attempts).toBe(2)
  expect(status.armed).toBe(true)
  expect(container.textContent).not.toContain('파티원창이 잘 보이게 해주세요.')
})
