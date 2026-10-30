import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { HTTPError } from 'ky'
import { afterEach, expect, it, vi } from 'vitest'
import { readOrCreateClientId } from './client-id'
import { sendMeasurement } from './http'
import { createUsageStats, type MeasurementBody } from './usage-stats'

// 합성 값이며 실제 GA 속성의 값이 아니다.
const ANALYTICS = { measurementId: 'G-SYNTH123', apiSecret: 'synthetic_Secret-1' }
const STARTED_AT = Date.UTC(2026, 9, 31, 3, 0, 0, 500)
const STARTED_AT_UNIX_SECONDS = '1793415600'

const directories: string[] = []

function createDirectory(): string {
  const directory = mkdtempSync(join(tmpdir(), 'dfragon-usage-stats-'))
  directories.push(directory)

  return directory
}

afterEach(() => {
  for (const directory of directories.splice(0)) {
    rmSync(directory, { recursive: true, force: true })
  }
})

it('이벤트마다 같은 client_id, 실행 세션, 앱 버전을 붙이고 닉네임 같은 검색 값은 담지 않는다', async () => {
  const send = vi.fn<(body: MeasurementBody) => Promise<void>>(async () => undefined)
  const stats = createUsageStats({
    clientId: '123.456',
    appVersion: '0.1.0',
    startedAt: STARTED_AT,
    send,
    onFailure: vi.fn()
  })

  stats.record({ name: 'app_start' })
  stats.record({ name: 'capture', screen: 'raid' })
  stats.record({ name: 'character_search', screen: 'party' })

  const common = { client_id: '123.456', user_properties: { app_version: { value: '0.1.0' } } }
  expect(send.mock.calls.map(([body]) => JSON.parse(JSON.stringify(body)))).toEqual([
    {
      ...common,
      events: [
        {
          name: 'app_start',
          params: { session_id: STARTED_AT_UNIX_SECONDS, engagement_time_msec: 1 }
        }
      ]
    },
    {
      ...common,
      events: [
        {
          name: 'capture',
          params: { session_id: STARTED_AT_UNIX_SECONDS, engagement_time_msec: 1, screen: 'raid' }
        }
      ]
    },
    {
      ...common,
      events: [
        {
          name: 'character_search',
          params: { session_id: STARTED_AT_UNIX_SECONDS, engagement_time_msec: 1, screen: 'party' }
        }
      ]
    }
  ])
})

it('전송 실패는 기록 호출로 던지지 않고 진단 코드만 남긴다', async () => {
  const onFailure = vi.fn()
  const stats = createUsageStats({
    clientId: '123.456',
    appVersion: '0.1.0',
    startedAt: STARTED_AT,
    send: async () => {
      throw new Error('offline')
    },
    onFailure
  })

  expect(() => stats.record({ name: 'app_start' })).not.toThrow()
  await vi.waitFor(() => expect(onFailure).toHaveBeenCalledWith('USAGE_STATS_FAILED'))
})

it('client_id는 처음 만든 값을 저장해 다음 실행에도 같은 사용자로 센다', () => {
  const path = join(createDirectory(), 'profile', 'usage-stats.json')

  const first = readOrCreateClientId(path, STARTED_AT)
  const second = readOrCreateClientId(path, STARTED_AT + 86_400_000)

  expect(first).toMatch(new RegExp(`^\\d+\\.${STARTED_AT_UNIX_SECONDS}$`))
  expect(second).toBe(first)
  expect(JSON.parse(readFileSync(path, 'utf8'))).toEqual({ clientId: first })
})

it('깨진 저장 파일은 새 client_id로 바꿔 쓴다', () => {
  const path = join(createDirectory(), 'usage-stats.json')
  writeFileSync(path, JSON.stringify({ clientId: '../private' }))

  const clientId = readOrCreateClientId(path, STARTED_AT)

  expect(clientId).toMatch(/^\d+\.\d+$/)
  expect(JSON.parse(readFileSync(path, 'utf8'))).toEqual({ clientId })
})

it('Measurement Protocol 주소로 측정 ID와 secret을 query에 담아 cookie 없이 JSON을 보낸다', async () => {
  const requests: Request[] = []
  const sentBodies: unknown[] = []
  const transport = vi.fn<typeof fetch>(async (...args) => {
    const request = new Request(...args)
    requests.push(request)
    sentBodies.push(await request.json())

    return new Response(null, { status: 204 })
  })
  const body: MeasurementBody = {
    client_id: '123.456',
    user_properties: { app_version: { value: '0.1.0' } },
    events: [{ name: 'app_start', params: { session_id: '1', engagement_time_msec: 1 } }]
  }

  await sendMeasurement(transport, ANALYTICS, body)

  expect(requests).toHaveLength(1)
  const [request] = requests
  const url = new URL(request.url)
  expect(`${url.origin}${url.pathname}`).toBe('https://www.google-analytics.com/mp/collect')
  expect(Object.fromEntries(url.searchParams)).toEqual({
    measurement_id: 'G-SYNTH123',
    api_secret: 'synthetic_Secret-1'
  })
  expect(request.method).toBe('POST')
  expect(request.credentials).toBe('omit')
  expect(request.redirect).toBe('error')
  expect(request.cache).toBe('no-store')
  expect(request.headers.get('accept-language')).toBe('en-US')
  expect(sentBodies).toEqual([body])
})

it('GA가 오류 상태로 답하면 실패로 돌려준다', async () => {
  const transport = vi.fn<typeof fetch>(async () => new Response('bad', { status: 400 }))
  const body: MeasurementBody = {
    client_id: '1.1',
    user_properties: { app_version: { value: '0' } },
    events: []
  }

  await expect(sendMeasurement(transport, ANALYTICS, body)).rejects.toBeInstanceOf(HTTPError)
  expect(transport).toHaveBeenCalledOnce()
})
