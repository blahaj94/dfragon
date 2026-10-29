import { setImmediate } from 'node:timers/promises'
import { describe, expect, it } from 'vitest'
import type { CharacterImage, CharacterPortrait } from '../../preload/common/types/character'
import type { PortraitAnchor } from './portrait-anchor'
import {
  createPortraitColorScorer,
  type PortraitColorInput,
  type PortraitColorPolicy
} from './portrait-color'
import { PortraitComparisonBudgetExceededError } from './portrait-raster'

const RGBA_CHANNELS = 4
const OPAQUE_ALPHA = 255
const FACE_SIZE = 26
const BADGE = { width: 12, height: 9 } as const
const GARBAGE: Pixel = [255, 0, 0, OPAQUE_ALPHA]
const TRANSPARENT: Pixel = [0, 0, 0, 0]
const POLICY: PortraitColorPolicy = {
  gridSize: 4,
  minCoverage: 0.01,
  minComparedCells: 1,
  topFraction: 1,
  anchorRadius: 0
}
type Pixel = readonly [number, number, number, number]
type Placement = Readonly<{ x: number; y: number; source: CharacterImage }>

function image(
  width: number,
  height: number,
  pixel: (x: number, y: number) => Pixel
): CharacterImage {
  const rgba = new Uint8Array(width * height * RGBA_CHANNELS)
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      rgba.set(pixel(x, y), (y * width + x) * RGBA_CHANNELS)
    }
  }

  return { width, height, rgba }
}

function pixelAt(source: CharacterImage, x: number, y: number): Pixel {
  const offset = (y * source.width + x) * RGBA_CHANNELS
  const [red, green, blue, alpha] = source.rgba.subarray(offset, offset + RGBA_CHANNELS)

  return [red, green, blue, alpha]
}

function faceImage(size = FACE_SIZE, offset = 0): CharacterImage {
  let state = 1
  const next = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0

    return 16 + ((state >>> 24) % 224) + offset
  }

  return image(size, size, () => [next(), next(), next(), OPAQUE_ALPHA])
}

function candidateImage(
  width: number,
  height: number,
  placements: readonly Placement[]
): CharacterImage {
  return image(width, height, (x, y) => {
    for (const { x: left, y: top, source } of placements) {
      if (x >= left && x < left + source.width && y >= top && y < top + source.height) {
        return pixelAt(source, x - left, y - top)
      }
    }

    return TRANSPARENT
  })
}

function badgeMask(size = FACE_SIZE): Uint8Array {
  return Uint8Array.from({ length: size * size }, (_, pixel) => {
    const x = pixel % size
    const y = Math.floor(pixel / size)

    if (x < BADGE.width && y < BADGE.height) {
      return 0
    }

    return 1
  })
}

function scaleImage(source: CharacterImage, factor: number): CharacterImage {
  return image(source.width * factor, source.height * factor, (x, y) =>
    pixelAt(source, Math.floor(x / factor), Math.floor(y / factor))
  )
}

function scaleMask(mask: Uint8Array, size: number, factor: number): Uint8Array {
  const scaled = size * factor

  return Uint8Array.from({ length: scaled * scaled }, (_, pixel) => {
    const x = Math.floor((pixel % scaled) / factor)
    const y = Math.floor(Math.floor(pixel / scaled) / factor)

    return mask[y * size + x]
  })
}

function portrait(source = faceImage(), validMask?: Uint8Array): CharacterPortrait {
  if (validMask === undefined) {
    return { image: source, rasterScale: 1 }
  }

  return { image: source, rasterScale: 1, validMask }
}

function input(
  face: CharacterPortrait,
  candidate: CharacterImage,
  signal = new AbortController().signal,
  anchor: PortraitAnchor | null = null
): PortraitColorInput {
  return { portrait: face, candidate, anchor, signal }
}

function score(
  face: CharacterPortrait,
  candidate: CharacterImage,
  policy: Partial<PortraitColorPolicy> = {},
  anchor: PortraitAnchor | null = null
) {
  const signal = new AbortController().signal

  return createPortraitColorScorer({ ...POLICY, ...policy })(input(face, candidate, signal, anchor))
}

describe('셀 평균 색 비교의 정렬과 점수', () => {
  it('투명 여백 안에서 얼굴 위치를 찾아 distance 0을 낸다', async () => {
    const candidate = candidateImage(60, 80, [{ x: 17, y: 9, source: faceImage() }])

    expect(await score(portrait(), candidate)).toEqual({
      distance: 0,
      coverage: 1,
      comparedCells: 16,
      alignment: { x: 17, y: 9, width: FACE_SIZE, height: FACE_SIZE }
    })
  })

  it.each([4, 6, 8])('격자 N=%i에서도 같은 얼굴은 distance 0이다', async (gridSize) => {
    const candidate = candidateImage(60, 80, [{ x: 11, y: 4, source: faceImage() }])

    expect(await score(portrait(), candidate, { gridSize })).toEqual({
      distance: 0,
      coverage: 1,
      comparedCells: gridSize * gridSize,
      alignment: { x: 11, y: 4, width: FACE_SIZE, height: FACE_SIZE }
    })
  })

  it('rasterScale 2로 복제된 얼굴과 마스크는 1배 얼굴과 같은 점수를 낸다', async () => {
    const candidate = candidateImage(60, 80, [{ x: 9, y: 6, source: faceImage(FACE_SIZE, 3) }])
    const base = await score(portrait(faceImage(), badgeMask()), candidate)
    const scaled = await score(
      {
        image: scaleImage(faceImage(), 2),
        rasterScale: 2,
        validMask: scaleMask(badgeMask(), FACE_SIZE, 2)
      },
      candidate
    )

    expect(base).toMatchObject({ alignment: { x: 9, y: 6 } })
    expect(scaled).toEqual(base)
  })

  it('validMask로 제외한 얼굴 픽셀은 셀 평균에 넣지 않는다', async () => {
    const mask = badgeMask()
    const face = image(FACE_SIZE, FACE_SIZE, (x, y) =>
      mask[y * FACE_SIZE + x] === 0 ? GARBAGE : pixelAt(faceImage(), x, y)
    )
    const visibleFace = image(FACE_SIZE, FACE_SIZE, (x, y) =>
      mask[y * FACE_SIZE + x] === 0 ? TRANSPARENT : pixelAt(faceImage(), x, y)
    )
    const candidate = candidateImage(60, 80, [{ x: 8, y: 10, source: visibleFace }])

    expect(await score(portrait(face, mask), candidate)).toMatchObject({
      distance: 0,
      comparedCells: 15,
      alignment: { x: 8, y: 10 }
    })
    expect((await score(portrait(face), candidate))?.distance).toBeGreaterThan(0)
  })

  it('topFraction 밖의 아래쪽 위치는 거리가 더 작아도 고르지 않는다', async () => {
    const candidate = candidateImage(40, 100, [
      { x: 7, y: 2, source: faceImage(FACE_SIZE, 3) },
      { x: 7, y: 70, source: faceImage() }
    ])
    const exactWindows = { minCoverage: 1 }

    expect(await score(portrait(), candidate, { ...exactWindows, topFraction: 0.5 })).toMatchObject(
      { distance: expect.closeTo(3), alignment: { x: 7, y: 2 } }
    )
    expect(await score(portrait(), candidate, { ...exactWindows, topFraction: 1 })).toMatchObject({
      distance: 0,
      alignment: { x: 7, y: 70 }
    })
  })

  it('기준 위치가 있으면 그 주변만 비교해 더 가까운 먼 창을 고르지 않는다', async () => {
    const candidate = candidateImage(40, 100, [
      { x: 7, y: 2, source: faceImage() },
      { x: 8, y: 70, source: faceImage(FACE_SIZE, 3) }
    ])
    const exactWindows = { minCoverage: 1, anchorRadius: 1 }

    expect(await score(portrait(), candidate, exactWindows, { x: 7, y: 71 })).toMatchObject({
      distance: expect.closeTo(3),
      alignment: { x: 8, y: 70 }
    })
    expect(await score(portrait(), candidate, exactWindows, null)).toMatchObject({
      distance: 0,
      alignment: { x: 7, y: 2 }
    })
  })

  it('기준 위치에서 anchorRadius를 넘는 창은 비교하지 않는다', async () => {
    const candidate = candidateImage(60, 80, [{ x: 20, y: 30, source: faceImage() }])
    const exactWindows = { minCoverage: 1 }

    expect(
      await score(portrait(), candidate, { ...exactWindows, anchorRadius: 2 }, { x: 18, y: 32 })
    ).toMatchObject({ distance: 0, alignment: { x: 20, y: 30 } })
    expect(
      await score(portrait(), candidate, { ...exactWindows, anchorRadius: 1 }, { x: 18, y: 32 })
    ).toBeNull()
  })

  it('기준 주변 창이 이미지 밖으로 나가면 이미지 안의 위치만 비교한다', async () => {
    const candidate = candidateImage(30, 30, [{ x: 0, y: 4, source: faceImage() }])

    expect(await score(portrait(), candidate, { anchorRadius: 2 }, { x: -1, y: 5 })).toMatchObject({
      distance: 0,
      alignment: { x: 0, y: 4 }
    })
    expect(await score(portrait(), candidate, { anchorRadius: 2 }, { x: 40, y: 4 })).toBeNull()
  })

  it('불투명 비율이 minCoverage에 못 미치는 창은 고르지 않는다', async () => {
    const upperHalf = image(FACE_SIZE, 13, (x, y) => pixelAt(faceImage(), x, y))
    const candidate = candidateImage(40, 40, [{ x: 7, y: 5, source: upperHalf }])

    expect(await score(portrait(), candidate, { minCoverage: 0.5 })).toEqual({
      distance: 0,
      coverage: 0.5,
      comparedCells: 8,
      alignment: { x: 7, y: 5, width: FACE_SIZE, height: FACE_SIZE }
    })
    expect(await score(portrait(), candidate, { minCoverage: 0.51 })).toBeNull()
  })

  it('비교한 셀 수가 minComparedCells에 못 미치면 고르지 않는다', async () => {
    const mask = Uint8Array.from({ length: FACE_SIZE * FACE_SIZE }, (_, pixel) =>
      pixel % FACE_SIZE < 13 && Math.floor(pixel / FACE_SIZE) < 13 ? 1 : 0
    )
    const candidate = candidateImage(60, 80, [{ x: 5, y: 7, source: faceImage() }])

    expect(await score(portrait(faceImage(), mask), candidate, { minComparedCells: 4 })).toEqual({
      distance: 0,
      coverage: 1,
      comparedCells: 4,
      alignment: { x: 5, y: 7, width: FACE_SIZE, height: FACE_SIZE }
    })
    expect(await score(portrait(faceImage(), mask), candidate, { minComparedCells: 5 })).toBeNull()
  })

  it.each([
    ['단색 얼굴', portrait(image(FACE_SIZE, FACE_SIZE, () => [80, 90, 100, OPAQUE_ALPHA]))],
    ['전부 투명한 얼굴', portrait(image(FACE_SIZE, FACE_SIZE, () => TRANSPARENT))],
    ['전부 마스크로 제외한 얼굴', portrait(faceImage(), new Uint8Array(FACE_SIZE * FACE_SIZE))]
  ])('%s은 구분할 정보가 없어 null이다', async (_, face) => {
    const candidate = candidateImage(60, 80, [{ x: 5, y: 7, source: faceImage() }])

    expect(await score(face, candidate)).toBeNull()
  })

  it.each([
    ['전부 투명한 후보', image(60, 80, () => TRANSPARENT)],
    ['얼굴 창보다 작은 후보', image(20, 20, () => [80, 90, 100, OPAQUE_ALPHA])]
  ])('%s는 비교할 위치가 없어 null이다', async (_, candidate) => {
    expect(await score(portrait(), candidate)).toBeNull()
  })

  it('거리와 비교 셀 수가 같으면 위쪽, 그다음 왼쪽 창을 고른다', async () => {
    const face = faceImage()
    const stacked = candidateImage(40, 100, [
      { x: 7, y: 60, source: face },
      { x: 7, y: 3, source: face }
    ])
    const sideBySide = candidateImage(100, 40, [
      { x: 60, y: 7, source: face },
      { x: 3, y: 7, source: face }
    ])

    expect(await score(portrait(), stacked, { minCoverage: 1 })).toMatchObject({
      distance: 0,
      alignment: { x: 7, y: 3 }
    })
    expect(await score(portrait(), sideBySide, { minCoverage: 1 })).toMatchObject({
      distance: 0,
      alignment: { x: 3, y: 7 }
    })
  })

  it('호출자의 얼굴, 마스크와 후보 버퍼를 바꾸지 않는다', async () => {
    const face = portrait(faceImage(), badgeMask())
    const candidate = candidateImage(60, 80, [{ x: 17, y: 9, source: faceImage() }])
    const before = [face.image.rgba.slice(), face.validMask?.slice(), candidate.rgba.slice()]

    await score(face, candidate)

    expect([face.image.rgba, face.validMask, candidate.rgba]).toEqual(before)
  })
})

describe('색 비교 입력 경계', () => {
  it.each([
    [
      'RGBA 길이가 틀린 얼굴',
      { image: { ...faceImage(), rgba: new Uint8Array(3) }, rasterScale: 1 }
    ],
    ['0인 rasterScale', { image: faceImage(), rasterScale: 0 }],
    ['크기가 틀린 마스크', portrait(faceImage(), new Uint8Array(3))],
    ['0과 1이 아닌 마스크 값', portrait(faceImage(), new Uint8Array(FACE_SIZE * FACE_SIZE).fill(2))]
  ])('%s을 거절한다', async (_, face) => {
    const candidate = candidateImage(60, 80, [{ x: 5, y: 7, source: faceImage() }])

    await expect(score(face, candidate)).rejects.toThrow(TypeError)
  })

  it('잘못된 후보 이미지를 거절한다', async () => {
    const candidate = { ...faceImage(), height: 1.5 }

    await expect(score(portrait(), candidate)).rejects.toThrow(TypeError)
  })

  it('정규화한 얼굴이 격자보다 작으면 범위 오류로 거절한다', async () => {
    const candidate = candidateImage(60, 80, [{ x: 5, y: 7, source: faceImage() }])

    await expect(score(portrait(), candidate, { gridSize: 27 })).rejects.toThrow(RangeError)
  })

  // 512 × 512 후보를 예산이 넘을 때까지 실제로 비교하므로 무겁다. Windows CI에서 기본 5초에 가깝게 걸려
  // (main에서 2~4초, 테스트가 몰린 shard에서 5초 초과) 이 사례만 제한을 늘린다.
  it('계산 예산 초과를 빈 점수로 숨기지 않는다', async () => {
    const candidate = image(512, 512, () => [80, 90, 100, OPAQUE_ALPHA])

    await expect(score(portrait(), candidate, { gridSize: 16 })).rejects.toBeInstanceOf(
      PortraitComparisonBudgetExceededError
    )
  }, 20_000)

  it('시작 전 취소 사유를 보존한다', async () => {
    const controller = new AbortController()
    const reason = new Error('이미 슬롯이 바뀜')
    controller.abort(reason)
    const candidate = candidateImage(60, 80, [{ x: 5, y: 7, source: faceImage() }])

    await expect(
      createPortraitColorScorer(POLICY)(input(portrait(), candidate, controller.signal))
    ).rejects.toBe(reason)
  })

  it('창 탐색 중 event loop를 양보해 같은 프로세스의 취소를 처리한다', async () => {
    const controller = new AbortController()
    const reason = new Error('탐색 도중 캡처 중지')
    const candidate = image(80, 80, () => [80, 90, 100, OPAQUE_ALPHA])
    const pending = createPortraitColorScorer({ ...POLICY, gridSize: 8 })(
      input(portrait(), candidate, controller.signal)
    )
    const rejected = expect(pending).rejects.toBe(reason)
    await setImmediate()
    controller.abort(reason)

    await rejected
  })
})
