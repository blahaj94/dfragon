import ky from 'ky'
import { RELEASE_FEED_URL } from './release-feed'

// 2026-10 기준 feed는 Release 10개에 약 13KB다. 긴 Release note를 감안해 상한을 넉넉히 둔다.
const FEED_MAX_BYTES = 2 * 1024 * 1024

export async function readReleaseFeed(
  transport: typeof fetch,
  signal: AbortSignal
): Promise<string> {
  const bytes = await ky
    .get(RELEASE_FEED_URL, {
      fetch: transport,
      signal,
      retry: 0,
      maxResponseSize: FEED_MAX_BYTES,
      credentials: 'omit',
      redirect: 'error',
      cache: 'no-store',
      // 언어 header는 사용자 설정 대신 고정값을 보내 IP와 User-Agent 밖의 정보를 전달하지 않는다.
      headers: { Accept: 'application/atom+xml', 'Accept-Language': 'en-US' }
    })
    .arrayBuffer()

  // Response.text()는 잘못된 UTF-8을 U+FFFD로 바꿔 읽으므로 fatal 모드로 decode해 거절한다.
  const feed = new TextDecoder('utf-8', { fatal: true }).decode(bytes)

  return feed
}
