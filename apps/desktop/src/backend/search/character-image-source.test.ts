import { describe, expect, it, vi } from 'vitest'
import type { CharacterImage } from '../../preload/common/types/character'
import type { CharacterImageHttp } from './character-http'
import { createCharacterImageSource } from './character-image-source'
import { CompletedCache } from './completed-cache'

function createImage(value: number): CharacterImage {
  return { width: 1, height: 1, rgba: new Uint8Array([value, 0, 0, 255]) }
}

function createCache(): CompletedCache<CharacterImage> {
  return new CompletedCache({
    maximumEntries: 8,
    maximumBytes: 1024,
    ttlMs: 60_000
  })
}

function identity(characterId: string) {
  return { serverId: 'cain', characterId } as const
}

type Pending = {
  characterId: string
  signal: AbortSignal
  resolve: (image: CharacterImage) => void
  reject: (error: unknown) => void
}

function createPendingImage(): {
  image: CharacterImageHttp
  started: Pending[]
} {
  const started: Pending[] = []
  const image: CharacterImageHttp = ({ characterId, signal }) =>
    new Promise((resolve, reject) => {
      signal.addEventListener('abort', () => reject(signal.reason), {
        once: true
      })
      started.push({ characterId, signal, resolve, reject })
    })

  return { image, started }
}

async function flush(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0))
}

describe('캐릭터 이미지 공급', () => {
  it('동시에 4개를 요청해도 하나씩 요청 순서대로 내보낸다', async () => {
    const { image, started } = createPendingImage()
    const source = createCharacterImageSource({ image, cache: createCache() })
    const results = ['a', 'b', 'c', 'd'].map((id) =>
      source({ ...identity(id), signal: new AbortController().signal })
    )

    const ids = ['a', 'b', 'c', 'd']
    for (const [index, result] of results.entries()) {
      await flush()
      expect(started.map((call) => call.characterId)).toEqual(ids.slice(0, index + 1))
      started[index].resolve(createImage(index))
      await expect(result).resolves.toEqual(createImage(index))
    }
  })

  it('앞 요청이 실패해도 다음 요청을 시작하고 실패는 캐시하지 않는다', async () => {
    const { image, started } = createPendingImage()
    const source = createCharacterImageSource({ image, cache: createCache() })
    const first = source({
      ...identity('a'),
      signal: new AbortController().signal
    })
    const second = source({
      ...identity('b'),
      signal: new AbortController().signal
    })
    const failure = new Error('실패')

    await flush()
    started[0].reject(failure)
    await expect(first).rejects.toBe(failure)
    await flush()
    expect(started.map((call) => call.characterId)).toEqual(['a', 'b'])
    started[1].resolve(createImage(2))
    await expect(second).resolves.toEqual(createImage(2))

    const retry = source({
      ...identity('a'),
      signal: new AbortController().signal
    })
    await flush()
    expect(started.map((call) => call.characterId)).toEqual(['a', 'b', 'a'])
    started[2].resolve(createImage(3))
    await expect(retry).resolves.toEqual(createImage(3))
  })

  it('성공한 이미지는 캐시하고 hit는 대기열을 거치지 않는다', async () => {
    const { image, started } = createPendingImage()
    const source = createCharacterImageSource({ image, cache: createCache() })
    const first = source({
      ...identity('a'),
      signal: new AbortController().signal
    })
    await flush()
    started[0].resolve(createImage(1))
    await first

    const blocker = source({
      ...identity('b'),
      signal: new AbortController().signal
    })
    await flush()
    const hit = await source({
      ...identity('a'),
      signal: new AbortController().signal
    })

    expect(hit).toEqual(createImage(1))
    expect(started.map((call) => call.characterId)).toEqual(['a', 'b'])
    started[1].resolve(createImage(2))
    await blocker
  })

  it('대기 중에 같은 캐릭터가 캐시되면 시작 직전 재조회로 요청을 생략한다', async () => {
    const image = vi.fn<CharacterImageHttp>().mockResolvedValue(createImage(1))
    const cache = createCache()
    const { image: slow, started } = createPendingImage()
    const delegating: CharacterImageHttp = (input) =>
      input.characterId === 'blocker' ? slow(input) : image(input)
    const source = createCharacterImageSource({ image: delegating, cache })
    const blocker = source({
      ...identity('blocker'),
      signal: new AbortController().signal
    })
    const waiting = source({
      ...identity('a'),
      signal: new AbortController().signal
    })
    await flush()

    cache.write('cain/a', createImage(9), 4)
    started[0].resolve(createImage(0))
    await blocker

    await expect(waiting).resolves.toEqual(createImage(9))
    expect(image).not.toHaveBeenCalled()
  })

  it('대기 중 취소한 요청은 시작하지 않고 뒤 요청은 이어서 처리한다', async () => {
    const { image, started } = createPendingImage()
    const source = createCharacterImageSource({ image, cache: createCache() })
    const controller = new AbortController()
    const running = new AbortController()
    const first = source({ ...identity('a'), signal: running.signal })
    const cancelled = source({ ...identity('b'), signal: controller.signal })
    const third = source({
      ...identity('c'),
      signal: new AbortController().signal
    })
    await flush()

    const reason = new Error('취소')
    controller.abort(reason)
    await expect(cancelled).rejects.toBe(reason)
    expect(started[0].signal).toBe(running.signal)
    expect(started[0].signal.aborted).toBe(false)
    started[0].resolve(createImage(1))
    await first
    await flush()

    expect(started.map((call) => call.characterId)).toEqual(['a', 'c'])
    started[1].resolve(createImage(3))
    await expect(third).resolves.toEqual(createImage(3))
  })

  it('이미 취소된 요청은 캐시 hit여도 요청 없이 취소로 끝난다', async () => {
    const image = vi.fn<CharacterImageHttp>()
    const cache = createCache()
    cache.write('cain/a', createImage(9), 4)
    const source = createCharacterImageSource({ image, cache })
    const controller = new AbortController()
    controller.abort(new Error('취소'))

    await expect(source({ ...identity('a'), signal: controller.signal })).rejects.toThrow('취소')
    expect(image).not.toHaveBeenCalled()
  })
})
