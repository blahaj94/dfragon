import assert from 'node:assert/strict'
import test from 'node:test'
import type { Request, Response } from 'express'
import { OcrAuth } from '../src/auth.js'
import { OCR_AUTH } from '../src/constants.js'

test('쿠키 없는 IPv6 주소 변경도 같은 대역의 대기 한도를 공유하고 교체, 만료로 용량을 회수한다', async (t) => {
  let now = Date.now()
  t.mock.method(Date, 'now', () => now)
  let calls = 0
  const auth = new OcrAuth(
    {
      origin: 'https://ocr.example.test',
      authOrigin: 'https://auth.example.test',
      ownerId: 'owner'
    },
    async () => {
      calls++

      return Response.json({
        requestId: 'fixture',
        browserUrl: 'https://auth.example.test/auth/login/authorize',
        expiresAt: new Date(now + 600_000).toISOString()
      })
    }
  )
  t.after(() => auth.close())
  const bindings: string[] = []
  const response = {
    cookie(_name: string, value: string) {
      bindings.push(value)
    },
    json() {}
  } as unknown as Response
  const request = (ip: string, binding?: string) =>
    ({ ip, cookies: { [OCR_AUTH.pendingCookie]: binding } }) as unknown as Request
  for (let i = 1; i <= 3; i++) {
    await auth.begin(request(`2001:db8:1:2::${i}`), response)
  }
  await assert.rejects(auth.begin(request('2001:0db8:0001:0002::abcd'), response), {
    code: 'LOGIN_LIMIT'
  })
  assert.equal(calls, 3)
  await auth.begin(request('2001:db8:1:2::1', bindings[0]), response)
  await auth.begin(request('2001:db8:1:3::1'), response)
  assert.equal(calls, 5)
  await assert.rejects(auth.begin(request('2001:db8:1:2::ffff'), response), { code: 'LOGIN_LIMIT' })
  now += 600_000
  await auth.begin(request('2001:db8:1:2::ffff'), response)
  assert.equal(calls, 6)
})

test('반복 교체와 인증 서버 실패가 있어도 예전 시작 횟수 한도를 넘어 계속 시작할 수 있다', async (t) => {
  const now = Date.now()
  t.mock.method(Date, 'now', () => now)
  let calls = 0
  let failing = true
  const auth = new OcrAuth(
    {
      origin: 'https://ocr.example.test',
      authOrigin: 'https://auth.example.test',
      ownerId: 'owner'
    },
    async () => {
      calls++
      if (failing) {
        return new Response(null, { status: 503 })
      }

      return Response.json({
        requestId: 'fixture',
        browserUrl: 'https://auth.example.test/auth/login/authorize',
        expiresAt: new Date(now + 600_000).toISOString()
      })
    }
  )
  t.after(() => auth.close())
  let binding: string | undefined
  const response = {
    cookie(_name: string, value: string) {
      binding = value
    },
    json() {}
  } as unknown as Response
  const request = () =>
    ({ ip: '192.0.2.1', cookies: { [OCR_AUTH.pendingCookie]: binding } }) as unknown as Request
  for (let i = 0; i < 3; i++) {
    await assert.rejects(auth.begin(request(), response), { code: 'AUTH_UNAVAILABLE' })
  }
  failing = false
  const startsOverPreviousClientLimit = 15
  for (let i = 3; i < startsOverPreviousClientLimit; i++) {
    await auth.begin(request(), response)
  }
  assert.equal(calls, startsOverPreviousClientLimit)
  await auth.close()
  await assert.rejects(auth.begin(request(), response), { code: 'AUTH_UNAVAILABLE' })
})
