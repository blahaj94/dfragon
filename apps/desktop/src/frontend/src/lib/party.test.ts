import { Buffer } from 'node:buffer'
import { afterEach, expect, it, vi } from 'vitest'
import { capturePartyNicknameCrops, capturePartyRecognitionInputs } from './party'
import type { PartyPortraitCropper } from './party-portrait'

type NicknameCanvas = {
  width: number
  height: number
  getContext: () => { putImageData: ReturnType<typeof vi.fn> }
}

afterEach(() => vi.unstubAllGlobals())

it('얼굴 크롭 제공자가 얼굴을 반환하지 않으면 닉네임만 유지한다', () => {
  const setup = captureCanvas(1280, 720, [42, 324])

  const inputs = capturePartyRecognitionInputs(setup.video, () => null)

  expect(inputs).toEqual([
    { slot: 0, nickname: setup.nicknames[0], portrait: null },
    null,
    { slot: 2, nickname: setup.nicknames[1], portrait: null },
    null
  ])
})

it('얼굴 크롭 경계에는 닉네임과 같은 프레임의 원본 RGBA와 검출 배율을 전달한다', () => {
  const setup = captureCanvas(1280, 720, [42, 324])
  const portrait = {
    image: { width: 1, height: 1, rgba: new Uint8Array([55, 170, 200, 255]) },
    rasterScale: 1
  }
  const cropper = vi.fn<PartyPortraitCropper>(() => portrait)

  const inputs = capturePartyRecognitionInputs(setup.video, cropper)

  expect(cropper).toHaveBeenCalledTimes(2)
  const first = cropper.mock.calls[0][0]
  const third = cropper.mock.calls[1][0]
  expect(first).toMatchObject({
    frame: { width: 1280, height: 720 },
    nicknameRegion: { slot: 1, x: 42, y: 10, width: 73, height: 16 },
    rasterScale: 1
  })
  expect(third.nicknameRegion).toMatchObject({ slot: 3, x: 324 })
  expect(third.frame.rgba).toBe(first.frame.rgba)
  const nicknameStart = (10 * 1280 + 42) * 4
  expect([...first.frame.rgba.slice(nicknameStart, nicknameStart + 12)]).toEqual([
    255, 255, 255, 255, 0, 0, 0, 255, 55, 170, 200, 255
  ])
  expect(inputs[0]?.portrait).toBe(portrait)
  expect(inputs[2]?.portrait).toBe(portrait)
})

/** 실측한 기본 배율의 HP, MP와 이름 픽셀을 제품 검출 좌표와 독립적으로 그린다. */
function framePixels(
  width: number,
  height: number,
  anchors: number[],
  loadingAnchors: number[] = []
): Uint8ClampedArray {
  const rgba = new Uint8ClampedArray(width * height * 4)
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

  // 연결중 팝업의 가림 범위. 텍스트를 읽거나 이름으로 금지하지 않고 가려진 HP, MP를 제외한다.
  for (const x of loadingAnchors) {
    for (let y = 15; y < 35; y += 1) {
      for (let column = x - 26; column < x + 56; column += 1) {
        rgba.set([8, 8, 8, 255], (y * width + column) * 4)
      }
    }
  }

  return rgba
}

/** Canvas 경계만 대체하고 실제 프레임 검출과 픽셀 전처리를 실행한다. */
function captureCanvas(
  width: number,
  height: number,
  anchors: number[],
  loadingAnchors: number[] = []
): {
  video: HTMLVideoElement
  getImageData: ReturnType<typeof vi.fn>
  nicknames: NicknameCanvas[]
  nextFrame: (width: number, height: number, anchors: number[]) => void
} {
  let pixels = framePixels(width, height, anchors, loadingAnchors)
  const video = { videoWidth: width, videoHeight: height } as HTMLVideoElement
  const getImageData = vi.fn((x: number, y: number, cropWidth: number, cropHeight: number) => {
    const data = new Uint8ClampedArray(cropWidth * cropHeight * 4)
    for (let row = 0; row < cropHeight; row += 1) {
      const start = ((y + row) * video.videoWidth + x) * 4
      data.set(pixels.subarray(start, start + cropWidth * 4), row * cropWidth * 4)
    }

    return { data }
  })
  const frame = {
    width: 0,
    height: 0,
    getContext: () => ({
      drawImage: vi.fn(),
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

      return frame
    }
    const context = { putImageData: vi.fn() }
    const nickname = { width: 0, height: 0, getContext: () => context }
    nicknames.push(nickname)

    return nickname
  })
  vi.stubGlobal('document', { createElement })

  function nextFrame(nextWidth: number, nextHeight: number, nextAnchors: number[]): void {
    Object.assign(video, { videoWidth: nextWidth, videoHeight: nextHeight })
    pixels = framePixels(nextWidth, nextHeight, nextAnchors)
    nextIsFrame = true
  }

  return { video, getImageData, nicknames, nextFrame }
}

it.each([
  [1067, 600],
  [1280, 720],
  [1600, 900],
  [1920, 1080],
  [2560, 1440],
  [3440, 1440],
  [3840, 2160]
])('%i×%i 영상에서 관측한 1, 3번만 크롭하고 원본 크기와 전처리를 유지한다', (width, height) => {
  const setup = captureCanvas(width, height, [42, 324])
  const crops = capturePartyNicknameCrops(setup.video)

  expect(crops).toEqual([setup.nicknames[0], null, setup.nicknames[1], null])
  expect(setup.getImageData).toHaveBeenCalledWith(42, 10, 73, 16)
  expect(setup.getImageData).toHaveBeenCalledWith(324, 10, 73, 16)
  expect(setup.nicknames[0]).toMatchObject({ width: 73, height: 16 })
  const pixels = setup.nicknames[0].getContext().putImageData.mock.calls[0][0].data
  expect(Array.from(pixels.slice(0, 12))).toEqual([0, 0, 0, 255, 255, 255, 255, 255, 0, 0, 0, 255])
})

it('캡처 중 해상도와 프레임 위치가 바뀌면 새 좌표를 검출하고 미검출 뒤 다시 복구한다', () => {
  const setup = captureCanvas(1280, 720, [42])
  expect(capturePartyNicknameCrops(setup.video)[0]).not.toBeNull()

  setup.nextFrame(2560, 1440, [])
  expect(capturePartyNicknameCrops(setup.video)).toEqual([null, null, null, null])

  setup.nextFrame(2560, 1440, [190])
  const crops = capturePartyNicknameCrops(setup.video)
  expect(crops).toEqual([null, setup.nicknames[1], null, null])
  expect(setup.getImageData).toHaveBeenLastCalledWith(190, 10, 73, 16)
})

it('HP, MP 띠가 이어져 슬롯을 판별할 수 없으면 OCR에 크롭을 넘기지 않는다', () => {
  const setup = captureCanvas(1920, 1080, [138, 237])
  expect(capturePartyNicknameCrops(setup.video)).toEqual([null, null, null, null])
  expect(setup.nicknames).toHaveLength(0)
})

it('연결중 팝업으로 가려진 슬롯은 OCR과 얼굴 크롭에서 제외하고 정상 복귀 때 다시 검출한다', () => {
  const setup = captureCanvas(1920, 1080, [42, 183, 324, 465], [183, 324, 465])
  const cropper = vi.fn<PartyPortraitCropper>(() => null)

  const inputs = capturePartyRecognitionInputs(setup.video, cropper)

  expect(inputs).toEqual([
    { slot: 0, nickname: setup.nicknames[0], portrait: null },
    null,
    null,
    null
  ])
  expect(cropper).toHaveBeenCalledOnce()
  setup.nextFrame(1920, 1080, [42, 183, 324, 465])
  expect(capturePartyRecognitionInputs(setup.video).every((entry) => entry?.portrait != null)).toBe(
    true
  )
})

it('기존 닉네임 전용 경로도 연결중 슬롯을 OCR 입력으로 보내지 않는다', () => {
  const setup = captureCanvas(1920, 1080, [42, 183, 324, 465], [183, 324, 465])

  expect(capturePartyNicknameCrops(setup.video)).toEqual([setup.nicknames[0], null, null, null])
})

it.each([
  [0, 0],
  [8193, 600],
  [8192, 8192]
])('처리할 수 없는 %i×%i 영상은 Canvas를 할당하지 않는다', (width, height) => {
  const createElement = vi.fn()
  vi.stubGlobal('document', { createElement })
  const video = { videoWidth: width, videoHeight: height } as HTMLVideoElement

  expect(capturePartyNicknameCrops(video)).toEqual([null, null, null, null])
  expect(createElement).not.toHaveBeenCalled()
})

it('공통 네이티브 캡처의 RGBA를 영상 변환 없이 크롭하고 원본은 바꾸지 않는다', () => {
  const setup = captureCanvas(1280, 720, [42])
  const rgba = new Uint8Array(framePixels(1280, 720, [42]))
  const before = rgba.slice()

  const inputs = capturePartyRecognitionInputs({ width: 1280, height: 720, rgba })

  expect(inputs[0]?.nickname).toBe(setup.nicknames[0])
  expect(inputs[0]?.portrait).not.toBeNull()
  expect(inputs.slice(1)).toEqual([null, null, null])
  expect(Buffer.compare(rgba, before)).toBe(0)
})
