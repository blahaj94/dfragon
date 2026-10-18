import { fileURLToPath } from 'node:url'
import { expect, it, vi } from 'vitest'
import { toRaidFrameResult } from './raid-frame'
import { raidFrame } from '../lib/raid-window-test-fixture'

vi.mock('../lib/raid-heading.png?asset', () => {
  const headingPath = fileURLToPath(new URL('../lib/raid-heading.png', import.meta.url))

  return { default: headingPath }
})

// 합성 창의 첫 행 닉네임 칸은 client (497, 169)에서 시작하는 86×17이고 행 간격은 21이다.
const NICKNAME = { x: 497, y: 169, width: 86, height: 17, rowSpacing: 21 }

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
  expect(Object.keys(result)).toEqual(['kind', 'nicknames'])
  expect(result.nicknames).toHaveLength(12)
  expect(result.nicknames.map((nickname) => nickname !== null)).toEqual(
    Array.from({ length: 12 }, (_, row) => row < 9)
  )
  // 큰 픽셀 배열은 요소마다 비교하는 toEqual 대신 바이트 비교로 확인한다(1067×600 프레임은 수 초가 걸린다).
  for (const [row, nickname] of result.nicknames.slice(0, 9).entries()) {
    expect(Object.keys(nickname!)).toEqual(['width', 'height', 'rgba'])
    expect([nickname?.width, nickname?.height]).toEqual([NICKNAME.width, NICKNAME.height])
    expect(nickname!.rgba).toBeInstanceOf(Uint8Array)
    const expected = nicknamePixels({ ...frame, rgba: original }, row)
    expect(Buffer.from(nickname!.rgba).equals(Buffer.from(expected))).toBe(true)
  }
  // 전달한 크롭을 바꿔도 회차 프레임은 그대로다.
  result.nicknames[0]!.rgba.fill(0)
  expect(Buffer.from(frame.rgba).equals(Buffer.from(original))).toBe(true)
})

it('다른 창에 가려 투명하게 제외된 픽셀이 있는 행만 읽지 않는다', () => {
  const frame = raidFrame(12)
  const covered = ((NICKNAME.y + NICKNAME.rowSpacing * 4 + 8) * frame.width + NICKNAME.x + 40) * 4
  frame.rgba[covered + 3] = 0

  const result = toRaidFrameResult({ kind: 'frame', image: frame })

  expect(result.kind).toBe('rows')
  if (result.kind === 'rows') {
    expect(result.nicknames.map((nickname) => nickname === null)).toEqual(
      Array.from({ length: 12 }, (_, row) => row === 4)
    )
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
