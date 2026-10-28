import assert from 'node:assert/strict'
import { test } from 'node:test'
import { SearchDeadline } from '../dist/characters/search-deadline.js'

function clock() {
  let now = 0
  let nextTimer = 0
  const timers = new Map()

  return {
    now: () => now,
    setTimer(callback, delay) {
      const timer = ++nextTimer
      timers.set(timer, { callback, at: now + delay })

      return timer
    },
    clearTimer: (timer) => timers.delete(timer),
    advance(time) {
      now = time
      for (const [id, timer] of timers) {
        const isDue = timer.at <= now
        if (!isDue) {
          continue
        }
        timers.delete(id)
        timer.callback()
      }
    },
    get timerCount() {
      return timers.size
    }
  }
}

test('deadline 대기는 1,999ms에는 통과하고 정확히 2,000ms에는 취소된다', async (t) => {
  for (const releaseAt of [1_999, 2_000]) {
    await t.test(`${releaseAt}ms 경계`, async () => {
      const time = clock()
      let finish
      const operation = new Promise((resolve) => {
        finish = resolve
      })
      const deadline = new SearchDeadline(time)
      const observed = deadline.wait(operation).then(
        (value) => ({ value }),
        (error) => ({ error })
      )
      try {
        time.advance(releaseAt)
        finish('완료')
        const result = await observed
        if (releaseAt === 1_999) {
          assert.deepEqual(result, { value: '완료' })
          assert.equal(deadline.signal.aborted, false)
        } else {
          assert.equal(result.value, undefined)
          assert.equal(result.error.status, 500)
          assert.equal(result.error.body.error.code, 'INTERNAL_SERVER_ERROR')
          assert.equal(deadline.signal.aborted, true)
        }
      } finally {
        deadline.dispose()
      }
      assert.equal(time.timerCount, 0)
    })
  }
})
