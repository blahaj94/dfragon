import { expect, it, vi } from 'vitest'
import { readTodayGrade } from './http'

const apiOrigin = 'https://api.synthetic.invalid'
const grade = { percent: 85, expiresAt: '2026-10-30T15:00:00.000Z' }

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' }
  })
}

it('API의 오늘의 등급을 cookie 없이 받아 퍼센트와 만료 시각을 돌려준다', async () => {
  const transport = vi.fn<typeof fetch>(async () => jsonResponse(grade))

  await expect(readTodayGrade(apiOrigin, transport)).resolves.toEqual(grade)

  expect(transport).toHaveBeenCalledOnce()
  const request = new Request(...transport.mock.calls[0])
  expect(request.url).toBe(`${apiOrigin}/items/today-grade`)
  expect(request.method).toBe('GET')
  expect(request.credentials).toBe('omit')
  expect(request.redirect).toBe('error')
  expect(request.cache).toBe('no-store')
})

it.each([
  ['오류 상태', () => jsonResponse({ error: { code: 'NEOPLE_TIMEOUT' } }, 504)],
  ['정수가 아닌 퍼센트', () => jsonResponse({ ...grade, percent: 85.5 })],
  ['100을 넘는 퍼센트', () => jsonResponse({ ...grade, percent: 101 })],
  ['시각이 아닌 만료', () => jsonResponse({ ...grade, expiresAt: 'tomorrow' })],
  ['객체가 아닌 본문', () => jsonResponse([grade])]
])('%s 응답은 등급 없이 실패한다', async (_name, respond) => {
  const transport = vi.fn<typeof fetch>(async () => respond())

  await expect(readTodayGrade(apiOrigin, transport)).rejects.toThrow()
})
