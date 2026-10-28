import { PNG } from 'pngjs'
import { expect, it, vi } from 'vitest'
import { INITIAL_PORTRAIT_COLOR_POLICY } from './portrait-policy'
import { candidate, createSearchFixture, jsonResponse } from './search-test-fixture'
import { parseSearchSnapshot } from '../../preload/common/search/snapshot'
import type {
  CharacterCandidate,
  CharacterDetails,
  CharacterImage,
  CharacterPortrait
} from '../../preload/common/types/character'
import { deferred, type Deferred } from '../lib/async-test-fixture'
import { API_ORIGIN } from './search-test-fixture'

const IMAGE_ORIGIN = 'https://img-api.neople.co.kr'
const FACE_SIZE = 16
const SHOWROOM_URL_PATTERN = /showroom|df\.nexon\.com/

function face(): CharacterImage {
  const rgba = new Uint8Array(FACE_SIZE * FACE_SIZE * 4)
  for (let y = 0; y < FACE_SIZE; y += 1) {
    for (let x = 0; x < FACE_SIZE; x += 1) {
      rgba.set([20 + x * 12, 40 + y * 10, 90, 255], (y * FACE_SIZE + x) * 4)
    }
  }

  return { width: FACE_SIZE, height: FACE_SIZE, rgba }
}

function otherFace(): CharacterImage {
  const rgba = new Uint8Array(FACE_SIZE * FACE_SIZE * 4)
  for (let pixel = 0; pixel < FACE_SIZE * FACE_SIZE; pixel += 1) {
    rgba.set([240, 10, 240, 255], pixel * 4)
  }

  return { width: FACE_SIZE, height: FACE_SIZE, rgba }
}

function portrait(): CharacterPortrait {
  return { image: face(), rasterScale: 1 }
}

function pngResponse(image: CharacterImage): Response {
  const png = new PNG({ width: image.width, height: image.height })
  png.data = Buffer.from(image.rgba)

  return new Response(new Uint8Array(PNG.sync.write(png)), {
    headers: { 'Content-Type': 'image/png' }
  })
}

function row(characterId: string, characterName: string, fame: number): CharacterCandidate {
  return {
    ...candidate,
    characterId,
    characterName,
    fame,
    imageUrl: `${IMAGE_ORIGIN}/df/servers/cain/characters/${characterId}?zoom=1`,
    adventureName: null,
    jobName: null,
    jobGrowName: null
  }
}

function detailsOf(character: CharacterCandidate): CharacterDetails {
  const { imageUrl: _imageUrl, ...identity } = character
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
    character: identity,
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

// 얼굴이 같은 후보가 명성 2위라 명성 대체가 아닌 얼굴 선택이어야 이 후보가 고른 결과가 된다.
const slots = [
  { nickname: '가나', rows: [row('slot0-other', '가나', 90000), row('slot0-match', '가나', 1000)] },
  { nickname: '다라', rows: [row('slot1-other', '다라', 90000), row('slot1-match', '다라', 1000)] }
]

it('얼굴 색 비교 식별은 API origin과 img-api만 credential 없이 부르고 쇼룸 주소는 부르지 않는다', async () => {
  const fixture = await createSearchFixture('capture', INITIAL_PORTRAIT_COLOR_POLICY)
  const calls: string[] = []
  const { nickname, rows } = slots[0]
  fixture.fetchSearch.mockImplementation(async (input, init) => {
    const request = new Request(input, init)
    const url = new URL(request.url)
    calls.push(`${url.origin}${url.pathname}`)
    expect(request.headers.has('authorization')).toBe(false)
    expect(request.headers.has('cookie')).toBe(false)
    expect(request.headers.has('apikey')).toBe(false)
    if (url.pathname === '/characters/candidates') {
      return jsonResponse({ body: { rows } })
    }

    if (url.origin === IMAGE_ORIGIN) {
      return pngResponse(url.pathname.endsWith('/slot0-match') ? face() : otherFace())
    }

    return jsonResponse({ body: detailsOf(rows[1]) })
  })

  await fixture.invoke('notifyOcrCandidatesDetected', {
    captureId: fixture.captureId,
    slot: 0,
    observationRevision: 1,
    nickname,
    candidateNicknames: [nickname],
    portrait: portrait()
  })

  await expect.poll(async () => (await fixture.read()).slots[0].state).toBe('success')
  const slot = (await fixture.read()).slots[0]
  expect(slot.selectionMethod).toBe('portrait')
  expect(slot.selected).toMatchObject({ characterId: 'slot0-match' })
  expect(calls).toEqual([
    `${API_ORIGIN}/characters/candidates`,
    `${IMAGE_ORIGIN}/df/servers/cain/characters/slot0-other`,
    `${IMAGE_ORIGIN}/df/servers/cain/characters/slot0-match`,
    `${API_ORIGIN}/characters/cain/slot0-match`
  ])
  const origins = new Set(calls.map((call) => new URL(call).origin))
  expect([...origins].sort()).toEqual([API_ORIGIN, IMAGE_ORIGIN].sort())
  expect(calls.some((call) => SHOWROOM_URL_PATTERN.test(call))).toBe(false)
})

// 두 후보의 이미지가 같아 거리가 같으므로 margin 0으로 확정하지 못하고 명성이 앞선 후보가 1위다.
it('외형이 같은 후보로 확정하지 못하면 1위와 함께 모험단과 얼굴 창을 담은 후보를 renderer에 보낸다', async () => {
  const fixture = await createSearchFixture('capture', INITIAL_PORTRAIT_COLOR_POLICY)
  const { nickname } = slots[0]
  const rows = [
    { ...row('slot0-other', nickname, 90000), adventureName: '합성모험단' },
    row('slot0-match', nickname, 1000)
  ]
  fixture.fetchSearch.mockImplementation(async (input, init) => {
    const url = new URL(new Request(input, init).url)
    if (url.pathname === '/characters/candidates') {
      return jsonResponse({ body: { rows } })
    }

    if (url.origin === IMAGE_ORIGIN) {
      return pngResponse(face())
    }

    return jsonResponse({ body: detailsOf(rows[0]) })
  })

  await fixture.invoke('notifyOcrCandidatesDetected', {
    captureId: fixture.captureId,
    slot: 0,
    observationRevision: 1,
    nickname,
    candidateNicknames: [nickname],
    portrait: portrait()
  })

  await expect.poll(async () => (await fixture.read()).slots[0].state).toBe('success')
  const snapshot = await fixture.read()
  const slot = snapshot.slots[0]
  expect(slot.selectionMethod).toBe('portrait')
  expect(slot.selected).toMatchObject({ characterId: 'slot0-other' })
  expect(
    slot.choices?.map(({ characterId, adventureName }) => ({ characterId, adventureName }))
  ).toEqual([
    { characterId: 'slot0-other', adventureName: '합성모험단' },
    { characterId: 'slot0-match', adventureName: null }
  ])
  expect(slot.choices?.every((choice) => choice.face !== null)).toBe(true)
  expect(parseSearchSnapshot(snapshot)).toEqual(snapshot)
})

it('두 슬롯의 후보 이미지는 앞 요청이 끝난 뒤에야 다음 요청을 시작한다', async () => {
  const fixture = await createSearchFixture('capture', INITIAL_PORTRAIT_COLOR_POLICY)
  const pendingImages: Array<{ characterId: string; response: Deferred<Response> }> = []
  let active = 0
  let maxActive = 0
  fixture.fetchSearch.mockImplementation(async (input, init) => {
    const request = new Request(input, init)
    const url = new URL(request.url)
    if (url.pathname === '/characters/candidates') {
      const nickname = url.searchParams.get('characterName')
      const slot = slots.find((entry) => entry.nickname === nickname)!

      return jsonResponse({ body: { rows: slot.rows } })
    }

    if (url.origin === IMAGE_ORIGIN) {
      active += 1
      maxActive = Math.max(maxActive, active)
      const response = deferred<Response>()
      pendingImages.push({ characterId: url.pathname.split('/').at(-1)!, response })

      return response.promise
    }
    const characterId = url.pathname.split('/').at(-1)
    const selected = slots
      .flatMap((entry) => entry.rows)
      .find((entry) => entry.characterId === characterId)!

    return jsonResponse({ body: detailsOf(selected) })
  })

  for (const [slot, { nickname }] of slots.entries()) {
    await fixture.invoke('notifyOcrCandidatesDetected', {
      captureId: fixture.captureId,
      slot,
      observationRevision: 1,
      nickname,
      candidateNicknames: [nickname],
      portrait: portrait()
    })
  }

  const imageCount = slots.flatMap((entry) => entry.rows).length
  for (let started = 1; started <= imageCount; started += 1) {
    await vi.waitFor(() => expect(pendingImages).toHaveLength(started))
    await new Promise<void>((resolve) => setImmediate(resolve))
    expect(pendingImages).toHaveLength(started)
    const current = pendingImages[started - 1]
    active -= 1
    current.response.resolve(
      pngResponse(current.characterId.endsWith('-match') ? face() : otherFace())
    )
  }

  await vi.waitFor(async () => {
    const snapshot = await fixture.read()
    expect(snapshot.slots.slice(0, 2).map((slot) => slot.state)).toEqual(['success', 'success'])
  })
  const snapshot = await fixture.read()
  expect(maxActive).toBe(1)
  expect(new Set(pendingImages.map((entry) => entry.characterId))).toEqual(
    new Set(['slot0-other', 'slot0-match', 'slot1-other', 'slot1-match'])
  )
  expect(snapshot.slots[0]).toMatchObject({
    selectionMethod: 'portrait',
    selected: { characterId: 'slot0-match' }
  })
  expect(snapshot.slots[1]).toMatchObject({
    selectionMethod: 'portrait',
    selected: { characterId: 'slot1-match' }
  })
})

it.each([
  ['색 비교 gridSize', { gridSize: 0 }],
  ['선택 maxCandidates', { maxCandidates: 1 }],
  ['선택 minMargin', { minMargin: -1 }]
] as const)('잘못된 %s 정책은 요청 전에 등록에서 거절한다', async (_name, change) => {
  await expect(
    createSearchFixture('capture', { ...INITIAL_PORTRAIT_COLOR_POLICY, ...change })
  ).rejects.toThrow(TypeError)
})
