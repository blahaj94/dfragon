import { describe, expect, it, vi } from 'vitest'
import type { MockedFunction } from 'vitest'
import type {
  CharacterCandidate,
  CharacterDetails,
  CharacterImage,
  CharacterPortrait
} from '../../preload/common/types/character'
import { FakeClock, deferred } from '../auth/auth-test-fixtures'
import { runSearchRequest, type IdentificationAdapters, type PortraitMatcher } from './request'
import type { CharacterIdentificationInput } from './identify'
import type { SearchOperationContext } from './operation'
import type {
  CharacterCandidatesHttp,
  CharacterDetailsHttp,
  CharacterImageHttp
} from './character-http'
import { SearchHttpFailure } from './http'
import { createPortraitEdgeMatcher } from './portrait-edges'
import type { StayImageSource } from './stay-images'

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

function requestWith(adapters: IdentificationAdapters) {
  return (input: CharacterIdentificationInput & SearchOperationContext) =>
    runSearchRequest({
      runtime: { clock: input.clock, http: vi.fn(), identification: adapters },
      nickname: input.nicknames[0] ?? '',
      startedAt: input.startedAt,
      signal: input.signal,
      isCurrent: input.isCurrent,
      ocrInput: { candidateNicknames: [...input.nicknames], portrait: input.portrait }
    })
}

function fixture(): {
  clock: FakeClock
  controller: AbortController
  calls: string[]
  candidates: MockedFunction<CharacterCandidatesHttp>
  image: MockedFunction<CharacterImageHttp>
  matchesPortrait: MockedFunction<PortraitMatcher>
  getDetails: MockedFunction<CharacterDetailsHttp>
  identify: ReturnType<typeof requestWith>
  input: CharacterIdentificationInput & SearchOperationContext
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
  const identify = requestWith({
    candidates,
    image,
    details: getDetails,
    matchesPortrait
  })
  const input: CharacterIdentificationInput & SearchOperationContext = {
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

describe('캐릭터 식별 요청의 실행 경계', () => {
  it('한 후보의 Stay 자세들을 순서대로 비교하고 통과하면 다음 후보로 넘어가지 않는다', async () => {
    const f = fixture()
    const firstImage = portrait.image
    const secondImage = { ...portrait.image, rgba: new Uint8Array([90, 80, 70, 255]) }
    const source = vi.fn<StayImageSource>(async ({ characterId }) => {
      f.calls.push(`stay:${characterId}`)

      return { kind: 'ready', images: [firstImage, secondImage, firstImage] }
    })
    f.matchesPortrait.mockResolvedValueOnce(false).mockResolvedValueOnce(true)
    const identify = requestWith({
      candidates: f.candidates,
      image: source,
      details: f.getDetails,
      matchesPortrait: f.matchesPortrait
    })

    expect(await identify(f.input)).toMatchObject({
      kind: 'success',
      rows: [expect.objectContaining({ characterId: 'high', characterName: '첫이름' })],
      selected: { details: details('high') }
    })
    expect(f.matchesPortrait.mock.calls.map(([input]) => input.candidate)).toEqual([
      firstImage,
      secondImage
    ])
    expect(f.calls).toEqual(['candidates:첫이름', 'stay:high', 'details:high'])
  })

  it.each(['unknown-avatar', 'ambiguous-avatar', 'unsupported-job'] as const)(
    '%s 외형을 불일치로 취급해 다음 후보나 이름을 선택하지 않는다',
    async (reason) => {
      const f = fixture()
      const source = vi.fn<StayImageSource>(async () => ({ kind: 'unavailable', reason }))
      const identify = requestWith({
        candidates: f.candidates,
        image: source,
        details: f.getDetails,
        matchesPortrait: f.matchesPortrait
      })

      expect(await identify(f.input)).toMatchObject({
        kind: 'failure',
        error: { code: 'SEARCH_APPEARANCE_UNAVAILABLE', retryAfterSeconds: null }
      })
      expect(source).toHaveBeenCalledOnce()
      expect(f.candidates).toHaveBeenCalledOnce()
      expect(f.matchesPortrait).not.toHaveBeenCalled()
      expect(f.getDetails).not.toHaveBeenCalled()
    }
  )

  it('비어 있는 Stay 결과는 외형 미확인으로 보류한다', async () => {
    const f = fixture()
    const source: StayImageSource = async () => ({ kind: 'ready', images: [] })
    const identify = requestWith({
      candidates: f.candidates,
      image: source,
      details: f.getDetails,
      matchesPortrait: f.matchesPortrait
    })

    expect(await identify(f.input)).toMatchObject({
      kind: 'failure',
      error: { code: 'SEARCH_APPEARANCE_UNAVAILABLE' }
    })
    expect(f.candidates).toHaveBeenCalledOnce()
    expect(f.matchesPortrait).not.toHaveBeenCalled()
  })

  it('첫 Stay 비교 중 캡처가 끝나면 다음 자세나 상세를 요청하지 않는다', async () => {
    const f = fixture()
    const source: StayImageSource = async () => ({
      kind: 'ready',
      images: [portrait.image, portrait.image]
    })
    f.matchesPortrait.mockImplementation(async () => {
      f.controller.abort()

      return false
    })
    const identify = requestWith({
      candidates: f.candidates,
      image: source,
      details: f.getDetails,
      matchesPortrait: f.matchesPortrait
    })

    expect(await identify(f.input)).toBeNull()
    expect(f.matchesPortrait).toHaveBeenCalledOnce()
    expect(f.getDetails).not.toHaveBeenCalled()
  })

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
      rows: [expect.objectContaining({ characterId: 'low', characterName: '첫이름' })],
      selected: { details: details('low') }
    })
    expect(f.calls).toEqual(['candidates:첫이름', 'image:high', 'image:low', 'details:low'])
  })

  it('아직 크롭이 없으면 후보와 이미지를 조회하지 않는다', async () => {
    const f = fixture()

    expect(await f.identify({ ...f.input, portrait: null })).toEqual({
      kind: 'success',
      rows: []
    })
    expect(f.calls).toEqual([])
    expect(f.matchesPortrait).not.toHaveBeenCalled()
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
      rows: [expect.objectContaining({ characterName: '둘째이름' })]
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
    await new Promise<void>((resolve) => setImmediate(resolve))
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

  it.each(['취소', '만료'] as const)(
    '비교 중 %s되면 비교 오류보다 요청 수명 판정을 우선한다',
    async (reason) => {
      const f = fixture()
      f.matchesPortrait.mockImplementationOnce(async () => {
        if (reason === '취소') {
          f.controller.abort()
        } else {
          f.clock.elapseWithoutTimers(15_000)
        }
        throw new Error('comparison failed after interruption')
      })

      const outcome = await f.identify(f.input)
      if (reason === '취소') {
        expect(outcome).toBeNull()
      } else {
        expect(outcome).toMatchObject({ kind: 'failure', error: { code: 'SEARCH_TIMEOUT' } })
      }
      expect(f.image).toHaveBeenCalledOnce()
      expect(f.getDetails).not.toHaveBeenCalled()
      expect(f.matchesPortrait.mock.calls[0][0].signal.aborted).toBe(true)
    }
  )

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
