import assert from 'node:assert/strict'
import { createAdventureSearchStore } from '../dist/adventures/store.js'
import { createCharacterDetailStore } from '../dist/characters/details/store.js'
import { characterDetailSections } from '../dist/characters/details/sections.js'
import { createLoginHttpApp } from '../dist/auth/login/http.js'

export async function assertAdventureSearch(source, mark = () => undefined) {
  const ids = Array.from({ length: 7 }, (_, i) => `fixture-adventure-${i}`)
  const name = '합성모험단'
  const names = [name, name, null, '', 42, '%_모험단', '다른모험단']
  const signal = new AbortController().signal
  const details = createCharacterDetailStore(source)
  const search = createAdventureSearchStore(source)
  const input = (adventureName, limit = 100, after = null) => ({ adventureName, limit, after })
  const snapshot = () =>
    source.query('SELECT * FROM characters WHERE character_id = ANY($1) ORDER BY character_id', [
      ids
    ])
  const bodies = () =>
    source.query(
      'SELECT * FROM character_api_responses WHERE character_id = ANY($1) ORDER BY character_id, section',
      [ids]
    )
  const identity = { characterId: ids[0], serverId: 'siroco' }
  const payloads = (adventureName) =>
    Object.fromEntries(
      characterDetailSections.map((section) => [
        section,
        { ...identity, characterName: '합성캐릭터', adventureName }
      ])
    )
  let app
  try {
    mark('existing JSONB migration backfill and nullable duplicate names')
    await source.undoLastMigration({ transaction: 'all' })
    for (const [i, id] of ids.entries()) {
      await source.query(
        'INSERT INTO characters (character_id, server_id, created_at, updated_at) VALUES ($1,$2,clock_timestamp(),clock_timestamp())',
        [id, i === 1 ? 'cain' : 'siroco']
      )
      // The final character has never had a basic response collected.
      if (i === 6) {
        continue
      }
      await source.query(
        `INSERT INTO character_api_responses (character_id, section, payload, revision, content_updated_at, last_successful_fetch_at, request_started_at)
        VALUES ($1,'basic',$2,1,clock_timestamp(),clock_timestamp(),clock_timestamp())`,
        [
          id,
          JSON.stringify({
            characterName: '합성캐릭터',
            adventureName: names[i],
            level: 115,
            fame: i === 0 ? 0 : 100,
            jobName: '합성직업',
            jobGrowName: '합성전직'
          })
        ]
      )
    }
    const before = await bodies()
    const charactersBefore = await snapshot()
    const applied = await source.runMigrations({ transaction: 'all' })
    assert.equal(applied.length, 1)
    assert.deepEqual(await bodies(), before)
    const characters = await snapshot()
    assert.deepEqual(
      characters.map((row) => row.adventure_name),
      [name, name, null, null, null, '%_모험단', null]
    )
    assert.deepEqual(
      characters.map((row) =>
        Object.fromEntries(Object.entries(row).filter(([key]) => key !== 'adventure_name'))
      ),
      charactersBefore
    )

    mark('exact indexed lookup with cross-server keyset pages and no writes')
    const first = await search.search(input(name, 1), signal)
    assert.equal(first.scope, 'stored')
    assert.equal(first.rows.length, 1)
    assert.equal(first.rows[0].characterId, ids[0])
    assert.equal(first.rows[0].fame, 0)
    assert.equal(first.nextAfter, ids[0])
    const second = await search.search(input(name, 1, first.nextAfter), signal)
    assert.equal(second.rows[0].characterId, ids[1])
    assert.equal(second.rows[0].serverId, 'cain')
    assert.equal(second.nextAfter, null)
    assert.equal((await search.search(input('%_모험단'), signal)).rows[0].characterId, ids[5])
    assert.equal((await search.search(input('%'), signal)).rows.length, 0)
    assert.equal((await search.search(input("' OR 1=1 --"), signal)).rows.length, 0)
    assert.equal((await search.search(input('없는모험단'), signal)).nextAfter, null)
    assert.deepEqual(await snapshot(), characters)
    assert.deepEqual(await bodies(), before)

    mark('rename only the refreshed character and keep the winning stored name')
    const older = await details.beginFetch()
    const newer = await details.beginFetch()
    await details.saveAndRead(identity, payloads('새모험단'), newer, signal)
    await details.saveAndRead(identity, payloads('늦은모험단'), older, signal)
    assert.equal((await search.search(input('새모험단'), signal)).rows[0].characterId, ids[0])
    assert.equal((await search.search(input('늦은모험단'), signal)).rows.length, 0)
    assert.deepEqual(
      (await search.search(input(name), signal)).rows.map((r) => r.characterId),
      [ids[1]]
    )
    const saved = await snapshot()
    const bad = payloads('실패모험단')
    bad.buff_creature = null
    await assert.rejects(details.saveAndRead(identity, bad, await details.beginFetch(), signal))
    assert.deepEqual(await snapshot(), saved)
    await details.saveAndRead(identity, payloads(null), await details.beginFetch(), signal)
    assert.equal((await snapshot())[0].adventure_name, null)
    assert.equal((await search.search(input('새모험단'), signal)).rows.length, 0)

    mark('HTTP database read returns pages without provider calls')
    const unused = async () => {
      throw new Error('Unexpected unrelated service')
    }
    app = await createLoginHttpApp(
      { create: unused, exchange: unused, authorize: unused, callback: unused },
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      search
    )
    await app.listen(0, '127.0.0.1')
    const url = `${await app.getUrl()}/adventures/characters?adventureName=${encodeURIComponent(name)}`
    const response = await fetch(url)
    assert.equal(response.status, 200)
    const body = await response.json()
    assert.equal(body.scope, 'stored')
    assert.equal(body.adventureName, name)
    assert.deepEqual(
      body.rows.map((r) => r.characterId),
      [ids[1]]
    )
    assert.equal(body.nextAfter, null)
  } finally {
    if (app) {
      await app.close()
    }
    await source.query('DELETE FROM characters WHERE character_id = ANY($1)', [ids])
  }
}
