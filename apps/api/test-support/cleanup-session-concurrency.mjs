import assert from 'node:assert/strict'
import { blockedBy, bounded, databaseNow, settled } from './login-test-control.mjs'
import { fixture, stored, setDeadline, withLock } from './refresh-fixtures.mjs'
import { searchFixture, withSearchApp, searchRequest } from './character-search-fixtures.mjs'
import { cleanupWaitingOn, withCleanupDeletionHeld } from './cleanup-database-control.mjs'

async function cleanupFirst(source, cleanup) {
  const f = await searchFixture(source)
  await setDeadline(source, f.initial.session.id, await databaseNow(source))
  const userBefore = await source.query('SELECT * FROM users WHERE id=$1', [f.initial.user.id])
  let signingCalls = 0
  const signer = f.deps.issueAccessJwt
  f.deps.issueAccessJwt = async (input) => {
    signingCalls++
    return signer(input)
  }
  await withSearchApp(f, async ({ base, calls }) => {
    await withCleanupDeletionHeld({
      source,
      cleanup,
      table: 'auth_sessions',
      id: f.initial.session.id,
      operation: async ({ pid, waiter, release }) => {
        const search = settled(searchRequest(base, f))
        const refresh = settled(f.rotate(f.initial.refreshToken))
        try {
          const refreshPid = await bounded(waiter)
          await blockedBy(source, refreshPid, [pid])
          const result = await bounded(search)
          assert.equal(result.error, undefined)
          assert.equal(result.value.status, 200)
          assert.equal(calls.length, 1)
          release()
          assert.equal((await refresh).error?.code, 'AUTHENTICATION_REQUIRED')
        } finally {
          release()
          await Promise.all([search, refresh])
        }
      }
    })
  })
  assert.equal(signingCalls, 0)
  assert.deepEqual(await stored(source, f.initial.session.id), { session: undefined, tokens: [] })
  assert.deepEqual(
    await source.query('SELECT * FROM users WHERE id=$1', [f.initial.user.id]),
    userBefore
  )
}

async function staleSessionHint(source, cleanup, change) {
  const f = await fixture(source)
  const other = await fixture(source)
  const otherBefore = await stored(source, other.initial.session.id)
  await setDeadline(source, f.initial.session.id, await databaseNow(source))
  await withLock(source, 'auth_sessions', f, async ({ runner, pid }) => {
    await cleanupWaitingOn({
      source,
      cleanup,
      table: 'auth_sessions',
      id: f.initial.session.id,
      blocker: pid,
      unlock: async () => {
        const canCommit = runner.isTransactionActive
        if (!canCommit) {
          return
        }
        const shouldDelete = change === 'deleted'
        if (shouldDelete) {
          await runner.query('DELETE FROM auth_sessions WHERE id=$1', [f.initial.session.id])
        } else {
          await runner.query('UPDATE auth_sessions SET user_id=$2 WHERE id=$1', [
            f.initial.session.id,
            other.initial.user.id
          ])
        }
        await runner.commitTransaction()
      }
    })
  })
  const final = await stored(source, f.initial.session.id)
  const wasDeleted = change === 'deleted'
  if (wasDeleted) {
    assert.deepEqual(final, { session: undefined, tokens: [] })
  } else {
    assert.equal(final.session.user_id, other.initial.user.id)
    assert.equal(final.tokens.length, 1)
  }
  assert.deepEqual(await stored(source, other.initial.session.id), otherBefore)
  await cleanup(source)
}

export async function assertCleanupSessionConcurrency(source, cleanup, mark) {
  const cases = [
    [
      'cleanup blocks refresh while public search remains independent',
      () => cleanupFirst(source, cleanup)
    ],
    ['session disappears after cleanup hint', () => staleSessionHint(source, cleanup, 'deleted')],
    [
      'session ownership changes after cleanup hint',
      () => staleSessionHint(source, cleanup, 'ownership')
    ]
  ]
  for (const [name, run] of cases) {
    mark(name)
    await run()
  }
  return cases.length
}
