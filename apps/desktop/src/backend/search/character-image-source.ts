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

type Waiter = { start: () => void }

/**
 * 이미지 다운로드를 FIFO로 제한하고 성공한 이미지만 공유한다.
 * 각 요청은 자기 signal만 사용하므로 한 슬롯의 취소가 다른 요청을 중단하지 않는다.
 */
export function createCharacterImageSource({
  image,
  concurrency = 1,
  cache = createCharacterImageCache()
}: {
  image: CharacterImageHttp
  concurrency?: number
  cache?: CompletedCache<CharacterImage>
}): CharacterImageHttp {
  const waiters: Waiter[] = []
  let active = 0

  function release(): void {
    active -= 1
    const next = waiters.shift()
    if (next) {
      active += 1
      next.start()
    }
  }

  function acquire(signal: AbortSignal): Promise<void> {
    if (active < concurrency && waiters.length === 0) {
      active += 1

      return Promise.resolve()
    }

    return new Promise<void>((resolve, reject) => {
      const waiter: Waiter = {
        start: () => {
          signal.removeEventListener('abort', abandon)
          resolve()
        }
      }
      function abandon(): void {
        const index = waiters.indexOf(waiter)
        if (index >= 0) {
          waiters.splice(index, 1)
        }
        reject(signal.reason)
      }
      waiters.push(waiter)
      signal.addEventListener('abort', abandon, { once: true })
    })
  }

  return async ({ serverId, characterId, signal }) => {
    const key = `${serverId}/${characterId}`
    signal.throwIfAborted()
    const early = cache.read(key)
    if (early) {
      return early
    }
    await acquire(signal)
    try {
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
