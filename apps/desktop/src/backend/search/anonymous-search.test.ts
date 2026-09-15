import { describe, expect, it, vi } from 'vitest'
import { deferred } from '../auth/auth-test-fixtures'
import { candidate, createSearchFixture, jsonResponse } from './search-test-fixture'

describe('character search independent of account authentication', () => {
  it.each([false, true])(
    'signedIn=%s sends no credential and never refreshes',
    async (signedIn) => {
      const fixture = await createSearchFixture(signedIn)
      fixture.harness.clock.advance(16 * 60_000)
      const authorize = vi.spyOn(fixture.auth, 'authorization')
      const recover = vi.spyOn(fixture.auth, 'recoverAuthorization')
      fixture.fetchSearch.mockResolvedValueOnce(jsonResponse({ body: { rows: [candidate] } }))

      await fixture.observe({ slot: 0, observationRevision: 1, nickname: '가나' })
      await vi.waitFor(async () => expect((await fixture.read()).slots[0].state).toBe('success'))

      const request = new Request(...fixture.fetchSearch.mock.calls[0])
      expect(request.headers.get('authorization')).toBeNull()
      expect(request.credentials).toBe('omit')
      expect(authorize).not.toHaveBeenCalled()
      expect(recover).not.toHaveBeenCalled()
      expect(fixture.harness.http.refresh).not.toHaveBeenCalled()
    }
  )

  it('logout during HTTP preserves capture and delivers its current result', async () => {
    const fixture = await createSearchFixture(true)
    const response = deferred<Response>()
    fixture.fetchSearch.mockReturnValueOnce(response.promise)
    await fixture.observe({ slot: 0, observationRevision: 1, nickname: '가나' })
    await vi.waitFor(() => expect(fixture.fetchSearch).toHaveBeenCalledTimes(1))

    await fixture.auth.logout()
    expect((await fixture.read()).captureId).toBe(fixture.captureId)
    response.resolve(jsonResponse({ body: { rows: [candidate] } }))

    await vi.waitFor(async () => expect((await fixture.read()).slots[0].state).toBe('success'))
    expect((await fixture.read()).slots[0].rows).toEqual([candidate])
    expect(fixture.auth.getSnapshot().phase).toBe('signedOut')
  })

  it('unexpected server 401 is a search failure without auth recovery or automatic GET', async () => {
    const fixture = await createSearchFixture(true)
    const recover = vi.spyOn(fixture.auth, 'recoverAuthorization')
    fixture.fetchSearch.mockResolvedValueOnce(
      jsonResponse({
        status: 401,
        body: { error: { code: 'AUTHENTICATION_REQUIRED' } }
      })
    )

    await fixture.observe({ slot: 0, observationRevision: 1, nickname: '가나' })
    await vi.waitFor(async () => expect((await fixture.read()).slots[0].state).toBe('failure'))

    expect((await fixture.read()).slots[0].error?.code).toBe('SEARCH_RESPONSE_INVALID')
    expect(recover).not.toHaveBeenCalled()
    expect(fixture.harness.http.refresh).not.toHaveBeenCalled()
    expect(fixture.harness.http.logout).not.toHaveBeenCalled()
    expect(fixture.fetchSearch).toHaveBeenCalledTimes(1)
    expect(fixture.auth.getSnapshot().phase).toBe('signedIn')
  })
})
