import { expect, it, vi } from 'vitest'
import { sendCollectionPayload } from './http'

const ID = '10000000-0000-4000-8000-000000000001'
const OTHER_ID = '10000000-0000-4000-8000-000000000002'

it('익명 수집 전용 HTTPS 경로로만 전송하며 쿠키, 토큰과 redirect를 허용하지 않는다', async () => {
  const request = vi.fn<typeof fetch>(async () =>
    Response.json({ id: ID, duplicate: false }, { status: 201 })
  )
  expect(
    await sendCollectionPayload(
      { id: ID, body: '{}', signal: new AbortController().signal },
      request
    )
  ).toBe(true)
  expect(request).toHaveBeenCalledWith(
    'https://ocr.dfragon.com/api/desktop/test-captures',
    expect.objectContaining({
      method: 'POST',
      credentials: 'omit',
      redirect: 'error',
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' }
    })
  )
})

it('콘텐츠 중복 응답은 기존 ID를 허용하지만 일반 영수증의 다른 ID는 거절한다', async () => {
  const request = vi
    .fn<typeof fetch>()
    .mockResolvedValueOnce(Response.json({ id: OTHER_ID, duplicate: true }))
    .mockResolvedValueOnce(Response.json({ id: OTHER_ID, duplicate: false }))
    .mockResolvedValueOnce(new Response('', { status: 429 }))
  const input = { id: ID, body: '{}', signal: new AbortController().signal }
  expect(await sendCollectionPayload(input, request)).toBe(true)
  expect(await sendCollectionPayload(input, request)).toBe(false)
  expect(await sendCollectionPayload(input, request)).toBe(false)
  expect(request).toHaveBeenCalledTimes(3)
})
