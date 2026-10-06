import { afterEach, expect, it, vi } from 'vitest'
import { capturePartyNicknameCrops } from './party'

type NicknameCanvas = {
  width: number
  height: number
  getContext: () => { putImageData: ReturnType<typeof vi.fn> }
}

afterEach(() => vi.unstubAllGlobals())

/** 실측한 기본 배율의 HP, MP와 이름 픽셀을 제품 검출 좌표와 독립적으로 그린다. */
function framePixels(width: number, height: number, anchors: number[]): Uint8ClampedArray {
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

  return rgba
}

/** Canvas 경계만 대체하고 실제 프레임 검출과 픽셀 전처리를 실행한다. */
function captureCanvas(
  width: number,
  height: number,
  anchors: number[]
): {
  video: HTMLVideoElement
  getImageData: ReturnType<typeof vi.fn>
  nicknames: NicknameCanvas[]
  nextFrame: (width: number, height: number, anchors: number[]) => void
} {
  let pixels = framePixels(width, height, anchors)
  const video = { videoWidth: width, videoHeight: height } as HTMLVideoElement
  const getImageData = vi.fn((x: number, y: number, cropWidth: number, cropHeight: number) => {
    const data = new Uint8ClampedArray(cropWidth * cropHeight * 4)
    for (let row = 0; row < cropHeight; row += 1) {
      const start = ((y + row) * video.videoWidth + x) * 4
      data.set(pixels.subarray(start, start + cropWidth * 4), row * cropWidth * 4)
    }

    return { data }
  })
  const frame = { width: 0, height: 0, getContext: () => ({ drawImage: vi.fn(), getImageData }) }
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
