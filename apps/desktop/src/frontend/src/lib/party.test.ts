import { Buffer } from 'node:buffer'
import { afterEach, expect, it, vi } from 'vitest'
import type { CharacterImage } from '../../../preload/common/types/character'
import { capturePartyRecognitionInputs } from './party'
import { recognizePartyFrame } from './party-recognition'
import type { PartyOcrWorker } from '../types/capture'

type NicknameCanvas = {
  width: number
  height: number
  getContext: () => { putImageData: ReturnType<typeof vi.fn> }
}

afterEach(() => vi.unstubAllGlobals())

it('얼굴 영역이 프레임 밖이면 닉네임만 유지한다', () => {
  const setup = captureCanvas(1067, 600, [20])

  const inputs = capturePartyRecognitionInputs(setup.frame)

  expect(inputs).toEqual([
    { slot: 0, nickname: setup.nicknames[0], portrait: null },
    null,
    null,
    null
  ])
})

it('얼굴 크롭에는 닉네임과 같은 프레임의 원본 RGBA를 검출한 위치 기준으로 전달한다', () => {
  const setup = captureCanvas(1280, 720, [42, 324])
  setup.frame.rgba.set([55, 170, 200, 255], (24 * 1280 + 14 + 13) * 4)
  setup.frame.rgba.set([66, 171, 201, 255], (24 * 1280 + 296 + 13) * 4)

  const inputs = capturePartyRecognitionInputs(setup.frame)

  const pixel = (slot: number): number[] => [
    ...inputs[slot]!.portrait!.image.rgba.slice((13 * 26 + 13) * 4, (13 * 26 + 14) * 4)
  ]
  expect(inputs[0]?.portrait).toMatchObject({ rasterScale: 1, image: { width: 26, height: 26 } })
  expect(pixel(0)).toEqual([55, 170, 200, 255])
  expect(pixel(2)).toEqual([66, 171, 201, 255])
})

function framePixels(
  width: number,
  height: number,
  anchors: number[],
  loadingAnchors: number[] = []
): Uint8Array {
  const rgba = new Uint8Array(width * height * 4)
  // 실제 GDI와 같이 원본 전체를 불투명하게 구성한다.
  for (let offset = 3; offset < rgba.length; offset += 4) {
    rgba[offset] = 255
  }
  for (const x of anchors) {
    for (let column = x; column < x + 99; column += 1) {
      for (let y = 27; y <= 29; y += 1) {
        rgba.set([194, 15, 11, 255], (y * width + column) * 4)
      }
      for (let y = 33; y <= 35; y += 1) {
        rgba.set([18, 124, 209, 255], (y * width + column) * 4)
      }
    }
    rgba.set([255, 255, 255, 255, 0, 0, 0, 255, 55, 170, 200, 255], (10 * width + x) * 4)
  }

  for (const x of loadingAnchors) {
    for (let y = 15; y < 35; y += 1) {
      for (let column = x - 26; column < x + 56; column += 1) {
        rgba.set([8, 8, 8, 255], (y * width + column) * 4)
      }
    }
  }

  return rgba
}

function captureCanvas(
  width: number,
  height: number,
  anchors: number[],
  loadingAnchors: number[] = []
): {
  frame: CharacterImage
  getImageData: ReturnType<typeof vi.fn>
  nicknames: NicknameCanvas[]
  nextFrame: (width: number, height: number, anchors: number[]) => void
} {
  let frame: CharacterImage = {
    width,
    height,
    rgba: framePixels(width, height, anchors, loadingAnchors)
  }
  let pixels: Uint8ClampedArray = new Uint8ClampedArray(0)
  const getImageData = vi.fn((x: number, y: number, cropWidth: number, cropHeight: number) => {
    const data = new Uint8ClampedArray(cropWidth * cropHeight * 4)
    for (let row = 0; row < cropHeight; row += 1) {
      const start = ((y + row) * frameCanvas.width + x) * 4
      data.set(pixels.subarray(start, start + cropWidth * 4), row * cropWidth * 4)
    }

    return { data }
  })
  const frameCanvas = {
    width: 0,
    height: 0,
    getContext: () => ({
      getImageData,
      createImageData: (width: number, height: number) => ({
        data: new Uint8ClampedArray(width * height * 4)
      }),
      putImageData: (image: { data: Uint8ClampedArray }) => {
        pixels = image.data
      }
    })
  }
  const nicknames: NicknameCanvas[] = []
  let nextIsFrame = true
  const createElement = vi.fn(() => {
    if (nextIsFrame) {
      nextIsFrame = false

      return frameCanvas
    }
    const context = { putImageData: vi.fn() }
    const nickname = { width: 0, height: 0, getContext: () => context }
    nicknames.push(nickname)

    return nickname
  })
  vi.stubGlobal('document', { createElement })

  function nextFrame(nextWidth: number, nextHeight: number, nextAnchors: number[]): void {
    frame = {
      width: nextWidth,
      height: nextHeight,
      rgba: framePixels(nextWidth, nextHeight, nextAnchors)
    }
    nextIsFrame = true
  }

  return {
    get frame() {
      return frame
    },
    getImageData,
    nicknames,
    nextFrame
  }
}

it.each([
  [1067, 600],
  [1280, 720],
  [1600, 900],
  [1920, 1080],
  [2560, 1440],
  [3440, 1440],
  [3840, 2160]
])('%i×%i 프레임에서 관측한 1, 3번만 크롭하고 원본 크기와 전처리를 유지한다', (width, height) => {
  const setup = captureCanvas(width, height, [42, 324])
  const crops = capturePartyRecognitionInputs(setup.frame)

  expect(crops.map((input) => input?.nickname ?? null)).toEqual([
    setup.nicknames[0],
    null,
    setup.nicknames[1],
    null
  ])
  expect(setup.getImageData).toHaveBeenCalledWith(42, 10, 73, 16)
  expect(setup.getImageData).toHaveBeenCalledWith(324, 10, 73, 16)
  expect(setup.nicknames[0]).toMatchObject({ width: 73, height: 16 })
  const pixels = setup.nicknames[0].getContext().putImageData.mock.calls[0][0].data
  expect(Array.from(pixels.slice(0, 12))).toEqual([0, 0, 0, 255, 255, 255, 255, 255, 0, 0, 0, 255])
})

it('캡처 중 해상도와 프레임 위치가 바뀌면 새 좌표를 검출하고 미검출 뒤 다시 복구한다', () => {
  const setup = captureCanvas(1280, 720, [42])
  expect(capturePartyRecognitionInputs(setup.frame)[0]).not.toBeNull()

  setup.nextFrame(2560, 1440, [])
  expect(capturePartyRecognitionInputs(setup.frame)).toEqual([null, null, null, null])

  setup.nextFrame(2560, 1440, [190])
  const crops = capturePartyRecognitionInputs(setup.frame)
  expect(crops.map((input) => input?.nickname ?? null)).toEqual([
    null,
    setup.nicknames[1],
    null,
    null
  ])
  expect(setup.getImageData).toHaveBeenLastCalledWith(190, 10, 73, 16)
})

it('HP, MP 띠가 이어져 슬롯을 판별할 수 없으면 OCR에 크롭을 넘기지 않는다', () => {
  const setup = captureCanvas(1920, 1080, [138, 237])
  expect(capturePartyRecognitionInputs(setup.frame)).toEqual([null, null, null, null])
  expect(setup.nicknames).toHaveLength(0)
})

it('연결중 팝업으로 가려진 슬롯은 OCR과 얼굴 크롭에서 제외하고 정상 복귀 때 다시 검출한다', () => {
  const setup = captureCanvas(1920, 1080, [42, 183, 324, 465], [183, 324, 465])

  const inputs = capturePartyRecognitionInputs(setup.frame)

  expect(inputs).toEqual([
    { slot: 0, nickname: setup.nicknames[0], portrait: expect.anything() },
    null,
    null,
    null
  ])
  setup.nextFrame(1920, 1080, [42, 183, 324, 465])
  expect(capturePartyRecognitionInputs(setup.frame).every((entry) => entry?.portrait != null)).toBe(
    true
  )
})

it.each([
  [0, 0],
  [8193, 600],
  [8192, 8192]
])('처리할 수 없는 %i×%i 프레임은 Canvas를 할당하지 않는다', (width, height) => {
  const createElement = vi.fn()
  vi.stubGlobal('document', { createElement })
  const frame = { width, height, rgba: new Uint8Array(0) }

  expect(capturePartyRecognitionInputs(frame)).toEqual([null, null, null, null])
  expect(createElement).not.toHaveBeenCalled()
})

it('공통 네이티브 캡처의 RGBA를 크롭하고 원본은 바꾸지 않는다', () => {
  const setup = captureCanvas(1280, 720, [42])
  const before = setup.frame.rgba.slice()

  const inputs = capturePartyRecognitionInputs(setup.frame)

  expect(inputs[0]?.nickname).toBe(setup.nicknames[0])
  expect(inputs[0]?.portrait).not.toBeNull()
  expect(inputs.slice(1)).toEqual([null, null, null])
  expect(Buffer.compare(setup.frame.rgba, before)).toBe(0)
})

it.each([
  { label: '닉네임', x: 42, y: 10 },
  { label: '얼굴', x: 20, y: 20 }
])('$label 영역이 가려진 슬롯은 OCR과 얼굴 비교에 전달하지 않는다', ({ x, y }) => {
  const setup = captureCanvas(1280, 720, [42])
  setup.frame.rgba[(y * 1280 + x) * 4 + 3] = 0

  expect(capturePartyRecognitionInputs(setup.frame)).toEqual([null, null, null, null])
})

it('회차 한 장의 네 슬롯 닉네임 픽셀과 얼굴 원문을 함께 인식 결과로 돌려준다', async () => {
  const setup = captureCanvas(1280, 720, [42, 183, 324, 465])
  for (const [slot, left] of [14, 155, 296, 437].entries()) {
    setup.frame.rgba.set([slot + 11, 50, 90, 255], (24 * 1280 + left + 13) * 4)
  }
  const recognize = vi.fn<PartyOcrWorker['recognize']>(async (image) => {
    const slot = setup.nicknames.findIndex((nickname) => Object.is(nickname, image))
    const data = setup.nicknames[slot].getContext().putImageData.mock.calls[0][0].data
    expect(Array.from(data.slice(0, 12))).toEqual([0, 0, 0, 255, 255, 255, 255, 255, 0, 0, 0, 255])
    const text = `슬롯${slot}`

    return {
      data: { text, confidence: 1, candidates: [{ nickname: text, rank: 1, modelScore: 1 }] }
    }
  })

  const results = await recognizePartyFrame(setup.frame, recognize)

  expect(recognize).toHaveBeenCalledTimes(4)
  expect(setup.nicknames).toHaveLength(4)
  for (const [slot, result] of results.entries()) {
    expect(result).toMatchObject({
      kind: 'recognized',
      slot,
      nickname: `슬롯${slot}`
    })
    if (result.kind === 'missing') {
      throw new Error('Expected a detected party slot')
    }
    expect(result.portrait?.image).toMatchObject({ width: 26, height: 26 })
    expect(
      Array.from(result.portrait!.image.rgba.slice((13 * 26 + 13) * 4, (13 * 26 + 14) * 4))
    ).toEqual([slot + 11, 50, 90, 255])
  }
})
