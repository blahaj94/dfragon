import { describe, expect, it, vi } from 'vitest'
import type { MockedFunction } from 'vitest'
import type {
  CharacterCandidate,
  CharacterDetails,
  CharacterImage,
  CharacterPortrait
} from '../../preload/common/types/character'
import { FakeClock, deferred } from '../auth/auth-test-fixtures'
import {
  createCharacterIdentifier,
  type CharacterIdentificationInput,
  type PortraitMatcher
} from './identify'
import type {
  CharacterCandidatesHttp,
  CharacterDetailsHttp,
  CharacterImageHttp
} from './character-http'
import { SearchHttpFailure } from './http'
import { createPortraitEdgeMatcher } from './portrait-edges'

vi.mock('electron', () => ({ session: { fromPartition: vi.fn() } }))

const portrait: CharacterPortrait = {
  image: { width: 1, height: 1, rgba: new Uint8Array([20, 40, 60, 255]) },
  rasterScale: 1
}

function candidate(id: string, name = '첫이름', fame: number | null = 100): CharacterCandidate {
  const imageUrl = `https://img-api.neople.co.kr/df/servers/cain/characters/${id}?zoom=1`

  return {
    characterId: id,
    characterName: name,
    serverId: 'cain',
    serverName: '카인',
    fame,
    imageUrl
  }
}

function details(characterId: string): CharacterDetails {
  return {
    character: { characterId, serverId: 'cain', serverName: '카인', characterName: '선택이름' },
    status: { status: null, buff: null },
    equipment: { equipment: [], setItemInfo: [] },
    avatar: null,
    creature: null,
    oath: null,
    mistAssimilation: null,
    skillStyle: null,
    buff: { equipment: null, avatar: null, creature: null },
    sections: {},
    freshness: {
      lastSuccessfulFetchAt: '2026-10-07T00:00:00.000Z',
      expiresAt: '2026-10-07T00:05:00.000Z'
    }
  }
}

function fixture(): {
  clock: FakeClock
  controller: AbortController
  calls: string[]
  candidates: MockedFunction<CharacterCandidatesHttp>
  image: MockedFunction<CharacterImageHttp>
  matchesPortrait: MockedFunction<PortraitMatcher>
  getDetails: MockedFunction<CharacterDetailsHttp>
  identify: ReturnType<typeof createCharacterIdentifier>
  input: CharacterIdentificationInput
} {
  const clock = new FakeClock()
  const controller = new AbortController()
  const calls: string[] = []
  const candidates = vi.fn<CharacterCandidatesHttp>(async ({ nickname }) => {
    calls.push(`candidates:${nickname}`)

    return [
      candidate('high', nickname),
      candidate('low', nickname, 50),
      candidate('null', nickname, null)
    ]
  })
  const image = vi.fn<CharacterImageHttp>(async ({ characterId }) => {
    calls.push(`image:${characterId}`)

    return portrait.image
  })
  const matchesPortrait = vi.fn<PortraitMatcher>(async () => false)
  const getDetails = vi.fn<CharacterDetailsHttp>(async ({ characterId }) => {
    calls.push(`details:${characterId}`)

    return details(characterId)
  })
  const identify = createCharacterIdentifier({
    candidates,
    image,
    details: getDetails,
    matchesPortrait
  })
  const input: CharacterIdentificationInput = {
    clock,
    startedAt: clock.monotonicMs,
    signal: controller.signal,
    isCurrent: () => true,
    nicknames: ['첫이름', '둘째이름'],
    portrait
  }

  return {
    clock,
    controller,
    calls,
    candidates,
    image,
    matchesPortrait,
    getDetails,
    identify,
    input
  }
}

describe('얼굴 크롭 경계 이후의 캐릭터 식별', () => {
  it('색을 반전한 같은 윤곽의 첫 후보를 선택하고 다음 후보나 이름을 조회하지 않는다', async () => {
    const f = fixture()
    const createRamp = (direction: 'horizontal' | 'vertical', inverted = false): CharacterImage => {
      const width = 10
      const height = 10
      const rgba = new Uint8Array(width * height * 4)
      for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
          const position = direction === 'horizontal' ? x : y
          const brightness = 20 + position * 20
          const value = inverted ? 255 - brightness : brightness
          rgba.set([value, value, value, 255], (y * width + x) * 4)
        }
      }

      return { width, height, rgba }
    }
    f.matchesPortrait.mockImplementation(
      createPortraitEdgeMatcher({ minSimilarity: 0.99, minCoverage: 1, minComparedPixels: 20 })
    )
    f.image.mockImplementation(async ({ characterId }) => {
      f.calls.push(`image:${characterId}`)
      if (characterId === 'high') {
        return createRamp('vertical')
      }

      return createRamp('horizontal', true)
    })
    const portrait = { image: createRamp('horizontal'), rasterScale: 1 }

    expect(await f.identify({ ...f.input, portrait })).toMatchObject({
      kind: 'success',
      value: { kind: 'matched', candidate: { characterId: 'low' }, nickname: '첫이름' }
    })
    expect(f.calls).toEqual(['candidates:첫이름', 'image:high', 'image:low', 'details:low'])
  })

  it('아직 크롭이 없으면 후보와 이미지를 조회하지 않는다', async () => {
    const f = fixture()

    expect(await f.identify({ ...f.input, portrait: null })).toEqual({
      kind: 'success',
      value: { kind: 'portrait-unavailable' }
    })
    expect(f.calls).toEqual([])
    expect(f.matchesPortrait).not.toHaveBeenCalled()
  })

  it('첫 이름의 null 명성 후보까지 비교한 뒤 첫 일치에서 멈춘다', async () => {
    const f = fixture()
    f.matchesPortrait
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true)

    expect(await f.identify(f.input)).toEqual({
      kind: 'success',
      value: {
        kind: 'matched',
        candidate: candidate('null', '첫이름', null),
        details: details('null'),
        nickname: '첫이름'
      }
    })
    expect(f.calls).toEqual([
      'candidates:첫이름',
      'image:high',
      'image:low',
      'image:null',
      'details:null'
    ])
    expect(f.getDetails).toHaveBeenCalledOnce()
  })

  it('첫 이름이 전부 불일치일 때만 둘째 이름을 조회하고 같은 취소 신호를 사용한다', async () => {
    const f = fixture()
    f.matchesPortrait
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true)

    expect(await f.identify(f.input)).toMatchObject({
      kind: 'success',
      value: { kind: 'matched', nickname: '둘째이름' }
    })
    expect(f.calls).toEqual([
      'candidates:첫이름',
      'image:high',
      'image:low',
      'image:null',
      'candidates:둘째이름',
      'image:high',
      'details:high'
    ])
    const signals = [
      ...f.candidates.mock.calls.map(([input]) => input.signal),
      ...f.image.mock.calls.map(([input]) => input.signal),
      ...f.matchesPortrait.mock.calls.map(([input]) => input.signal),
      ...f.getDetails.mock.calls.map(([input]) => input.signal)
    ]
    expect(new Set(signals).size).toBe(1)
  })

  it('원문과 순위를 유지하고 같은 이름은 한 번만 조회한다', async () => {
    const f = fixture()
    f.candidates.mockResolvedValue([])

    expect(await f.identify({ ...f.input, nicknames: ['가+&', '가+&'] })).toEqual({
      kind: 'success',
      value: { kind: 'unmatched' }
    })
    expect(f.candidates).toHaveBeenCalledExactlyOnceWith({
      nickname: '가+&',
      signal: expect.any(AbortSignal)
    })
    expect(f.image).not.toHaveBeenCalled()
    expect(f.getDetails).not.toHaveBeenCalled()
  })

  it.each([['', ' A'], ['x'.repeat(13), '\ud800'], []])(
    '검색할 수 없는 OCR 후보 %j는 보정하지 않고 제외한다',
    async (...nicknames) => {
      const f = fixture()

      expect(await f.identify({ ...f.input, nicknames })).toEqual({
        kind: 'success',
        value: { kind: 'unmatched' }
      })
      expect(f.calls).toEqual([])
    }
  )

  it('첫 OCR 후보가 비어 있어도 유효한 두 번째 원문은 조회한다', async () => {
    const f = fixture()
    f.candidates.mockResolvedValue([])

    await f.identify({ ...f.input, nicknames: ['', '가'] })

    expect(f.candidates).toHaveBeenCalledExactlyOnceWith({
      nickname: '가',
      signal: expect.any(AbortSignal)
    })
  })

  it('두 개를 초과한 후보 입력은 조회 전에 거절한다', async () => {
    const f = fixture()

    expect(await f.identify({ ...f.input, nicknames: ['가', '나', '다'] })).toMatchObject({
      kind: 'failure',
      error: { code: 'INVALID_SEARCH_QUERY' }
    })
    expect(f.calls).toEqual([])
  })

  it('이미지 로딩 실패와 비교 실패를 불일치로 숨기지 않는다', async () => {
    const loading = fixture()
    loading.image.mockRejectedValueOnce(new SearchHttpFailure('NEOPLE_API_ERROR'))
    expect(await loading.identify(loading.input)).toMatchObject({
      kind: 'failure',
      error: { code: 'NEOPLE_API_ERROR' }
    })
    expect(loading.candidates).toHaveBeenCalledOnce()
    expect(loading.image).toHaveBeenCalledOnce()
    expect(loading.getDetails).not.toHaveBeenCalled()

    const comparing = fixture()
    comparing.matchesPortrait.mockRejectedValueOnce(new Error('comparison budget exhausted'))
    expect(await comparing.identify(comparing.input)).toMatchObject({
      kind: 'failure',
      error: { code: 'SEARCH_RESPONSE_INVALID' }
    })
    expect(comparing.image).toHaveBeenCalledOnce()
    expect(comparing.getDetails).not.toHaveBeenCalled()
  })

  it.each(['후보', '상세'] as const)(
    '%s 호출 제한은 원래 수신 시각을 유지하고 다른 후보로 넘어가지 않는다',
    async (stage) => {
      const f = fixture()
      const error = new SearchHttpFailure('SEARCH_RATE_LIMITED', {
        retryAfterSeconds: 30,
        retryAfterReceivedAt: 1000
      })
      if (stage === '후보') {
        f.candidates.mockRejectedValueOnce(error)
      } else {
        f.matchesPortrait.mockResolvedValueOnce(true)
        f.getDetails.mockRejectedValueOnce(error)
      }

      expect(await f.identify(f.input)).toEqual({
        kind: 'failure',
        error: { code: 'SEARCH_RATE_LIMITED', retryAfterSeconds: 30 },
        retryAfterReceivedAt: 1000
      })
      expect(f.candidates).toHaveBeenCalledOnce()
      expect(f.image.mock.calls.length).toBe(stage === '후보' ? 0 : 1)
    }
  )

  it('이미지 대기 중 캡처가 끝나면 비교와 상세 조회를 시작하지 않는다', async () => {
    const f = fixture()
    const pendingImage = deferred<CharacterImage>()
    f.image.mockReturnValueOnce(pendingImage.promise)
    const pending = f.identify(f.input)
    await vi.waitFor(() => expect(f.image).toHaveBeenCalledOnce())
    const signal = f.image.mock.calls[0][0].signal

    f.controller.abort()
    expect(await pending).toBeNull()
    expect(signal.aborted).toBe(true)
    pendingImage.resolve(portrait.image)
    await Promise.resolve()
    expect(f.matchesPortrait).not.toHaveBeenCalled()
    expect(f.getDetails).not.toHaveBeenCalled()
  })

  it('이전 관측이 된 후보 응답은 다음 이미지 조회를 시작하지 않는다', async () => {
    const f = fixture()
    let current = true
    f.candidates.mockImplementationOnce(async () => {
      current = false

      return [candidate('stale')]
    })

    expect(await f.identify({ ...f.input, isCurrent: () => current })).toBeNull()
    expect(f.image).not.toHaveBeenCalled()
  })

  it('앞 단계에서 쓴 시간을 유지하고 15초 경계에서 상세 요청을 시작하지 않는다', async () => {
    const f = fixture()
    f.image.mockImplementationOnce(async () => {
      f.clock.elapseWithoutTimers(14_999)

      return portrait.image
    })
    f.matchesPortrait.mockImplementationOnce(async () => {
      f.clock.elapseWithoutTimers(1)

      return true
    })

    expect(await f.identify(f.input)).toMatchObject({
      kind: 'failure',
      error: { code: 'SEARCH_TIMEOUT' }
    })
    expect(f.getDetails).not.toHaveBeenCalled()
  })

  it('응답 없는 이미지도 처음 접수한 시각의 15초에 종료한다', async () => {
    const f = fixture()
    f.image.mockReturnValueOnce(new Promise(() => undefined))
    const pending = f.identify(f.input)
    await vi.waitFor(() => expect(f.image).toHaveBeenCalledOnce())

    f.clock.advance(15_000)

    expect(await pending).toMatchObject({ kind: 'failure', error: { code: 'SEARCH_TIMEOUT' } })
    expect(f.image.mock.calls[0][0].signal.aborted).toBe(true)
    expect(f.getDetails).not.toHaveBeenCalled()
  })
})
