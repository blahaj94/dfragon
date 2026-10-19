import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createCharacterDetailService } from '../dist/characters/details/service.js'
import { createCharacterDetailStore } from '../dist/characters/details/store.js'

const fixtureUrl = new URL('../test/fixtures/character-card-dealer.json', import.meta.url)

export async function assertCharacterFame(source, mark = () => undefined) {
  const prefix = 'fixture-fame-'
  const signal = new AbortController().signal
  const store = createCharacterDetailStore(source)
  const characters = () =>
    source.query('SELECT * FROM characters WHERE character_id LIKE $1 ORDER BY character_id', [
      `${prefix}%`
    ])
  const insert = async (characterId, serverId, basic) => {
    await source.query(
      'INSERT INTO characters (character_id, server_id, created_at, updated_at) VALUES ($1,$2,clock_timestamp(),clock_timestamp())',
      [characterId, serverId]
    )
    if (basic !== undefined) {
      await source.query(
        `INSERT INTO character_api_responses (character_id, section, payload, revision, content_updated_at, last_successful_fetch_at, request_started_at)
        VALUES ($1,'basic',$2,1,clock_timestamp(),clock_timestamp(),clock_timestamp())`,
        [characterId, JSON.stringify(basic)]
      )
    }
  }
  const fameColumn = async () =>
    (
      await source.query(
        "SELECT data_type, is_nullable FROM information_schema.columns WHERE table_name = 'characters' AND column_name = 'fame'"
      )
    )[0]
  const cleanup = () =>
    source.query('DELETE FROM characters WHERE character_id LIKE $1', [`${prefix}%`])
  await cleanup()
  let service
  try {
    mark('migration down은 명성 column과 index만 지우고 기존 캐릭터 행을 유지')
    // Exercise this migration even when later unrelated migrations exist.
    const migration = source.migrations.find((m) => m.name === 'AddCharacterFame1792360553578')
    assert(migration)
    assert.deepEqual(await fameColumn(), { data_type: 'integer', is_nullable: 'YES' })
    await insert(`${prefix}rollback`, 'siroco', { fame: 100 })
    await source.query('UPDATE characters SET fame = 100 WHERE character_id = $1', [
      `${prefix}rollback`
    ])
    const [kept] = await characters()
    await source.transaction((manager) => migration.down(manager.queryRunner))
    assert.equal(await fameColumn(), undefined)
    const { fame: _fame, ...keptWithoutFame } = kept
    assert.deepEqual(await characters(), [keptWithoutFame])
    assert.deepEqual(
      await source.query(
        "SELECT indexname FROM pg_indexes WHERE indexname = 'idx_characters_fame_character_id'"
      ),
      []
    )
    await cleanup()

    mark('migration up은 기존 기본정보의 정수 명성만 채우고 JSONB, 다른 column을 유지')
    const fames = [100, 0, null, '1000', 1.5, 3_000_000_000, -1, undefined]
    for (const [i, fame] of fames.entries()) {
      await insert(`${prefix}backfill-${i}`, 'siroco', fame === undefined ? {} : { fame })
    }
    await insert(`${prefix}backfill-no-basic`, 'siroco')
    const bodies = () =>
      source.query(
        'SELECT * FROM character_api_responses WHERE character_id LIKE $1 ORDER BY character_id',
        [`${prefix}%`]
      )
    const bodiesBefore = await bodies()
    const before = await characters()
    await source.transaction((manager) => migration.up(manager.queryRunner))
    const after = await characters()
    assert.deepEqual(
      after.map((row) => row.fame),
      [100, 0, null, null, null, null, null, null, null]
    )
    assert.deepEqual(
      after.map(({ fame: _fame, ...row }) => row),
      before
    )
    assert.deepEqual(await bodies(), bodiesBefore)
    const [index] = await source.query(
      "SELECT indexdef FROM pg_indexes WHERE indexname = 'idx_characters_fame_character_id'"
    )
    assert.match(index.indexdef, /\(fame DESC, character_id\)$/)
    assert.equal((await source.driver.createSchemaBuilder().log()).upQueries.length, 0)
    await cleanup()

    mark('성공 갱신은 이긴 기본정보로 명성을 맞추고 같은 값이면 updated_at을 유지')
    const fixture = JSON.parse(await readFile(fixtureUrl, 'utf8'))
    const identity = { serverId: 'cain', characterId: `${prefix}target` }
    const payloads = (fame) =>
      Object.fromEntries(
        Object.entries(fixture.sections).map(([section, payload]) => [
          section,
          { ...payload, ...identity, fame }
        ])
      )
    await store.saveAndRead(identity, payloads(50_000), await store.beginFetch(), signal)
    const [first] = await characters()
    assert.equal(first.fame, 50_000)
    await store.saveAndRead(identity, payloads(50_000), await store.beginFetch(), signal)
    assert.deepEqual((await characters())[0], first)
    const older = await store.beginFetch()
    const newer = await store.beginFetch()
    await store.saveAndRead(identity, payloads(52_000), newer, signal)
    await store.saveAndRead(identity, payloads(10), older, signal)
    const [updated] = await characters()
    assert.equal(updated.fame, 52_000)
    assert(updated.updated_at > first.updated_at)
    const failed = payloads(1)
    failed.buff_creature = null
    await assert.rejects(store.saveAndRead(identity, failed, await store.beginFetch(), signal))
    assert.deepEqual((await characters())[0], updated)

    mark('명성 순위는 모든 서버를 함께 세고 동점은 같은 순위이며 명성 null은 제외')
    // Other suites clean up their characters, so only this fixture can carry fame here.
    const [{ others }] = await source.query(
      'SELECT count(*)::int AS others FROM characters WHERE fame IS NOT NULL AND character_id NOT LIKE $1',
      [`${prefix}%`]
    )
    assert.equal(others, 0)
    for (const [name, serverId, fame] of [
      ['higher', 'cain', 60_000],
      ['tie', 'cain', 52_000],
      ['lower', 'cain', 100],
      ['unknown', 'cain', null],
      ['other-server', 'siroco', 90_000]
    ]) {
      await insert(`${prefix}${name}`, serverId)
      await source.query('UPDATE characters SET fame = $2 WHERE character_id = $1', [
        `${prefix}${name}`,
        fame
      ])
    }
    const rankOf = (name, serverId = 'cain') =>
      store.readServerRank({ serverId, characterId: `${prefix}${name}` }, signal)
    const target = await rankOf('target')
    assert.deepEqual(
      { ...target, observedAt: undefined },
      { rank: 3, total: 5, basis: 'fame', scope: 'stored', observedAt: undefined }
    )
    const [{ now }] = await source.query('SELECT clock_timestamp() AS now')
    assert(Math.abs(Date.parse(target.observedAt) - now.getTime()) < 60_000)
    assert.equal((await rankOf('tie')).rank, 3)
    assert.equal((await rankOf('higher')).rank, 2)
    assert.equal((await rankOf('lower')).rank, 5)
    assert.equal(await rankOf('unknown'), null)
    assert.deepEqual(
      { ...(await rankOf('other-server', 'siroco')), observedAt: undefined },
      { rank: 1, total: 5, basis: 'fame', scope: 'stored', observedAt: undefined }
    )
    // The identity still has to match the stored server of the character.
    assert.equal(await rankOf('other-server', 'cain'), null)

    mark('순위 조회가 2초 statement 제한에 걸리면 상세 응답은 serverRank만 null')
    const blocker = source.createQueryRunner()
    await blocker.connect()
    try {
      await blocker.startTransaction()
      // Reads wait behind ACCESS EXCLUSIVE, so the ranking hits its own statement timeout.
      await blocker.query('LOCK TABLE characters IN ACCESS EXCLUSIVE MODE')
      const startedAt = performance.now()
      await assert.rejects(rankOf('target'), /statement timeout/)
      assert(performance.now() - startedAt >= 1900)
    } finally {
      await blocker.rollbackTransaction()
      await blocker.release()
    }
    let blockRank = true
    service = createCharacterDetailService({
      store: {
        ...store,
        async readServerRank(...args) {
          if (!blockRank) {
            return store.readServerRank(...args)
          }
          const holder = source.createQueryRunner()
          await holder.connect()
          try {
            await holder.startTransaction()
            await holder.query('LOCK TABLE characters IN ACCESS EXCLUSIVE MODE')

            return await store.readServerRank(...args)
          } finally {
            await holder.rollbackTransaction()
            await holder.release()
          }
        }
      },
      fetchDetails: async () => {
        throw new Error('저장값이 유효하므로 공급자를 호출하지 않는다')
      }
    })
    const timedOut = await service.get('127.0.0.1', identity, signal)
    assert.equal(timedOut.card.serverRank, null)
    const expected = { ...fixture.card }
    assert.deepEqual({ ...timedOut.card, serverRank: null }, { ...expected, serverRank: null })
    blockRank = false
    const ranked = await service.get('127.0.0.1', identity, signal)
    assert.equal(ranked.card.serverRank.rank, 3)
    assert.deepEqual({ ...ranked.card, serverRank: null }, { ...expected, serverRank: null })
  } finally {
    await service?.onModuleDestroy()
    await cleanup()
  }
}
