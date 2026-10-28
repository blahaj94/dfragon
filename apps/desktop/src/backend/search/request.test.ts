import { describe, expect, it, vi } from 'vitest'
import type { MockedFunction } from 'vitest'
import type {
  CharacterCandidate,
  CharacterDetails,
  CharacterImage,
  CharacterPortrait,
  SelectedCharacterSummary
} from '../../preload/common/types/character'
import { deferred } from '../lib/async-test-fixture'
import { FakeMonotonicClock } from '../lib/fake-monotonic-clock'
import { runDetailsRequest, runSearchRequest, type IdentificationAdapters } from './request'
import type { CharacterIdentificationInput } from './identify'
import type { SearchOperationContext } from './operation'
import type {
  CharacterCandidatesHttp,
  CharacterDetailsHttp,
  CharacterImageHttp
} from './character-http'
import { createCharacterImageCache, createCharacterImageSource } from './character-image-source'
import { SearchHttpFailure } from './http'
import { createPortraitColorScorer, type PortraitColorScorer } from './portrait-color'
import { INITIAL_PORTRAIT_COLOR_POLICY } from './portrait-policy'
import { PortraitComparisonBudgetExceededError } from './portrait-raster'
import type { ScoreEngine, ScoreEngineResult } from '../score/engine'
import { dealerCard } from '../../preload/common/search/card-test-fixture'

vi.mock('electron', () => ({ session: { fromPartition: vi.fn() } }))

const FACE_SIZE = 8
const FACE_LEFT_SHADE = 100
const FACE_RIGHT_SHADE = 150

function shadedImage(shift = 0): CharacterImage {
  const rgba = new Uint8Array(FACE_SIZE * FACE_SIZE * 4)
  for (let y = 0; y < FACE_SIZE; y += 1) {
    for (let x = 0; x < FACE_SIZE; x += 1) {
      const shade = (x < FACE_SIZE / 2 ? FACE_LEFT_SHADE : FACE_RIGHT_SHADE) + shift
      rgba.set([shade, shade, shade, 255], (y * FACE_SIZE + x) * 4)
    }
  }

  return { width: FACE_SIZE, height: FACE_SIZE, rgba }
}

const portrait: CharacterPortrait = { image: shadedImage(), rasterScale: 1 }

function candidate(id: string, name = '첫이름', fame: number | null = 100): CharacterCandidate {
  const imageUrl = `https://img-api.neople.co.kr/df/servers/cain/characters/${id}?zoom=1`

  return {
    characterId: id,
    characterName: name,
    serverId: 'cain',
    serverName: '카인',
    fame,
    imageUrl,
    adventureName: null,
    jobName: null,
    jobGrowName: null
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
      runtime: { clock: input.clock, identification: adapters },
      nickname: input.nicknames[0] ?? '',
      startedAt: input.startedAt,
      signal: input.signal,
      isCurrent: input.isCurrent,
      ocrInput: { candidateNicknames: [...input.nicknames], portrait: input.portrait }
    })
}

function fixture(shifts: Record<string, number> = { high: 20, low: 10, null: 30 }): {
  clock: FakeMonotonicClock
  controller: AbortController
  calls: string[]
  candidates: MockedFunction<CharacterCandidatesHttp>
  image: MockedFunction<CharacterImageHttp>
  scorePortrait: MockedFunction<PortraitColorScorer>
  getDetails: MockedFunction<CharacterDetailsHttp>
  identify: ReturnType<typeof requestWith>
  input: CharacterIdentificationInput & SearchOperationContext
} {
  const clock = new FakeMonotonicClock()
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

    return shadedImage(shifts[characterId])
  })
  const scorePortrait = vi.fn<PortraitColorScorer>(
    createPortraitColorScorer(INITIAL_PORTRAIT_COLOR_POLICY)
  )
  const getDetails = vi.fn<CharacterDetailsHttp>(async ({ characterId }) => {
    calls.push(`details:${characterId}`)

    return details(characterId)
  })
  const identify = requestWith({
    candidates,
    image,
    details: getDetails,
    scorePortrait,
    selection: INITIAL_PORTRAIT_COLOR_POLICY
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
    scorePortrait,
    getDetails,
    identify,
    input
  }
}

describe('캐릭터 식별 요청의 실행 경계', () => {
  it('실제 색 비교기로 후보 전원을 비교해 가장 가까운 후보를 같은 취소 신호로 선택한다', async () => {
    const f = fixture()

    expect(await f.identify(f.input)).toMatchObject({
      kind: 'success',
      rows: [expect.objectContaining({ characterId: 'low', characterName: '첫이름' })],
      selected: {
        selectionMethod: 'portrait',
        details: 'pending',
        summary: { characterId: 'low', level: null, card: null }
      }
    })
    expect(f.calls).toEqual(['candidates:첫이름', 'image:high', 'image:low', 'image:null'])
    await expect(f.scorePortrait.mock.results[1].value).resolves.toMatchObject({
      distance: 10,
      comparedCells: 64
    })
    const signals = [
      ...f.candidates.mock.calls.map(([input]) => input.signal),
      ...f.image.mock.calls.map(([input]) => input.signal),
      ...f.scorePortrait.mock.calls.map(([input]) => input.signal)
    ]
    expect(new Set(signals).size).toBe(1)
  })

  it('1위와 2위의 거리 차이가 초기 minMargin보다 작으면 1위를 고르고 선택지를 함께 준다', async () => {
    const f = fixture({ high: 12, low: 10, null: 30 })

    const outcome = await f.identify(f.input)

    expect(outcome).toMatchObject({
      kind: 'success',
      rows: [expect.objectContaining({ characterId: 'low' })],
      selected: { selectionMethod: 'portrait', summary: { characterId: 'low' } }
    })
    expect(
      outcome?.kind === 'success' && outcome.selected?.choices?.map((choice) => choice.characterId)
    ).toEqual(['high', 'low', 'null'])
    expect(f.scorePortrait).toHaveBeenCalledTimes(3)
  })

  it('크롭이 없으면 후보 조회만 실행한다', async () => {
    const f = fixture()

    expect(await f.identify({ ...f.input, portrait: null })).toMatchObject({
      kind: 'success',
      selected: { selectionMethod: 'highest-fame', summary: { characterId: 'high' } }
    })
    expect(f.calls).toEqual(['candidates:첫이름'])
    expect(f.scorePortrait).not.toHaveBeenCalled()
  })

  it('두 개를 초과한 후보 입력은 조회 전에 거절한다', async () => {
    const f = fixture()

    expect(await f.identify({ ...f.input, nicknames: ['가', '나', '다'] })).toMatchObject({
      kind: 'failure',
      error: { code: 'INVALID_SEARCH_QUERY' }
    })
    expect(f.calls).toEqual([])
  })

  it('이미지 로딩 실패와 비교 예산 초과는 그 후보만 점수 없이 두고 선택지를 함께 준다', async () => {
    const loading = fixture()
    loading.image.mockRejectedValueOnce(new SearchHttpFailure('NEOPLE_API_ERROR'))
    const loaded = await loading.identify(loading.input)
    expect(loaded).toMatchObject({
      kind: 'success',
      selected: { selectionMethod: 'portrait', summary: { characterId: 'low' } }
    })
    expect(
      loaded?.kind === 'success' &&
        loaded.selected?.choices?.find((choice) => choice.characterId === 'high')?.face
    ).toBeNull()
    expect(loading.image).toHaveBeenCalledTimes(3)
    expect(loading.scorePortrait).toHaveBeenCalledTimes(2)

    const comparing = fixture()
    comparing.scorePortrait.mockRejectedValueOnce(new PortraitComparisonBudgetExceededError())
    const compared = await comparing.identify(comparing.input)
    expect(compared).toMatchObject({
      kind: 'success',
      selected: { selectionMethod: 'portrait', summary: { characterId: 'low' } }
    })
    expect(
      compared?.kind === 'success' &&
        compared.selected?.choices?.find((choice) => choice.characterId === 'high')?.face
    ).toBeNull()
    expect(comparing.getDetails).not.toHaveBeenCalled()
  })

  it.each(['후보', '이미지'] as const)(
    '%s 호출 제한은 원래 수신 시각을 유지하고 명성 대체로 바꾸지 않는다',
    async (stage) => {
      const f = fixture()
      const error = new SearchHttpFailure('SEARCH_RATE_LIMITED', {
        retryAfterSeconds: 30,
        retryAfterReceivedAt: 1000
      })
      if (stage === '후보') {
        f.candidates.mockRejectedValueOnce(error)
      } else {
        f.image.mockImplementation(async ({ characterId }) => {
          if (characterId === 'low') {
            throw error
          }

          return shadedImage()
        })
      }

      expect(await f.identify(f.input)).toEqual({
        kind: 'failure',
        error: { code: 'SEARCH_RATE_LIMITED', retryAfterSeconds: 30 },
        retryAfterReceivedAt: 1000
      })
      expect(f.candidates).toHaveBeenCalledOnce()
      if (stage === '이미지') {
        expect(f.image).toHaveBeenCalledTimes(2)
        expect(f.getDetails).not.toHaveBeenCalled()
      }
    }
  )

  it('이미지 대기 중 캡처가 끝나면 늦게 온 이미지로 비교와 상세 조회를 시작하지 않는다', async () => {
    const f = fixture()
    const pendingImage = deferred<CharacterImage>()
    f.image.mockReturnValueOnce(pendingImage.promise)
    const pending = f.identify(f.input)
    await vi.waitFor(() => expect(f.image).toHaveBeenCalledOnce())
    const signal = f.image.mock.calls[0][0].signal

    f.controller.abort()
    expect(await pending).toBeNull()
    expect(signal.aborted).toBe(true)
    pendingImage.resolve(shadedImage())
    await new Promise<void>((resolve) => setImmediate(resolve))
    expect(f.image).toHaveBeenCalledOnce()
    expect(f.scorePortrait).not.toHaveBeenCalled()
    expect(f.getDetails).not.toHaveBeenCalled()
  })

  it('이전 관측이 된 후보 응답은 이미지 조회를 시작하지 않는다', async () => {
    const f = fixture()
    let current = true
    f.candidates.mockImplementationOnce(async () => {
      current = false

      return [candidate('stale'), candidate('other', '첫이름', 50)]
    })

    expect(await f.identify({ ...f.input, isCurrent: () => current })).toBeNull()
    expect(f.image).not.toHaveBeenCalled()
  })

  it('앞 단계에서 쓴 시간을 유지하고 15초 경계에서 다음 이미지나 상세 요청을 시작하지 않는다', async () => {
    const f = fixture()
    f.image.mockImplementationOnce(async () => {
      f.clock.elapseWithoutTimers(14_999)

      return shadedImage()
    })
    f.scorePortrait.mockImplementationOnce(async () => {
      f.clock.elapseWithoutTimers(1)

      return {
        distance: 0,
        coverage: 1,
        comparedCells: 64,
        alignment: { x: 0, y: 0, width: 8, height: 8 }
      }
    })

    expect(await f.identify(f.input)).toMatchObject({
      kind: 'failure',
      error: { code: 'SEARCH_TIMEOUT' }
    })
    expect(f.image).toHaveBeenCalledOnce()
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

  it.each(['취소', '만료'] as const)(
    '비교 중 %s되면 비교 오류를 명성 대체로 바꾸지 않고 요청 수명 판정을 우선한다',
    async (reason) => {
      const f = fixture()
      f.scorePortrait.mockImplementationOnce(async () => {
        if (reason === '취소') {
          f.controller.abort()
        } else {
          f.clock.elapseWithoutTimers(15_000)
        }
        throw new PortraitComparisonBudgetExceededError()
      })

      const outcome = await f.identify(f.input)
      if (reason === '취소') {
        expect(outcome).toBeNull()
      } else {
        expect(outcome).toMatchObject({ kind: 'failure', error: { code: 'SEARCH_TIMEOUT' } })
      }
      expect(f.image).toHaveBeenCalledOnce()
      expect(f.getDetails).not.toHaveBeenCalled()
      expect(f.scorePortrait.mock.calls[0][0].signal.aborted).toBe(true)
    }
  )

  it.each(['취소', '만료', '이전 요청'] as const)(
    '이미지 오류를 복구하더라도 %s 판정 뒤에는 명성 후보의 상세를 요청하지 않는다',
    async (reason) => {
      const f = fixture()
      let current = true
      f.image.mockImplementationOnce(async () => {
        if (reason === '취소') {
          f.controller.abort()
        } else if (reason === '만료') {
          f.clock.elapseWithoutTimers(15_000)
        } else {
          current = false
        }
        throw new SearchHttpFailure('NEOPLE_API_ERROR')
      })
      const outcome = await f.identify({ ...f.input, isCurrent: () => current })
      if (reason === '만료') {
        expect(outcome).toMatchObject({ kind: 'failure', error: { code: 'SEARCH_TIMEOUT' } })
      } else {
        expect(outcome).toBeNull()
      }
      expect(f.getDetails).not.toHaveBeenCalled()
      expect(f.scorePortrait).not.toHaveBeenCalled()
    }
  )

  it('공유 직렬 큐에서 대기하던 슬롯의 캡처가 끝나면 그 슬롯의 이미지 요청을 시작하지 않는다', async () => {
    const clock = new FakeMonotonicClock()
    const started: { characterId: string; resolve: (image: CharacterImage) => void }[] = []
    const http = vi.fn<CharacterImageHttp>(
      ({ characterId }) =>
        new Promise((resolve) => {
          started.push({ characterId, resolve })
        })
    )
    const queued: string[] = []
    const source = createCharacterImageSource({ image: http, cache: createCharacterImageCache() })
    const image: CharacterImageHttp = (input) => {
      queued.push(input.characterId)

      return source(input)
    }
    const slot = (prefix: string) => {
      const controller = new AbortController()
      const request = requestWith({
        candidates: async () => [
          candidate(`${prefix}-high`),
          candidate(`${prefix}-low`, '첫이름', 50)
        ],
        image,
        details: async ({ characterId }) => details(characterId),
        scorePortrait: createPortraitColorScorer(INITIAL_PORTRAIT_COLOR_POLICY),
        selection: INITIAL_PORTRAIT_COLOR_POLICY
      })
      const outcome = request({
        clock,
        startedAt: clock.monotonicMs,
        signal: controller.signal,
        isCurrent: () => true,
        nicknames: ['첫이름'],
        portrait
      })

      return { controller, outcome }
    }

    const first = slot('a')
    await vi.waitFor(() => expect(started.map((call) => call.characterId)).toEqual(['a-high']))
    const second = slot('b')
    await vi.waitFor(() => expect(queued).toContain('b-high'))
    second.controller.abort()
    expect(await second.outcome).toBeNull()

    started[0].resolve(shadedImage(20))
    await vi.waitFor(() => expect(started).toHaveLength(2))
    started[1].resolve(shadedImage(5))

    expect(await first.outcome).toMatchObject({
      kind: 'success',
      selected: { selectionMethod: 'portrait', summary: { characterId: 'a-low' } }
    })
    expect(http.mock.calls.map(([input]) => input.characterId)).toEqual(['a-high', 'a-low'])
  })
})

describe('선택한 캐릭터 카드와 점수 엔진', () => {
  const engineResult: ScoreEngineResult = {
    calculator: 'equipment',
    score: 1741,
    skipped: null,
    approximate_score: null,
    approximate_source: null,
    warning: null,
    versions: { package: '0.1.0', rules_rev: 'rev12', bundle_id: 'phase31-rev12' },
    display: { role: 'dealer', switchingLevel: 3, buff30: null, buff50: null }
  }

  const identified: SelectedCharacterSummary = {
    characterId: 'high',
    characterName: '첫이름',
    serverId: 'cain',
    serverName: '카인',
    adventureName: null,
    jobName: null,
    jobGrowName: null,
    level: null,
    fame: 100,
    imageUrl: 'https://img-api.neople.co.kr/df/servers/cain/characters/high?zoom=1',
    guildName: null,
    equipmentScore: null,
    card: null
  }

  function cardRequest(
    f: ReturnType<typeof fixture>,
    score: ScoreEngine,
    card: unknown = dealerCard
  ) {
    f.getDetails.mockImplementation(async ({ characterId }) => ({
      ...details(characterId),
      card: card as CharacterDetails['card']
    }))

    return (isCurrent: () => boolean = () => true) =>
      runDetailsRequest({
        runtime: {
          clock: f.clock,
          identification: {
            candidates: f.candidates,
            image: f.image,
            details: f.getDetails,
            scorePortrait: f.scorePortrait,
            selection: INITIAL_PORTRAIT_COLOR_POLICY
          },
          score
        },
        summary: identified,
        startedAt: f.input.startedAt,
        signal: f.controller.signal,
        isCurrent
      })
  }

  it('카드 역할에 엔진 점수를 채우고 요약의 장비 점수로 옮긴다', async () => {
    const f = fixture()
    const score = vi.fn<ScoreEngine>(() => engineResult)

    const outcome = await cardRequest(f, score)()

    expect(outcome).toMatchObject({
      kind: 'success',
      summary: {
        characterId: 'high',
        imageUrl: identified.imageUrl,
        equipmentScore: 1741,
        card: {
          role: 'dealer',
          score: { calculator: 'equipment', value: 1741, skipped: null }
        }
      }
    })
    expect(f.getDetails).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ serverId: 'cain', characterId: 'high' })
    )
    expect(score).toHaveBeenCalledOnce()
  })

  it('카드 역할을 읽지 못하면 엔진을 부르지 않고 카드만 null로 두어 나머지 요약은 전달한다', async () => {
    const f = fixture()
    const score = vi.fn<ScoreEngine>(() => engineResult)

    const outcome = await cardRequest(f, score, { ...dealerCard, role: 'tank' })()

    expect(outcome).toMatchObject({
      kind: 'success',
      summary: { characterId: 'high', equipmentScore: null, card: null }
    })
    expect(score).not.toHaveBeenCalled()
  })

  it('상세 호출 제한은 원래 수신 시각을 유지해 전달한다', async () => {
    const f = fixture()
    const score = vi.fn<ScoreEngine>(() => engineResult)
    const request = cardRequest(f, score)
    f.getDetails.mockRejectedValueOnce(
      new SearchHttpFailure('SEARCH_RATE_LIMITED', {
        retryAfterSeconds: 30,
        retryAfterReceivedAt: 1000
      })
    )

    expect(await request()).toEqual({
      kind: 'failure',
      error: { code: 'SEARCH_RATE_LIMITED', retryAfterSeconds: 30 },
      retryAfterReceivedAt: 1000
    })
    expect(score).not.toHaveBeenCalled()
  })

  it.each(['만료', '이전 요청', '취소'] as const)(
    '엔진 계산 중 %s 판정이 나면 늦은 카드 결과를 발행하지 않는다',
    async (reason) => {
      const f = fixture()
      let current = true
      const score = vi.fn<ScoreEngine>(() => {
        if (reason === '만료') {
          f.clock.elapseWithoutTimers(15_000)
        } else if (reason === '이전 요청') {
          current = false
        } else {
          f.controller.abort()
        }

        return engineResult
      })

      const outcome = await cardRequest(f, score)(() => current)

      expect(score).toHaveBeenCalledOnce()
      if (reason === '만료') {
        expect(outcome).toMatchObject({ kind: 'failure', error: { code: 'SEARCH_TIMEOUT' } })
      } else {
        expect(outcome).toBeNull()
      }
    }
  )

  it('상세 조회 뒤 15초 경계에 닿으면 엔진을 부르지 않는다', async () => {
    const f = fixture()
    const score = vi.fn<ScoreEngine>(() => engineResult)
    const request = cardRequest(f, score)
    f.getDetails.mockImplementationOnce(async ({ characterId }) => {
      f.clock.elapseWithoutTimers(15_000)

      return { ...details(characterId), card: dealerCard as CharacterDetails['card'] }
    })

    expect(await request()).toMatchObject({ kind: 'failure', error: { code: 'SEARCH_TIMEOUT' } })
    expect(score).not.toHaveBeenCalled()
  })
})
