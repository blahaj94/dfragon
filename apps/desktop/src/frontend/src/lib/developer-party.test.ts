// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { developerPartyModelInputDataUrl } from './developer-party'

type Pixels = { data: Uint8ClampedArray; width: number; height: number }

let drawn: Pixels | null = null

/** 높이 48 크롭은 리사이즈가 항등이므로 넣은 픽셀을 그대로 돌려줘 전처리 결과만 남긴다. */
class IdentityOffscreenCanvas {
  pixels: Pixels | null = null

  constructor(
    readonly width: number,
    readonly height: number
  ) {}

  getContext(): object {
    return {
      putImageData: (pixels: Pixels) => {
        this.pixels = pixels
      },
      drawImage: (source: IdentityOffscreenCanvas, _x: number, _y: number, width: number) => {
        if (width !== source.width) {
          throw new Error('Only an identity resize is simulated.')
        }
        this.pixels = source.pixels
      },
      getImageData: () => this.pixels
    }
  }
}

beforeEach(() => {
  drawn = null
  vi.stubGlobal(
    'ImageData',
    class SyntheticImageData {
      constructor(
        readonly data: Uint8ClampedArray,
        readonly width: number,
        readonly height: number
      ) {}
    }
  )
  vi.stubGlobal('OffscreenCanvas', IdentityOffscreenCanvas)
  Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
    configurable: true,
    value: () => ({
      putImageData: (pixels: Pixels) => {
        drawn = pixels
      }
    })
  })
  Object.defineProperty(HTMLCanvasElement.prototype, 'toDataURL', {
    configurable: true,
    value: (type: string) => `data:${type};base64,model-input`
  })
})

afterEach(() => vi.unstubAllGlobals())

it('저장 원본은 그대로 두고 밝은 글자를 반전 이진화해 320×48 입력의 가운데에 그린다', () => {
  const width = 4
  const height = 48
  const rgba = new Uint8Array(width * height * 4)
  for (let pixel = 0; pixel < width * height; pixel += 1) {
    const isGlyph = pixel % width < 2
    rgba.set(isGlyph ? [200, 200, 200, 255] : [20, 20, 20, 255], pixel * 4)
  }
  const original = rgba.slice()

  expect(developerPartyModelInputDataUrl({ width, height, rgba })).toBe(
    'data:image/png;base64,model-input'
  )
  expect(rgba).toEqual(original)
  expect([drawn?.width, drawn?.height]).toEqual([320, 48])
  for (const y of [0, 47]) {
    const row = drawn!.data.subarray(y * 320 * 4, (y + 1) * 320 * 4)
    const red = [...row].filter((_, index) => index % 4 === 0)
    // 글자 폭 2는 (320 - 2) / 2 = 159에서 시작하고 나머지는 zero padding 회색이다.
    expect(red.slice(157, 164)).toEqual([128, 128, 0, 0, 255, 255, 128])
    expect(red.filter((value) => value === 128)).toHaveLength(316)
  }
})
