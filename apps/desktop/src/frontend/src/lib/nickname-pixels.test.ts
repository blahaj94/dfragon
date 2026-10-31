import { expect, it } from 'vitest'
import {
  binarizeNicknamePixels,
  binarizeRaidTextPixels,
  nicknameCenterOffset,
  removeDetachedRaidNicknamePixels,
  removeRaidNicknameFrameLines
} from './nickname-pixels'

// OpenCV 4.12.0의 THRESH_BINARY_INV | THRESH_OTSU 출력과 대조한 회색 입력이다.
it.each([
  {
    name: '자동 임계값 30',
    input: [10, 20, 30, 100, 110, 120],
    expected: [255, 255, 255, 0, 0, 0]
  },
  { name: '분산 동률 부근의 임계값 10', input: [0, 10, 20], expected: [255, 255, 0] },
  { name: '균일한 검정', input: [0, 0, 0], expected: [255, 255, 255] },
  { name: '균일한 회색', input: [64, 64, 64], expected: [0, 0, 0] },
  { name: '균일한 흰색', input: [255, 255, 255], expected: [0, 0, 0] }
])('$name에서 Otsu 반전 이진화 결과와 불투명 alpha를 유지한다', ({ input, expected }) => {
  const pixels = new Uint8ClampedArray(input.flatMap((gray) => [gray, gray, gray, 128]))
  binarizeNicknamePixels(pixels)
  expect([...pixels]).toEqual(expected.flatMap((gray) => [gray, gray, gray, 255]))
})

it('색상 입력에 BT.601 회색 변환을 적용해 OpenCV 기준 이진화 결과를 만든다', () => {
  const pixels = new Uint8ClampedArray([
    255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255, 0, 0, 0, 255, 255, 255, 255, 255, 100, 150, 200,
    255
  ])
  binarizeNicknamePixels(pixels)
  expect([...pixels]).toEqual([255, 0, 255, 255, 0, 0].flatMap((gray) => [gray, gray, gray, 255]))
})

it('빨강의 BT.601 밝기 76을 밝은 글자 집단으로 분류한다', () => {
  const pixels = new Uint8ClampedArray([
    40, 40, 40, 255, 45, 45, 45, 255, 70, 70, 70, 255, 75, 75, 75, 255, 255, 0, 0, 255
  ])
  binarizeNicknamePixels(pixels)
  expect([...pixels]).toEqual([255, 255, 0, 0, 0].flatMap((gray) => [gray, gray, gray, 255]))
})

// 2026-10-31 미카엘라 레이드 명예 보상 행에서 잰 글자, 배경이 반짝이는 곳, 배경 색이다.
it('공대 칸은 노란 배경이 반짝이는 곳을 글자로 남기지 않고 연노랑 글자만 남긴다', () => {
  const text = [238, 225, 134]
  const glint = [192, 170, 62]
  const background = [76, 61, 13]
  const input = [text, text, glint, glint, background, background, background]
  const pixels = new Uint8ClampedArray(input.flatMap((color) => [...color, 255]))
  binarizeRaidTextPixels(pixels)
  expect([...pixels]).toEqual(
    [0, 0, 255, 255, 255, 255, 255].flatMap((gray) => [gray, gray, gray, 255])
  )
})

it('공대 칸도 어두운 배경의 흰 글자는 글자로 남긴다', () => {
  const input = [10, 20, 30, 200, 210, 220]
  const pixels = new Uint8ClampedArray(input.flatMap((gray) => [gray, gray, gray, 128]))
  binarizeRaidTextPixels(pixels)
  expect([...pixels]).toEqual([255, 255, 255, 0, 0, 0].flatMap((gray) => [gray, gray, gray, 255]))
})

it('빈 픽셀 배열은 그대로 유지한다', () => {
  const pixels = new Uint8ClampedArray()
  binarizeNicknamePixels(pixels)
  expect(pixels).toHaveLength(0)
})

it('글자 밑획에 붙은 프레임 선과 모서리 장식은 가로 정렬의 글자 경계로 세지 않는다', () => {
  const width = 24
  const height = 48
  const rgba = new Uint8ClampedArray(width * height * 4)
  rgba.fill(255)
  const paint = (x: number, y: number): void => {
    rgba.set([0, 0, 0, 255], (y * width + x) * 4)
  }
  for (let y = 0; y < 7; y += 1) {
    paint(23, y)
  }
  for (let y = 20; y <= 42; y += 1) {
    paint(2, y)
    paint(6, y)
  }
  for (let y = 43; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      paint(x, y)
    }
  }
  const before = rgba.slice()

  expect(nicknameCenterOffset(rgba, width, height, 32)).toBe(11)
  expect(rgba).toEqual(before)
})

it('위쪽 가장자리에서 본문까지 이어지는 획과 떨어진 구두점은 글자 경계로 보존한다', () => {
  const rgba = new Uint8ClampedArray(20 * 48 * 4)
  rgba.fill(255)
  for (let y = 0; y <= 12; y += 1) {
    rgba.set([0, 0, 0, 255], (y * 20 + 1) * 4)
  }
  rgba.set([0, 0, 0, 255], (40 * 20 + 12) * 4)

  expect(nicknameCenterOffset(rgba, 20, 48, 32)).toBe(9)
})

const RAID_NICKNAME_WIDTH = 86

// 이진화한 공대 닉네임 칸이다. 본문은 x 20~40 사이에 세로획을 둔다.
function raidNickname(height: number, marks: readonly (readonly [x: number, y: number])[]) {
  const data = new Uint8ClampedArray(RAID_NICKNAME_WIDTH * height * 4).fill(255)
  const paint = (x: number, y: number): void => {
    data.set([0, 0, 0, 255], (y * RAID_NICKNAME_WIDTH + x) * 4)
  }
  for (let x = 20; x <= 40; x += 2) {
    for (let y = 3; y < height - 3; y += 1) {
      paint(x, y)
    }
  }
  for (const [x, y] of marks) {
    paint(x, y)
  }

  return data
}

function darkColumns(data: Uint8ClampedArray, height: number): number[] {
  const columns = new Set<number>()
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < RAID_NICKNAME_WIDTH; x += 1) {
      if (data[(y * RAID_NICKNAME_WIDTH + x) * 4] === 0) {
        columns.add(x)
      }
    }
  }

  return [...columns].sort((left, right) => left - right)
}

const textColumns = [20, 22, 24, 26, 28, 30, 32, 34, 36, 38, 40]

it('본문에 정상 자간으로 붙은 쉼표는 공대 닉네임 칸에서 지우지 않는다', () => {
  const data = raidNickname(17, [
    [18, 13],
    [17, 14]
  ])
  const before = data.slice()

  removeDetachedRaidNicknamePixels(data, RAID_NICKNAME_WIDTH, 17)

  expect(data).toEqual(before)
})

it.each([
  { name: '왼쪽', marks: [[3, 8]] },
  { name: '오른쪽', marks: [[80, 8]] },
  {
    name: '양쪽',
    marks: [
      [0, 2],
      [1, 2],
      [85, 14]
    ]
  }
] as const)(
  '본문과 멀리 떨어진 $name 점만 배경으로 지우고 alpha는 불투명으로 둔다',
  ({ marks }) => {
    const data = raidNickname(17, marks)

    removeDetachedRaidNicknamePixels(data, RAID_NICKNAME_WIDTH, 17)

    expect(darkColumns(data, 17)).toEqual(textColumns)
    for (const [x, y] of marks) {
      const index = (y * RAID_NICKNAME_WIDTH + x) * 4
      expect([...data.subarray(index, index + 4)]).toEqual([255, 255, 255, 255])
    }
  }
)

it.each([
  ['UI 0% 높이 17', 4, 17],
  ['배율 1.8 높이 31', 7, 31]
])('%s에서는 본문과 빈 열 %i개 이상 떨어진 덩어리부터 지운다', (_case, gap, height) => {
  const kept = raidNickname(height, [[20 - gap, 5]])
  const removed = raidNickname(height, [[20 - gap - 1, 5]])

  removeDetachedRaidNicknamePixels(kept, RAID_NICKNAME_WIDTH, height)
  removeDetachedRaidNicknamePixels(removed, RAID_NICKNAME_WIDTH, height)

  expect(darkColumns(kept, height)).toEqual([20 - gap, ...textColumns])
  expect(darkColumns(removed, height)).toEqual(textColumns)
})

it('글자 획만큼 큰 덩어리도 본문과 떨어져 있으면 지운다', () => {
  const marks: [number, number][] = []
  for (let y = 0; y < 17; y += 1) {
    marks.push([2, y], [4, y], [6, y], [8, y])
  }
  const data = raidNickname(17, marks)

  removeDetachedRaidNicknamePixels(data, RAID_NICKNAME_WIDTH, 17)

  expect(darkColumns(data, 17)).toEqual(textColumns)
})

it('위아래 여백의 짧은 가로획은 글자 획일 수 있으므로 남긴다', () => {
  const stroke: [number, number][] = []
  for (let x = 20; x <= 40; x += 1) {
    stroke.push([x, 15])
  }
  const data = raidNickname(17, stroke)
  const before = data.slice()

  removeRaidNicknameFrameLines(data, RAID_NICKNAME_WIDTH, 17)

  expect(data).toEqual(before)
})

it('검은 픽셀이 없는 공대 닉네임 칸은 그대로 둔다', () => {
  const data = new Uint8ClampedArray(RAID_NICKNAME_WIDTH * 17 * 4).fill(255)

  removeDetachedRaidNicknamePixels(data, RAID_NICKNAME_WIDTH, 17)

  expect(data.every((value) => value === 255)).toBe(true)
})
