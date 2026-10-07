import { setImmediate } from 'node:timers/promises'
import { describe, expect, it } from 'vitest'
import type { CharacterImage, CharacterPortrait } from '../../preload/common/types/character'
import {
  createPortraitEdgeMatcher,
  scoreCharacterPortraitEdges,
  type PortraitEdgeRequirements
} from './portrait-edges'
import { PORTRAIT_MATCH_LIMITS, PortraitMatchBudgetExceededError } from './portrait-match'

const RGBA_CHANNELS = 4
const OPAQUE_ALPHA = 255
const FACE_SIZE = 7
const FULL_RAMP_PIXELS = (FACE_SIZE - 2) * (FACE_SIZE - 2)
const COMPLETE_FACE = { minCoverage: 1, minComparedPixels: FULL_RAMP_PIXELS }
const TEST_SIMILARITY_THRESHOLD = 0.95
const TEST_POLICY = { ...COMPLETE_FACE, minSimilarity: TEST_SIMILARITY_THRESHOLD }
type Pixel = readonly [number, number, number, number]

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

function grayImage(
  width: number,
  height: number,
  gray: (x: number, y: number) => number
): CharacterImage {
  return image(width, height, (x, y) => {
    const value = gray(x, y)

    return [value, value, value, OPAQUE_ALPHA]
  })
}

function ramp(): CharacterImage {
  return grayImage(FACE_SIZE, FACE_SIZE, (x) => 20 + x * 30)
}

function input(
  candidate = ramp(),
  portrait: CharacterPortrait = { image: ramp(), rasterScale: 1 }
): Parameters<typeof scoreCharacterPortraitEdges>[0] {
  const signal = new AbortController().signal

  return { candidate, portrait, signal }
}

describe('색 변화에 덜 민감한 얼굴 경계 비교', () => {
  it('색과 밝기 극성이 바뀌어도 같은 경계 방향을 일치로 판정한다', async () => {
    const recolored = image(FACE_SIZE, FACE_SIZE, (x) => [20 + 25 * x, 80, 160, OPAQUE_ALPHA])
    const inverted = grayImage(FACE_SIZE, FACE_SIZE, (x) => 235 - 30 * x)
    const match = createPortraitEdgeMatcher(TEST_POLICY)

    for (const candidate of [recolored, inverted]) {
      const score = await scoreCharacterPortraitEdges(input(candidate), COMPLETE_FACE)

      expect(score?.similarity).toBeCloseTo(1, 6)
      expect(score).toMatchObject({
        coverage: 1,
        comparedPixels: FULL_RAMP_PIXELS,
        alignment: { x: 0, y: 0, width: FACE_SIZE, height: FACE_SIZE }
      })
      expect(await match(input(candidate))).toBe(true)
    }
  })

  it('수직과 수평처럼 구조가 다른 경계를 거절하고 음수 유사도도 반환한다', async () => {
    const verticalRamp = grayImage(FACE_SIZE, FACE_SIZE, (_x, y) => 20 + y * 30)
    const args = input(verticalRamp)
    const score = await scoreCharacterPortraitEdges(args, COMPLETE_FACE)

    expect(score?.similarity).toBeCloseTo(-1, 6)
    expect(await createPortraitEdgeMatcher(TEST_POLICY)(args)).toBe(false)
  })

  it('전체 이미지에서 비대칭 경계의 이동 위치를 찾는다', async () => {
    const pattern = [
      [20, 20, 20, 20, 20, 20, 20],
      [20, 190, 190, 190, 20, 20, 20],
      [20, 190, 40, 190, 20, 20, 20],
      [20, 190, 190, 190, 20, 20, 20],
      [20, 20, 20, 160, 160, 20, 20],
      [20, 20, 20, 160, 160, 20, 20],
      [20, 20, 20, 20, 20, 20, 20]
    ]
    const face = grayImage(FACE_SIZE, FACE_SIZE, (x, y) => pattern[y][x])
    const candidate = grayImage(14, 13, (x, y) => {
      if (x < 4 || x > 10 || y < 3 || y > 9) {
        return 20
      }

      return pattern[y - 3][x - 4]
    })
    const args = input(candidate, { image: face, rasterScale: 1 })
    const score = await scoreCharacterPortraitEdges(args, { minCoverage: 1, minComparedPixels: 10 })

    expect(score?.similarity).toBeGreaterThan(0.99)
    expect(score?.alignment).toEqual({ x: 4, y: 3, width: FACE_SIZE, height: FACE_SIZE })
  })

  it('동률이면 위쪽, 왼쪽 정렬을 유지한다', async () => {
    const candidate = grayImage(12, 10, (x) => 10 + x * 20)
    const score = await scoreCharacterPortraitEdges(input(candidate), COMPLETE_FACE)

    expect(score?.similarity).toBeCloseTo(1, 6)
    expect(score?.alignment).toEqual({ x: 0, y: 0, width: FACE_SIZE, height: FACE_SIZE })
  })

  it('UI 배율로 복제한 얼굴을 같은 원래 크기로 정규화한다', async () => {
    const doubled = grayImage(FACE_SIZE * 2, FACE_SIZE * 2, (x) => 20 + Math.floor(x / 2) * 30)
    const args = input(ramp(), { image: doubled, rasterScale: 2 })

    expect(await scoreCharacterPortraitEdges(args, COMPLETE_FACE)).toMatchObject({
      similarity: 1,
      comparedPixels: FULL_RAMP_PIXELS,
      coverage: 1,
      alignment: { x: 0, y: 0, width: FACE_SIZE, height: FACE_SIZE }
    })
  })

  it('평탄한 여백은 비교량과 coverage 분모를 채우지 않는다', async () => {
    const edge = grayImage(8, 8, (x) => {
      if (x < 4) {
        return 20
      }

      return 200
    })
    const args = input(edge, { image: edge, rasterScale: 1 })
    const score = await scoreCharacterPortraitEdges(args, { minCoverage: 1, minComparedPixels: 12 })

    expect(score).toMatchObject({ similarity: 1, comparedPixels: 12, coverage: 1 })
    expect(
      await scoreCharacterPortraitEdges(args, { minCoverage: 1, minComparedPixels: 13 })
    ).toBeNull()
  })
})

describe('겹침 영역과 마스크의 경계', () => {
  it.each([0, 254])(
    '후보 이웃의 alpha %s가 불투명하지 않으면 해당 3x3 비교를 제외한다',
    async (alpha) => {
      const candidate = image(FACE_SIZE, FACE_SIZE, (x, y) => {
        const value = 20 + x * 30
        const pixelAlpha = x === 0 && y === 0 ? alpha : OPAQUE_ALPHA

        return [value, value, value, pixelAlpha]
      })
      const requirements = { minCoverage: 24 / 25, minComparedPixels: 24 }
      const args = input(candidate)
      const score = await scoreCharacterPortraitEdges(args, requirements)

      expect(score).toMatchObject({ comparedPixels: 24, coverage: 24 / 25 })
      expect(score?.similarity).toBeCloseTo(1, 6)
      expect(await scoreCharacterPortraitEdges(args, COMPLETE_FACE)).toBeNull()
      expect(await createPortraitEdgeMatcher({ ...requirements, minSimilarity: 0.99 })(args)).toBe(
        true
      )
      expect(await createPortraitEdgeMatcher(TEST_POLICY)(args)).toBe(false)
    }
  )

  it('원본 마스크 이웃까지 제외한 nonzero 벡터만 template의 유효 비교량으로 센다', async () => {
    const mask = new Uint8Array(FACE_SIZE * FACE_SIZE).fill(1)
    mask[0] = 0
    const args = input(ramp(), { image: ramp(), rasterScale: 1, validMask: mask })
    const score = await scoreCharacterPortraitEdges(args, { minCoverage: 1, minComparedPixels: 24 })

    expect(score).toMatchObject({ comparedPixels: 24, coverage: 1 })
    expect(await scoreCharacterPortraitEdges(args, COMPLETE_FACE)).toBeNull()
  })

  it.each(['mask', 'transparent', 'translucent'])(
    '%s로 가린 색 차이가 가짜 경계를 만들지 않는다',
    async (exclusion) => {
      const mask = new Uint8Array(FACE_SIZE * FACE_SIZE).fill(1)
      mask[3 * FACE_SIZE + 3] = 0
      const face = image(FACE_SIZE, FACE_SIZE, (x, y) => {
        if (x !== 3 || y !== 3) {
          return [40, 40, 40, OPAQUE_ALPHA]
        }
        let alpha = OPAQUE_ALPHA
        if (exclusion === 'transparent') {
          alpha = 0
        } else if (exclusion === 'translucent') {
          alpha = 254
        }

        return [220, 220, 220, alpha]
      })
      const validMask = exclusion === 'mask' ? mask : undefined
      const args = input(ramp(), { image: face, rasterScale: 1, validMask })

      expect(
        await scoreCharacterPortraitEdges(args, { minCoverage: 1, minComparedPixels: 1 })
      ).toBeNull()
    }
  )

  it('후보의 zero 벡터는 유효 겹침으로 세지만 에너지가 전혀 없으면 null이다', async () => {
    const candidate = grayImage(FACE_SIZE, FACE_SIZE, (x) => {
      if (x < 4) {
        return 20
      }

      return 200
    })
    const score = await scoreCharacterPortraitEdges(input(candidate), COMPLETE_FACE)
    const flat = grayImage(FACE_SIZE, FACE_SIZE, () => 20)

    expect(score).toMatchObject({ comparedPixels: FULL_RAMP_PIXELS, coverage: 1 })
    expect(score?.similarity).toBeGreaterThan(0)
    expect(score?.similarity).toBeLessThan(TEST_SIMILARITY_THRESHOLD)
    expect(await scoreCharacterPortraitEdges(input(flat), COMPLETE_FACE)).toBeNull()
  })

  it('비교량 조건에 탈락한 최고점 대신 조건을 통과한 다른 정렬을 찾는다', async () => {
    const candidate = image(16, FACE_SIZE, (x, y) => {
      if (x < FACE_SIZE) {
        const value = 20 + x * 30
        const alpha = x === 0 && y === 0 ? 0 : OPAQUE_ALPHA

        return [value, value, value, alpha]
      }

      if (x < 9) {
        return [0, 0, 0, 0]
      }
      const value = 20 + (x - 9) * 30 + y * 2

      return [value, value, value, OPAQUE_ALPHA]
    })
    const args = input(candidate)
    const score = await scoreCharacterPortraitEdges(args, COMPLETE_FACE)

    expect(score?.alignment).toEqual({ x: 9, y: 0, width: FACE_SIZE, height: FACE_SIZE })
    expect(score?.coverage).toBe(1)
    expect(score?.similarity).toBeGreaterThan(TEST_SIMILARITY_THRESHOLD)
    expect(await createPortraitEdgeMatcher(TEST_POLICY)(args)).toBe(true)
  })

  it('유사도가 같은 정렬은 더 많은 경계가 겹치는 위치를 선택한다', async () => {
    const candidate = image(16, FACE_SIZE, (x, y) => {
      if (x >= FACE_SIZE && x < 9) {
        return [0, 0, 0, 0]
      }
      const localX = x < FACE_SIZE ? x : x - 9
      const value = 20 + localX * 30
      const alpha = x === 0 && y === 0 ? 0 : OPAQUE_ALPHA

      return [value, value, value, alpha]
    })
    const score = await scoreCharacterPortraitEdges(input(candidate), {
      minCoverage: 24 / 25,
      minComparedPixels: 24
    })

    expect(score).toMatchObject({
      similarity: 1,
      comparedPixels: FULL_RAMP_PIXELS,
      coverage: 1,
      alignment: { x: 9, y: 0, width: FACE_SIZE, height: FACE_SIZE }
    })
  })

  it('입력 이미지와 마스크 버퍼를 보존한다', async () => {
    const args = input(ramp(), {
      image: ramp(),
      rasterScale: 1,
      validMask: new Uint8Array(FACE_SIZE * FACE_SIZE).fill(1)
    })
    const source = args.portrait.image.rgba.slice()
    const mask = args.portrait.validMask?.slice()
    const candidate = args.candidate.rgba.slice()

    await scoreCharacterPortraitEdges(args, COMPLETE_FACE)

    expect(args.portrait.image.rgba).toEqual(source)
    expect(args.portrait.validMask).toEqual(mask)
    expect(args.candidate.rgba).toEqual(candidate)
  })
})

describe('입력 검증과 계산 자원', () => {
  it.each([
    ['평탄', grayImage(FACE_SIZE, FACE_SIZE, () => 20)],
    ['투명', image(FACE_SIZE, FACE_SIZE, () => [100, 0, 200, 0])],
    ['3x3 미만', grayImage(2, 2, (x) => x * 200)]
  ])('%s 얼굴은 비교 정보를 만들지 않는다', async (_name, face) => {
    const args = input(ramp(), { image: face, rasterScale: 1 })

    expect(await scoreCharacterPortraitEdges(args, COMPLETE_FACE)).toBeNull()
    expect(await createPortraitEdgeMatcher(TEST_POLICY)(args)).toBe(false)
  })

  it.each([0, -1, NaN, Infinity])('유효하지 않은 UI 배율 %s를 거부한다', async (rasterScale) => {
    await expect(
      scoreCharacterPortraitEdges(input(ramp(), { image: ramp(), rasterScale }), COMPLETE_FACE)
    ).rejects.toThrow(TypeError)
  })

  it.each([0.001, 100])(
    '허용된 정규화 크기를 벗어나는 UI 배율 %s를 거부한다',
    async (rasterScale) => {
      await expect(
        scoreCharacterPortraitEdges(input(ramp(), { image: ramp(), rasterScale }), COMPLETE_FACE)
      ).rejects.toThrow(RangeError)
    }
  )

  it.each([
    ['잘못된 RGBA 길이', { ...ramp(), rgba: new Uint8Array(2) }],
    ['너비 소수', { ...ramp(), width: 1.5 }],
    ['높이 NaN', { ...ramp(), height: NaN }],
    ['축 크기 초과', { ...ramp(), width: PORTRAIT_MATCH_LIMITS.imageDimension + 1 }],
    ['총 픽셀 초과', { ...ramp(), width: 2048, height: 1024 }]
  ])('%s 입력을 후보와 얼굴 양쪽에서 거부한다', async (_name, invalid) => {
    await expect(scoreCharacterPortraitEdges(input(invalid), COMPLETE_FACE)).rejects.toThrow(
      TypeError
    )
    await expect(
      scoreCharacterPortraitEdges(input(ramp(), { image: invalid, rasterScale: 1 }), COMPLETE_FACE)
    ).rejects.toThrow(TypeError)
  })

  it.each([
    ['길이', new Uint8Array(2)],
    ['값', new Uint8Array(FACE_SIZE * FACE_SIZE).fill(255)]
  ])('잘못된 마스크 %s를 거부한다', async (_name, validMask) => {
    await expect(
      scoreCharacterPortraitEdges(
        input(ramp(), { image: ramp(), rasterScale: 1, validMask }),
        COMPLETE_FACE
      )
    ).rejects.toThrow(TypeError)
  })

  it.each([
    { minCoverage: 0, minComparedPixels: 1 },
    { minCoverage: NaN, minComparedPixels: 1 },
    { minCoverage: 1.1, minComparedPixels: 1 },
    { minCoverage: 1, minComparedPixels: 0 },
    { minCoverage: 1, minComparedPixels: 1.5 },
    { minCoverage: 1, minComparedPixels: Infinity }
  ])('잘못된 최소 비교 조건 %j를 보정하지 않는다', async (requirements) => {
    await expect(scoreCharacterPortraitEdges(input(), requirements)).rejects.toThrow(TypeError)
    expect(() =>
      createPortraitEdgeMatcher({ ...requirements, minSimilarity: TEST_SIMILARITY_THRESHOLD })
    ).toThrow(TypeError)
  })

  it.each([-1, NaN, Infinity, 1.01])('잘못된 최소 유사도 %s를 거부한다', (minSimilarity) => {
    expect(() => createPortraitEdgeMatcher({ ...COMPLETE_FACE, minSimilarity })).toThrow(TypeError)
  })

  it('외부 정책 변경이 검증된 matcher 기준을 바꾸지 않는다', async () => {
    const policy = { ...TEST_POLICY }
    const match = createPortraitEdgeMatcher(policy)
    policy.minComparedPixels = 100

    expect(await match(input())).toBe(true)
  })

  it('취소된 입력은 원래 취소 사유를 보존한다', async () => {
    const controller = new AbortController()
    const reason = new Error('슬롯 교체')
    controller.abort(reason)

    await expect(
      scoreCharacterPortraitEdges({ ...input(), signal: controller.signal }, COMPLETE_FACE)
    ).rejects.toBe(reason)
  })

  it('큰 이미지 전처리 중 event loop를 양보해 취소를 처리한다', async () => {
    const controller = new AbortController()
    const reason = new Error('캡처 종료')
    const candidate = grayImage(1024, 1024, (x) => x % 200)
    const pending = scoreCharacterPortraitEdges(
      { ...input(candidate), signal: controller.signal },
      COMPLETE_FACE
    )
    const rejected = expect(pending).rejects.toBe(reason)
    await setImmediate()
    controller.abort(reason)

    await rejected
  })

  it('투명한 후보 영역 방문도 비교 예산에 포함하고 초과를 오류로 구분한다', async () => {
    const candidate = image(1024, 1024, (x, y) => {
      if (x >= 12 || y >= 12) {
        return [0, 0, 0, 0]
      }
      const value = x * 20

      return [value, value, value, OPAQUE_ALPHA]
    })
    const face = grayImage(10, 10, (x) => x * 20)
    const requirements: PortraitEdgeRequirements = { minCoverage: 1, minComparedPixels: 64 }

    await expect(
      scoreCharacterPortraitEdges(input(candidate, { image: face, rasterScale: 1 }), requirements)
    ).rejects.toBeInstanceOf(PortraitMatchBudgetExceededError)
  })
})
