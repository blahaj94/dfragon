import assert from 'node:assert/strict'
import test from 'node:test'
import {
  exactObject,
  hasExactKeys,
  isFiniteNumber,
  isNonblankString,
  isNonNegativeSafeInteger,
  isNullableFiniteNumber,
  isNullableString,
  isOffsetTimestamp,
  isPositiveSafeInteger,
  isRecord,
  isUtcTimestamp,
  listOf,
  nullable,
  oneOf
} from '@dfragon/lib/utils/shape-check'

const TITLES = {
  record: 'null과 배열이 아닌 객체만 받고 키와 prototype은 보지 않는다',
  exactKeys: '정한 키만 가진, 배열이 아닌 객체를 받고 빠진 키, 추가 키와 symbol 키를 거절한다',
  numbers:
    '숫자 검사는 NaN, 무한대, 숫자 문자열을 받지 않고 정수 검사는 안전 정수와 부호를 구분한다',
  strings:
    '빈 문자열은 null 허용 문자열에서만 받고 공백만 있는 문자열은 비어 있지 않은 문자열이 아니다',
  utc: 'UTC 시각은 Z로 끝나는 실제 날짜만 받고 넘치는 날짜와 시각, offset 시각을 거절한다',
  offset: 'offset 시각은 Z와 ±HH:MM을 받고 날짜 형식이 아닌 문자열을 거절한다',
  combinators: '조합 검사는 null, 고른 값, 모든 항목, 정확한 키와 값으로 판정한다'
}

test(TITLES.record, () => {
  assert.deepEqual([{}, { a: 1 }, new Date(0), Object.create(null)].map(isRecord), [
    true,
    true,
    true,
    true
  ])
  assert.deepEqual([null, undefined, [], 'a', 1].map(isRecord), [false, false, false, false, false])
})

test(TITLES.exactKeys, () => {
  assert.equal(hasExactKeys({ a: 1, b: undefined }, ['a', 'b']), true)
  assert.equal(hasExactKeys({ a: 1 }, ['a', 'b']), false)
  assert.equal(hasExactKeys({ a: 1, b: 2, c: 3 }, ['a', 'b']), false)
  assert.equal(hasExactKeys({ a: 1, [Symbol('extra')]: 2 }, ['a']), false)
  assert.equal(hasExactKeys(['a'], ['0']), false)
  assert.equal(hasExactKeys(null, []), false)
})

test(TITLES.numbers, () => {
  assert.deepEqual([0, -1.5, Number.MAX_VALUE].map(isFiniteNumber), [true, true, true])
  assert.deepEqual([Number.NaN, Infinity, '1', null].map(isFiniteNumber), [
    false,
    false,
    false,
    false
  ])
  assert.deepEqual([null, 2, Number.NaN].map(isNullableFiniteNumber), [true, true, false])
  assert.deepEqual(
    [0, 3, -1, 1.5, Number.MAX_SAFE_INTEGER + 1, '2'].map(isNonNegativeSafeInteger),
    [true, true, false, false, false, false]
  )
  assert.deepEqual([1, 0, -2, 2.5].map(isPositiveSafeInteger), [true, false, false, false])
})

test(TITLES.strings, () => {
  assert.deepEqual([null, '', '가나'].map(isNullableString), [true, true, true])
  assert.equal(isNullableString(undefined), false)
  assert.deepEqual(['가', ' 가 ', '', '  ', 1].map(isNonblankString), [
    true,
    true,
    false,
    false,
    false
  ])
})

test(TITLES.utc, () => {
  for (const value of ['2026-10-07T00:00Z', '2026-10-07T00:00:00Z', '2026-10-07T00:00:00.123Z']) {
    assert.equal(isUtcTimestamp(value), true, value)
  }
  for (const value of [
    '2026-02-30T00:00:00Z',
    '2026-10-07T24:00:00Z',
    '2026-10-07T00:00:00+09:00',
    '2026-10-07',
    'private-date'
  ]) {
    assert.equal(isUtcTimestamp(value), false, value)
  }
})

test(TITLES.offset, () => {
  assert.equal(isOffsetTimestamp('2026-10-07T00:00:00.000Z'), true)
  assert.equal(isOffsetTimestamp('2026-10-07T09:00:00+09:00'), true)
  assert.equal(isOffsetTimestamp('yesterday'), false)
  assert.equal(isOffsetTimestamp(1_791_000_000_000), false)
})

test(TITLES.combinators, () => {
  const role = oneOf('dealer', 'buffer')
  const point = exactObject({ current: isFiniteNumber, label: nullable(isNonblankString) })
  const points = listOf(point)

  assert.deepEqual(['dealer', 'buffer', 'tank'].map(role), [true, true, false])
  assert.equal(points([]), true)
  assert.equal(
    points([
      { current: 1, label: null },
      { current: 2, label: '두 번째' }
    ]),
    true
  )
  assert.equal(
    points([
      { current: 1, label: null },
      { current: '2', label: null }
    ]),
    false
  )
  assert.equal(points([{ current: 1 }]), false)
  assert.equal(points([{ current: 1, label: null, extra: true }]), false)
  assert.equal(points({ 0: { current: 1, label: null } }), false)
})
