import { expect, it, vi } from 'vitest'
import { toRaidFrameResult } from './raid-frame'
import { readRaidWindowValues } from '../lib/raid-window'
import { raidFrame } from '../lib/raid-window-test-fixture'

vi.mock('../lib/raid-window', async (original) => {
  const actual = await original<typeof import('../lib/raid-window')>()

  return { ...actual, readRaidWindowValues: vi.fn(actual.readRaidWindowValues) }
})

// 합성 창의 첫 행 닉네임 칸은 client (497, 169)에서 시작하는 86×17이고 행 간격은 21이다.
const NICKNAME = { x: 497, y: 169, width: 86, height: 17, rowSpacing: 21 }
// 닉네임 칸 오른쪽의 이 열은 직업명 칸 안이다.
const JOB = { x: 582, y: 169, rowSpacing: 21 }

function nicknamePixels(frame: ReturnType<typeof raidFrame>, row: number): Uint8Array {
  const rgba = new Uint8Array(NICKNAME.width * NICKNAME.height * 4)
  for (let line = 0; line < NICKNAME.height; line += 1) {
    const start = ((NICKNAME.y + NICKNAME.rowSpacing * row + line) * frame.width + NICKNAME.x) * 4
    rgba.set(frame.rgba.subarray(start, start + NICKNAME.width * 4), line * NICKNAME.width * 4)
  }

  return rgba
}

it('공대 상세 창의 12행을 화면 순서로 돌려주고 빈 행은 null, 원본 프레임은 넘기지 않는다', () => {
  const frame = raidFrame(9)
  const original = frame.rgba.slice()

  const result = toRaidFrameResult({ kind: 'frame', image: frame })

  expect(result.kind).toBe('rows')
  if (result.kind !== 'rows') {
    return
  }
  expect(Object.keys(result)).toEqual(['kind', 'valueColumn', 'rows'])
  // 합성 창의 기준 헤더는 장비 점수 열 제목을 담는다.
  expect(result.valueColumn).toBe('equipment-score')
  expect(result.rows).toHaveLength(12)
  expect(result.rows.map((row) => row !== null)).toEqual(
    Array.from({ length: 12 }, (_, row) => row < 9)
  )
  // 큰 픽셀 배열은 요소마다 비교하는 toEqual 대신 바이트 비교로 확인한다(1067×600 프레임은 수 초가 걸린다).
  for (const [row, entry] of result.rows.slice(0, 9).entries()) {
    expect(Object.keys(entry!)).toEqual(['nickname', 'job', 'valueText'])
    // 합성 행에는 수치 글자를 그리지 않았다.
    expect(entry!.valueText).toBeNull()
    expect(entry!.job).not.toBeNull()
    const nickname = entry!.nickname
    expect(Object.keys(nickname)).toEqual(['width', 'height', 'rgba'])
    expect([nickname?.width, nickname?.height]).toEqual([NICKNAME.width, NICKNAME.height])
    expect(nickname!.rgba).toBeInstanceOf(Uint8Array)
    const expected = nicknamePixels({ ...frame, rgba: original }, row)
    expect(Buffer.from(nickname!.rgba).equals(Buffer.from(expected))).toBe(true)
  }
  // 전달한 크롭을 바꿔도 회차 프레임은 그대로다.
  result.rows[0]!.nickname.rgba.fill(0)
  result.rows[0]!.job!.rgba.fill(0)
  expect(Buffer.from(frame.rgba).equals(Buffer.from(original))).toBe(true)
})

it('다른 창에 가려 투명하게 제외된 픽셀이 있는 행만 읽지 않는다', () => {
  const frame = raidFrame(12)
  const covered = ((NICKNAME.y + NICKNAME.rowSpacing * 4 + 8) * frame.width + NICKNAME.x + 40) * 4
  frame.rgba[covered + 3] = 0

  const result = toRaidFrameResult({ kind: 'frame', image: frame })

  expect(result.kind).toBe('rows')
  if (result.kind === 'rows') {
    expect(result.rows.map((row) => row === null)).toEqual(
      Array.from({ length: 12 }, (_, row) => row === 4)
    )
  }
})

it('직업명 칸만 가려진 행은 닉네임을 남기고 직업명 크롭만 null이다', () => {
  const frame = raidFrame(12)
  const covered = ((JOB.y + JOB.rowSpacing * 2 + 8) * frame.width + JOB.x + 20) * 4
  frame.rgba[covered + 3] = 0

  const result = toRaidFrameResult({ kind: 'frame', image: frame })

  expect(result.kind).toBe('rows')
  if (result.kind === 'rows') {
    expect(result.rows.map((row) => row?.job === null)).toEqual(
      Array.from({ length: 12 }, (_, row) => row === 2)
    )
    expect(result.rows.every((row) => row !== null)).toBe(true)
  }
})

it('FHD보다 큰 프레임은 창을 찾아도 수치 칸을 읽지 않는다', () => {
  const small = raidFrame(3)
  const width = 1921
  const height = 1080
  const rgba = new Uint8Array(width * height * 4)
  for (let line = 0; line < small.height; line += 1) {
    rgba.set(
      small.rgba.subarray(line * small.width * 4, (line + 1) * small.width * 4),
      line * width * 4
    )
  }

  const result = toRaidFrameResult({ kind: 'frame', image: { width, height, rgba } })

  expect(result.kind).toBe('rows')
  if (result.kind === 'rows') {
    expect(result.valueColumn).toBe('equipment-score')
    expect(result.rows.slice(0, 3).map((row) => row?.valueText)).toEqual([null, null, null])
  }
})

it('창을 찾지 못하거나 후보가 둘이면 크롭 없이 미검출 사유만 돌려준다', () => {
  const empty = { width: 1067, height: 600, rgba: new Uint8Array(1067 * 600 * 4) }
  expect(toRaidFrameResult({ kind: 'frame', image: empty })).toEqual({
    kind: 'missing',
    reason: 'not-found'
  })
  const two = raidFrame(12, [
    { x: 20, y: 30 },
    { x: 580, y: 30 }
  ])
  expect(toRaidFrameResult({ kind: 'frame', image: two })).toEqual({
    kind: 'missing',
    reason: 'uncertain'
  })
})

it.each([
  { kind: 'waiting', reason: 'covered' },
  { kind: 'waiting', reason: 'unavailable' },
  { kind: 'unsupported' }
] as const)('프레임 없는 결과 %j는 그대로 전달한다', (result) => {
  expect(toRaidFrameResult(result)).toEqual(result)
})

it('행마다 읽은 수치 표기를 같은 화면 행의 결과에 붙이고 빈 행은 버린다', () => {
  // 합성 창에는 수치 글자가 없어 판독 결과만 바꿔 행 대응을 확인한다.
  const valueTexts = Array.from({ length: 12 }, (_, row) => `${row + 1},000`)
  vi.mocked(readRaidWindowValues).mockReturnValueOnce({ valueColumn: 'fame', valueTexts })

  const result = toRaidFrameResult({ kind: 'frame', image: raidFrame(4) })

  expect(result.kind).toBe('rows')
  if (result.kind === 'rows') {
    expect(result.valueColumn).toBe('fame')
    expect(result.rows.map((row) => row?.valueText ?? null)).toEqual([
      '1,000',
      '2,000',
      '3,000',
      '4,000',
      ...Array.from({ length: 8 }, () => null)
    ])
  }
})
