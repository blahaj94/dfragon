import { RELEASE_FEED_URL } from './release-feed'

const FEED_TIMEOUT_MS = 10_000
// 2026-10 기준 feed는 Release 10개에 약 13KB다. 긴 Release note를 감안해 상한을 넉넉히 둔다.
const FEED_MAX_BYTES = 2 * 1024 * 1024

/**
 * GitHub Release feed를 cookie와 인증 정보 없이 받아 UTF-8 문자열로 돌려준다.
 * 응답 상태, 크기, 대기 시간이 상한을 벗어나면 원문 없이 실패한다.
 */
export async function readReleaseFeed(
  transport: typeof fetch,
  signal: AbortSignal
): Promise<string> {
  const timeout = new AbortController()
  const timer = setTimeout(() => timeout.abort(), FEED_TIMEOUT_MS)
  const combined = AbortSignal.any([signal, timeout.signal])
  let response: Response | undefined
  try {
    response = await transport(RELEASE_FEED_URL, {
      method: 'GET',
      credentials: 'omit',
      redirect: 'error',
      cache: 'no-store',
      // 언어 header는 사용자 설정 대신 고정값을 보내 IP와 User-Agent 밖의 정보를 전달하지 않는다.
      headers: { Accept: 'application/atom+xml', 'Accept-Language': 'en-US' },
      signal: combined
    })
    if (
      response.status !== 200 ||
      response.redirected ||
      (response.url && response.url !== RELEASE_FEED_URL)
    ) {
      throw new Error('UPDATE_FEED_UNAVAILABLE')
    }

    return await readBoundedText(response, combined)
  } finally {
    clearTimeout(timer)
    void response?.body?.cancel().catch(() => undefined)
  }
}

async function readBoundedText(response: Response, signal: AbortSignal): Promise<string> {
  const declaredBytes = Number(response.headers.get('content-length') ?? 0)
  if (declaredBytes > FEED_MAX_BYTES || response.body == null) {
    throw new Error('UPDATE_FEED_INVALID')
  }
  const reader = response.body.getReader()
  const cancel = (): void => {
    void reader.cancel().catch(() => undefined)
  }
  signal.addEventListener('abort', cancel, { once: true })
  const chunks: Uint8Array[] = []
  let bytes = 0
  try {
    for (let chunk = await reader.read(); !chunk.done; chunk = await reader.read()) {
      bytes += chunk.value.byteLength
      if (bytes > FEED_MAX_BYTES) {
        cancel()
        throw new Error('UPDATE_FEED_INVALID')
      }
      chunks.push(chunk.value)
    }
  } finally {
    signal.removeEventListener('abort', cancel)
  }

  // 취소한 stream은 끝난 것처럼 읽히므로 잘린 본문을 돌려주지 않는다.
  if (signal.aborted) {
    throw new Error('UPDATE_FEED_UNAVAILABLE')
  }

  return new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks))
}
