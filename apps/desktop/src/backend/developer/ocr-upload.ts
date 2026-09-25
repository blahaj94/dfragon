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
import { createOcrUploadLifecycle } from './ocr-upload-lifecycle'
import { createOcrUploadPayload } from './ocr-upload-payload'

const OCR_API_ORIGIN = 'https://ocr.dfragon.com'
const UPLOAD_URL = `${OCR_API_ORIGIN}/api/desktop/captures`
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
      const lifecycle = createOcrUploadLifecycle({ auth, generation, captureSignal })
      try {
        if (!lifecycle.isCurrent()) {
          return 'signedOut'
        }
        let authorization = await auth.authorization(lifecycle.signal)
        if (
          !lifecycle.isCurrent() ||
          authorization.status !== 'available' ||
          authorization.generation !== generation
        ) {
          return 'signedOut'
        }
        const payload = createOcrUploadPayload(frame, selected, kind)
        if (payload === null) {
          return 'failed'
        }
        // Only a rejected credential may be refreshed once. Network failures are never retried.
        for (let attempt = 0; attempt < 2; attempt += 1) {
          if (
            !lifecycle.isCurrent() ||
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
            body: payload.body,
            credentials: 'omit',
            cache: 'no-store',
            redirect: 'error',
            signal: lifecycle.signal
          })
          if (response.status === 401) {
            await response.body?.cancel()
            authorization = await auth.recoverAuthorization(
              {
                generation,
                accessGeneration: authorization.accessGeneration,
                finalRejection: attempt === 1
              },
              lifecycle.signal
            )
            continue
          }
          if (!lifecycle.isCurrent()) {
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
          const receipt = receiptSchema.safeParse(await readJson(response, lifecycle.signal))
          return lifecycle.isCurrent() && receipt.success && receipt.data.id === payload.id
            ? 'uploaded'
            : 'failed'
        }
        return 'signedOut'
      } catch {
        return auth.captureGeneration() === generation ? 'failed' : 'signedOut'
      } finally {
        lifecycle.cleanup()
      }
    }
  }
}
