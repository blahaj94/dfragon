import { PNG } from 'pngjs'
import { expect, it } from 'vitest'
import { INITIAL_PORTRAIT_EDGE_POLICY } from './portrait-policy'
import { candidate, createSearchFixture, jsonResponse } from './search-test-fixture'
import type { CharacterDetails, CharacterPortrait } from '../../preload/common/types/character'
import { API_ORIGIN } from '../auth/auth-test-fixtures'

function portrait(): CharacterPortrait {
  const width = 14
  const height = 14
  const rgba = new Uint8Array(width * height * 4)
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const value = 20 + x * 15
      rgba.set([value, value, value, 255], (y * width + x) * 4)
    }
  }
  const image = { width, height, rgba }

  return { image, rasterScale: 1 }
}

function details(): CharacterDetails {
  const metadata = {
    revision: 1,
    contentUpdatedAt: '2026-10-07T00:00:00.000Z',
    lastSuccessfulFetchAt: '2026-10-07T00:00:00.000Z'
  }
  const sections = Object.fromEntries(
    [
      'basic',
      'status',
      'equipment',
      'avatar',
      'creature',
      'oath',
      'mist_assimilation',
      'skill_style',
      'buff_equipment',
      'buff_avatar',
      'buff_creature'
    ].map((name) => [name, metadata])
  )

  return {
    character: { ...candidate, fame: 71000, jobName: '프리스트(남)', jobGrowName: '眞 크루세이더' },
    status: { status: [], buff: null },
    equipment: { equipment: [], setItemInfo: [] },
    avatar: null,
    creature: null,
    oath: null,
    mistAssimilation: null,
    skillStyle: null,
    buff: { equipment: null, avatar: null, creature: null },
    sections,
    freshness: {
      lastSuccessfulFetchAt: '2026-10-07T00:00:00.000Z',
      expiresAt: '2026-10-07T00:05:00.000Z'
    }
  }
}

it.each([false, true])(
  'Stay 외형부터 선택 상세까지 연결한다, 지원하지 않는 직업=%s',
  async (unsupported) => {
    const fixture = await createSearchFixture(
      false,
      'capture',
      undefined,
      undefined,
      INITIAL_PORTRAIT_EDGE_POLICY
    )
    const calls: string[] = []
    fixture.fetchSearch.mockImplementation(async (request, options) => {
      const input = request instanceof Request ? request : new Request(request, options)
      const url = new URL(input.url)
      calls.push(`${url.origin}${url.pathname}`)
      expect(input.headers.has('authorization')).toBe(false)
      expect(input.headers.has('cookie')).toBe(false)
      expect(input.headers.has('apikey')).toBe(false)
      if (url.pathname === '/characters/candidates') {
        return jsonResponse({
          body: {
            rows: [
              {
                ...candidate,
                imageUrl: `https://img-api.neople.co.kr/df/servers/cain/characters/${candidate.characterId}?zoom=1`
              }
            ]
          }
        })
      }

      if (url.pathname === `/characters/cain/${candidate.characterId}/appearance`) {
        return jsonResponse({
          body: {
            serverId: 'cain',
            characterId: candidate.characterId,
            characterName: candidate.characterName,
            jobName: unsupported ? '지원 외 직업' : '프리스트(남)',
            jobGrowName: '眞 크루세이더',
            avatar: []
          }
        })
      }

      if (url.origin === 'https://bbscdn.df.nexon.com') {
        expect(url.pathname).toBe('/data7/showroom/static/json/4_animation.json')

        return jsonResponse({ body: { job: 4, animation_list: ['Stand', 'Stay.1'] } })
      }

      if (url.origin === 'https://avatarsync.df.nexon.com') {
        const wear: unknown = JSON.parse(url.searchParams.get('wearInfo')!)
        expect(wear).toMatchObject({ job: '4', grow: '0', level: 0, animation: 'Stay.1' })
        const source = portrait().image
        const image = new PNG({ width: source.width, height: source.height })
        image.data = Buffer.from(source.rgba)
        const bytes = new Uint8Array(PNG.sync.write(image))

        return new Response(bytes, { headers: { 'Content-Type': 'image/png' } })
      }
      expect(url.pathname).toBe(`/characters/cain/${candidate.characterId}`)

      return jsonResponse({ body: details() })
    })
    await fixture.invoke('notifyOcrCandidatesDetected', {
      captureId: fixture.captureId,
      slot: 0,
      observationRevision: 1,
      nickname: candidate.characterName,
      candidateNicknames: [candidate.characterName],
      portrait: portrait()
    })
    const expectedState = unsupported ? 'failure' : 'success'
    await expect.poll(async () => (await fixture.read()).slots[0].state).toBe(expectedState)
    const slot = (await fixture.read()).slots[0]
    const origin = API_ORIGIN
    const expectedCalls = [
      `${origin}/characters/candidates`,
      `${origin}/characters/cain/${candidate.characterId}/appearance`
    ]
    if (unsupported) {
      expect(slot.error).toMatchObject({ code: 'SEARCH_APPEARANCE_UNAVAILABLE' })
      expect(slot.selected).toBeUndefined()
    } else {
      expectedCalls.push(
        'https://bbscdn.df.nexon.com/data7/showroom/static/json/4_animation.json',
        'https://avatarsync.df.nexon.com/wear/image/stand@1x.png',
        `${origin}/characters/cain/${candidate.characterId}`
      )
      expect(slot.selected).toMatchObject({ characterId: candidate.characterId, fame: 71000 })
    }
    expect(calls).toEqual(expectedCalls)
  }
)
