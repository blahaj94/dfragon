import { describe, expect, it, vi } from 'vitest'
import type { MockedFunction } from 'vitest'
import type {
  CharacterCandidate,
  CharacterDetails,
  CharacterImage,
  CharacterPortrait
} from '../../preload/common/types/character'
import {
  createCharacterIdentifier,
  createManualCharacterLookup,
  type CharacterIdentificationInput,
  type CharacterSelectionPolicy,
  type IdentificationServices
} from './identify'

const SELECTION: CharacterSelectionPolicy = { maxDistance: 40, minMargin: 3, maxCandidates: 3 }
const portrait: CharacterPortrait = {
  image: { width: 1, height: 1, rgba: new Uint8Array([20, 40, 60, 255]) },
  rasterScale: 1
}

function candidate(id: string, name: string, fame: number | null): CharacterCandidate {
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

/** 후보마다 다른 얼굴 창이라 선택지의 창이 어느 후보의 점수에서 왔는지 구분할 수 있다. */
function faceOf(characterId: string): { x: number; y: number; width: number; height: number } {
  return { x: characterId.length, y: 2, width: 26, height: 26 }
}

/** 후보 이미지마다 정한 거리를 돌려주는 비교 연산. 이미지는 캐릭터 ID로 구분한다. */
function fixture(distances: Record<string, number> = { high: 20, low: 10, null: 30 }): {
  calls: string[]
  findCandidates: MockedFunction<IdentificationServices['findCandidates']>
  loadPortrait: MockedFunction<IdentificationServices['loadPortrait']>
  scorePortrait: MockedFunction<IdentificationServices['scorePortrait']>
  getDetails: MockedFunction<IdentificationServices['getDetails']>
  services: IdentificationServices
  identify: ReturnType<typeof createCharacterIdentifier>
  input: CharacterIdentificationInput
} {
  const calls: string[] = []
  const imageOwners = new Map<CharacterImage, string>()
  const findCandidates = vi.fn<IdentificationServices['findCandidates']>(async (nickname) => {
    calls.push(`candidates:${nickname}`)

    return [
      candidate('high', nickname, 100),
      candidate('low', nickname, 50),
      candidate('null', nickname, null)
    ]
  })
  const loadPortrait = vi.fn<IdentificationServices['loadPortrait']>(async ({ characterId }) => {
    calls.push(`image:${characterId}`)
    const image: CharacterImage = { width: 1, height: 1, rgba: new Uint8Array(4) }
    imageOwners.set(image, characterId)

    return image
  })
  const scorePortrait = vi.fn<IdentificationServices['scorePortrait']>(async (input) => {
    const characterId = imageOwners.get(input.candidate) ?? ''
    calls.push(`score:${characterId}`)
    const distance = distances[characterId]
    if (distance === undefined) {
      return null
    }

    return { distance, alignment: faceOf(characterId) }
  })
  const getDetails = vi.fn<IdentificationServices['getDetails']>(async ({ characterId }) => {
    calls.push(`details:${characterId}`)

    return details(characterId)
  })
  const services = { findCandidates, loadPortrait, scorePortrait, getDetails }
  const identify = createCharacterIdentifier(services, SELECTION)
  const input: CharacterIdentificationInput = { nicknames: ['첫이름', '둘째이름'], portrait }

  return {
    calls,
    findCandidates,
    loadPortrait,
    scorePortrait,
    getDetails,
    services,
    identify,
    input
  }
}

describe('캐릭터 식별 규칙', () => {
  it('얼굴이 없으면 이미지 없이 최고 명성을 고르고 동명 후보 전부를 선택지로 준다', async () => {
    const f = fixture()

    const identified = await f.identify({ ...f.input, portrait: null })

    expect(identified).toMatchObject({
      kind: 'matched',
      selectionMethod: 'highest-fame',
      candidate: { characterId: 'high' }
    })
    expect(identified.kind === 'matched' && identified.choices).toEqual([
      {
        characterId: 'high',
        characterName: '첫이름',
        serverId: 'cain',
        serverName: '카인',
        fame: 100,
        adventureName: null,
        face: null
      },
      expect.objectContaining({ characterId: 'low', face: null }),
      expect.objectContaining({ characterId: 'null', face: null })
    ])
    expect(f.calls).toEqual(['candidates:첫이름', 'details:high'])
  })

  it('명성 순으로 후보 전원의 점수를 구한 뒤 가장 가까운 후보를 얼굴로 선택한다', async () => {
    const f = fixture({ high: 20, low: 25, null: 10 })

    expect(await f.identify(f.input)).toEqual({
      kind: 'matched',
      candidate: candidate('null', '첫이름', null),
      details: details('null'),
      nickname: '첫이름',
      selectionMethod: 'portrait'
    })
    expect(f.calls).toEqual([
      'candidates:첫이름',
      'image:high',
      'score:high',
      'image:low',
      'score:low',
      'image:null',
      'score:null',
      'details:null'
    ])
    expect(f.findCandidates).toHaveBeenCalledExactlyOnceWith('첫이름')
  })

  it.each([
    {
      name: '2위와의 차이가 minMargin과 같으면 확정',
      distances: { high: 13, low: 10 },
      confident: true
    },
    {
      name: '2위와의 차이가 minMargin보다 작으면 선택지와 함께 1위',
      distances: { high: 12.9, low: 10 },
      confident: false
    },
    {
      name: '1위 거리가 maxDistance와 같으면 확정',
      distances: { high: 50, low: 40 },
      confident: true
    },
    {
      name: '1위 거리가 maxDistance를 넘으면 선택지와 함께 1위',
      distances: { high: 50, low: 40.1 },
      confident: false
    }
  ] as const)('$name', async ({ distances, confident }) => {
    const f = fixture({ ...distances, null: 60 })

    const identified = await f.identify(f.input)

    expect(identified).toMatchObject({
      selectionMethod: 'portrait',
      candidate: { characterId: 'low' }
    })
    if (confident) {
      expect(identified).not.toHaveProperty('choices')
    } else {
      expect(
        identified.kind === 'matched' &&
          identified.choices?.map(({ characterId, face }) => ({ characterId, face }))
      ).toEqual([
        { characterId: 'high', face: faceOf('high') },
        { characterId: 'low', face: faceOf('low') },
        { characterId: 'null', face: faceOf('null') }
      ])
    }
    expect(f.scorePortrait).toHaveBeenCalledTimes(3)
    expect(f.getDetails).toHaveBeenCalledOnce()
  })

  it('후보 직업으로 아는 얼굴 위치를 비교 기준으로 넘기고 모르는 직업은 null로 넘긴다', async () => {
    const f = fixture()
    f.findCandidates.mockImplementation(async (nickname) => [
      { ...candidate('high', nickname, 100), jobName: '마법사(여)' },
      { ...candidate('low', nickname, 50), jobName: '다크나이트' },
      candidate('null', nickname, null)
    ])

    await f.identify(f.input)

    expect(f.scorePortrait.mock.calls.map(([input]) => input.anchor)).toEqual([
      { x: 85, y: 108 },
      null,
      null
    ])
  })

  it('비교하지 못한 후보의 얼굴 창은 직업별 얼굴 위치로 채우고 직업도 모르면 null로 둔다', async () => {
    const f = fixture({ high: 20 })
    f.findCandidates.mockImplementation(async (nickname) => [
      { ...candidate('high', nickname, 100), jobName: '아처' },
      candidate('low', nickname, 50),
      { ...candidate('null', nickname, null), jobName: '나이트' }
    ])

    const identified = await f.identify(f.input)

    expect(
      identified.kind === 'matched' &&
        identified.choices?.map(({ characterId, face }) => ({ characterId, face }))
    ).toEqual([
      { characterId: 'high', face: faceOf('high') },
      { characterId: 'low', face: null },
      { characterId: 'null', face: { x: 84, y: 101, width: 26, height: 26 } }
    ])
  })

  it('얼굴이 없어 비교하지 않은 선택지도 직업별 얼굴 위치를 얼굴 창으로 준다', async () => {
    const f = fixture()
    f.findCandidates.mockImplementation(async (nickname) => [
      { ...candidate('high', nickname, 100), jobName: '거너(남)' },
      candidate('low', nickname, 50)
    ])

    const identified = await f.identify({ ...f.input, portrait: null })

    expect(identified.kind === 'matched' && identified.choices?.map(({ face }) => face)).toEqual([
      { x: 85, y: 61, width: 26, height: 26 },
      null
    ])
  })

  it('거리가 같으면 명성이 앞선 후보를 고르고 선택지를 준다', async () => {
    const f = fixture({ high: 10, low: 10, null: 60 })

    const identified = await f.identify(f.input)

    expect(identified).toMatchObject({
      selectionMethod: 'portrait',
      candidate: { characterId: 'high' }
    })
    expect(
      identified.kind === 'matched' && identified.choices?.map(({ characterId }) => characterId)
    ).toEqual(['high', 'low', 'null'])
  })

  it('이미지를 받지 못한 후보가 있어도 남은 후보를 비교해 1위를 고르고 선택지를 준다', async () => {
    const f = fixture({ high: 20, low: 0, null: 5 })
    const loadImage = f.loadPortrait.getMockImplementation()!
    f.loadPortrait.mockImplementation(async (identity) => {
      if (identity.characterId === 'low') {
        return null
      }

      return loadImage(identity)
    })

    const identified = await f.identify(f.input)

    expect(identified).toMatchObject({
      selectionMethod: 'portrait',
      candidate: { characterId: 'null' }
    })
    expect(
      identified.kind === 'matched' &&
        identified.choices?.map(({ characterId, face }) => ({ characterId, face }))
    ).toEqual([
      { characterId: 'high', face: faceOf('high') },
      { characterId: 'low', face: null },
      { characterId: 'null', face: faceOf('null') }
    ])
    expect(f.loadPortrait).toHaveBeenCalledTimes(3)
    expect(f.calls).toEqual([
      'candidates:첫이름',
      'image:high',
      'score:high',
      'image:null',
      'score:null',
      'details:null'
    ])
  })

  it('minMargin이 0이면 거리가 같은 후보 중 명성이 앞선 후보를 얼굴로 선택한다', async () => {
    const f = fixture({ high: 30, low: 10, null: 10 })
    const identify = createCharacterIdentifier(f.services, { ...SELECTION, minMargin: 0 })

    expect(await identify(f.input)).toMatchObject({
      selectionMethod: 'portrait',
      candidate: { characterId: 'low' }
    })
  })

  it('점수를 만들지 못한 후보가 있으면 차이가 커도 확정하지 않고 선택지를 준다', async () => {
    const f = fixture({ high: 0, null: 30 })

    const identified = await f.identify(f.input)

    expect(identified).toMatchObject({
      selectionMethod: 'portrait',
      candidate: { characterId: 'high' }
    })
    expect(
      identified.kind === 'matched' &&
        identified.choices?.map(({ characterId, face }) => ({ characterId, face }))
    ).toEqual([
      { characterId: 'high', face: faceOf('high') },
      { characterId: 'low', face: null },
      { characterId: 'null', face: faceOf('null') }
    ])
  })

  it('점수를 하나도 만들지 못하면 최고 명성을 고르고 비교 범위 밖 후보까지 선택지로 준다', async () => {
    const f = fixture({})
    f.findCandidates.mockResolvedValueOnce([
      candidate('first', '첫이름', 400),
      candidate('second', '첫이름', 300),
      candidate('third', '첫이름', 200),
      candidate('fourth', '첫이름', 100)
    ])

    const identified = await f.identify(f.input)

    expect(identified).toMatchObject({
      selectionMethod: 'highest-fame',
      candidate: { characterId: 'first' }
    })
    expect(
      identified.kind === 'matched' && identified.choices?.map(({ characterId }) => characterId)
    ).toEqual(['first', 'second', 'third', 'fourth'])
    expect(f.loadPortrait).toHaveBeenCalledTimes(SELECTION.maxCandidates)
  })

  it('선택지는 후보의 저장된 모험단명을 옮긴다', async () => {
    const f = fixture({ high: 20, low: 19, null: 60 })
    f.findCandidates.mockResolvedValueOnce([
      { ...candidate('high', '첫이름', 100), adventureName: '합성모험단' },
      candidate('low', '첫이름', 50),
      candidate('null', '첫이름', null)
    ])

    const identified = await f.identify(f.input)

    expect(
      identified.kind === 'matched' &&
        identified.choices?.map(({ characterId, adventureName }) => ({
          characterId,
          adventureName
        }))
    ).toEqual([
      { characterId: 'high', adventureName: '합성모험단' },
      { characterId: 'low', adventureName: null },
      { characterId: 'null', adventureName: null }
    ])
  })

  it('명성 상위 maxCandidates명만 비교하고 그 밖의 후보는 이미지도 받지 않는다', async () => {
    const f = fixture({ first: 20, second: 30, third: 10, fourth: 0 })
    f.findCandidates.mockResolvedValueOnce([
      candidate('fourth', '첫이름', 10),
      candidate('first', '첫이름', 400),
      candidate('third', '첫이름', 200),
      candidate('second', '첫이름', 300)
    ])

    expect(await f.identify(f.input)).toMatchObject({
      selectionMethod: 'portrait',
      candidate: { characterId: 'third' }
    })
    expect(f.loadPortrait.mock.calls.map(([identity]) => identity.characterId)).toEqual([
      'first',
      'second',
      'third'
    ])
  })

  it('후보가 한 명이면 비교와 선택지 없이 그 후보를 최고 명성으로 표시한다', async () => {
    const f = fixture({ only: 0 })
    f.findCandidates.mockResolvedValueOnce([candidate('only', '첫이름', 100)])

    const identified = await f.identify(f.input)

    expect(identified).toMatchObject({
      selectionMethod: 'highest-fame',
      candidate: { characterId: 'only' }
    })
    expect(identified).not.toHaveProperty('choices')
    expect(f.calls).toEqual(['details:only'])
  })

  it('이미지 조회 오류는 대체 선택으로 바꾸지 않고 그대로 전달한다', async () => {
    const f = fixture()
    const error = new Error('rate limited')
    f.loadPortrait.mockRejectedValueOnce(error)

    await expect(f.identify(f.input)).rejects.toBe(error)
    expect(f.getDetails).not.toHaveBeenCalled()
  })

  it('이름 검색이 비어 있으면 둘째 이름이나 상세를 조회하지 않는다', async () => {
    const f = fixture()
    f.findCandidates.mockResolvedValueOnce([])

    expect(await f.identify(f.input)).toEqual({ kind: 'unmatched' })
    expect(f.findCandidates).toHaveBeenCalledExactlyOnceWith('첫이름')
    expect(f.getDetails).not.toHaveBeenCalled()
  })

  it.each([
    ['', '정상이름'],
    [' ', '정상이름'],
    ['x'.repeat(13), '정상이름'],
    ['\ud800', '정상이름'],
    []
  ])('잘못된 첫 후보 %j를 두 번째 후보로 대체하지 않는다', async (...nicknames) => {
    const f = fixture()

    expect(await f.identify({ ...f.input, nicknames })).toEqual({ kind: 'invalid-input' })
    expect(f.calls).toEqual([])
  })

  it('두 개를 초과한 입력은 조회 전에 거절한다', async () => {
    const f = fixture()

    expect(await f.identify({ nicknames: ['가', '나', '다'], portrait: null })).toEqual({
      kind: 'invalid-input'
    })
    expect(f.calls).toEqual([])
  })

  it.each([
    { fames: [null, 0, 100, 100], expected: '2' },
    { fames: [null, 0, null], expected: '1' },
    { fames: [null, null], expected: '0' }
  ])('명성 $fames를 정렬하고 동점은 원래 순서를 유지한다', async ({ fames, expected }) => {
    const f = fixture()
    f.findCandidates.mockResolvedValueOnce(
      fames.map((fame, index) => candidate(String(index), '첫이름', fame))
    )

    expect(await f.identify({ ...f.input, portrait: null })).toMatchObject({
      candidate: { characterId: expected },
      selectionMethod: 'highest-fame'
    })
  })

  it.each([
    { maxCandidates: 1 },
    { maxCandidates: 2.5 },
    { maxDistance: Number.NaN },
    { maxDistance: -1 },
    { minMargin: Number.POSITIVE_INFINITY },
    { minMargin: -0.1 }
  ])('잘못된 선택 기준 %o는 식별기를 만들기 전에 거절한다', (override) => {
    const f = fixture()

    expect(() => createCharacterIdentifier(f.services, { ...SELECTION, ...override })).toThrow(
      TypeError
    )
  })

  it('수동 조회는 선택한 서버와 원문 이름으로만 상세를 선택한다', async () => {
    const f = fixture()
    f.findCandidates.mockResolvedValueOnce([
      candidate('other-server', '첫이름', 100),
      { ...candidate('wrong-name', '다른이름', 90), serverId: 'siroco' },
      { ...candidate('chosen', '첫이름', 50), serverId: 'siroco' }
    ])
    const lookup = createManualCharacterLookup({
      findCandidates: f.findCandidates,
      getDetails: f.getDetails
    })

    expect(await lookup({ nickname: '첫이름', serverId: 'siroco' })).toMatchObject({
      candidate: { characterId: 'chosen' },
      selectionMethod: 'manual'
    })
    expect(f.getDetails).toHaveBeenCalledExactlyOnceWith({
      serverId: 'siroco',
      characterId: 'chosen'
    })
    expect(f.loadPortrait).not.toHaveBeenCalled()
  })

  it('지정한 서버에 없으면 다른 서버 캐릭터로 대체하지 않는다', async () => {
    const f = fixture()
    const lookup = createManualCharacterLookup({
      findCandidates: f.findCandidates,
      getDetails: f.getDetails
    })

    expect(await lookup({ nickname: '첫이름', serverId: 'siroco' })).toEqual({ kind: 'unmatched' })
    expect(f.getDetails).not.toHaveBeenCalled()
  })
})
