import { PNG } from 'pngjs'
import { afterEach, expect, it, vi } from 'vitest'
import type { CharacterAppearance } from '../../preload/common/types/appearance'
import type { CharacterAppearanceHttp } from './character-http'
import { createStayImageSource } from './stay-images'

vi.mock('electron', () => ({ session: { fromPartition: vi.fn() } }))
afterEach(() => vi.restoreAllMocks())

const identity = { serverId: 'cain', characterId: 'character-1' }
const baseAppearance: CharacterAppearance = {
  ...identity,
  characterName: '가나',
  jobName: '귀검사(남)',
  jobGrowName: '眞 웨펀마스터',
  avatar: [
    {
      slotId: 'HAIR',
      itemId: 'hair-1',
      itemName: '기본 머리',
      clone: { itemId: null, itemName: null }
    }
  ]
}
const catalog = [{ name: '기본 머리', index: 'hair1', icon: 'hair/1.png', extra: 'discard' }]

function pngResponse(width = 2, height = 1): Response {
  const png = new PNG({ width, height })
  png.data.set([12, 24, 36, 255, 48, 60, 72, 0])
  const bytes = new Uint8Array(PNG.sync.write(png))

  return new Response(bytes, { headers: { 'Content-Type': 'image/png' } })
}

function fixture(body: CharacterAppearance = baseAppearance): {
  appearance: ReturnType<typeof vi.fn<CharacterAppearanceHttp>>
  transport: ReturnType<typeof vi.fn<typeof fetch>>
} {
  const appearance = vi.fn<CharacterAppearanceHttp>().mockResolvedValue(body)
  const transport = vi.fn<typeof fetch>().mockImplementation(async (input, init) => {
    const request = new Request(input, init)
    const url = new URL(request.url)
    if (url.hostname === 'avatarsync.df.nexon.com') {
      return pngResponse()
    }

    if (url.pathname.endsWith('_animation.json')) {
      const job = Number(url.pathname.split('/').at(-1)!.split('_')[0])

      return Response.json({ job, animation_list: ['Stand', 'Stay.0'] })
    }

    return Response.json(catalog)
  })

  return { appearance, transport }
}

it('공식 외형과 catalog에서 Stay 이미지를 만들고 고정 origin 밖으로 요청하지 않는다', async () => {
  const { appearance, transport } = fixture()
  const source = createStayImageSource({ appearance, fetch: transport })
  const controller = new AbortController()

  const result = await source({ ...identity, signal: controller.signal })

  expect(result).toEqual({
    kind: 'ready',
    images: [{ width: 2, height: 1, rgba: new Uint8Array([12, 24, 36, 255, 48, 60, 72, 0]) }]
  })
  expect(appearance).toHaveBeenCalledWith({ ...identity, signal: controller.signal })
  const requests = transport.mock.calls.map((args) => new Request(...args))
  expect(requests.map((request) => new URL(request.url).origin)).toEqual([
    'https://bbscdn.df.nexon.com',
    'https://bbscdn.df.nexon.com',
    'https://avatarsync.df.nexon.com'
  ])
  for (const request of requests) {
    expect(request.headers.get('Authorization')).toBeNull()
    expect(request.headers.get('apikey')).toBeNull()
    expect(request.credentials).toBe('omit')
    expect(request.redirect).toBe('error')
  }
  const render = new URL(requests.at(-1)!.url)
  expect(render.pathname).toBe('/wear/image/stand@1x.png')
  expect([...render.searchParams.keys()]).toEqual(['wearInfo'])
  expect(JSON.parse(render.searchParams.get('wearInfo')!)).toEqual({
    job: '0',
    grow: '0',
    level: 0,
    hair: { index: 'hair1', color: 0 },
    cap: null,
    face: null,
    neck: null,
    coat: null,
    belt: null,
    pants: null,
    shoes: null,
    skin: null,
    weapon1: null,
    package: null,
    animation: 'Stay.0'
  })
})

it('성공 catalog와 render만 재사용하고 render TTL 이후 다시 받는다', async () => {
  let now = 0
  vi.spyOn(performance, 'now').mockImplementation(() => now)
  const { appearance, transport } = fixture()
  const source = createStayImageSource({ appearance, fetch: transport })
  const request = { ...identity, signal: new AbortController().signal }
  await source(request)
  await source(request)
  expect(transport).toHaveBeenCalledTimes(3)
  expect(appearance).toHaveBeenCalledTimes(2)

  now = 5 * 60_000
  await source(request)
  expect(transport).toHaveBeenCalledTimes(4)
  now = 30 * 60_000
  await source(request)
  expect(transport).toHaveBeenCalledTimes(7)
})

it('성공 render 캐시 항목 수가 넘치면 오래된 항목부터 다시 받는다', async () => {
  const { appearance, transport } = fixture()
  const rows = Array.from({ length: 65 }, (_, index) => ({
    name: `머리${index}`,
    index: `hair${index}`,
    icon: `hair/${index}.png`
  }))
  const fallback = transport.getMockImplementation()!
  transport.mockImplementation(async (input, init) => {
    const request = new Request(input, init)
    if (new URL(request.url).pathname.endsWith('_hair.json')) {
      return Response.json(rows)
    }

    return fallback(input, init)
  })
  const source = createStayImageSource({ appearance, fetch: transport })
  const request = { ...identity, signal: new AbortController().signal }
  for (const row of rows) {
    appearance.mockResolvedValueOnce({
      ...baseAppearance,
      avatar: [{ ...baseAppearance.avatar[0], itemName: row.name }]
    })
    await source(request)
  }
  expect(transport).toHaveBeenCalledTimes(67)
  appearance.mockResolvedValueOnce({
    ...baseAppearance,
    avatar: [{ ...baseAppearance.avatar[0], itemName: rows[0].name }]
  })
  await source(request)
  expect(transport).toHaveBeenCalledTimes(68)
})

it('catalog 429는 Retry-After와 수신 시각을 전달하고 실패값은 캐시하지 않는다', async () => {
  vi.spyOn(performance, 'now').mockReturnValue(1234)
  const { appearance, transport } = fixture()
  transport.mockResolvedValueOnce(
    new Response('rate limited', { status: 429, headers: { 'Retry-After': '8' } })
  )
  const source = createStayImageSource({ appearance, fetch: transport })
  const request = { ...identity, signal: new AbortController().signal }

  await expect(source(request)).rejects.toMatchObject({
    code: 'SEARCH_RATE_LIMITED',
    retryAfterSeconds: 8,
    retryAfterReceivedAt: 1234
  })
  expect(transport).toHaveBeenCalledOnce()
  expect((await source(request)).kind).toBe('ready')
  expect(transport).toHaveBeenCalledTimes(4)
})

it.each([
  { name: '잘못된 catalog 배열', response: () => Response.json({ rows: catalog }) },
  { name: '잘못된 index', response: () => Response.json([{ ...catalog[0], index: '../hair1' }]) },
  { name: '잘못된 JSON', response: () => new Response('{') },
  { name: '본문 한도 초과', response: () => new Response(new Uint8Array(4 * 1024 * 1024 + 1)) }
])('$name 오류를 외형 미지원으로 숨기지 않는다', async ({ response }) => {
  const { appearance, transport } = fixture()
  transport.mockResolvedValueOnce(response())
  const source = createStayImageSource({ appearance, fetch: transport })

  await expect(source({ ...identity, signal: new AbortController().signal })).rejects.toMatchObject(
    { code: 'SEARCH_RESPONSE_INVALID' }
  )
  expect(transport).toHaveBeenCalledOnce()
})

it('한 소비자의 catalog 취소가 다른 소비자의 요청을 취소하지 않는다', async () => {
  const first = new AbortController()
  const cancel = vi.fn()
  const pull = vi.fn()
  const body = new ReadableStream<Uint8Array>({ pull, cancel }, { highWaterMark: 0 })
  const { appearance, transport } = fixture()
  transport.mockResolvedValueOnce(new Response(body))
  const source = createStayImageSource({ appearance, fetch: transport })
  const firstRequest = source({ ...identity, signal: first.signal })
  const failure = expect(firstRequest).rejects.toMatchObject({ name: 'AbortError' })
  await vi.waitFor(() => expect(pull).toHaveBeenCalledOnce())
  const secondRequest = source({ ...identity, signal: new AbortController().signal })
  first.abort()

  await failure
  expect((await secondRequest).kind).toBe('ready')
  expect(cancel).toHaveBeenCalledOnce()
})

it('render의 잘못된 PNG를 실패로 전파하고 성공 cache에 넣지 않는다', async () => {
  const { appearance, transport } = fixture()
  const fallback = transport.getMockImplementation()!
  let corrupt = true
  transport.mockImplementation(async (input, init) => {
    const request = new Request(input, init)
    if (new URL(request.url).hostname === 'avatarsync.df.nexon.com' && corrupt) {
      return new Response(new Uint8Array([1, 2, 3]), { headers: { 'Content-Type': 'image/png' } })
    }

    return fallback(input, init)
  })
  const source = createStayImageSource({ appearance, fetch: transport })
  const request = { ...identity, signal: new AbortController().signal }

  await expect(source(request)).rejects.toMatchObject({ code: 'SEARCH_RESPONSE_INVALID' })
  corrupt = false
  expect((await source(request)).kind).toBe('ready')
  expect(transport).toHaveBeenCalledTimes(4)
})

it('동일 이름과 icon의 여러 index는 catalog 첫 항목을 사용한다', async () => {
  const { appearance, transport } = fixture()
  transport.mockResolvedValueOnce(
    Response.json([
      { name: ' 기본 머리 ', index: 'first-index', icon: 'hair/1.png' },
      { name: '기본 머리', index: 'second-index', icon: 'hair/1.png' }
    ])
  )
  const source = createStayImageSource({ appearance, fetch: transport })

  expect((await source({ ...identity, signal: new AbortController().signal })).kind).toBe('ready')
  const render = new URL(new Request(...transport.mock.calls.at(-1)!).url)
  expect(JSON.parse(render.searchParams.get('wearInfo')!).hair).toEqual({
    index: 'first-index',
    color: 0
  })
})

it.each(['hair/2.png', '', null, undefined, 42, '../hair/1.png', 'hair/1.png\n'])(
  '동명 후보의 다른 또는 잘못된 icon %j는 임의 선택하지 않는다',
  async (icon) => {
    const { appearance, transport } = fixture()
    transport.mockResolvedValueOnce(
      Response.json([catalog[0], { ...catalog[0], index: 'other', icon }])
    )
    const source = createStayImageSource({ appearance, fetch: transport })

    expect(await source({ ...identity, signal: new AbortController().signal })).toEqual({
      kind: 'unavailable',
      reason: 'ambiguous-avatar'
    })
    expect(transport).toHaveBeenCalledOnce()
  }
)

it('원래 아이템보다 완전한 clone 이름의 catalog 외형을 우선한다', async () => {
  const body: CharacterAppearance = {
    ...baseAppearance,
    avatar: [
      {
        ...baseAppearance.avatar[0],
        itemName: '다른 원본 머리',
        clone: { itemId: 'cloned', itemName: '기본 머리' }
      }
    ]
  }
  const { appearance, transport } = fixture(body)
  const source = createStayImageSource({ appearance, fetch: transport })

  expect((await source({ ...identity, signal: new AbortController().signal })).kind).toBe('ready')
})

it.each([
  { slotId: 'HAIR', itemName: '레어 머리 클론 아바타', part: 'hair' },
  { slotId: 'WEAPON', itemName: '무기 클론 아바타', part: 'weapon1' }
])(
  '지원한 빈 $slotId clone은 이름 조회 후 기본 외형을 사용한다',
  async ({ slotId, itemName, part }) => {
    const body = { ...baseAppearance, avatar: [{ ...baseAppearance.avatar[0], slotId, itemName }] }
    const { appearance, transport } = fixture(body)
    transport.mockResolvedValueOnce(Response.json([]))
    const source = createStayImageSource({ appearance, fetch: transport })

    expect((await source({ ...identity, signal: new AbortController().signal })).kind).toBe('ready')
    const render = new URL(new Request(...transport.mock.calls.at(-1)!).url)
    expect(JSON.parse(render.searchParams.get('wearInfo')!)[part]).toBeNull()
  }
)

it('알려지지 않은 아바타 이름은 불일치로 바꾸지 않는다', async () => {
  const { appearance, transport } = fixture()
  transport.mockResolvedValueOnce(Response.json([]))
  const source = createStayImageSource({ appearance, fetch: transport })

  expect(await source({ ...identity, signal: new AbortController().signal })).toEqual({
    kind: 'unavailable',
    reason: 'unknown-avatar'
  })
  expect(transport).toHaveBeenCalledOnce()
})

it.each(['AURORA', 'AURA_SKIN'])(
  '얼굴 범위 밖의 %s 슬롯은 catalog를 요청하지 않는다',
  async (slotId) => {
    const body = { ...baseAppearance, avatar: [{ ...baseAppearance.avatar[0], slotId }] }
    const { appearance, transport } = fixture(body)
    const source = createStayImageSource({ appearance, fetch: transport })

    expect((await source({ ...identity, signal: new AbortController().signal })).kind).toBe('ready')
    expect(transport).toHaveBeenCalledTimes(2)
    expect(new Request(...transport.mock.calls[0]).url).toBe(
      'https://bbscdn.df.nexon.com/data7/showroom/static/json/0_animation.json'
    )
  }
)

it('모르는 직업과 슬롯은 쇼룸 요청 전에 지원 불가로 반환한다', async () => {
  const { appearance, transport } = fixture()
  appearance
    .mockResolvedValueOnce({ ...baseAppearance, jobName: '../unknown' })
    .mockResolvedValueOnce({
      ...baseAppearance,
      avatar: [{ ...baseAppearance.avatar[0], slotId: 'UNKNOWN' }]
    })
  const source = createStayImageSource({ appearance, fetch: transport })
  const request = { ...identity, signal: new AbortController().signal }

  expect(await source(request)).toEqual({ kind: 'unavailable', reason: 'unsupported-job' })
  expect(await source(request)).toEqual({ kind: 'unavailable', reason: 'unknown-avatar' })
  expect(transport).not.toHaveBeenCalled()
})

it.each(['헌터', '호크 아이', '메이븐', '眞 헌터'])(
  '아처 %s는 공식 Hunter preview grow=3을 사용한다',
  async (jobGrowName) => {
    const body = { ...baseAppearance, jobName: '아처', jobGrowName, avatar: [] }
    const { appearance, transport } = fixture(body)
    const source = createStayImageSource({ appearance, fetch: transport })

    expect((await source({ ...identity, signal: new AbortController().signal })).kind).toBe('ready')
    const render = new URL(new Request(...transport.mock.calls.at(-1)!).url)
    expect(JSON.parse(render.searchParams.get('wearInfo')!)).toMatchObject({ job: '16', grow: '3' })
  }
)

it('일반 아처 전직은 preview 기본 grow=0을 유지한다', async () => {
  const { appearance, transport } = fixture({
    ...baseAppearance,
    jobName: '아처',
    jobGrowName: '眞 뮤즈',
    avatar: []
  })
  const source = createStayImageSource({ appearance, fetch: transport })

  expect((await source({ ...identity, signal: new AbortController().signal })).kind).toBe('ready')
  const render = new URL(new Request(...transport.mock.calls.at(-1)!).url)
  expect(JSON.parse(render.searchParams.get('wearInfo')!)).toMatchObject({ job: '16', grow: '0' })
})

it('모션 catalog에 나열된 여러 Stay를 순서대로 반환한다', async () => {
  const { appearance, transport } = fixture({
    ...baseAppearance,
    jobName: '귀검사(여)',
    avatar: []
  })
  transport.mockResolvedValueOnce(
    Response.json({ job: 11, animation_list: ['Stand', 'Stay.0', 'Stay2.0', 'Stay.0'] })
  )
  const source = createStayImageSource({ appearance, fetch: transport })

  const result = await source({ ...identity, signal: new AbortController().signal })

  expect(result.kind).toBe('ready')
  if (result.kind !== 'ready') {
    throw new Error('Expected ready')
  }
  expect(result.images).toHaveLength(2)
  const animations = transport.mock.calls.slice(1).map((args) => {
    const url = new URL(new Request(...args).url)

    return JSON.parse(url.searchParams.get('wearInfo')!).animation
  })
  expect(animations).toEqual(['Stay.0', 'Stay2.0'])
})

it.each([['Stand'], ['Stay.0', 'Stay3.0'], ['Stay.10']])(
  '지원하지 않는 모션 목록 %j는 Stand로 대체하지 않는다',
  async (...animation_list) => {
    const { appearance, transport } = fixture({ ...baseAppearance, avatar: [] })
    transport.mockResolvedValueOnce(Response.json({ job: 0, animation_list }))
    const source = createStayImageSource({ appearance, fetch: transport })

    expect(await source({ ...identity, signal: new AbortController().signal })).toEqual({
      kind: 'unavailable',
      reason: 'unsupported-motion'
    })
    expect(transport).toHaveBeenCalledOnce()
  }
)

it('큰 RGBA의 합이 cache 바이트 한도를 넘으면 오래된 이미지를 제거한다', async () => {
  const { appearance, transport } = fixture()
  const rows = Array.from({ length: 5 }, (_, index) => ({
    name: `머리${index}`,
    index: `hair${index}`,
    icon: `hair/${index}.png`
  }))
  const fallback = transport.getMockImplementation()!
  transport.mockImplementation(async (input, init) => {
    const url = new URL(new Request(input, init).url)
    if (url.pathname.endsWith('_hair.json')) {
      return Response.json(rows)
    }

    if (url.hostname === 'avatarsync.df.nexon.com') {
      return pngResponse(1024, 1024)
    }

    return fallback(input, init)
  })
  const source = createStayImageSource({ appearance, fetch: transport })
  const request = { ...identity, signal: new AbortController().signal }
  for (const row of rows) {
    appearance.mockResolvedValueOnce({
      ...baseAppearance,
      avatar: [{ ...baseAppearance.avatar[0], itemName: row.name }]
    })
    await source(request)
  }
  appearance.mockResolvedValueOnce({
    ...baseAppearance,
    avatar: [{ ...baseAppearance.avatar[0], itemName: rows[0].name }]
  })
  await source(request)
  expect(transport).toHaveBeenCalledTimes(8)
})
