import { randomUUID } from 'node:crypto'
import { PNG } from 'pngjs'
import { z } from 'zod'
import { fetchApi } from '../api-fetch'
import { readJson } from '../auth/http-response'
import type { AuthCoordinator } from '../auth/types'
import type {
  DeveloperCollectionKind,
  DeveloperPartySlot,
  DeveloperUploadStatus
} from '../../preload/common/types/developer'
import type { CapturedPartyFrame } from './collection-session'
import { validatePartyFrame } from './collection-session'

const UPLOAD_URL = 'https://ocr.dfragon.com/api/desktop/captures'
const receiptSchema = z.strictObject({ id: z.uuid(), duplicate: z.boolean() })

/** Uses main-owned credentials and pixels; no URL, token or image upload IPC is exposed. */
export function createOcrUploader(
  auth: Pick<
    AuthCoordinator,
    'captureGeneration' | 'authorization' | 'recoverAuthorization' | 'subscribe'
  >,
  request: typeof fetch = fetchApi
) {
  return function prepareUpload() {
    const generation = auth.captureGeneration()
    if (generation == null) {
      return null
    }

    return async function upload(
      frame: CapturedPartyFrame,
      selected: DeveloperPartySlot[],
      kind: DeveloperCollectionKind,
      captureSignal: AbortSignal
    ): Promise<DeveloperUploadStatus> {
      const controller = new AbortController()
      const abort = (): void => controller.abort()
      const current = (): boolean =>
        auth.captureGeneration() === generation && !controller.signal.aborted
      const unsubscribe = auth.subscribe(() => {
        if (auth.captureGeneration() !== generation) {
          abort()
        }
      })
      captureSignal.addEventListener('abort', abort, { once: true })
      const deadline = setTimeout(abort, 15_000)
      try {
        if (captureSignal.aborted || !current()) {
          return 'signedOut'
        }
        let authorization = await auth.authorization(controller.signal)
        if (
          !current() ||
          authorization.status !== 'available' ||
          authorization.generation !== generation
        ) {
          return 'signedOut'
        }
        validatePartyFrame(frame)
        const original = frame.original
        if (!original || original.rgba.length !== frame.width * frame.height * 4) {
          return 'failed'
        }
        const crops = original.crops.filter(({ slot }) => selected.includes(slot))
        if (crops.length === 0) {
          return 'failed'
        }
        const image = new PNG({ width: frame.width, height: frame.height })
        image.data = original.rgba
        const png = PNG.sync.write(image)
        if (png.length > 16 * 1024 * 1024) {
          return 'failed'
        }
        const id = randomUUID()
        const body = JSON.stringify({
          id,
          capturedAt: frame.capturedAt,
          kind,
          originalPng: png.toString('base64'),
          uiScale: frame.scale,
          uiScaleSource: 'estimated',
          crops
        })
        // Only a rejected credential may be refreshed once. Network failures are never retried.
        for (let attempt = 0; attempt < 2; attempt += 1) {
          if (
            !current() ||
            authorization.status !== 'available' ||
            authorization.generation !== generation
          ) {
            return 'signedOut'
          }
          const response = await request(UPLOAD_URL, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${authorization.accessToken}`,
              'Content-Type': 'application/json',
              Accept: 'application/json'
            },
            body,
            credentials: 'omit',
            cache: 'no-store',
            redirect: 'error',
            signal: controller.signal
          })
          if (response.status === 401) {
            await response.body?.cancel()
            authorization = await auth.recoverAuthorization(
              {
                generation,
                accessGeneration: authorization.accessGeneration,
                finalRejection: attempt === 1
              },
              controller.signal
            )
            continue
          }
          if (!current()) {
            await response.body?.cancel()
            return 'signedOut'
          }
          if (response.status !== 200 && response.status !== 201) {
            await response.body?.cancel()
            return response.status === 403
              ? 'ownerRequired'
              : response.status === 507
                ? 'storageFull'
                : 'failed'
          }
          const receipt = receiptSchema.safeParse(await readJson(response, controller.signal))
          return current() && receipt.success && receipt.data.id === id ? 'uploaded' : 'failed'
        }
        return 'signedOut'
      } catch {
        return auth.captureGeneration() === generation ? 'failed' : 'signedOut'
      } finally {
        clearTimeout(deadline)
        captureSignal.removeEventListener('abort', abort)
        unsubscribe()
      }
    }
  }
}
