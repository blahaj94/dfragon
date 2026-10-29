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

describe('main의 429와 사용자의 다시 조회', () => {
  it.each<[string, Record<string, string>]>([
    ['없는', {}],
    ['2초인', { 'Retry-After': '2' }]
  ])(
    'Retry-After가 %s 429는 호출 제한 실패로 두고 자동 GET 없이 바로 직접 조회를 받는다',
    async (_name, headers) => {
      const fixture = await createSearchFixture()
      const failed = await limited(fixture, headers)

      expect(failed).toMatchObject({ state: 'failure', rows: [] })
      expect(failed.error).toEqual({ code: 'SEARCH_RATE_LIMITED' })
      expect(fixture.fetchSearch).toHaveBeenCalledTimes(1)
      expect(
        await fixture.invoke('controlCharacterSearch', {
          action: 'lookup',
          captureId: fixture.captureId,
          slot: 0,
          observationRevision: 2,
          nickname: '가나',
          serverId: 'cain'
        })
      ).toMatchObject({ ok: true })
      await vi.waitFor(async () => expect((await fixture.read()).slots[0].state).toBe('empty'))
      expect(requestPaths(fixture.fetchSearch)).toEqual([
        '/characters/candidates',
        '/characters/candidates'
      ])
      expect((await fixture.read()).slots[0].requestId).not.toBe(failed.requestId)
    }
  )

  it('429 뒤 새 캡처 회차(Alt+R)는 같은 OCR 관측도 기다리지 않고 다시 조회한다', async () => {
    const fixture = await createSearchFixture()
    const failed = await limited(fixture, { 'Retry-After': '2' })

    await fixture.invoke('controlCharacterSearch', { action: 'begin' })
    const { captureId } = await fixture.read()
    expect(captureId).not.toBe(fixture.captureId)
    await fixture.invoke('notifyOcrCandidatesDetected', {
      captureId,
      slot: 0,
      observationRevision: 1,
      nickname: '가나',
      candidateNicknames: ['가나'],
      portrait: null
    })

    await vi.waitFor(async () => expect((await fixture.read()).slots[0].state).toBe('empty'))
    expect(requestPaths(fixture.fetchSearch)).toEqual([
      '/characters/candidates',
      '/characters/candidates'
    ])
    expect((await fixture.read()).slots[0].requestId).not.toBe(failed.requestId)
  })
})
