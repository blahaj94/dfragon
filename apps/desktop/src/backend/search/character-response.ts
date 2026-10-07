import ky from 'ky'
import { SearchHttpFailure } from './http'

const RETRY_AFTER_SECONDS_PATTERN = /^[0-9]+$/

/** 공개 캐릭터와 쇼룸 요청은 인증, 리다이렉트, 자체 재시도를 사용하지 않는다. */
export function createCharacterHttpClient(transport: typeof fetch): ReturnType<typeof ky.create> {
  return ky.create({
    fetch: transport,
    retry: 0,
    timeout: false,
    totalTimeout: false,
    throwHttpErrors: false,
    redirect: 'error',
    credentials: 'omit',
    cache: 'no-store'
  })
}

export function parseCharacterRetryAfter(value: string | null): number | null {
  if (value == null || !RETRY_AFTER_SECONDS_PATTERN.test(value)) {
    return null
  }
  const seconds = Number(value)
  if (!Number.isSafeInteger(seconds) || seconds <= 0) {
    return null
  }

  return seconds
}

/** 호출자의 공통 요청 시간 예산이 끝나면 지연된 응답 본문 읽기도 취소한다. */
export async function readCharacterResponseBody(
  response: Response,
  signal: AbortSignal,
  limit: number
): Promise<Buffer> {
  if (!response.body) {
    throw new SearchHttpFailure('SEARCH_RESPONSE_INVALID')
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
        throw new SearchHttpFailure('SEARCH_RESPONSE_INVALID')
      }
      chunks.push(chunk.value)
    }

    return Buffer.concat(chunks, length)
  } finally {
    signal.removeEventListener('abort', cancel)
    await reader.cancel().catch(() => undefined)
  }
}

export function parseCharacterJson(bytes: Buffer): unknown {
  try {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes)

    return JSON.parse(text)
  } catch {
    throw new SearchHttpFailure('SEARCH_RESPONSE_INVALID')
  }
}

export function throwCharacterTransportFailure(error: unknown, signal: AbortSignal): never {
  signal.throwIfAborted()
  if (error instanceof SearchHttpFailure) {
    throw error
  }
  throw new SearchHttpFailure('SEARCH_NETWORK_ERROR')
}
