import { setImmediate } from 'node:timers/promises'
import { describe, expect, it } from 'vitest'
import type { CharacterImage, CharacterPortrait } from '../../preload/common/types/character'
import {
  createPortraitMatcher,
  PORTRAIT_MATCH_LIMITS,
  PortraitMatchBudgetExceededError,
  scoreCharacterPortrait
} from './portrait-match'

const RGBA_CHANNELS = 4
const OPAQUE_ALPHA = 255
type Pixel = readonly [number, number, number, number]
const TRANSPARENT: Pixel = [0, 0, 0, 0]
const FACE: readonly Pixel[] = [
  [10, 20, 30, OPAQUE_ALPHA],
  [40, 60, 80, OPAQUE_ALPHA],
  [100, 120, 140, OPAQUE_ALPHA],
  [150, 90, 30, OPAQUE_ALPHA],
  [60, 170, 200, OPAQUE_ALPHA],
  [210, 190, 80, OPAQUE_ALPHA]
]
const EXACT_POLICY = { maxMeanChannelError: 0, minCoverage: 1, minComparedPixels: 6 }

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

function portrait(): CharacterPortrait {
  const face = image(3, 2, (x, y) => FACE[y * 3 + x])

  return { image: face, rasterScale: 1 }
}

function candidateFace(pixel: (index: number) => Pixel = (index) => FACE[index]): CharacterImage {
  return image(8, 7, (x, y) => {
    if (x < 2 || x > 4 || y < 3 || y > 4) {
      return TRANSPARENT
    }
    const index = (y - 3) * 3 + x - 2

    return pixel(index)
  })
}

function input(
  face = portrait(),
  candidate = candidateFace()
): Parameters<typeof scoreCharacterPortrait>[0] {
  const signal = new AbortController().signal

  return { portrait: face, candidate, signal }
}

describe('크롭을 마친 캐릭터 얼굴의 정렬과 점수', () => {
  it('전체 이미지에서 얼굴 위치를 찾아 실제 겹친 RGB 평균 오차를 구한다', async () => {
    const candidate = candidateFace((index) => {
      const [red, green, blue] = FACE[index]

      return [red + 3, green + 6, blue + 9, OPAQUE_ALPHA]
    })

    expect(await scoreCharacterPortrait(input(portrait(), candidate))).toEqual({
      meanChannelError: 6,
      comparedPixels: 6,
      coverage: 1,
      alignment: { x: 2, y: 3, width: 3, height: 2 }
    })
  })

  it('동일한 최적 위치가 여러 개면 위쪽, 왼쪽 위치를 선택한다', async () => {
    const candidate = image(8, 5, (x, y) => {
      if (y >= 2 || x === 3 || x === 7) {
        return TRANSPARENT
      }
      const faceX = x % 4

      return FACE[y * 3 + faceX]
    })
    const score = await scoreCharacterPortrait(input(portrait(), candidate))

    expect(score).toMatchObject({
      meanChannelError: 0,
      coverage: 1,
      alignment: { x: 0, y: 0 }
    })
  })

  it('UI 배율로 복제된 픽셀을 원래 크기로 정규화한다', async () => {
    const doubled = image(6, 4, (x, y) => FACE[Math.floor(y / 2) * 3 + Math.floor(x / 2)])
    const scaled = { image: doubled, rasterScale: 2 }

    expect(await scoreCharacterPortrait(input(scaled))).toEqual({
      meanChannelError: 0,
      comparedPixels: 6,
      coverage: 1,
      alignment: { x: 2, y: 3, width: 3, height: 2 }
    })
  })

  it('왕관 등 마스크로 제외한 픽셀과 투명한 얼굴 픽셀을 비교하지 않는다', async () => {
    const masked: CharacterPortrait = {
      image: image(3, 2, (x, y) => {
        if (x === 0 && y === 0) {
          return [255, 255, 255, OPAQUE_ALPHA]
        }

        if (x === 1 && y === 0) {
          return [255, 255, 255, 0]
        }

        return FACE[y * 3 + x]
      }),
      rasterScale: 1,
      validMask: new Uint8Array([0, 1, 1, 1, 1, 1])
    }
    const result = await scoreCharacterPortrait(input(masked))

    expect(result).toEqual({
      meanChannelError: 0,
      comparedPixels: 4,
      coverage: 1,
      alignment: { x: 2, y: 3, width: 3, height: 2 }
    })
  })

  it('후보 투명 픽셀의 숨은 RGB를 비교하지 않고 coverage에 반영한다', async () => {
    const candidate = candidateFace((index) => {
      if (index === 0) {
        return [255, 255, 255, 0]
      }

      return FACE[index]
    })
    const score = await scoreCharacterPortrait(input(portrait(), candidate))

    expect(score).toEqual({
      meanChannelError: 0,
      comparedPixels: 5,
      coverage: 5 / 6,
      alignment: { x: 2, y: 3, width: 3, height: 2 }
    })
  })

  it('투명한 영역의 완벽한 한 픽셀보다 충분히 겹치는 얼굴을 우선한다', async () => {
    const candidate = image(10, 6, (x, y) => {
      if (x === 0 && y === 0) {
        return FACE[0]
      }

      if (x < 5 || x > 7 || y < 2 || y > 3) {
        return TRANSPARENT
      }
      const [red, green, blue] = FACE[(y - 2) * 3 + x - 5]

      return [red + 1, green + 1, blue + 1, OPAQUE_ALPHA]
    })

    expect(await scoreCharacterPortrait(input(portrait(), candidate))).toEqual({
      meanChannelError: 1,
      comparedPixels: 6,
      coverage: 1,
      alignment: { x: 5, y: 2, width: 3, height: 2 }
    })
  })

  it.each([
    ['투명한 얼굴', { image: image(3, 2, () => TRANSPARENT), rasterScale: 1 }],
    ['동일한 RGB만 있는 얼굴', { image: image(3, 2, () => FACE[0]), rasterScale: 1 }],
    ['모두 제외한 얼굴', { ...portrait(), validMask: new Uint8Array(6) }]
  ])('%s은 식별 정보가 없어 점수를 반환하지 않는다', async (_name, face) => {
    expect(await scoreCharacterPortrait(input(face))).toBeNull()
  })

  it('후보가 모두 투명하거나 정규화 얼굴보다 작으면 정렬하지 않는다', async () => {
    expect(
      await scoreCharacterPortrait(
        input(
          portrait(),
          image(3, 2, () => TRANSPARENT)
        )
      )
    ).toBeNull()
    expect(
      await scoreCharacterPortrait(
        input(
          portrait(),
          image(2, 2, () => FACE[0])
        )
      )
    ).toBeNull()
  })

  it('호출자의 원본 이미지와 마스크 버퍼를 변경하거나 분리하지 않는다', async () => {
    const args = input({ ...portrait(), validMask: new Uint8Array([1, 0, 1, 1, 1, 1]) })
    const originalPortrait = args.portrait.image.rgba.slice()
    const originalMask = args.portrait.validMask?.slice()
    const originalCandidate = args.candidate.rgba.slice()

    await scoreCharacterPortrait(args)

    expect(args.portrait.image.rgba).toEqual(originalPortrait)
    expect(args.portrait.validMask).toEqual(originalMask)
    expect(args.candidate.rgba).toEqual(originalCandidate)
  })
})

describe('얼굴 입력과 계산 자원 경계', () => {
  it.each([0, -1, Infinity, NaN])('잘못된 UI 배율 %s을 거부한다', async (rasterScale) => {
    await expect(scoreCharacterPortrait(input({ ...portrait(), rasterScale }))).rejects.toThrow(
      TypeError
    )
  })

  it.each([
    ['소수 너비', { ...portrait().image, width: 1.5 }],
    ['음수 높이', { ...portrait().image, height: -1 }],
    ['RGBA 길이 불일치', { ...portrait().image, rgba: new Uint8Array(3) }],
    ['너비 한도 초과', { ...portrait().image, width: PORTRAIT_MATCH_LIMITS.imageDimension + 1 }],
    ['픽셀 한도 초과', { ...portrait().image, width: 2048, height: 1024 }]
  ])('%s 입력을 거부한다', async (_name, invalidImage) => {
    await expect(
      scoreCharacterPortrait(input({ image: invalidImage, rasterScale: 1 }))
    ).rejects.toThrow(TypeError)
    await expect(scoreCharacterPortrait(input(portrait(), invalidImage))).rejects.toThrow(TypeError)
  })

  it.each([
    ['마스크 길이 불일치', new Uint8Array(5)],
    ['허용하지 않는 마스크 값', new Uint8Array([1, 1, 1, 1, 1, 255])]
  ])('%s 입력을 거부한다', async (_name, validMask) => {
    await expect(scoreCharacterPortrait(input({ ...portrait(), validMask }))).rejects.toThrow(
      TypeError
    )
  })

  it.each([0.001, 100])(
    '정규화 결과가 허용 크기를 벗어나는 배율 %s을 거부한다',
    async (rasterScale) => {
      await expect(scoreCharacterPortrait(input({ ...portrait(), rasterScale }))).rejects.toThrow(
        RangeError
      )
    }
  )

  it('계산 예산 초과를 불일치나 빈 점수로 숨기지 않는다', async () => {
    const face = {
      image: image(8, 8, (x, y) => FACE[(x + y) % FACE.length]),
      rasterScale: 1
    }
    const candidate = image(1024, 1024, () => FACE[0])

    await expect(scoreCharacterPortrait(input(face, candidate))).rejects.toBeInstanceOf(
      PortraitMatchBudgetExceededError
    )
  })

  it('시작 전 취소 사유를 보존한다', async () => {
    const controller = new AbortController()
    const reason = new Error('이미 슬롯이 바뀜')
    controller.abort(reason)

    await expect(scoreCharacterPortrait({ ...input(), signal: controller.signal })).rejects.toBe(
      reason
    )
  })

  it('탐색 중 event loop를 양보해 같은 프로세스의 취소를 처리한다', async () => {
    const controller = new AbortController()
    const reason = new Error('탐색 도중 캡처 중지')
    const candidate = image(200, 230, (x, y) => FACE[(x + y) % FACE.length])
    const pending = scoreCharacterPortrait({
      ...input(portrait(), candidate),
      signal: controller.signal
    })
    const rejected = expect(pending).rejects.toBe(reason)
    await setImmediate()
    controller.abort(reason)

    await rejected
  })
})

describe('명시적으로 전달된 얼굴 일치 기준', () => {
  it('오차, coverage, 비교 픽셀 조건을 모두 만족해야 일치한다', async () => {
    expect(await createPortraitMatcher(EXACT_POLICY)(input())).toBe(true)
    expect(await createPortraitMatcher({ ...EXACT_POLICY, minComparedPixels: 7 })(input())).toBe(
      false
    )

    const partialCandidate = candidateFace((index) => {
      if (index === 0) {
        return TRANSPARENT
      }

      return FACE[index]
    })
    expect(
      await createPortraitMatcher({ ...EXACT_POLICY, minComparedPixels: 5 })(
        input(portrait(), partialCandidate)
      )
    ).toBe(false)
    expect(
      await createPortraitMatcher({ ...EXACT_POLICY, minCoverage: 5 / 6, minComparedPixels: 5 })(
        input(portrait(), partialCandidate)
      )
    ).toBe(true)

    const changedCandidate = candidateFace((index) => {
      const [red, green, blue] = FACE[index]

      return [red + 3, green + 6, blue + 9, OPAQUE_ALPHA]
    })
    expect(await createPortraitMatcher(EXACT_POLICY)(input(portrait(), changedCandidate))).toBe(
      false
    )
    expect(
      await createPortraitMatcher({ ...EXACT_POLICY, maxMeanChannelError: 6 })(
        input(portrait(), changedCandidate)
      )
    ).toBe(true)
  })

  it('유효 픽셀이 부족하거나 단색인 얼굴을 자동 일치시키지 않는다', async () => {
    const onePixel = image(4, 3, (x, y) => {
      if (x === 0 && y === 0) {
        return FACE[0]
      }

      return TRANSPARENT
    })
    const match = createPortraitMatcher(EXACT_POLICY)

    expect(await match(input(portrait(), onePixel))).toBe(false)
    expect(await match(input({ image: image(3, 2, () => FACE[0]), rasterScale: 1 }))).toBe(false)
  })

  it('최적 점수가 기준에 미달해도 다른 위치가 모든 허용 조건을 만족하면 일치한다', async () => {
    const candidate = image(10, 3, (x, y) => {
      if (y > 1 || x === 3 || x === 4 || x > 7) {
        return TRANSPARENT
      }

      if (x < 3) {
        const [red, green, blue] = FACE[y * 3 + x]

        return [red + 1, green + 1, blue + 1, OPAQUE_ALPHA]
      }

      if (x === 5 && y === 0) {
        return TRANSPARENT
      }

      return FACE[y * 3 + x - 5]
    })
    const policy = { maxMeanChannelError: 0, minCoverage: 5 / 6, minComparedPixels: 5 }

    expect(await scoreCharacterPortrait(input(portrait(), candidate))).toMatchObject({
      meanChannelError: 1,
      coverage: 1,
      alignment: { x: 0, y: 0 }
    })
    expect(await createPortraitMatcher(policy)(input(portrait(), candidate))).toBe(true)
  })

  it.each([
    { ...EXACT_POLICY, maxMeanChannelError: NaN },
    { ...EXACT_POLICY, maxMeanChannelError: -1 },
    { ...EXACT_POLICY, maxMeanChannelError: 256 },
    { ...EXACT_POLICY, minCoverage: 0 },
    { ...EXACT_POLICY, minCoverage: 1.01 },
    { ...EXACT_POLICY, minCoverage: Infinity },
    { ...EXACT_POLICY, minComparedPixels: 0 },
    { ...EXACT_POLICY, minComparedPixels: 1.5 },
    { ...EXACT_POLICY, minComparedPixels: Infinity }
  ])('잘못된 허용 기준 %j을 보정하지 않고 거부한다', (policy) => {
    expect(() => createPortraitMatcher(policy)).toThrow(TypeError)
  })

  it('생성 이후 외부에서 정책 객체를 변경해도 검증한 허용 기준을 유지한다', async () => {
    const policy = { ...EXACT_POLICY }
    const match = createPortraitMatcher(policy)
    policy.minComparedPixels = 100

    expect(await match(input())).toBe(true)
  })
})
