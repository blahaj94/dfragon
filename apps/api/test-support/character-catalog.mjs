import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { setTimeout as delay } from 'node:timers/promises'
import { createCatalogStore } from '../dist/characters/catalog/store.js'
import { createCatalogService } from '../dist/characters/catalog/service.js'
import { catalogKey } from '../dist/characters/catalog/types.js'

export async function assertCharacterCatalog(source, mark = () => undefined) {
  const store = createCatalogStore(source)
  const signal = new AbortController().signal
  const item = { kind: 'item', itemId: 'catalog-fixture-item' }
  const skill = { kind: 'skill', jobId: 'catalog-fixture-job', skillId: 'catalog-fixture-skill' }
  const otherJob = { ...skill, jobId: 'catalog-fixture-other-job' }
  const set = { kind: 'set', setItemId: 'catalog-fixture-set' }
  const keys = [item, skill, otherJob, set]
  const clear = async () => {
    await source.query('DELETE FROM set_item_catalog WHERE set_item_id = $1', [set.setItemId])
    await source.query('DELETE FROM item_catalog WHERE item_id = $1', [item.itemId])
    await source.query('DELETE FROM skill_catalog WHERE skill_id = $1', [skill.skillId])
  }
  await clear()
  try {
    mark('first save, JSONB preservation and composite skill identity')
    const started = await store.read(keys, signal)
    const values = keys.map((key, i) => ({
      key,
      payload: { version: i, futureOption: { rate: '3%', chain: [null, 'skill', null] } }
    }))
    const saved = await store.saveAndRead(values, started.requestedAt, signal)
    assert.equal(saved.entries.length, 4)
    for (const entry of saved.entries) {
      assert.deepEqual(
        entry.payload,
        values.find((value) => catalogKey(value.key) === catalogKey(entry.key)).payload
      )
      assert(Math.abs(entry.expiresAt.getTime() - entry.fetchedAt.getTime() - 86_400_000) < 10)
    }

    mark('fresh reuse and expired cache failure retain exact original data')
    let calls = 0
    const service = createCatalogService(store, async () => {
      calls++
      throw new Error('fixture failure')
    })
    assert.equal((await service.load(keys, signal)).get(catalogKey(item)).status, 'fresh')
    assert.equal(calls, 0)
    await source.query(
      "UPDATE item_catalog SET expires_at = clock_timestamp() - interval '1 second' WHERE item_id = $1",
      [item.itemId]
    )
    const before = (await store.read(keys, signal)).entries.find(
      (entry) => entry.key.kind === 'item'
    )
    const stale = (await service.load(keys, signal)).get(catalogKey(item))
    assert.equal(stale.status, 'stale')
    assert.deepEqual(stale.data, before.payload)
    assert.equal(stale.fetchedAt, before.fetchedAt.toISOString())

    mark('older request cannot overwrite newer result, including concurrent row waits')
    const older = (await store.read(keys, signal)).requestedAt
    const newer = (await store.read(keys, signal)).requestedAt
    const blocker = source.createQueryRunner()
    await blocker.connect()
    await blocker.startTransaction()
    const [{ pid }] = await blocker.query('SELECT pg_backend_pid() AS pid')
    await blocker.query('SELECT item_id FROM item_catalog WHERE item_id = $1 FOR UPDATE', [
      item.itemId
    ])
    let oldWrite, newWrite
    try {
      newWrite = store.saveAndRead([{ key: item, payload: { version: 'newer' } }], newer, signal)
      oldWrite = store.saveAndRead([{ key: item, payload: { version: 'older' } }], older, signal)
      // Install handlers before observing lock waits so a DB failure cannot become an unhandled rejection.
      const settled = Promise.allSettled([oldWrite, newWrite])
      let blocked = false
      for (let i = 0; i < 100; i++) {
        const [{ count }] = await source.query(
          'SELECT count(*)::int AS count FROM pg_stat_activity WHERE $1 = ANY(pg_blocking_pids(pid))',
          [pid]
        )
        if (count >= 1) {
          blocked = true
          break
        }
        await delay(5)
      }
      assert(blocked, 'real row lock wait must be observed')
      await blocker.commitTransaction()
      assert((await settled).every((result) => result.status === 'fulfilled'))
    } finally {
      if (blocker.isTransactionActive) {
        await blocker.rollbackTransaction()
      }
      await blocker.release()
      await Promise.allSettled([oldWrite, newWrite].filter(Boolean))
    }
    assert.deepEqual((await store.read([item], signal)).entries[0].payload, { version: 'newer' })
    const skillNew = await store.saveAndRead(
      [{ key: skill, payload: { version: 'newer-skill' } }],
      newer,
      signal
    )
    const skillOld = await store.saveAndRead(
      [{ key: skill, payload: { version: 'older-skill' } }],
      older,
      signal
    )
    assert.deepEqual(skillOld.entries[0].payload, skillNew.entries[0].payload)

    mark('set rows retain newer data and stale fallback')
    const setNew = await store.saveAndRead(
      [
        {
          key: set,
          payload: { setItemName: '새 세트', setItemOption: [{ status: [{ value: '3%' }] }] }
        }
      ],
      newer,
      signal
    )
    const setOld = await store.saveAndRead(
      [{ key: set, payload: { setItemName: '이전 세트' } }],
      older,
      signal
    )
    assert.deepEqual(setOld.entries[0].payload, setNew.entries[0].payload)
    await source.query(
      "UPDATE set_item_catalog SET expires_at = clock_timestamp() - interval '1 second' WHERE set_item_id = $1",
      [set.setItemId]
    )
    const staleSet = (await service.load([set], signal)).get(catalogKey(set))
    assert.equal(staleSet.status, 'stale')
    assert.deepEqual(staleSet.data, setNew.entries[0].payload)
    assert.equal(staleSet.fetchedAt, setNew.entries[0].fetchedAt.toISOString())

    mark('invalidation rejects earlier in-flight refresh and the next request refreshes')
    const inFlight = (await store.read([item], signal)).requestedAt
    await source.query(
      'UPDATE item_catalog SET expires_at = clock_timestamp(), request_started_at = clock_timestamp() WHERE item_id = $1',
      [item.itemId]
    )
    const rejected = await store.saveAndRead(
      [{ key: item, payload: { invalidated: true } }],
      inFlight,
      signal
    )
    assert.deepEqual(rejected.entries[0].payload, { version: 'newer' })
    assert(rejected.entries[0].expiresAt <= rejected.now)
    const refresh = createCatalogService(store, async (requested) =>
      requested.map((key) => ({ key, payload: { updated: true } }))
    )
    assert.equal((await refresh.load([item], signal)).get(catalogKey(item)).status, 'fresh')

    mark('bad payload rolls back the whole write batch and cancellation creates no rows')
    const snapshot = (await store.read(keys, signal)).entries
    await assert.rejects(
      store.saveAndRead(
        [
          { key: item, payload: { shouldRollback: true } },
          { key: set, payload: [] }
        ],
        (await store.read(keys, signal)).requestedAt,
        signal
      )
    )
    assert.deepEqual((await store.read(keys, signal)).entries, snapshot)
    for (const invalidId of ['', 'bad/path', 'x'.repeat(257)]) {
      await assert.rejects(
        store.saveAndRead(
          [{ key: { kind: 'set', setItemId: invalidId }, payload: {} }],
          newer,
          signal
        )
      )
    }
    const aborted = new AbortController()
    aborted.abort()
    await assert.rejects(store.saveAndRead(values, newer, aborted.signal))

    mark('deployment grant gives runtime all three catalog permissions without DELETE')
    const runner = source.createQueryRunner()
    await runner.connect()
    await runner.startTransaction()
    try {
      await runner.query('CREATE ROLE ldb_migrator NOLOGIN')
      await runner.query('CREATE ROLE ldb_api NOLOGIN')
      await runner.query(
        'GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ldb_migrator WITH GRANT OPTION'
      )
      const grantFile = await readFile(
        new URL('../../../deploy/api/grant-api.sql', import.meta.url),
        'utf8'
      )
      const grantSql = grantFile
        .split('\n')
        .filter((line) => !line.startsWith('\\'))
        .join('\n')
        .replace('SET ROLE', 'SET LOCAL ROLE')
      await runner.query(grantSql)
      await runner.query('RESET ROLE')
      for (const table of ['item_catalog', 'skill_catalog', 'set_item_catalog']) {
        for (const privilege of ['SELECT', 'INSERT', 'UPDATE']) {
          const [row] = await runner.query(
            "SELECT has_table_privilege('ldb_api', $1, $2) AS allowed",
            [table, privilege]
          )
          assert.equal(row.allowed, true)
        }
        const [row] = await runner.query(
          "SELECT has_table_privilege('ldb_api', $1, 'DELETE') AS allowed",
          [table]
        )
        assert.equal(row.allowed, false)
      }
      await runner.query('SET LOCAL ROLE ldb_api')
      await runner.query(
        "INSERT INTO set_item_catalog VALUES ('runtime-set','{}',clock_timestamp(),clock_timestamp(),clock_timestamp())"
      )
      await runner.query(
        "UPDATE set_item_catalog SET payload = '{\"runtime\":true}' WHERE set_item_id = 'runtime-set'"
      )
      assert.deepEqual(
        (
          await runner.query(
            "SELECT payload FROM set_item_catalog WHERE set_item_id = 'runtime-set'"
          )
        )[0].payload,
        { runtime: true }
      )
    } finally {
      await runner.rollbackTransaction()
      await runner.release()
    }
  } finally {
    await clear()
  }
}
