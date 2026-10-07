import { describe, expect, it, vi } from 'vitest'
import type { MockedFunction } from 'vitest'
import type {
  CharacterCandidate,
  CharacterDetails,
  CharacterPortrait
} from '../../preload/common/types/character'
import {
  createCharacterIdentifier,
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
  it('아직 크롭이 없으면 후보와 이미지를 조회하지 않는다', async () => {
    const f = fixture()

    expect(await f.identify({ ...f.input, portrait: null })).toEqual({
      kind: 'portrait-unavailable'
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
      kind: 'matched',
      candidate: candidate('null', '첫이름', null),
      details: details('null'),
      nickname: '첫이름'
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

  it('첫 이름이 전부 불일치일 때만 둘째 이름을 조회한다', async () => {
    const f = fixture()
    f.matchesPortrait
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true)

    expect(await f.identify(f.input)).toMatchObject({ kind: 'matched', nickname: '둘째이름' })
    expect(f.calls).toEqual([
      'candidates:첫이름',
      'image:high',
      'image:low',
      'image:null',
      'candidates:둘째이름',
      'image:high',
      'details:high'
    ])
  })

  it('한 후보의 자세들을 순서대로 비교하고 통과하면 다음 후보로 넘어가지 않는다', async () => {
    const f = fixture()
    const secondImage = { ...portrait.image, rgba: new Uint8Array([90, 80, 70, 255]) }
    f.loadPortraits.mockResolvedValueOnce([portrait.image, secondImage, portrait.image])
    f.matchesPortrait.mockResolvedValueOnce(false).mockResolvedValueOnce(true)

    expect(await f.identify(f.input)).toMatchObject({
      kind: 'matched',
      candidate: { characterId: 'high' }
    })
    expect(f.matchesPortrait.mock.calls.map(([input]) => input.candidate)).toEqual([
      portrait.image,
      secondImage
    ])
    expect(f.loadPortraits).toHaveBeenCalledExactlyOnceWith({
      serverId: 'cain',
      characterId: 'high'
    })
    expect(f.calls).toEqual(['candidates:첫이름', 'details:high'])
  })

  it.each([{ images: null }, { images: [] }])(
    '외형이 없으면 불일치로 취급하지 않고 식별을 보류한다: $images',
    async ({ images }) => {
      const f = fixture()
      f.loadPortraits.mockResolvedValueOnce(images)

      expect(await f.identify(f.input)).toEqual({ kind: 'appearance-unavailable' })
      expect(f.loadPortraits).toHaveBeenCalledExactlyOnceWith({
        serverId: 'cain',
        characterId: 'high'
      })
      expect(f.calls).toEqual(['candidates:첫이름'])
      expect(f.matchesPortrait).not.toHaveBeenCalled()
      expect(f.getDetails).not.toHaveBeenCalled()
    }
  )

  it('원문과 순위를 유지하고 같은 이름은 한 번만 조회한다', async () => {
    const f = fixture()
    f.findCandidates.mockResolvedValue([])

    expect(await f.identify({ ...f.input, nicknames: ['가+&', '가+&'] })).toEqual({
      kind: 'unmatched'
    })
    expect(f.findCandidates).toHaveBeenCalledExactlyOnceWith('가+&')
    expect(f.loadPortraits).not.toHaveBeenCalled()
    expect(f.getDetails).not.toHaveBeenCalled()
  })

  it.each([['', ' A'], ['x'.repeat(13), '\ud800'], []])(
    '검색할 수 없는 OCR 후보 %j는 보정하지 않고 제외한다',
    async (...nicknames) => {
      const f = fixture()

      expect(await f.identify({ ...f.input, nicknames })).toEqual({ kind: 'unmatched' })
      expect(f.calls).toEqual([])
    }
  )

  it('첫 OCR 후보가 비어 있어도 유효한 두 번째 원문은 조회한다', async () => {
    const f = fixture()
    f.findCandidates.mockResolvedValue([])

    await f.identify({ ...f.input, nicknames: ['', '가'] })

    expect(f.findCandidates).toHaveBeenCalledExactlyOnceWith('가')
  })

  it('두 개를 초과한 후보 입력은 크롭 유무와 무관하게 조회 전에 거절한다', async () => {
    const f = fixture()

    expect(await f.identify({ nicknames: ['가', '나', '다'], portrait: null })).toEqual({
      kind: 'invalid-input'
    })
    expect(f.calls).toEqual([])
  })
})
