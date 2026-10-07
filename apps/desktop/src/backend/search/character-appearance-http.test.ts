import { expect, it, vi } from 'vitest'
import type { AuthClock } from '../auth/types'
import type { CharacterAppearance } from '../../preload/common/types/appearance'
import { CHARACTER_HTTP_LIMITS, createCharacterAppearanceHttp } from './character-http'

vi.mock('electron', () => ({ session: { fromPartition: vi.fn() } }))

const API_ORIGIN = 'https://api.example.test'
const identity = { serverId: 'cain', characterId: 'character-1' }
const appearance: CharacterAppearance = {
  ...identity,
  characterName: '가나',
  jobName: '귀검사(남)',
  jobGrowName: '眞 웨펀마스터',
  avatar: [
    {
      slotId: 'HAIR',
      itemId: 'avatar-1',
      itemName: '기본 머리',
      clone: { itemId: 'clone-1', itemName: '클론 머리' }
    }
  ]
}

it('고정 외형 경로를 익명으로 요청하고 표시용 보강 필드를 전달하지 않는다', async () => {
  const body = { ...appearance, itemDetail: { unexpected: true } }
  const transport = vi.fn<typeof fetch>().mockResolvedValue(Response.json(body))
  const read = createCharacterAppearanceHttp({ apiOrigin: API_ORIGIN, fetch: transport })

  expect(await read({ ...identity, signal: new AbortController().signal })).toEqual(appearance)
  const request = new Request(...transport.mock.calls[0])
  expect(request.url).toBe(`${API_ORIGIN}/characters/cain/character-1/appearance`)
  expect(request.headers.get('Authorization')).toBeNull()
  expect(request.headers.get('apikey')).toBeNull()
  expect(request.credentials).toBe('omit')
  expect(request.redirect).toBe('error')
})

it.each([
  { avatar: [] },
  { avatar: [{ ...appearance.avatar[0], clone: { itemId: null, itemName: null } }] }
])('미착용 또는 외형 복제 없음 %j를 보존한다', async (fields) => {
  const body = { ...appearance, ...fields }
  const transport = vi.fn<typeof fetch>().mockResolvedValue(Response.json(body))
  const read = createCharacterAppearanceHttp({ apiOrigin: API_ORIGIN, fetch: transport })

  expect(await read({ ...identity, signal: new AbortController().signal })).toEqual(body)
})

it.each([
  { serverId: 'prey' },
  { characterId: 'another' },
  { jobName: null },
  { avatar: null },
  { avatar: [{ ...appearance.avatar[0], clone: { itemId: 'clone-1', itemName: null } }] },
  { avatar: [{ ...appearance.avatar[0], clone: { itemId: null, itemName: '클론 머리' } }] }
])('다른 식별자 또는 불완전한 외형 응답 %j를 거부한다', async (fields) => {
  const transport = vi
    .fn<typeof fetch>()
    .mockResolvedValue(Response.json({ ...appearance, ...fields }))
  const read = createCharacterAppearanceHttp({ apiOrigin: API_ORIGIN, fetch: transport })

  await expect(read({ ...identity, signal: new AbortController().signal })).rejects.toMatchObject({
    code: 'SEARCH_RESPONSE_INVALID'
  })
})

it('외형 응답 크기 상한을 넘으면 스트림을 취소한다', async () => {
  const cancel = vi.fn()
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new Uint8Array(CHARACTER_HTTP_LIMITS.appearanceJsonBytes + 1))
    },
    cancel
  })
  const transport = vi.fn<typeof fetch>().mockResolvedValue(new Response(body))
  const read = createCharacterAppearanceHttp({ apiOrigin: API_ORIGIN, fetch: transport })

  await expect(read({ ...identity, signal: new AbortController().signal })).rejects.toMatchObject({
    code: 'SEARCH_RESPONSE_INVALID'
  })
  expect(cancel).toHaveBeenCalledOnce()
})

it('외형 한도 오류는 수신 시각과 Retry-After를 보존하며 재시도하지 않는다', async () => {
  const transport = vi
    .fn<typeof fetch>()
    .mockResolvedValue(
      Response.json(
        { error: { code: 'CHARACTER_RATE_LIMITED' } },
        { status: 429, headers: { 'Retry-After': '9' } }
      )
    )
  const clock: Pick<AuthClock, 'read'> = {
    read: () => ({ monotonicMs: 1234, wallMs: 5678, discontinuous: false })
  }
  const read = createCharacterAppearanceHttp({ apiOrigin: API_ORIGIN, fetch: transport, clock })

  await expect(read({ ...identity, signal: new AbortController().signal })).rejects.toMatchObject({
    code: 'SEARCH_RATE_LIMITED',
    retryAfterSeconds: 9,
    retryAfterReceivedAt: 1234
  })
  expect(transport).toHaveBeenCalledOnce()
})

it('외형 body가 멈추면 호출자의 취소를 전파한다', async () => {
  const controller = new AbortController()
  const cancel = vi.fn()
  const pull = vi.fn()
  const body = new ReadableStream<Uint8Array>({ pull, cancel }, { highWaterMark: 0 })
  const transport = vi.fn<typeof fetch>().mockResolvedValue(new Response(body))
  const read = createCharacterAppearanceHttp({ apiOrigin: API_ORIGIN, fetch: transport })
  const pending = read({ ...identity, signal: controller.signal })
  const failure = expect(pending).rejects.toMatchObject({ name: 'AbortError' })
  await vi.waitFor(() => expect(pull).toHaveBeenCalledOnce())
  controller.abort()

  await failure
  expect(cancel).toHaveBeenCalledOnce()
})
