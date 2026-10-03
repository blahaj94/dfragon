import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { formatDate } from '../format-date.mjs'

const script = fileURLToPath(new URL('../format-date.mjs', import.meta.url))

test('문자열이 아닌 시각은 UTC ISO 입력 오류로 거절한다', () => {
  for (const timestamp of [
    undefined,
    null,
    42,
    {},
    ['2026-09-08T15:35:00Z'],
    Symbol('timestamp')
  ]) {
    assert.throws(() => formatDate(timestamp), {
      message: 'Expected a valid UTC ISO timestamp ending in Z'
    })
  }
})

test('CLI는 host 시간대와 관계없이 연도 경계를 넘은 한국 자정을 출력한다', () => {
  for (const timeZone of ['UTC', 'America/New_York']) {
    const result = spawnSync(process.execPath, [script, '2026-12-31T15:00:59.999Z'], {
      encoding: 'utf8',
      env: { ...process.env, TZ: timeZone }
    })

    assert.equal(result.status, 0, result.stderr)
    assert.equal(result.stdout, '2027년 1월 1일 00시 00분\n')
  }
})

test('CLI에서 시각을 생략하면 현재 시각을 한국 시간으로 출력한다', () => {
  const clockImport = new URL('./fixtures/task-tools/format-date-clock.mjs', import.meta.url).href

  const result = spawnSync(process.execPath, ['--import', clockImport, script], {
    encoding: 'utf8',
    env: { ...process.env, TZ: 'UTC', FORMAT_DATE_TEST_NOW: '2026-09-08T15:35:00Z' }
  })

  assert.equal(result.status, 0, result.stderr)
  assert.equal(result.stdout, '2026년 9월 9일 00시 35분\n')
})

test('CLI는 잘못된 날짜·시간대 없는 시각을 출력 없이 실패 처리한다', () => {
  for (const timestamp of ['2026-01-01T99:00:00Z', '2026-02-30T00:00:00Z', '2026-09-08T15:35:00']) {
    const result = spawnSync(process.execPath, [script, timestamp], {
      encoding: 'utf8'
    })

    assert.equal(result.status, 1)
    assert.equal(result.stdout, '')
    assert.match(result.stderr, /UTC ISO/)
  }
})

test('윤일·월 경계·소수 초는 고정한 한국 시각으로 변환하고 분을 반올림하지 않는다', () => {
  for (const [timestamp, expected] of [
    ['2024-02-29T15:04:59Z', '2024년 3월 1일 00시 04분'],
    ['2026-01-31T23:59:59.999Z', '2026년 2월 1일 08시 59분'],
    ['2026-09-08T15:34:59.9Z', '2026년 9월 9일 00시 34분'],
    ['2026-09-08T15:34:59.99Z', '2026년 9월 9일 00시 34분'],
    ['2026-09-08T15:34:59.999Z', '2026년 9월 9일 00시 34분']
  ]) {
    assert.equal(formatDate(timestamp), expected, timestamp)
  }
})

test('자동 보정되는 날짜·시각과 계약 밖 ISO 표기는 오류로 거절한다', () => {
  for (const timestamp of [
    '2025-02-29T00:00:00Z',
    '2026-04-31T00:00:00Z',
    '2026-00-01T00:00:00Z',
    '2026-13-01T00:00:00Z',
    '2026-01-00T00:00:00Z',
    '2026-01-01T24:00:00Z',
    '2026-01-01T00:60:00Z',
    '2026-01-01T00:00:60Z',
    '2026-09-08',
    '2026-09-08T15:35:00+00:00',
    '2026-09-08T15:35:00.Z',
    '2026-09-08T15:35:00.1234Z',
    '2026-09-08t15:35:00z',
    ' 2026-09-08T15:35:00Z',
    '2026-09-08T15:35:00Z\n'
  ]) {
    assert.throws(
      () => formatDate(timestamp),
      { message: 'Expected a valid UTC ISO timestamp ending in Z' },
      timestamp
    )
  }
})

test('CLI는 추가 인자를 무시하지 않고 출력 없이 사용법 오류로 실패한다', () => {
  const result = spawnSync(process.execPath, [script, '2026-09-08T15:35:00Z', 'unexpected'], {
    encoding: 'utf8'
  })

  assert.equal(result.status, 1)
  assert.equal(result.stdout, '')
  assert.equal(result.stderr, 'Expected at most one UTC ISO timestamp\n')
})
