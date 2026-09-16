import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import test from 'node:test'
import { CharacterDetailFailure } from '../src/characters/details/errors.js'
import {
  createNeopleCharacterDetailsForTest,
  validateCharacterPayload
} from '../src/characters/details/neople.js'
import { parseCharacterIdentity } from '../src/characters/details/service.js'

const identity = { serverId: 'siroco', characterId: 'fixture-character' }
const basic = { ...identity, characterName: '테스트 캐릭터' }

test('detail input rejects query injection, unknown server and unsafe path values', () => {
  assert.deepEqual(
    parseCharacterIdentity(
      identity.serverId,
      identity.characterId,
      '/characters/siroco/fixture-character'
    ),
    identity
  )
  for (const [server, character, url] of [
    ['all', identity.characterId, '/characters/all/id'],
    ['siroco', '../id', '/characters/siroco/../id'],
    ['siroco', ' ', '/characters/siroco/%20'],
    ['siroco', identity.characterId, '/characters/siroco/id?apikey=untrusted']
  ]) {
    assert.throws(
      () => parseCharacterIdentity(server, character, url!),
      (error: unknown) => error instanceof CharacterDetailFailure && error.status === 400
    )
  }
})

test('payload validation preserves seasonal options and distinguishes absent section from null', () => {
  const payload = { ...basic, creature: null, futureOption: { rate: '48.3%', value: 0 } }
  assert.equal(validateCharacterPayload(payload, identity, 'creature'), payload)
  for (const body of [
    null,
    [],
    basic,
    { ...payload, characterId: 'another' },
    { ...payload, serverId: 'cain' },
    { ...payload, creature: 'invalid' }
  ]) {
    assert.throws(
      () => validateCharacterPayload(body, identity, 'creature'),
      CharacterDetailFailure
    )
  }
})

test('provider failures are sanitized, retain known-code precedence, and do not fan out or retry', async () => {
  for (const [status, body, expected] of [
    [503, { error: { code: 'API901', message: 'sensitive upstream detail' } }, 502],
    [401, { error: { code: 'API003' } }, 500],
    [503, 'invalid JSON', 503],
    [200, { ...basic, characterId: 'wrong' }, 502]
  ] as const) {
    let calls = 0
    const adapter = createNeopleCharacterDetailsForTest('fake-key', {
      fetch: async (_url, init) => {
        calls++
        assert.equal(new Headers(init?.headers).get('apikey'), 'fake-key')
        return new Response(typeof body === 'string' ? body : JSON.stringify(body), { status })
      }
    })
    await assert.rejects(adapter(identity, new AbortController().signal), (error: unknown) => {
      assert(error instanceof CharacterDetailFailure)
      assert.equal(error.status, expected)
      assert.equal(JSON.stringify(error.body).includes('sensitive'), false)
      return true
    })
    assert.equal(calls, 1)
  }
})

test('native detail transport aborts incomplete body and refuses redirects', async () => {
  let mode = 'stall'
  let requests = 0
  const server = createServer((_request, response) => {
    requests++
    if (mode === 'redirect') {
      response.writeHead(302, { location: '/unexpected' }).end()
    } else {
      response.writeHead(200, { 'content-type': 'application/json' })
      response.write('{')
    }
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  assert(address && typeof address !== 'string')
  try {
    const adapter = createNeopleCharacterDetailsForTest('fake-key', {
      origin: `http://127.0.0.1:${address.port}`,
      timeoutMs: 150
    })
    await assert.rejects(
      adapter(identity, new AbortController().signal),
      (error: unknown) => error instanceof CharacterDetailFailure && error.status === 504
    )
    mode = 'redirect'
    await assert.rejects(
      adapter(identity, new AbortController().signal),
      (error: unknown) => error instanceof CharacterDetailFailure && error.status === 502
    )
    assert.equal(requests, 2)
  } finally {
    server.closeAllConnections()
    await new Promise<void>((resolve) => server.close(() => resolve()))
  }
})
