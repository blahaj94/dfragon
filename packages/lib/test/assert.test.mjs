import nodeAssert from 'node:assert/strict'
import test from 'node:test'
import { AssertionError, assert } from '@dfragon/lib/utils/assert'

test('assert는 truthy 조건을 통과시키고 falsy 조건이면 받은 message로 AssertionError를 던진다', () => {
  nodeAssert.doesNotThrow(() => assert(true))
  nodeAssert.doesNotThrow(() => assert({}))

  for (const falsy of [false, 0, '', null, undefined, Number.NaN]) {
    nodeAssert.throws(() => assert(falsy, '조건 불일치'), {
      name: 'AssertionError',
      message: '조건 불일치'
    })
  }
  nodeAssert.throws(
    () => assert(false),
    (error) => error instanceof AssertionError
  )
})

test('assert는 실패할 때 받은 Error를 그대로 던지고, 함수를 받으면 실패할 때만 호출해 그 Error를 던진다', () => {
  const failure = new RangeError('범위 밖')
  nodeAssert.throws(
    () => assert(false, failure),
    (error) => error === failure
  )

  let created = 0
  const createFailure = () => {
    created++

    return new RangeError('생성한 실패')
  }
  assert(true, createFailure)
  nodeAssert.equal(created, 0)
  nodeAssert.throws(() => assert(false, createFailure), {
    name: 'RangeError',
    message: '생성한 실패'
  })
  nodeAssert.equal(created, 1)
})
