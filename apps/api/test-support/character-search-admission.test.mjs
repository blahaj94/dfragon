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

async function reserve(admission, peerAddress = '192.0.2.1') {
  const controller = new AbortController()
  const lease = await admission.acquire(peerAddress, controller.signal)
  try {
    lease.assertCapacity()
    lease.reserve()
  } finally {
    lease.release()
  }
}

function assertLimited(lease, seconds) {
  assert.throws(
    () => lease.assertCapacity(),
    (error) => {
      assert.equal(error.status, 429)
      assert.deepEqual(error.body, {
        error: {
          code: 'SEARCH_RATE_LIMITED',
          message: '검색 요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.'
        }
      })
      assert.equal(error.retryAfter, seconds)

      return true
    }
  )
}

test('검색 한도는 정확히 60초에 만료되고 거절된 요청으로 창을 연장하지 않는다', async () => {
  const { SearchAdmission } = await import('../dist/characters/search-admission.js')
  const time = clock()
  const admission = new SearchAdmission(time)
  for (let count = 0; count < 10; count += 1) {
    await reserve(admission)
  }
  const controller = new AbortController()
  for (const [now, retryAfter] of [
    [0, 60],
    [58_001, 2],
    [59_999, 1]
  ]) {
    time.advance(now)
    const lease = await admission.acquire('192.0.2.1', controller.signal)
    assertLimited(lease, retryAfter)
    lease.release()
  }
  time.advance(60_000)
  await reserve(admission)
  assert.equal(admission.entryCount, 1)
  time.advance(120_000)
  assert.equal(admission.entryCount, 0)
  assert.equal(time.timerCount, 0)
})

test('같은 접속 IP의 admission만 직렬화하고 실제 예약 시각으로 한도를 계산한다', async () => {
  const { SearchAdmission } = await import('../dist/characters/search-admission.js')
  const time = clock()
  const admission = new SearchAdmission(time)
  const owner = await admission.acquire('192.0.2.1', new AbortController().signal)
  owner.assertCapacity()
  let waiterAcquired = false
  const pending = admission.acquire('192.0.2.1', new AbortController().signal).then((lease) => {
    waiterAcquired = true

    return lease
  })
  await reserve(admission, '192.0.2.2')
  assert.equal(waiterAcquired, false)
  time.advance(1000)
  owner.reserve()
  owner.release()
  const waiter = await pending
  waiter.release()
  for (let count = 1; count < 10; count += 1) {
    await reserve(admission)
  }
  time.advance(60_000)
  const beforeExactExpiry = await admission.acquire('192.0.2.1', new AbortController().signal)
  assertLimited(beforeExactExpiry, 1)
  beforeExactExpiry.release()
  time.advance(61_000)
  assert.equal(admission.entryCount, 0)
})

test('취소한 admission 대기자와 예약 없는 접속 IP entry를 정리한다', async () => {
  const { SearchAdmission } = await import('../dist/characters/search-admission.js')
  const admission = new SearchAdmission(clock())
  const ownerController = new AbortController()
  const owner = await admission.acquire('192.0.2.1', ownerController.signal)
  const waiterController = new AbortController()
  const pending = assert.rejects(admission.acquire('192.0.2.1', waiterController.signal), {
    status: 500,
    body: {
      error: { code: 'INTERNAL_SERVER_ERROR', message: '서버 오류로 검색을 처리하지 못했습니다.' }
    }
  })
  waiterController.abort()
  await pending
  assert.equal(admission.entryCount, 1)
  ownerController.abort()
  owner.release()
  assert.equal(admission.entryCount, 0)
  await assert.rejects(admission.acquire('192.0.2.1', waiterController.signal), { status: 500 })
  assert.equal(admission.entryCount, 0)
})

test('예약 만료 시 살아 있는 admission의 IP entry를 교체하지 않는다', async () => {
  const { SearchAdmission } = await import('../dist/characters/search-admission.js')
  const time = clock()
  const admission = new SearchAdmission(time)
  await reserve(admission)
  const owner = await admission.acquire('192.0.2.1', new AbortController().signal)
  time.advance(60_000)
  assert.equal(admission.entryCount, 1)
  let nextAcquired = false
  const next = admission.acquire('192.0.2.1', new AbortController().signal).then((lease) => {
    nextAcquired = true

    return lease
  })
  await Promise.resolve()
  assert.equal(nextAcquired, false)
  owner.release()
  const nextLease = await next
  nextLease.release()
  assert.equal(admission.entryCount, 0)
})

test('admission 대기는 1,999ms에는 통과하고 정확히 2,000ms에는 취소된다', async (t) => {
  const { SearchAdmission } = await import('../dist/characters/search-admission.js')
  for (const releaseAt of [1_999, 2_000]) {
    await t.test(`${releaseAt}ms 경계`, async () => {
      const time = clock()
      const admission = new SearchAdmission(time)
      const owner = await admission.acquire('192.0.2.1', new AbortController().signal)
      const deadline = new SearchDeadline(time)
      const pending = deadline.wait(admission.acquire('192.0.2.1', deadline.signal))
      const observed = pending.then(
        (lease) => ({ lease }),
        (error) => ({ error })
      )
      try {
        time.advance(releaseAt)
        owner.release()
        const result = await observed
        if (releaseAt === 1_999) {
          assert.equal(result.error, undefined)
          assert.equal(deadline.signal.aborted, false)
          result.lease.release()
        } else {
          assert.equal(result.lease, undefined)
          assert.equal(result.error.status, 500)
          assert.deepEqual(result.error.body, {
            error: {
              code: 'INTERNAL_SERVER_ERROR',
              message: '서버 오류로 검색을 처리하지 못했습니다.'
            }
          })
          assert.equal(deadline.signal.aborted, true)
        }
        assert.equal(admission.entryCount, 0)
      } finally {
        owner.release()
        deadline.dispose()
        admission.close()
      }
      assert.equal(time.timerCount, 0)
    })
  }
})

test('admission 종료는 대기자를 취소하고 예약, timer를 정리하며 새 요청을 거절한다', async () => {
  const { SearchAdmission } = await import('../dist/characters/search-admission.js')
  const time = clock()
  const admission = new SearchAdmission(time)
  await reserve(admission)
  const owner = await admission.acquire('192.0.2.1', new AbortController().signal)
  const rejected = assert.rejects(admission.acquire('192.0.2.1', new AbortController().signal), {
    status: 500,
    body: {
      error: { code: 'INTERNAL_SERVER_ERROR', message: '서버 오류로 검색을 처리하지 못했습니다.' }
    }
  })
  admission.close()
  await rejected
  assert.throws(() => owner.reserve(), { status: 500 })
  owner.release()
  assert.equal(admission.entryCount, 0)
  assert.equal(time.timerCount, 0)
  await assert.rejects(admission.acquire('192.0.2.2', new AbortController().signal), {
    status: 500
  })
})
