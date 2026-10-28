import { describe, expect, it, vi } from 'vitest'
import type { CharacterCandidate, CharacterDetails } from '../../preload/common/types/character'
import {
  createCharacterCandidatesHttp,
  createCharacterDetailsHttp,
  type CharacterCandidatesHttp
} from './character-http'
import {
  createCachedCharacterCandidates,
  createCachedCharacterDetails
} from './character-response-cache'

vi.mock('electron', () => ({ session: { fromPartition: vi.fn() } }))

const API_ORIGIN = 'https://api.example.test'
const IMAGE_URL = 'https://img-api.neople.co.kr/df/servers/cain/characters/character-1?zoom=1'
const identity = { serverId: 'cain', characterId: 'character-1' }
const candidate: CharacterCandidate = {
  ...identity,
  characterName: '가나',
  serverName: '카인',
  fame: 71000,
  imageUrl: IMAGE_URL,
  adventureName: null,
  jobName: null,
  jobGrowName: null
}

function json(body: unknown, status = 200, headers?: HeadersInit): Response {
  return new Response(JSON.stringify(body), { status, headers })
}

function signal(): AbortSignal {
  return new AbortController().signal
}

function detail(): CharacterDetails {
  const metadata = {
    revision: 1,
    contentUpdatedAt: '2026-10-07T00:00:00.000Z',
    lastSuccessfulFetchAt: '2026-10-07T00:00:00.000Z'
  }
  const character = {
    ...identity,
    characterName: '가나',
    serverName: '카인',
    level: 115,
    jobName: '귀검사(남)',
    jobGrowName: '眞 웨펀마스터',
    fame: null,
    adventureName: '모험단',
    guildName: null
  }
  const sections = {
    basic: metadata,
    status: metadata,
    equipment: metadata,
    avatar: metadata,
    creature: metadata,
    oath: metadata,
    mist_assimilation: metadata,
    skill_style: metadata,
    buff_equipment: metadata,
    buff_avatar: metadata,
    buff_creature: metadata
  }

  return {
    character,
    status: { status: [{ name: '힘', value: 100 }], buff: null },
    equipment: {
      equipment: [{ itemId: 'item-1', seasonOptions: [false, { value: 0 }] }],
      setItemInfo: []
    },
    avatar: null,
    creature: { itemId: 'creature-1' },
    oath: [],
    mistAssimilation: null,
    skillStyle: { skill: { active: [] } },
    buff: { equipment: null, avatar: [], creature: null },
    sections,
    freshness: {
      lastSuccessfulFetchAt: '2026-10-07T00:00:00.000Z',
      expiresAt: '2026-10-07T00:05:00.000Z'
    }
  }
}

describe('완료한 캐릭터 응답 캐시', () => {
  it.each(['candidates', 'details'] as const)(
    '%s는 성공값을 복제해 5분간 재사용하고 만료 후 다시 요청한다',
    async (kind) => {
      let now = 0
      const time = vi.spyOn(performance, 'now').mockImplementation(() => now)
      const fetch = vi
        .fn<typeof globalThis.fetch>()
        .mockImplementation(async () =>
          json(kind === 'candidates' ? { rows: [candidate] } : detail())
        )
      const options = { apiOrigin: API_ORIGIN, fetch }
      const candidates = createCachedCharacterCandidates(createCharacterCandidatesHttp(options))
      const details = createCachedCharacterDetails(createCharacterDetailsHttp(options))
      const read = () => {
        if (kind === 'candidates') {
          return candidates({ nickname: '가나', signal: signal() })
        }

        return details({ ...identity, signal: signal() })
      }
      try {
        const original = kind === 'candidates' ? [candidate] : detail()
        const rename = (value: Awaited<ReturnType<typeof read>>) => {
          if (Array.isArray(value)) {
            Reflect.set(value[0], 'characterName', '변경')
          } else {
            Reflect.set((value as CharacterDetails).character, 'characterName', '변경')
          }
        }
        rename(await read())
        const cached = await read()
        expect(cached).toEqual(original)
        rename(cached)
        now = 299_999
        expect(await read()).toEqual(original)
        expect(fetch).toHaveBeenCalledOnce()
        now = 300_000
        await read()
        expect(fetch).toHaveBeenCalledTimes(2)
      } finally {
        time.mockRestore()
      }
    }
  )

  it.each(['candidates', 'details'] as const)('%s의 실패와 429는 저장하지 않는다', async (kind) => {
    const code = kind === 'details' ? 'CHARACTER_RATE_LIMITED' : 'SEARCH_RATE_LIMITED'
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValueOnce(json({ error: { code: 'NEOPLE_API_ERROR' } }, 502))
      .mockResolvedValueOnce(json({ error: { code } }, 429))
      .mockResolvedValueOnce(json(kind === 'candidates' ? { rows: [candidate] } : detail()))
    const options = { apiOrigin: API_ORIGIN, fetch }
    const candidates = createCachedCharacterCandidates(createCharacterCandidatesHttp(options))
    const details = createCachedCharacterDetails(createCharacterDetailsHttp(options))
    const read = () => {
      if (kind === 'candidates') {
        return candidates({ nickname: '가나', signal: signal() })
      }

      return details({ ...identity, signal: signal() })
    }
    await expect(read()).rejects.toMatchObject({ code: 'NEOPLE_API_ERROR' })
    await expect(read()).rejects.toMatchObject({ code: 'SEARCH_RATE_LIMITED' })
    await read()
    await read()
    expect(fetch).toHaveBeenCalledTimes(3)
  })

  it('동시 요청은 독립적으로 실행되고 취소된 늦은 결과는 성공 캐시를 덮지 않는다', async () => {
    const controller = new AbortController()
    let finish!: (value: readonly CharacterCandidate[]) => void
    const load = vi
      .fn<CharacterCandidatesHttp>()
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            finish = resolve
          })
      )
      .mockResolvedValueOnce([candidate])
    const read = createCachedCharacterCandidates(load)
    const cancelled = read({ nickname: '가나', signal: controller.signal })
    const failure = expect(cancelled).rejects.toMatchObject({ name: 'AbortError' })
    expect(await read({ nickname: '가나', signal: signal() })).toEqual([candidate])
    controller.abort()
    finish([{ ...candidate, characterName: '늦은 결과' }])
    await failure
    expect(await read({ nickname: '가나', signal: signal() })).toEqual([candidate])
    expect(load).toHaveBeenCalledTimes(2)
  })
})
