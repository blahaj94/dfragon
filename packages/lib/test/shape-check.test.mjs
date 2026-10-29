import assert from 'node:assert/strict'
import test from 'node:test'
import {
  isFiniteNumber,
  isNonblankString,
  isRecord,
  textOrNull
} from '@dfragon/lib/utils/shape-check'

const TITLES = {
  record: 'null과 배열이 아닌 객체만 받고 키와 prototype은 보지 않는다',
  number: '숫자 검사는 NaN, 무한대, 숫자 문자열을 받지 않는다',
  strings: '공백만 있는 문자열은 비어 있지 않은 문자열이 아니다'
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

test(TITLES.number, () => {
  assert.deepEqual([0, -1.5, Number.MAX_VALUE].map(isFiniteNumber), [true, true, true])
  assert.deepEqual([Number.NaN, Infinity, '1', null].map(isFiniteNumber), [
    false,
    false,
    false,
    false
  ])
})

test(TITLES.strings, () => {
  assert.deepEqual(['가', ' 가 ', '', '  ', 1].map(isNonblankString), [
    true,
    true,
    false,
    false,
    false
  ])
  assert.deepEqual(['가', ' 가 ', '', '  ', 1, null].map(textOrNull), [
    '가',
    ' 가 ',
    null,
    null,
    null,
    null
  ])
})
