import { z } from 'zod'
import { fetchApi } from '../api-fetch'
import { readJson } from '../auth/http-response'

const UPLOAD_URL = 'https://ocr.dfragon.com/api/desktop/test-captures'
const UPLOAD_TIMEOUT_MS = 15_000
const receiptSchema = z.strictObject({ id: z.uuid(), duplicate: z.boolean() })

/** 테스트 수집 전용 경로에만 쓰며 로그인 토큰, 쿠키와 redirect는 사용하지 않는다. */
export async function sendCollectionPayload(
  input: { id: string; body: string; signal: AbortSignal },
  request: typeof fetch = fetchApi
): Promise<boolean> {
  const timeout = AbortSignal.timeout(UPLOAD_TIMEOUT_MS)
  const signal = AbortSignal.any([input.signal, timeout])
  try {
    const response = await request(UPLOAD_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: input.body,
      credentials: 'omit',
      cache: 'no-store',
      redirect: 'error',
      signal
    })
    if (response.status !== 200 && response.status !== 201) {
      await response.body?.cancel()

      return false
    }
    const receipt = receiptSchema.safeParse(await readJson(response, signal))

    return (
      !signal.aborted && receipt.success && (receipt.data.duplicate || receipt.data.id === input.id)
    )
  } catch {
    return false
  }
}
