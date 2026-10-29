import ky, { isResponseSizeError } from 'ky'
import { SearchHttpFailure } from './http'

const RETRY_AFTER_SECONDS_PATTERN = /^[0-9]+$/

/** 공개 캐릭터와 캐릭터 이미지 요청은 인증, 리다이렉트, 자체 재시도를 사용하지 않는다. */
export function createCharacterHttpClient(
  transport: typeof fetch,
  maxResponseSize: number
): ReturnType<typeof ky.create> {
  return ky.create({
    fetch: transport,
    retry: 0,
    timeout: false,
    totalTimeout: false,
    throwHttpErrors: false,
    maxResponseSize,
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

// Response.text(), .json()과 ky의 parseJson은 잘못된 UTF-8을 U+FFFD로 바꿔 읽으므로 bytes를 fatal 모드로 decode해 거절한다.
export function parseCharacterJson(bytes: ArrayBuffer): unknown {
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

  if (isResponseSizeError(error)) {
    throw new SearchHttpFailure('SEARCH_RESPONSE_INVALID')
  }
  throw new SearchHttpFailure('SEARCH_NETWORK_ERROR')
}
