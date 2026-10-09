import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { setTimeout as delay } from 'node:timers/promises'
import { isDeepStrictEqual } from 'node:util'
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
  const insertedItem = { kind: 'item', itemId: 'catalog-fixture-new-item' }
  const canceledItem = { kind: 'item', itemId: 'catalog-fixture-canceled-item' }
  const clear = async () => {
    await source.query('DELETE FROM set_item_catalog WHERE set_item_id = $1', [set.setItemId])
    await source.query('DELETE FROM item_catalog WHERE item_id = ANY($1)', [
      [item.itemId, insertedItem.itemId, canceledItem.itemId]
    ])
    await source.query('DELETE FROM skill_catalog WHERE skill_id = $1', [skill.skillId])
  }
  await clear()
  try {
    mark('최초 공용 상세 저장의 JSONB 원문, 복합 스킬 식별자, 24시간 캐시')
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
        values.find((value) => isDeepStrictEqual(value.key, entry.key)).payload
      )
      assert(Math.abs(entry.expiresAt.getTime() - entry.fetchedAt.getTime() - 86_400_000) < 10)
    }

    mark('유효 캐시 재사용과 갱신 실패의 이전 원문, 조회 시각 보존')
    let calls = 0
    const service = createCatalogService(store, async () => {
      calls++
      throw new Error('fixture failure')
    })
    assert.equal((await service.load(keys, signal)).get(catalogKey(item)).detail.status, 'fresh')
    assert.equal(calls, 0)
    await source.query(
      "UPDATE item_catalog SET expires_at = clock_timestamp() - interval '1 second' WHERE item_id = $1",
      [item.itemId]
    )
    const before = (await store.read(keys, signal)).entries.find(
      (entry) => entry.key.kind === 'item'
    )
    const stale = (await service.load(keys, signal)).get(catalogKey(item)).detail
    assert.equal(stale.status, 'stale')
    assert.deepEqual(stale.data, before.payload)
    assert.equal(stale.fetchedAt, before.fetchedAt.toISOString())

    mark('실제 행 잠금 대기에서도 늦은 이전 아이템, 스킬 요청이 최신 값을 덮어쓰지 않음')
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
          `WITH RECURSIVE waiters(pid) AS (
            SELECT pid FROM pg_stat_activity WHERE $1 = ANY(pg_blocking_pids(pid))
            UNION
            SELECT activity.pid FROM pg_stat_activity activity
              JOIN waiters ON waiters.pid = ANY(pg_blocking_pids(activity.pid))
          ) SELECT count(*)::int AS count FROM waiters`,
          [pid]
        )
        if (count >= 2) {
          blocked = true
          break
        }
        await delay(5)
      }
      assert(blocked, '두 요청의 실제 PostgreSQL 잠금 대기를 관측해야 한다')
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

    mark('세트 상세의 최신 저장값과 실패 시 stale 반환')
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
    mark('아이템, 스킬, 세트의 동일 시각 요청은 먼저 저장한 원문과 조회 시각을 유지한다')
    const tieKeys = [item, skill, set]
    const beforeTie = (await store.read(tieKeys, signal)).entries
    const tie = await store.saveAndRead(
      tieKeys.map((key) => ({
        key,
        payload: { shouldNotReplace: true }
      })),
      newer,
      signal
    )
    assert.deepEqual(tie.entries, beforeTie)
    assert.deepEqual((await store.read(tieKeys, signal)).entries, beforeTie)
    await source.query(
      "UPDATE set_item_catalog SET expires_at = clock_timestamp() - interval '1 second' WHERE set_item_id = $1",
      [set.setItemId]
    )
    const staleSet = (await service.load([set], signal)).get(catalogKey(set)).detail
    assert.equal(staleSet.status, 'stale')
    assert.deepEqual(staleSet.data, setNew.entries[0].payload)
    assert.equal(staleSet.fetchedAt, setNew.entries[0].fetchedAt.toISOString())

    mark('무효화는 진행 중인 이전 요청을 거절하고 다음 요청에서 갱신')
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
    const refreshedPayload = {
      itemId: item.itemId,
      itemName: '갱신된 테스트 장비',
      itemRarity: '에픽',
      itemType: '무기',
      itemAvailableLevel: 115,
      futureOption: { rate: '3%', chain: [null, { value: 1 }, null] }
    }
    const refresh = createCatalogService(store, async (requested) => {
      assert.deepEqual(requested, [item])

      return [{ key: item, payload: refreshedPayload }]
    })
    const refreshed = (await refresh.load([item], signal)).get(catalogKey(item)).detail
    assert.equal(refreshed.status, 'fresh')
    assert.deepEqual(refreshed.data, refreshedPayload)
    const [storedItem] = await source.query('SELECT payload FROM item_catalog WHERE item_id = $1', [
      item.itemId
    ])
    assert.deepEqual(storedItem.payload, refreshedPayload)

    mark('저장 실패는 신규, 기존 batch 전체를 rollback하고 취소는 새 행을 생성하지 않음')
    const snapshot = (await store.read(keys, signal)).entries
    await assert.rejects(
      store.saveAndRead(
        [
          { key: insertedItem, payload: { shouldRollback: true } },
          { key: item, payload: { shouldRollback: true } },
          { key: set, payload: [] }
        ],
        (await store.read(keys, signal)).requestedAt,
        signal
      )
    )
    assert.deepEqual((await store.read(keys, signal)).entries, snapshot)
    assert.deepEqual((await store.read([insertedItem], signal)).entries, [])
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
    await assert.rejects(
      store.saveAndRead(
        [
          { key: canceledItem, payload: { shouldNotExist: true } },
          { key: item, payload: { shouldNotReplace: true } }
        ],
        (await store.read(keys, signal)).requestedAt,
        aborted.signal
      )
    )
    assert.deepEqual((await store.read(keys, signal)).entries, snapshot)
    assert.deepEqual((await store.read([canceledItem], signal)).entries, [])

    mark('실제 테스트 role은 공용 상세 세 테이블의 SELECT, INSERT, UPDATE만 허용')
    const runner = source.createQueryRunner()
    await runner.connect()
    await runner.startTransaction()
    try {
      await runner.query('CREATE ROLE dfragon_migrator NOLOGIN')
      await runner.query('CREATE ROLE dfragon_api NOLOGIN')
      await runner.query(
        'GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO dfragon_migrator WITH GRANT OPTION'
      )
      const grantFile = await readFile(new URL('./grant-api.sql', import.meta.url), 'utf8')
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
            "SELECT has_table_privilege('dfragon_api', $1, $2) AS allowed",
            [table, privilege]
          )
          assert.equal(row.allowed, true)
        }
        const [row] = await runner.query(
          "SELECT has_table_privilege('dfragon_api', $1, 'DELETE') AS allowed",
          [table]
        )
        assert.equal(row.allowed, false)
      }
      await runner.query('SET LOCAL ROLE dfragon_api')
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
