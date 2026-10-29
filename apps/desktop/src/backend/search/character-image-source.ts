import type { CharacterImage } from '../../preload/common/types/character'
import type { CharacterImageHttp } from './character-http'
import { CompletedCache } from './completed-cache'

const DEFAULT_CACHE_ENTRIES = 64
const DEFAULT_CACHE_BYTES = 16 * 1024 * 1024
const DEFAULT_CACHE_TTL_MS = 5 * 60_000

export function createCharacterImageCache(): CompletedCache<CharacterImage> {
  return new CompletedCache<CharacterImage>({
    maximumEntries: DEFAULT_CACHE_ENTRIES,
    maximumBytes: DEFAULT_CACHE_BYTES,
    ttlMs: DEFAULT_CACHE_TTL_MS
  })
}

function waitForTurn(turn: Promise<void>, signal: AbortSignal): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    function abandon(): void {
      reject(signal.reason)
    }
    signal.addEventListener('abort', abandon, { once: true })
    turn.then(() => {
      signal.removeEventListener('abort', abandon)
      resolve()
    })
  })
}

/**
 * 이미지는 한 번에 하나씩 요청 순서대로 받는다.
 * 각 요청은 자기 signal만 사용하므로 한 슬롯의 취소가 다른 요청을 중단하지 않는다.
 */
export function createCharacterImageSource({
  image,
  cache = createCharacterImageCache()
}: {
  image: CharacterImageHttp
  cache?: CompletedCache<CharacterImage>
}): CharacterImageHttp {
  let queue: Promise<void> = Promise.resolve()

  return async ({ serverId, characterId, signal }) => {
    const key = `${serverId}/${characterId}`
    signal.throwIfAborted()
    const early = cache.read(key)
    if (early) {
      return early
    }
    const previous = queue
    const { promise: finished, resolve: release } = Promise.withResolvers<void>()
    // 대기 중에 취소한 요청도 앞 요청이 끝난 뒤에 차례를 넘겨야 다음 요청이 겹치지 않는다.
    queue = previous.then(() => finished)
    try {
      await waitForTurn(previous, signal)
      signal.throwIfAborted()
      // 대기 중에 같은 캐릭터를 앞 요청이 받았을 수 있다.
      const cached = cache.read(key)
      if (cached) {
        return cached
      }
      const loaded = await image({ serverId, characterId, signal })
      cache.write(key, loaded, loaded.rgba.byteLength)

      return loaded
    } finally {
      release()
    }
  }
}
