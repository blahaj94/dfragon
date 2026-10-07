import { randomUUID } from 'node:crypto'
import type { CharacterImage } from '../../preload/common/types/character'
import type {
  CollectOcrSample,
  OcrCollectionResult
} from '../../preload/common/types/ocr-collection'
import {
  createCollectionPayload,
  detectCollectionCrops,
  isCollectableFrame,
  type CollectionFrame,
  type CollectionJob
} from './payload'
import { sendCollectionPayload } from './http'

const FRAME_RETENTION_MS = 60_000
const MAX_RETAINED_FRAMES = 2
const MAX_RETAINED_BYTES = 64 * 1024 * 1024
const MAX_QUEUED_FRAMES = 2
const MAX_QUEUED_BYTES = 64 * 1024 * 1024
const SHORTCUT_COOLDOWN_MS = 1_000

type RetainedFrame = {
  frame: CollectionFrame
  expires: ReturnType<typeof setTimeout>
}

export type OcrCollection = {
  retain: (captureId: string, image: CharacterImage) => string | undefined
  collect: (input: CollectOcrSample) => OcrCollectionResult
  collectShortcut: (captureId: string, image: CharacterImage) => OcrCollectionResult
  clear: () => void
  dispose: () => void
}

/** 프레임 소유권, 검색 회차 중복 제거와 업로드 수명을 main에 한정한다. */
export function createOcrCollection(options: {
  enabled: boolean
  send?: typeof sendCollectionPayload
  onFailure?: (code: 'UPLOAD_FAILED' | 'UPLOAD_QUEUE_FULL') => void
}): OcrCollection {
  const frames = new Map<string, RetainedFrame>()
  const collected = new Set<CollectOcrSample['slot']>()
  const queue: CollectionJob[] = []
  const send = options.send ?? sendCollectionPayload
  let captureId: string | null = null
  let active: AbortController | null = null
  let disposed = false
  let shortcutAt = -Infinity

  function forgetFrame(id: string): void {
    const retained = frames.get(id)
    if (retained !== undefined) {
      clearTimeout(retained.expires)
      frames.delete(id)
    }
  }

  function clear(): void {
    for (const id of frames.keys()) {
      forgetFrame(id)
    }
    collected.clear()
    queue.length = 0
    active?.abort()
    captureId = null
  }

  function retain(nextCaptureId: string, image: CharacterImage): string | undefined {
    if (!options.enabled || disposed || !isCollectableFrame(image)) {
      return undefined
    }

    if (captureId !== nextCaptureId) {
      clear()
      captureId = nextCaptureId
    }
    const id = randomUUID()
    const capturedAt = new Date().toISOString()
    const frame = { id, capturedAt, image }
    const expires = setTimeout(() => forgetFrame(id), FRAME_RETENTION_MS)
    expires.unref?.()
    frames.set(id, { frame, expires })
    let bytes = [...frames.values()].reduce(
      (total, value) => total + value.frame.image.rgba.byteLength,
      0
    )
    for (const [oldId, retained] of frames) {
      if (frames.size <= MAX_RETAINED_FRAMES && bytes <= MAX_RETAINED_BYTES) {
        break
      }
      bytes -= retained.frame.image.rgba.byteLength
      forgetFrame(oldId)
    }

    return id
  }

  async function drain(): Promise<void> {
    if (active !== null || disposed) {
      return
    }
    const controller = new AbortController()
    active = controller
    try {
      while (queue.length > 0 && !controller.signal.aborted) {
        const job = queue.shift()!
        try {
          const id = randomUUID()
          const body = await createCollectionPayload(job, id)
          if (controller.signal.aborted) {
            break
          }

          if (body === null) {
            continue
          }
          const uploaded = await send({ id, body, signal: controller.signal })
          if (!uploaded && !controller.signal.aborted) {
            options.onFailure?.('UPLOAD_FAILED')
          }
        } catch {
          if (!controller.signal.aborted) {
            options.onFailure?.('UPLOAD_FAILED')
          }
        }
      }
    } finally {
      active = null
      if (queue.length > 0 && !disposed) {
        void drain()
      }
    }
  }

  function enqueue(job: CollectionJob): OcrCollectionResult {
    const pending = queue.find(
      (item) => item.frame.id === job.frame.id && item.trigger === job.trigger
    )
    if (pending !== undefined) {
      for (const [slot, prediction] of job.predictions) {
        pending.predictions.set(slot, prediction)
      }

      return { status: 'queued' }
    }
    const queuedBytes = queue.reduce((total, item) => total + item.frame.image.rgba.byteLength, 0)
    if (
      queue.length >= MAX_QUEUED_FRAMES ||
      queuedBytes + job.frame.image.rgba.byteLength > MAX_QUEUED_BYTES
    ) {
      options.onFailure?.('UPLOAD_QUEUE_FULL')

      return { status: 'skipped' }
    }
    queue.push(job)
    // IPC는 대기열 등록만 기다린다. 검출, 압축과 외부 요청은 다음 작업에서 실행한다.
    setImmediate(() => void drain())

    return { status: 'queued' }
  }

  function collect(input: CollectOcrSample): OcrCollectionResult {
    if (!options.enabled || disposed || captureId !== input.captureId) {
      return { status: 'skipped' }
    }

    if (collected.has(input.slot)) {
      return { status: 'duplicate' }
    }
    const retained = frames.get(input.frameId)
    if (retained === undefined) {
      return { status: 'skipped' }
    }
    collected.add(input.slot)
    const predictions = new Map([[input.slot, input.prediction]])

    return enqueue({ frame: retained.frame, trigger: 'ocr', predictions })
  }

  function collectShortcut(nextCaptureId: string, image: CharacterImage): OcrCollectionResult {
    if (!options.enabled || disposed || Date.now() - shortcutAt < SHORTCUT_COOLDOWN_MS) {
      return { status: 'skipped' }
    }
    const geometry = detectCollectionCrops(image)
    if (geometry === null || geometry.slots.length === 0) {
      return { status: 'skipped' }
    }
    const id = retain(nextCaptureId, image)
    const frame = id === undefined ? undefined : frames.get(id)?.frame
    if (frame === undefined) {
      return { status: 'skipped' }
    }
    shortcutAt = Date.now()
    const predictions = new Map<CollectOcrSample['slot'], null>(
      geometry.slots.map(({ nickname }) => [nickname.slot, null])
    )

    return enqueue({ frame, trigger: 'shortcut', predictions })
  }

  function dispose(): void {
    disposed = true
    clear()
  }

  return { retain, collect, collectShortcut, clear, dispose }
}
