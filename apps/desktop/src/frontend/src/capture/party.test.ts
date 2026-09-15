import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  PARTY_MANA_COLOR,
  PARTY_SLOTS,
  isPartySlotPresent,
  capturePartyNicknameCrops
} from './party'

describe('파티 layout', () => {
  it('1920×1080 기준 고정 파티 slot 네 개를 정의한다', () => {
    expect(PARTY_SLOTS).toHaveLength(4)
    expect(PARTY_SLOTS[0].nickname).toEqual({ x: 42, y: 11, width: 105, height: 18 })
    expect(PARTY_SLOTS[3].nickname).toEqual({ x: 492, y: 11, width: 105, height: 18 })
  })

  it('충분한 MP 색상 pixel이 있을 때만 slot이 존재한다고 판단한다', () => {
    const matchingPixels = new Uint8ClampedArray(60 * 4)
    for (let index = 0; index < matchingPixels.length; index += 4) {
      matchingPixels[index] = PARTY_MANA_COLOR[0]
      matchingPixels[index + 1] = PARTY_MANA_COLOR[1]
      matchingPixels[index + 2] = PARTY_MANA_COLOR[2]
      matchingPixels[index + 3] = 255
    }

    const oneMatchingPixel = new Uint8ClampedArray(60 * 4)
    oneMatchingPixel[0] = PARTY_MANA_COLOR[0]
    oneMatchingPixel[1] = PARTY_MANA_COLOR[1]
    oneMatchingPixel[2] = PARTY_MANA_COLOR[2]
    oneMatchingPixel[3] = 255

    expect(isPartySlotPresent(matchingPixels)).toBe(true)
    expect(isPartySlotPresent(oneMatchingPixel)).toBe(false)
  })

  it.each([
    { name: 'red mismatch', values: [0, 121, 170], reads: ['red'] },
    { name: 'green mismatch', values: [55, 0, 170], reads: ['red', 'green'] },
    { name: 'all match', values: [55, 121, 170], reads: ['red', 'green', 'blue'] }
  ])('$name reads only the required RGB channels', ({ values, reads }) => {
    const access: string[] = []
    const rgba = {
      length: 4,
      0: values[0],
      1: values[1],
      2: values[2],
      3: 255
    }
    for (const [index, channel] of [
      [0, 'red'],
      [1, 'green'],
      [2, 'blue']
    ] as const) {
      Object.defineProperty(rgba, index, {
        configurable: true,
        get: () => {
          access.push(channel)
          return values[index]
        }
      })
    }

    isPartySlotPresent(rgba as unknown as Uint8ClampedArray)

    expect(access).toEqual(reads)
  })

  it('reads all matching RGB channels for every pixel needed to reach the threshold', () => {
    const access: string[] = []
    const rgba = { length: 60 * 4 } as Record<number | 'length', number>
    for (let index = 0; index < rgba.length; index += 4) {
      for (const [offset, channel] of [
        [0, 'red'],
        [1, 'green'],
        [2, 'blue']
      ] as const) {
        Object.defineProperty(rgba, index + offset, {
          configurable: true,
          get: () => {
            access.push(channel)
            return PARTY_MANA_COLOR[offset]
          }
        })
      }
      rgba[index + 3] = 255
    }

    expect(isPartySlotPresent(rgba as unknown as Uint8ClampedArray)).toBe(true)
    expect(access).toEqual(Array.from({ length: 50 }, () => ['red', 'green', 'blue']).flat())
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
    return { data }
  })
  const cropContext = { imageSmoothingEnabled: true, drawImage: vi.fn() }
  const frameContext = { drawImage: vi.fn(), getImageData }
  const frame = { width: 0, height: 0, getContext: () => frameContext }
  const crop = { width: 0, height: 0, getContext: () => cropContext }
  const createElement = vi.fn().mockReturnValueOnce(frame).mockReturnValue(crop)
  vi.stubGlobal('document', { createElement })
  const video = { videoWidth: 1920, videoHeight: 1080 } as HTMLVideoElement

  const crops = capturePartyNicknameCrops(video)

  expect(crops).toEqual([crop, null, null, null])
  expect(cropContext.drawImage).toHaveBeenCalledExactlyOnceWith(
    frame,
    42,
    11,
    105,
    18,
    0,
    0,
    420,
    72
  )
  expect(cropContext.imageSmoothingEnabled).toBe(false)
  expect(createElement).toHaveBeenCalledTimes(2)
})
