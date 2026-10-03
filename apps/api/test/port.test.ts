import assert from 'node:assert/strict'
import test from 'node:test'
import { parsePort } from '../src/port.js'

test('PORT는 허용 범위의 ASCII 십진 정수와 선행 0을 받는다', () => {
  assert.equal(parsePort('1'), 1)
  assert.equal(parsePort('65535'), 65_535)
  assert.equal(parsePort('00001'), 1)
})

test('PORT는 누락·범위 초과·공백·비십진 입력을 거절한다', () => {
  const invalidValues = [
    undefined,
    '',
    '0',
    '65536',
    '1.5',
    '+1',
    '-1',
    ' 1',
    '1 ',
    '1\n',
    '1e3',
    '0x10',
    '9007199254740993',
    '１',
    '١'
  ]

  for (const value of invalidValues) {
    assert.throws(() => parsePort(value), { message: 'Invalid server configuration' })
  }
})
