import { expect, it } from 'vitest'
import { binarizeNicknamePixels, nicknameCenterOffset } from './nickname-pixels'

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

  // 글자 폭 5px가 32px 입력의 x=13..17에 놓이고 픽셀 자체는 수정하지 않는다.
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
