import { describe, expect, it, vi } from 'vitest'
import type { MockedFunction } from 'vitest'
import type {
  CharacterCandidate,
  CharacterDetails,
  CharacterPortrait
} from '../../preload/common/types/character'
import {
  createCharacterIdentifier,
  createManualCharacterLookup,
  type CharacterIdentificationInput,
  type IdentificationServices
} from './identify'

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
  calls: string[]
  findCandidates: MockedFunction<IdentificationServices['findCandidates']>
  loadPortraits: MockedFunction<IdentificationServices['loadPortraits']>
  matchesPortrait: MockedFunction<IdentificationServices['matchesPortrait']>
  getDetails: MockedFunction<IdentificationServices['getDetails']>
  identify: ReturnType<typeof createCharacterIdentifier>
  input: CharacterIdentificationInput
} {
  const calls: string[] = []
  const findCandidates = vi.fn<IdentificationServices['findCandidates']>(async (nickname) => {
    calls.push(`candidates:${nickname}`)

    return [
      candidate('high', nickname, 100),
      candidate('low', nickname, 50),
      candidate('null', nickname, null)
    ]
  })
  const loadPortraits = vi.fn<IdentificationServices['loadPortraits']>(async ({ characterId }) => {
    calls.push(`image:${characterId}`)

    return [portrait.image]
  })
  const matchesPortrait = vi.fn<IdentificationServices['matchesPortrait']>(async () => false)
  const getDetails = vi.fn<IdentificationServices['getDetails']>(async ({ characterId }) => {
    calls.push(`details:${characterId}`)

    return details(characterId)
  })
  const identify = createCharacterIdentifier({
    findCandidates,
    loadPortraits,
    matchesPortrait,
    getDetails
  })
  const input: CharacterIdentificationInput = { nicknames: ['첫이름', '둘째이름'], portrait }

  return { calls, findCandidates, loadPortraits, matchesPortrait, getDetails, identify, input }
}

describe('캐릭터 식별 규칙', () => {
  it('얼굴이 없으면 첫 이름을 조회하고 최고 명성으로 표시한다', async () => {
    const f = fixture()

    expect(await f.identify({ ...f.input, portrait: null })).toMatchObject({
      kind: 'matched',
      selectionMethod: 'highest-fame',
      candidate: { characterId: 'high' }
    })
    expect(f.calls).toEqual(['candidates:첫이름', 'details:high'])
    expect(f.matchesPortrait).not.toHaveBeenCalled()
  })

  it('첫 이름의 null 명성 후보까지 비교한 뒤 첫 일치에서 멈춘다', async () => {
    const f = fixture()
    f.matchesPortrait
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true)

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
      'image:low',
      'image:null',
      'details:null'
    ])
    expect(f.getDetails).toHaveBeenCalledOnce()
  })

  it('전부 불일치이면 둘째 이름을 조회하지 않고 첫 이름의 최고 명성을 표시한다', async () => {
    const f = fixture()

    expect(await f.identify(f.input)).toMatchObject({
      kind: 'matched',
      nickname: '첫이름',
      selectionMethod: 'highest-fame',
      candidate: { characterId: 'high' }
    })
    expect(f.calls).toEqual([
      'candidates:첫이름',
      'image:high',
      'image:low',
      'image:null',
      'details:high'
    ])
    expect(f.findCandidates).toHaveBeenCalledExactlyOnceWith('첫이름')
  })

  it('한 후보의 자세들을 순서대로 비교하고 통과하면 다음 후보로 넘어가지 않는다', async () => {
    const f = fixture()
    const secondImage = { ...portrait.image, rgba: new Uint8Array([90, 80, 70, 255]) }
    f.loadPortraits.mockResolvedValueOnce([portrait.image, secondImage, portrait.image])
    f.matchesPortrait.mockResolvedValueOnce(false).mockResolvedValueOnce(true)

    expect(await f.identify(f.input)).toMatchObject({
      kind: 'matched',
      selectionMethod: 'portrait',
      candidate: { characterId: 'high' }
    })
    expect(f.matchesPortrait.mock.calls.map(([input]) => input.candidate)).toEqual([
      portrait.image,
      secondImage
    ])
    expect(f.loadPortraits).toHaveBeenCalledOnce()
  })

  it.each([{ images: null }, { images: [] }])(
    '외형 $images이면 비교 순서를 건너뛰어 확정하지 않고 최고 명성으로 표시한다',
    async ({ images }) => {
      const f = fixture()
      f.loadPortraits.mockResolvedValueOnce(images)

      expect(await f.identify(f.input)).toMatchObject({
        kind: 'matched',
        selectionMethod: 'highest-fame',
        candidate: { characterId: 'high' }
      })
      expect(f.loadPortraits).toHaveBeenCalledOnce()
      expect(f.matchesPortrait).not.toHaveBeenCalled()
    }
  )

  it('비교가 불가능하면 다음 후보로 넘어가지 않고 최고 명성으로 표시한다', async () => {
    const f = fixture()
    f.matchesPortrait.mockResolvedValueOnce(null)

    expect(await f.identify(f.input)).toMatchObject({
      kind: 'matched',
      selectionMethod: 'highest-fame',
      candidate: { characterId: 'high' }
    })
    expect(f.loadPortraits).toHaveBeenCalledOnce()
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
    expect(f.loadPortraits).not.toHaveBeenCalled()
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
