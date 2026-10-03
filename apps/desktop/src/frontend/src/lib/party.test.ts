import { afterEach, describe, expect, it, vi } from 'vitest'
import { PARTY_SLOTS } from '../constants/capture'
import { isPartySlotPresent, capturePartyNicknameCrops } from './party'

describe('파티 닉네임 크롭', () => {
  it('1920×1080 기준 파티 슬롯 네 개의 닉네임 좌표를 유지한다', () => {
    expect(PARTY_SLOTS).toHaveLength(4)
    expect(PARTY_SLOTS[0].nickname).toEqual({ x: 56, y: 15, width: 91, height: 14 })
    expect(PARTY_SLOTS[3].nickname).toEqual({ x: 506, y: 15, width: 91, height: 14 })
  })

  it.each([
    { name: '49개 일치는 인원이 없는 슬롯', count: 49, color: [55, 121, 170], present: false },
    { name: '50개 일치는 인원이 있는 슬롯', count: 50, color: [55, 121, 170], present: true },
    { name: '51개 일치는 인원이 있는 슬롯', count: 51, color: [55, 121, 170], present: true },
    { name: 'RGB 하한 오차 35 포함', count: 50, color: [20, 86, 135], present: true },
    { name: 'RGB 상한 오차 35 포함', count: 50, color: [90, 156, 205], present: true },
    { name: '빨강 하한 오차 36 거절', count: 50, color: [19, 121, 170], present: false },
    { name: '빨강 상한 오차 36 거절', count: 50, color: [91, 121, 170], present: false },
    { name: '초록 하한 오차 36 거절', count: 50, color: [55, 85, 170], present: false },
    { name: '초록 상한 오차 36 거절', count: 50, color: [55, 157, 170], present: false },
    { name: '파랑 하한 오차 36 거절', count: 50, color: [55, 121, 134], present: false },
    { name: '파랑 상한 오차 36 거절', count: 50, color: [55, 121, 206], present: false }
  ])('$name', ({ count, color, present }) => {
    // 기존 MP 판정의 색상 [55, 121, 170], 허용 오차 35, 최소 50픽셀로 경계값을 직접 계산한다.
    // 제품 상수로 입력과 기대값을 함께 만들면 경계가 바뀌어도 테스트가 통과한다.
    const rgba = new Uint8ClampedArray(60 * 4)
    for (let index = 0; index < count; index += 1) {
      rgba.set([...color, 255], index * 4)
    }

    expect(isPartySlotPresent(rgba)).toBe(present)
  })
})

afterEach(() => vi.unstubAllGlobals())

it('UI 50%의 MP 바에서 첫 슬롯을 찾아 OCR crop을 만들고 빈 슬롯은 건너뛴다', () => {
  // 실제 확인한 MP 세로 위치를 독립적인 합성 입력으로 재현한다.
  // 제품 좌표로 fixture 위치를 만들면 원래의 y=36 오류도 통과하므로 공유하지 않는다.
  const getImageData = vi.fn((x: number, y: number, width: number, height: number) => {
    const data = new Uint8ClampedArray(width * height * 4)
    for (let row = 0; row < height; row += 1) {
      for (let column = 0; column < width; column += 1) {
        const pixelX = x + column
        const pixelY = y + row
        if (pixelX >= 42 && pixelX < 147 && pixelY >= 42 && pixelY < 47) {
          data.set([55, 121, 170, 255], (row * width + column) * 4)
        }
      }
    }
    if (x === 56 && y === 15) {
      data.set([255, 255, 255, 255, 0, 0, 0, 255, 55, 170, 200, 255])
    }

    return { data }
  })
  const nicknameContext = { putImageData: vi.fn() }
  const frameContext = { drawImage: vi.fn(), getImageData }
  const frame = { width: 0, height: 0, getContext: () => frameContext }
  const nickname = { width: 0, height: 0, getContext: () => nicknameContext }
  const createElement = vi.fn().mockReturnValueOnce(frame).mockReturnValue(nickname)
  vi.stubGlobal('document', { createElement })
  const video = { videoWidth: 1920, videoHeight: 1080 } as HTMLVideoElement

  const crops = capturePartyNicknameCrops(video)

  expect(crops).toEqual([nickname, null, null, null])
  expect(nickname.width).toBe(91)
  expect(nickname.height).toBe(14)
  expect(createElement).toHaveBeenCalledTimes(2)
  expect(getImageData).toHaveBeenCalledWith(56, 15, 91, 14)
  const pixels = nicknameContext.putImageData.mock.calls[0][0].data
  expect(Array.from(pixels.slice(0, 12))).toEqual([
    0,
    0,
    0,
    255, // 흰 글자는 검정으로 반전한다.
    255,
    255,
    255,
    255, // 검정 배경은 흰색으로 반전한다.
    107,
    107,
    107,
    255 // 청록색 획은 이진화하지 않고 중간 명암으로 남긴다.
  ])
})
