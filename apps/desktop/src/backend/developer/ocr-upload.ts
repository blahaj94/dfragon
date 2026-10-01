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
import { requestWithOcrAuthorizationRecovery } from './ocr-authorization-recovery'
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
        const authorization = await auth.authorization(lifecycle.signal)
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
        const response = await requestWithOcrAuthorizationRecovery({
          auth,
          generation,
          authorization,
          lifecycle,
          send: (accessToken, signal) =>
            request(UPLOAD_URL, {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
                Accept: 'application/json'
              },
              body: payload.body,
              credentials: 'omit',
              cache: 'no-store',
              redirect: 'error',
              signal
            })
        })
        if (response == null) {
          return 'signedOut'
        }

        if (!lifecycle.isCurrent()) {
          await response.body?.cancel()

          return 'signedOut'
        }

        if (response.status !== 200 && response.status !== 201) {
          await response.body?.cancel()
          if (response.status === 403) {
            return 'ownerRequired'
          }

          if (response.status === 507) {
            return 'storageFull'
          }

          return 'failed'
        }
        const receipt = receiptSchema.safeParse(await readJson(response, lifecycle.signal))
        const isUploadConfirmed =
          lifecycle.isCurrent() && receipt.success && receipt.data.id === payload.id
        if (isUploadConfirmed) {
          return 'uploaded'
        }

        return 'failed'
      } catch {
        const isSameGeneration = auth.captureGeneration() === generation
        if (isSameGeneration) {
          return 'failed'
        }

        return 'signedOut'
      } finally {
        lifecycle.cleanup()
      }
    }
  }
}
