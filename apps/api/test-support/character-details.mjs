import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { DataSource } from 'typeorm'
import { createCharacterDetailService } from '../dist/characters/details/service.js'
import { setTimeout as delay } from 'node:timers/promises'
import { createCharacterDetailStore } from '../dist/characters/details/store.js'
import { createCatalogStore } from '../dist/characters/catalog/store.js'
import { createCatalogService } from '../dist/characters/catalog/service.js'
import { createNeopleCharacterDetailsForTest } from '../dist/characters/details/neople.js'
import {
  CHARACTER_DETAIL_SECTIONS,
  characterDetailSections
} from '../dist/characters/details/sections.js'
import { createApiHttpApp } from '../dist/http.js'
import { bounded } from './login-test-control.mjs'

function fixture(identity, reinforce = 12, characterName = '테스트') {
  const common = { ...identity, characterName, level: 115, fame: 120000 }
  const sections = {
    basic: {},
    status: { status: [{ name: '힘', value: 4000 }], buff: [] },
    equipment: {
      equipment: [
        {
          slotId: 'WEAPON',
          itemId: 'fixture-item',
          reinforce,
          futureOption: { amount: '15%', nullable: null, chain: [null, { value: '3%' }, null] }
        }
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
  const orderedIdentity = { ...identity, characterId: 'fixture-detail-request-order' }
  const failedIdentity = { ...identity, characterId: 'fixture-detail-failed-insert' }
  const fixtureIds = [identity.characterId, orderedIdentity.characterId, failedIdentity.characterId]
  const store = createCharacterDetailStore(source)
  const signal = new AbortController().signal
  const snapshot = (characterId = identity.characterId) =>
    source.query(
      'SELECT *, (extract(epoch FROM last_successful_fetch_at) * 1000000)::numeric(30,0)::text AS fetch_microseconds FROM character_api_responses WHERE character_id = $1 ORDER BY section',
      [characterId]
    )
  const ageSuccessfulFetch = () =>
    source.query(
      "UPDATE character_api_responses SET last_successful_fetch_at = clock_timestamp() - interval '30 seconds' WHERE character_id = $1",
      [identity.characterId]
    )
  await source.query('DELETE FROM characters WHERE character_id = ANY($1)', [fixtureIds])
  let app, provider
  try {
    mark('최초 11개 섹션 저장과 식별자 조회')
    const firstPayloads = fixture(identity)
    const first = await store.saveAndRead(identity, firstPayloads, await store.beginFetch(), signal)
    assert.equal(first.length, 11)
    assert(first.every((row) => row.revision === 1))
    assert.deepEqual(
      new Map(first.map(({ section, payload }) => [section, payload])),
      new Map(Object.entries(firstPayloads))
    )
    const firstRead = await store.read(identity, signal)
    assert.equal(firstRead.rows.length, 11)
    assert(firstRead.now instanceof Date)
    await assert.rejects(store.read({ ...identity, serverId: 'cain' }, signal))
    assert.deepEqual(
      (await store.read({ ...identity, characterId: 'missing-fixture' }, signal)).rows,
      []
    )
    const original = await snapshot()

    mark('중첩 객체 key 순서가 달라도 JSONB 내용·revision·내용 시각은 유지')
    const reordered = Object.fromEntries(
      Object.entries(fixture(identity)).map(([section, body]) => [
        section,
        Object.fromEntries(Object.entries(body).reverse())
      ])
    )
    const options = reordered.equipment.equipment[0].futureOption
    reordered.equipment.equipment[0].futureOption = {
      chain: options.chain,
      nullable: options.nullable,
      amount: options.amount
    }
    await store.saveAndRead(identity, reordered, await store.beginFetch(), signal)
    const unchanged = await snapshot()
    for (let i = 0; i < original.length; i++) {
      assert.equal(unchanged[i].revision, 1)
      assert.deepEqual(unchanged[i].content_updated_at, original[i].content_updated_at)
      assert(BigInt(unchanged[i].fetch_microseconds) > BigInt(original[i].fetch_microseconds))
    }

    mark('바뀐 섹션만 revision을 올리고 늦은 이전 요청은 보존')
    const olderRequest = await store.beginFetch()
    const newerRequest = await store.beginFetch()
    await store.saveAndRead(identity, fixture(identity, 13), newerRequest, signal)
    const newer = await snapshot()
    assert.equal(newer.find((r) => r.section === 'equipment').revision, 2)
    assert(newer.filter((r) => r.section !== 'equipment').every((r) => r.revision === 1))
    const reread = await store.saveAndRead(identity, fixture(identity, 14), olderRequest, signal)
    assert.equal(reread.find((r) => r.section === 'equipment').payload.equipment[0].reinforce, 13)
    assert.deepEqual(await snapshot(), newer)

    mark('실패한 신규·기존 저장 전체 rollback과 다른 서버 병합 거절')
    const invalid = fixture(identity, 15)
    invalid.buff_creature = null
    await assert.rejects(store.saveAndRead(identity, invalid, await store.beginFetch(), signal))
    assert.deepEqual(await snapshot(), newer)
    const invalidFirstInsert = fixture(failedIdentity)
    invalidFirstInsert.buff_creature = null
    await assert.rejects(
      store.saveAndRead(failedIdentity, invalidFirstInsert, await store.beginFetch(), signal)
    )
    assert.deepEqual(await snapshot(failedIdentity.characterId), [])
    assert.deepEqual(
      await source.query('SELECT * FROM characters WHERE character_id = $1', [
        failedIdentity.characterId
      ]),
      []
    )
    await assert.rejects(
      store.saveAndRead(
        { ...identity, serverId: 'cain' },
        fixture(identity),
        await store.beginFetch(),
        signal
      )
    )
    assert.deepEqual(await snapshot(), newer)

    mark('같은 내용의 동시 갱신은 revision을 중복 증가시키지 않음')
    await Promise.all(
      Array.from({ length: 4 }, async () =>
        store.saveAndRead(identity, fixture(identity, 14), await store.beginFetch(), signal)
      )
    )
    assert.equal((await snapshot()).find((r) => r.section === 'equipment').revision, 3)
    assert.equal((await snapshot()).length, 11)

    mark('1마이크로초 차이와 동일 시각 요청은 최신 저장값과 먼저 저장한 값을 유지한다')
    const earlier = '2026-01-01 00:00:00.000001+00'
    const later = '2026-01-01 00:00:00.000002+00'
    const latestPayloads = fixture(orderedIdentity, 22, '최신캐릭터')
    await store.saveAndRead(
      orderedIdentity,
      fixture(orderedIdentity, 21, '이전캐릭터'),
      earlier,
      signal
    )
    await store.saveAndRead(orderedIdentity, latestPayloads, later, signal)
    const ordered = await snapshot(orderedIdentity.characterId)
    assert(ordered.every((row) => row.revision === 2))
    for (const requestedAt of [earlier, later]) {
      const retained = await store.saveAndRead(
        orderedIdentity,
        fixture(orderedIdentity, 99, '덮어쓸캐릭터'),
        requestedAt,
        signal
      )
      assert.deepEqual(
        new Map(retained.map(({ section, payload }) => [section, payload])),
        new Map(Object.entries(latestPayloads))
      )
      assert.deepEqual(await snapshot(orderedIdentity.characterId), ordered)
    }

    mark('실제 캐릭터 행 잠금에서 두 갱신이 대기해도 11개 섹션은 최신 요청으로 일치한다')
    const blocker = source.createQueryRunner()
    await blocker.connect()
    await blocker.startTransaction()
    const [{ pid }] = await blocker.query('SELECT pg_backend_pid() AS pid')
    await blocker.query('SELECT character_id FROM characters WHERE character_id = $1 FOR UPDATE', [
      orderedIdentity.characterId
    ])
    const competingPayloads = fixture(orderedIdentity, 24, '경합후최신')
    const competing = Promise.allSettled([
      store.saveAndRead(
        orderedIdentity,
        competingPayloads,
        '2026-01-01 00:00:00.000004+00',
        signal
      ),
      store.saveAndRead(
        orderedIdentity,
        fixture(orderedIdentity, 23, '경합중이전'),
        '2026-01-01 00:00:00.000003+00',
        signal
      )
    ])
    try {
      let waiting = false
      for (let attempt = 0; attempt < 100; attempt++) {
        const [{ count }] = await source.query(
          `WITH RECURSIVE waiters(pid) AS (
            SELECT pid FROM pg_stat_activity WHERE $1 = ANY(pg_blocking_pids(pid))
            UNION
            SELECT activity.pid FROM pg_stat_activity activity
              JOIN waiters ON waiters.pid = ANY(pg_blocking_pids(activity.pid))
          ) SELECT count(*)::int AS count FROM waiters`,
          [pid]
        )
        if (count >= 2) {
          waiting = true
          break
        }
        await delay(5)
      }
      assert(waiting, '두 요청의 실제 PostgreSQL 잠금 대기를 관측해야 한다')
      await blocker.commitTransaction()
      assert((await competing).every((result) => result.status === 'fulfilled'))
    } finally {
      if (blocker.isTransactionActive) {
        await blocker.rollbackTransaction()
      }
      await blocker.release()
      await competing
    }
    assert.deepEqual(
      new Map(
        (await snapshot(orderedIdentity.characterId)).map(({ section, payload }) => [
          section,
          payload
        ])
      ),
      new Map(Object.entries(competingPayloads))
    )

    mark('연결 풀이 찬 상태에서 종료와 취소 뒤 쓰기를 중단')
    await ageSuccessfulFetch()
    const boundedSource = new DataSource({ ...source.options, poolSize: 1 })
    await boundedSource.initialize()
    let held, detailService
    try {
      const beforeCancellation = await snapshot()
      let announceFetch
      const fetched = new Promise((resolve) => {
        announceFetch = resolve
      })
      let announceSave
      const saving = new Promise((resolve) => {
        announceSave = resolve
      })
      const boundedStore = createCharacterDetailStore(boundedSource)
      detailService = createCharacterDetailService({
        store: {
          ...boundedStore,
          saveAndRead(...args) {
            const pending = boundedStore.saveAndRead(...args)
            announceSave()

            return pending
          }
        },
        fetchDetails: async () => {
          held = boundedSource.createQueryRunner()
          await held.connect()
          announceFetch()

          return fixture(identity, 99)
        }
      })
      const pending = detailService.refresh('127.0.0.1', identity, signal)
      const rejected = assert.rejects(pending)
      await bounded(fetched)
      await bounded(saving)
      await bounded(detailService.onModuleDestroy(), 4000)
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

    mark('loopback provider·실제 PostgreSQL의 저장·정제 HTTP 응답')
    await ageSuccessfulFetch()
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
    app = await createApiHttpApp(
      {
        async searchCharacters() {
          throw new Error('예상하지 않은 캐릭터 검색 공급자 호출')
        }
      },
      {
        store,
        fetchDetails: adapter,
        catalog: createCatalogService(createCatalogStore(source), async (keys) =>
          keys.map((key) => {
            const payload =
              key.kind === 'set'
                ? { setItemId: key.setItemId, setItemName: '테스트 세트', setItemOption: [] }
                : {
                    itemId: key.itemId,
                    itemName: '테스트 공용 상세',
                    setItemId: 'fixture-set',
                    tune: [{ level: 0 }]
                  }

            return { key, payload }
          })
        )
      }
    )
    await app.listen(0, '127.0.0.1')
    const url = `${await app.getUrl()}/characters/${identity.serverId}/${identity.characterId}`
    const response = await fetch(url + '/refresh', { method: 'POST' })
    assert.equal(response.status, 200)
    const body = await response.json()
    assert.equal(body.character.characterId, identity.characterId)
    assert.equal(body.character.serverName, '시로코')
    assert.equal(body.equipment.equipment[0].reinforce, 15)
    assert.equal(body.equipment.equipment[0].itemDetail.status, 'fresh')
    assert.equal(body.setDetails['fixture-set'].status, 'fresh')
    assert.equal(body.setDetails['fixture-set'].data.setItemName, '테스트 세트')
    assert.equal(body.equipment.equipment[0].itemDetail.data.itemName, '테스트 공용 상세')
    assert.equal(
      (await snapshot()).find((row) => row.section === 'equipment').payload.equipment[0].itemDetail,
      undefined
    )
    assert.equal(body.sections.equipment.revision, 4)
    assert.equal(body.creature, null)
    assert.equal(providerCalls, 11)
    assert.equal(body.equipment.characterName, undefined)
    assert.equal(
      Date.parse(body.freshness.expiresAt) - Date.parse(body.freshness.lastSuccessfulFetchAt),
      300_000
    )
    const beforeHit = await snapshot()
    const hit = await fetch(url)
    assert.equal(hit.status, 200)
    const cached = await hit.json()
    assert.deepEqual(cached.freshness, body.freshness)
    assert.equal(providerCalls, 11)
    assert.deepEqual(await snapshot(), beforeHit)

    mark('명시 갱신 cooldown은 commit된 DB 시각으로 판단하고 provider를 호출하지 않음')
    const cooldown = await fetch(url + '/refresh', { method: 'POST' })
    assert.equal(cooldown.status, 429)
    assert(Number(cooldown.headers.get('Retry-After')) > 0)
    assert(Number(cooldown.headers.get('Retry-After')) <= 30)
    assert.equal((await cooldown.json()).error.code, 'CHARACTER_RATE_LIMITED')
    assert.equal(providerCalls, 11)
    assert.deepEqual(await snapshot(), beforeHit)

    mark('섹션 하나가 만료되면 전체 갱신하고 같은 내용의 revision은 유지')
    await source.query(
      "UPDATE character_api_responses SET last_successful_fetch_at = clock_timestamp() - interval '5 minutes 1 second' WHERE character_id = $1 AND section = 'avatar'",
      [identity.characterId]
    )
    const automatic = await fetch(url)
    assert.equal(automatic.status, 200)
    assert.equal((await automatic.json()).sections.equipment.revision, 4)
    assert.equal(providerCalls, 22)
    await ageSuccessfulFetch()
    const beforeFailure = await snapshot()

    mark('upstream 실패는 기존 11개 섹션을 유지')
    fail = true
    const failure = await fetch(url + '/refresh', { method: 'POST' })
    assert.equal(failure.status, 503)
    assert.equal((await failure.json()).error.code, 'NEOPLE_UNAVAILABLE')
    assert.deepEqual(await snapshot(), beforeFailure)
    const callsBeforeInvalid = providerCalls
    for (const [target, options] of [
      [url + '?unknown=value', {}],
      [url, { method: 'HEAD' }],
      [url + '/refresh?force=true', { method: 'POST' }],
      [
        url + '/refresh',
        { method: 'POST', body: '{}', headers: { 'Content-Type': 'application/json' } }
      ]
    ]) {
      assert.equal((await fetch(target, options)).status, 400)
    }
    assert.equal(providerCalls, callsBeforeInvalid)

    const beforeCachedFailure = providerCalls
    assert.equal((await fetch(url)).status, 200)
    assert.equal(providerCalls, beforeCachedFailure)
    assert.deepEqual(await snapshot(), beforeFailure)

    mark('상세 호출 한도는 provider 호출 전에 거절')
    fail = false
    for (let i = 0; i < 4; i++) {
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
    await source.query('DELETE FROM characters WHERE character_id = ANY($1)', [fixtureIds])
    await source.query('DELETE FROM set_item_catalog WHERE set_item_id = $1', ['fixture-set'])
    await source.query('DELETE FROM item_catalog WHERE item_id = $1', ['fixture-item'])
  }
}
