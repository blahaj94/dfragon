import assert from 'node:assert/strict'

export async function assertCharacterFame(source, mark = () => undefined) {
  const prefix = 'fixture-fame-'
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
  } finally {
    await cleanup()
  }
}
