import { expect, it } from 'vitest'
import { sameCharacterPortrait } from '../../../preload/common/search/ocr-input'
import { cropPartyPortrait, type PartyPortraitCropInput } from './party-portrait'

function input(width = 1067, height = 600, x = 42, rasterScale = 1): PartyPortraitCropInput {
  const rgba = new Uint8Array(width * height * 4)
  const frame = { width, height, rgba }
  const nicknameRegion = {
    slot: 1 as const,
    x,
    y: 10,
    width: 73,
    height: 16,
    coverage: { x, y: 10, width: 101, height: 27 }
  }

  return { frame, nicknameRegion, rasterScale }
}

// 첨부 원본에서 확인한 좌표와 크기만 사용하며 플레이어 이미지와 닉네임은 저장하지 않는다.
it.each([
  [1067, 600, 42, 1, 14, 11, 26],
  [1600, 900, 558, 1.2, 524, 13, 31],
  [1920, 1080, 417, 1.28, 381, 14, 33],
  [2560, 1440, 645, 1.42, 605, 16, 37],
  [1920, 1080, 329, 1.8, 279, 20, 47],
  [3840, 2160, 828, 1.82, 777, 20, 47]
])(
  '%i×%i, 관측 x=%i, 배율 %f에서 얼굴 원본을 복사한다',
  (width, height, x, scale, left, top, size) => {
    const source = input(width, height, x, scale)
    const sourceOffset = (top * width + left) * 4
    const bottomOffset = ((top + size - 1) * width + left + size - 1) * 4
    source.frame.rgba.set([55, 120, 210, 127], sourceOffset)
    source.frame.rgba.set([220, 34, 120, 255], bottomOffset)

    const portrait = cropPartyPortrait(source)

    expect(portrait).not.toBeNull()
    expect(portrait).toMatchObject({ image: { width: size, height: size }, rasterScale: scale })
    expect(portrait!.image.rgba.slice(0, 4)).toEqual(new Uint8Array([55, 120, 210, 127]))
    expect(portrait!.image.rgba.slice(-4)).toEqual(new Uint8Array([220, 34, 120, 255]))
    portrait!.image.rgba[0] = 0
    expect(source.frame.rgba[sourceOffset]).toBe(55)
  }
)

it('왕관, PC 표시와 테두리 변화는 같은 얼굴로 취급하고 유효 얼굴 변화는 구분한다', () => {
  const source = input(64, 64)
  source.frame.rgba.fill(255)
  const before = source.frame.rgba.slice()
  const first = cropPartyPortrait(source)!

  expect(source.frame.rgba).toEqual(before)
  expect(first.validMask![3 * 26 + 3]).toBe(0)
  expect(first.validMask![3 * 26 + 22]).toBe(0)
  expect(first.validMask![25 * 26 + 13]).toBe(0)
  expect(first.validMask![13 * 26 + 13]).toBe(1)
  const second = cropPartyPortrait(source)!
  second.image.rgba[(3 * 26 + 3) * 4] = 20
  second.image.rgba[(3 * 26 + 22) * 4] = 40
  expect(sameCharacterPortrait(first, second)).toBe(true)
  second.image.rgba[(13 * 26 + 13) * 4] = 60
  expect(sameCharacterPortrait(first, second)).toBe(false)
})

it('UI 100% 확대에서도 왕관과 PC 영역을 항상 가리고 아래 얼굴과 중앙은 비교한다', () => {
  const source = input(1920, 1080, 329, 1.8)
  const portrait = cropPartyPortrait(source)!
  const mask = portrait.validMask!
  const width = portrait.image.width

  expect(mask[16 * width + 10]).toBe(0)
  expect(mask[16 * width + 36]).toBe(0)
  expect(mask[16 * width + 23]).toBe(1)
  expect(mask[17 * width + 10]).toBe(1)
  expect(mask[17 * width + 36]).toBe(1)
})

it('얼굴이 프레임을 벗어나거나 크기가 처리 범위를 벗어나면 자르지 않는다', () => {
  expect(cropPartyPortrait(input(1067, 600, 10))).toBeNull()
  expect(cropPartyPortrait(input(1067, 600, 1090))).toBeNull()
  expect(cropPartyPortrait(input(1067, 20))).toBeNull()
  expect(cropPartyPortrait(input(1067, 600, 700, 20))).toBeNull()
  expect(cropPartyPortrait(input(1067, 600, 42, 0.01))).toBeNull()
})

it('잘못된 픽셀 버퍼와 배율은 빈 얼굴로 숨기지 않는다', () => {
  const source = input()
  expect(() => cropPartyPortrait({ ...source, rasterScale: Number.NaN })).toThrow(TypeError)
  expect(() => cropPartyPortrait({ ...source, rasterScale: 0 })).toThrow(TypeError)
  expect(() =>
    cropPartyPortrait({ ...source, frame: { ...source.frame, rgba: new Uint8Array(4) } })
  ).toThrow(TypeError)
})
