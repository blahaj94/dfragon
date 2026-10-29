import { describe, expect, it, vi } from 'vitest'
import type { SearchSlot } from '../../preload/common/types/search'
import { createSearchFixture, jsonResponse, requestPaths } from './search-test-fixture'

type Fixture = Awaited<ReturnType<typeof createSearchFixture>>

async function limited(fixture: Fixture, headers: Record<string, string>): Promise<SearchSlot> {
  fixture.fetchSearch.mockResolvedValueOnce(
    jsonResponse({
      status: 429,
      headers,
      body: { error: { code: 'SEARCH_RATE_LIMITED', message: 'discard' } }
    })
  )
  await fixture.startSearch({ slot: 0, observationRevision: 1, nickname: '가나' })
  await vi.waitFor(async () => expect((await fixture.read()).slots[0].state).not.toBe('pending'))
  const slot = (await fixture.read()).slots[0]
  expect(slot.requestId).toEqual(expect.any(String))

  return slot
}

function retry(fixture: Fixture, slot: SearchSlot): Promise<unknown> {
  return fixture.invoke('controlCharacterSearch', {
    action: 'retry',
    captureId: fixture.captureId,
    slot: slot.slot,
    requestId: slot.requestId
  })
}

describe('main의 429와 사용자 재시도', () => {
  it.each<[string, Record<string, string>]>([
    ['없는', {}],
    ['2초인', { 'Retry-After': '2' }]
  ])(
    'Retry-After가 %s 429는 호출 제한 실패로 두고 자동 GET 없이 바로 사용자 retry를 받는다',
    async (_name, headers) => {
      const fixture = await createSearchFixture()
      const failed = await limited(fixture, headers)

      expect(failed).toMatchObject({ state: 'failure', rows: [] })
      expect(failed.error).toEqual({ code: 'SEARCH_RATE_LIMITED' })
      expect(fixture.fetchSearch).toHaveBeenCalledTimes(1)
      expect(await retry(fixture, failed)).toMatchObject({ ok: true })
      await vi.waitFor(async () => expect((await fixture.read()).slots[0].state).toBe('empty'))
      expect(requestPaths(fixture.fetchSearch)).toEqual([
        '/characters/candidates',
        '/characters/candidates'
      ])
      expect((await fixture.read()).slots[0].requestId).not.toBe(failed.requestId)
    }
  )
})
