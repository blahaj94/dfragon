import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { DataSource } from 'typeorm'
import { createCharacterDetailService } from '../dist/characters/details/service.js'
import { setTimeout as delay } from 'node:timers/promises'
import { createCharacterDetailStore } from '../dist/characters/details/store.js'
import { createNeopleCharacterDetailsForTest } from '../dist/characters/details/neople.js'
import {
  CHARACTER_DETAIL_SECTIONS,
  characterDetailSections
} from '../dist/characters/details/sections.js'
import { createLoginHttpApp } from '../dist/auth/login/http.js'

function fixture(identity, reinforce = 12) {
  const common = { ...identity, characterName: '테스트', level: 115, fame: 120000 }
  const sections = {
    basic: {},
    status: { status: [{ name: '힘', value: 4000 }], buff: [] },
    equipment: {
      equipment: [
        { slotId: 'WEAPON', itemId: 'fixture-item', reinforce, futureOption: { amount: '15%' } }
      ],
      setItemInfo: []
    },
    avatar: { avatar: [] },
    creature: { creature: null },
    oath: { oath: null },
    mist_assimilation: { mistAssimilation: { level: 1, expRate: '0%', status: [] } },
    skill_style: { skill: { style: { active: [], passive: [] } } },
    buff_equipment: { skill: { buff: { skillInfo: { name: '버프' }, equipment: [] } } },
    buff_avatar: { skill: { buff: { avatar: [] } } },
    buff_creature: { skill: { buff: { creature: null } } }
  }
  return Object.fromEntries(
    Object.entries(sections).map(([section, body]) => [section, { ...common, ...body }])
  )
}

export async function assertCharacterDetails(source, mark = () => undefined) {
  const identity = { serverId: 'siroco', characterId: 'fixture-detail-character' }
  const store = createCharacterDetailStore(source)
  const signal = new AbortController().signal
  const snapshot = () =>
    source.query('SELECT * FROM character_api_responses WHERE character_id = $1 ORDER BY section', [
      identity.characterId
    ])
  await source.query('DELETE FROM characters WHERE character_id = $1', [identity.characterId])
  let app, provider
  try {
    mark('first store and read')
    const first = await store.saveAndRead(
      identity,
      fixture(identity),
      await store.beginFetch(),
      signal
    )
    assert.equal(first.length, 11)
    assert(first.every((row) => row.revision === 1))
    const original = await snapshot()

    mark('JSONB equality and unchanged content timestamps')
    const reordered = Object.fromEntries(
      Object.entries(fixture(identity)).map(([section, body]) => [
        section,
        Object.fromEntries(Object.entries(body).reverse())
      ])
    )
    await delay(5)
    await store.saveAndRead(identity, reordered, await store.beginFetch(), signal)
    const unchanged = await snapshot()
    for (let i = 0; i < original.length; i++) {
      assert.equal(unchanged[i].revision, 1)
      assert.deepEqual(unchanged[i].content_updated_at, original[i].content_updated_at)
      assert(unchanged[i].last_successful_fetch_at > original[i].last_successful_fetch_at)
    }

    mark('changed section only and stale completion')
    const olderRequest = await store.beginFetch()
    const newerRequest = await store.beginFetch()
    await store.saveAndRead(identity, fixture(identity, 13), newerRequest, signal)
    const newer = await snapshot()
    assert.equal(newer.find((r) => r.section === 'equipment').revision, 2)
    assert(newer.filter((r) => r.section !== 'equipment').every((r) => r.revision === 1))
    const reread = await store.saveAndRead(identity, fixture(identity, 14), olderRequest, signal)
    assert.equal(reread.find((r) => r.section === 'equipment').payload.equipment[0].reinforce, 13)
    assert.deepEqual(await snapshot(), newer)

    mark('atomic rollback and server mismatch protection')
    const invalid = fixture(identity, 15)
    invalid.buff_creature = null
    await assert.rejects(store.saveAndRead(identity, invalid, await store.beginFetch(), signal))
    assert.deepEqual(await snapshot(), newer)
    await assert.rejects(
      store.saveAndRead(
        { ...identity, serverId: 'cain' },
        fixture(identity),
        await store.beginFetch(),
        signal
      )
    )
    assert.deepEqual(await snapshot(), newer)

    mark('concurrent identical updates do not inflate revisions')
    await Promise.all(
      Array.from({ length: 4 }, async () =>
        store.saveAndRead(identity, fixture(identity, 14), await store.beginFetch(), signal)
      )
    )
    assert.equal((await snapshot()).find((r) => r.section === 'equipment').revision, 3)
    assert.equal((await snapshot()).length, 11)

    mark('exhausted pool bounds shutdown and does not write after cancellation')
    const boundedSource = new DataSource({ ...source.options, poolSize: 1 })
    await boundedSource.initialize()
    let held, detailService
    try {
      const beforeCancellation = await snapshot()
      let announceFetch
      const fetched = new Promise((resolve) => {
        announceFetch = resolve
      })
      detailService = createCharacterDetailService({
        apiKey: 'fixture-neople-key',
        store: createCharacterDetailStore(boundedSource),
        fetchDetails: async () => {
          held = boundedSource.createQueryRunner()
          await held.connect()
          announceFetch()
          return fixture(identity, 99)
        }
      })
      const pending = detailService.refresh('127.0.0.1', identity, signal)
      const rejected = assert.rejects(pending)
      await fetched
      await delay(20)
      await Promise.race([
        detailService.onModuleDestroy(),
        delay(4000).then(() => {
          throw new Error('detail shutdown exceeded pool timeout')
        })
      ])
      await rejected
      await held.release()
      held = undefined
      assert.deepEqual(await snapshot(), beforeCancellation)

      const late = boundedSource.createQueryRunner()
      await late.connect()
      const canceled = new AbortController()
      const queued = assert.rejects(
        createCharacterDetailStore(boundedSource).saveAndRead(
          identity,
          fixture(identity, 99),
          newerRequest,
          canceled.signal
        )
      )
      canceled.abort()
      await late.release()
      await queued
      assert.deepEqual(await snapshot(), beforeCancellation)
    } finally {
      await held?.release()
      await detailService?.onModuleDestroy()
      await boundedSource.destroy()
    }

    mark('real HTTP, provider, persistence and projection')
    let providerCalls = 0,
      fail = false
    provider = createServer((request, response) => {
      providerCalls++
      assert.equal(request.headers.apikey, 'fixture-neople-key')
      assert(!request.url.includes('fixture-neople-key'))
      const prefix = `/df/servers/${identity.serverId}/characters/${identity.characterId}`
      const suffix = request.url.slice(prefix.length)
      const section = characterDetailSections.find(
        (name) => CHARACTER_DETAIL_SECTIONS[name] === suffix
      )
      if (fail && section === 'oath') {
        response
          .writeHead(503)
          .end(JSON.stringify({ error: { code: 'API002', message: 'fixture-private-error' } }))
      } else {
        response.setHeader('Content-Type', 'application/json')
        response.end(JSON.stringify(fixture(identity, 15)[section]))
      }
    })
    await new Promise((resolve) => provider.listen(0, '127.0.0.1', resolve))
    const adapter = createNeopleCharacterDetailsForTest('fixture-neople-key', {
      origin: `http://127.0.0.1:${provider.address().port}`
    })
    app = await createLoginHttpApp({}, undefined, undefined, undefined, undefined, {
      apiKey: 'fixture-neople-key',
      store,
      fetchDetails: adapter
    })
    await app.listen(0, '127.0.0.1')
    const url = `${await app.getUrl()}/characters/${identity.serverId}/${identity.characterId}`
    const response = await fetch(url)
    assert.equal(response.status, 200)
    const body = await response.json()
    assert.equal(body.character.characterId, identity.characterId)
    assert.equal(body.character.serverName, '시로코')
    assert.equal(body.equipment.equipment[0].reinforce, 15)
    assert.equal(body.sections.equipment.revision, 4)
    assert.equal(body.creature, null)
    assert.equal(providerCalls, 11)
    assert.equal(body.equipment.characterName, undefined)
    const beforeFailure = await snapshot()

    mark('upstream failure preserves all stored sections')
    fail = true
    const failure = await fetch(url)
    assert.equal(failure.status, 503)
    assert.equal((await failure.json()).error.code, 'NEOPLE_UNAVAILABLE')
    assert.deepEqual(await snapshot(), beforeFailure)
    const callsBeforeInvalid = providerCalls
    for (const [target, options] of [
      [url + '?unknown=value', {}],
      [url, { method: 'HEAD' }]
    ]) {
      assert.equal((await fetch(target, options)).status, 400)
    }
    assert.equal(providerCalls, callsBeforeInvalid)

    mark('detail quota rejects before the provider')
    fail = false
    for (let i = 0; i < 8; i++) {
      assert.equal((await fetch(url)).status, 200)
    }
    const callsBeforeLimit = providerCalls
    const limited = await fetch(url)
    assert.equal(limited.status, 429)
    assert(Number(limited.headers.get('Retry-After')) > 0)
    assert.equal(providerCalls, callsBeforeLimit)
    assert.equal((await snapshot()).find((r) => r.section === 'equipment').revision, 4)
  } finally {
    await app?.close()
    if (provider) {
      provider.closeAllConnections()
      await new Promise((resolve) => provider.close(resolve))
    }
    await source.query('DELETE FROM characters WHERE character_id = $1', [identity.characterId])
  }
}
