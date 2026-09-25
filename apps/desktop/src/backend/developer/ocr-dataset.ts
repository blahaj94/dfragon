import { z } from 'zod'
import { fetchApi } from '../api-fetch'
import type { AuthCoordinator } from '../auth/types'
import type { DeveloperSample } from '../../preload/common/types/developer'
import { DEVELOPER_ERROR_CODES as errors } from '../../preload/common/developer-errors'
import { createOcrUploadLifecycle } from './ocr-upload-lifecycle'

const origin = 'https://ocr.dfragon.com'
const dimension = z.number().int().min(1).max(8192)
const sampleSchema = z.object({
  id: z.string().regex(/^[0-9a-f-]{36}-[1-4]$/),
  capturedAt: z.iso.datetime(),
  width: dimension,
  height: dimension,
  text: z.string().max(100).nullable(),
  excluded: z.boolean(),
  slot: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
  frameWidth: dimension,
  frameHeight: dimension,
  uiScale: z.number().positive().max(10).nullable(),
  kind: z.enum(['hud', 'participants']),
  split: z.enum(['unassigned', 'train', 'val', 'test'])
})
const datasetSchema = z.object({
  exportedAt: z.iso.datetime(),
  samples: z.array(sampleSchema).max(10_000)
})
type DatasetAuth = Pick<
  AuthCoordinator,
  'captureGeneration' | 'authorization' | 'recoverAuthorization' | 'subscribe'
>

/** Bounds remote metadata and PNG bytes before exposing them to the renderer. */
async function readBody(response: Response, signal: AbortSignal, limit: number): Promise<Buffer> {
  if (!response.body) {
    throw new Error(errors.OCR_UNAVAILABLE)
  }
  const reader = response.body.getReader()
  const cancel = (): void => {
    void reader.cancel().catch(() => undefined)
  }
  signal.addEventListener('abort', cancel, { once: true })
  const chunks: Uint8Array[] = []
  let length = 0
  try {
    signal.throwIfAborted()
    while (true) {
      const chunk = await reader.read()
      signal.throwIfAborted()
      if (chunk.done) {
        break
      }
      length += chunk.value.length
      if (length > limit) {
        throw new Error(errors.OCR_UNAVAILABLE)
      }
      chunks.push(chunk.value)
    }
    return Buffer.concat(chunks, length)
  } finally {
    signal.removeEventListener('abort', cancel)
    await reader.cancel().catch(() => undefined)
  }
}

/** Keeps one read-only server snapshot in memory, scoped to the signed-in session. */
export function createOcrDataset(
  auth: DatasetAuth,
  request: typeof fetch = fetchApi
): {
  close: () => void
  list: () => Promise<DeveloperSample[]>
  readImage: (id: string) => Promise<string>
} {
  let session = new AbortController()
  let revision = 0
  let generation: number | null = null
  const samples = new Map<string, z.infer<typeof sampleSchema>>()

  function close(): void {
    session.abort()
    session = new AbortController()
    revision++
    generation = null
    samples.clear()
  }

  async function get<T>(
    path: string,
    parse: (response: Response, signal: AbortSignal) => Promise<T>
  ): Promise<T> {
    const expected = generation
    if (expected === null || auth.captureGeneration() !== expected) {
      throw new Error(errors.OCR_LOGIN_REQUIRED)
    }
    const lifecycle = createOcrUploadLifecycle({
      auth,
      generation: expected,
      captureSignal: session.signal
    })
    try {
      let authorization = await auth.authorization(lifecycle.signal)
      for (let attempt = 0; attempt < 2; attempt++) {
        if (
          !lifecycle.isCurrent() ||
          authorization.status !== 'available' ||
          authorization.generation !== expected
        ) {
          throw new Error(errors.OCR_LOGIN_REQUIRED)
        }
        const response = await request(`${origin}${path}`, {
          headers: { Authorization: `Bearer ${authorization.accessToken}` },
          credentials: 'omit',
          cache: 'no-store',
          redirect: 'error',
          signal: lifecycle.signal
        })
        if (response.status === 401) {
          await response.body?.cancel()
          authorization = await auth.recoverAuthorization(
            {
              generation: expected,
              accessGeneration: authorization.accessGeneration,
              finalRejection: attempt === 1
            },
            lifecycle.signal
          )
          continue
        }
        if (response.status !== 200) {
          await response.body?.cancel()
          throw new Error(
            response.status === 403 ? errors.OCR_OWNER_REQUIRED : errors.OCR_UNAVAILABLE
          )
        }
        try {
          const result = await parse(response, lifecycle.signal)
          if (!lifecycle.isCurrent()) {
            throw new Error(errors.OCR_LOGIN_REQUIRED)
          }
          return result
        } catch (error) {
          await response.body?.cancel().catch(() => undefined)
          throw error
        }
      }
      throw new Error(errors.OCR_LOGIN_REQUIRED)
    } finally {
      lifecycle.cleanup()
    }
  }

  return {
    close,
    async list(): Promise<DeveloperSample[]> {
      close()
      generation = auth.captureGeneration()
      const current = revision
      const dataset = await get('/api/desktop/dataset', async (response, signal) => {
        if (response.headers.get('content-type')?.split(';')[0] !== 'application/json') {
          throw new Error(errors.OCR_UNAVAILABLE)
        }
        return datasetSchema.parse(
          JSON.parse((await readBody(response, signal, 8 * 1024 * 1024)).toString('utf8'))
        )
      })
      if (current !== revision) {
        throw new Error(errors.OCR_UNAVAILABLE)
      }
      return dataset.samples.map((sample) => {
        const id = `ocr:${current}:${sample.id}`
        if (samples.has(id)) {
          throw new Error(errors.OCR_UNAVAILABLE)
        }
        samples.set(id, sample)
        return {
          id,
          createdAt: sample.capturedAt,
          width: sample.width,
          height: sample.height,
          text: sample.text,
          excluded: sample.excluded,
          remote: { kind: sample.kind, split: sample.split },
          source:
            sample.uiScale === null
              ? null
              : {
                  slot: sample.slot,
                  frameWidth: sample.frameWidth,
                  frameHeight: sample.frameHeight,
                  scale: sample.uiScale
                }
        }
      })
    },
    async readImage(id: string): Promise<string> {
      const sample = samples.get(id)
      if (!sample) {
        throw new Error(errors.SAMPLE_NOT_FOUND)
      }
      return get(`/api/desktop/samples/${sample.id}/image`, async (response, signal) => {
        if (response.headers.get('content-type') !== 'image/png') {
          throw new Error(errors.OCR_UNAVAILABLE)
        }
        const png = await readBody(response, signal, 16 * 1024 * 1024)
        // Validate the PNG signature and dimensions before the renderer's decoder allocates pixels.
        if (
          png.length < 24 ||
          png.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a' ||
          png.toString('ascii', 12, 16) !== 'IHDR' ||
          png.readUInt32BE(16) !== sample.width ||
          png.readUInt32BE(20) !== sample.height ||
          sample.width * sample.height > 16_777_216
        ) {
          throw new Error(errors.OCR_UNAVAILABLE)
        }
        return `data:image/png;base64,${png.toString('base64')}`
      })
    }
  }
}
