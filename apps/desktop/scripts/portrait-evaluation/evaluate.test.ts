import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { PNG } from 'pngjs'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  createPortraitColorScorer,
  type PortraitColorScorer
} from '../../src/backend/search/portrait-color'
import type { CharacterImage } from '../../src/preload/common/types/character'
import { type CaseResult, evaluateCase, summarize } from './evaluate'
import { buildHudPortrait, hudFaceSize } from './hud-portrait'
import {
  type LoadedCandidate,
  type LoadedCase,
  loadCase,
  parseManifest,
  readManifest
} from './manifest'

const RGBA_CHANNELS = 4
const FACE = 26
const CANDIDATE_SIZE = { width: 44, height: 60 } as const
const FACE_ORIGIN = { x: 9, y: 7 } as const
const GRID_SIZE = 4
const scorer = createPortraitColorScorer({
  gridSize: GRID_SIZE,
  minCoverage: 0.5,
  minComparedCells: 4,
  topFraction: 1,
  anchorRadius: 0
})
const signal = new AbortController().signal

type Color = (x: number, y: number) => readonly [number, number, number]

function cellIndex(position: number): number {
  return [6, 13, 19].filter((edge) => position >= edge).length
}

const gradient: Color = (x, y) => [
  cellIndex(x) * 60,
  cellIndex(y) * 60,
  (cellIndex(x) + cellIndex(y)) * 30
]
const inverted: Color = (x, y) => {
  const [red, green, blue] = gradient(x, y)

  return [255 - red, 255 - green, 255 - blue]
}

function faceImage(size: number, color: Color): CharacterImage {
  const rgba = new Uint8Array(size * size * RGBA_CHANNELS)
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      rgba.set(
        [...color(Math.floor((x * FACE) / size), Math.floor((y * FACE) / size)), 255],
        (y * size + x) * RGBA_CHANNELS
      )
    }
  }

  return { width: size, height: size, rgba }
}

function candidateImage(color: Color): CharacterImage {
  const { width, height } = CANDIDATE_SIZE
  const rgba = new Uint8Array(width * height * RGBA_CHANNELS)
  for (let y = 0; y < FACE; y += 1) {
    for (let x = 0; x < FACE; x += 1) {
      rgba.set(
        [...color(x, y), 255],
        ((FACE_ORIGIN.y + y) * width + FACE_ORIGIN.x + x) * RGBA_CHANNELS
      )
    }
  }

  return { width, height, rgba }
}

function transparentImage(): CharacterImage {
  const { width, height } = CANDIDATE_SIZE

  return { width, height, rgba: new Uint8Array(width * height * RGBA_CHANNELS) }
}

function candidate(id: string, image: CharacterImage | null, correct = false): LoadedCandidate {
  return { id, image, correct, jobName: null }
}

function loadedCase(candidates: readonly LoadedCandidate[]): LoadedCase {
  return { id: 'case-01', hud: faceImage(FACE, gradient), rasterScale: 1, candidates }
}

function evaluate(candidates: readonly LoadedCandidate[]): Promise<CaseResult> {
  return evaluateCase({
    loaded: loadedCase(candidates),
    gridSize: GRID_SIZE,
    scorer,
    anchors: true,
    signal
  })
}

describe('evaluateCase', () => {
  it.each([
    [true, { x: 78, y: 98 }],
    [false, null]
  ])('anchors=%s면 직업 얼굴 위치나 null을 비교기에 넘긴다', async (anchors, anchor) => {
    const spy = vi.fn<PortraitColorScorer>(async () => null)
    const archer = { ...candidate('c0', candidateImage(gradient), true), jobName: '아처' }

    await evaluateCase({
      loaded: loadedCase([archer, candidate('c1', candidateImage(inverted))]),
      gridSize: GRID_SIZE,
      scorer: spy,
      anchors,
      signal
    })

    expect(spy.mock.calls.map(([input]) => input.anchor)).toEqual([anchor, null])
  })

  it('정답이 1위면 순위 1과 오답 최소 distance와의 차이를 margin으로 돌려준다', async () => {
    const result = await evaluate([
      candidate('c0', candidateImage(inverted)),
      candidate('c1', candidateImage(gradient), true),
      candidate('c2', null)
    ])

    expect(result.rank).toBe(1)
    expect(result.correctDistance).toBeCloseTo(0, 6)
    expect(result.bestWrongDistance).toBeGreaterThan(50)
    expect(result.margin).toBeCloseTo(result.bestWrongDistance as number, 6)
    expect(result.comparedCandidates).toBe(2)
    expect(result.skippedCandidateIds).toEqual(['c2'])
    expect(result.excludedReason).toBeNull()
  })

  it('정답이 1위가 아니면 순위가 밀리고 margin이 음수다', async () => {
    const result = await evaluate([
      candidate('c0', candidateImage(gradient)),
      candidate('c1', candidateImage(inverted), true)
    ])

    expect(result.rank).toBe(2)
    expect(result.margin).toBeCloseTo(-(result.correctDistance as number), 6)
    expect(result.margin).toBeLessThan(0)
  })

  it('정답과 같은 distance인 오답은 정답보다 앞선 것으로 센다', async () => {
    const result = await evaluate([
      candidate('c0', candidateImage(gradient)),
      candidate('c1', candidateImage(gradient), true)
    ])

    expect(result.rank).toBe(2)
    expect(result.margin).toBe(0)
  })

  it('점수가 null인 오답은 순위에 영향을 주지 않고 표에는 null로 남는다', async () => {
    const result = await evaluate([
      candidate('c0', transparentImage()),
      candidate('c1', candidateImage(gradient), true)
    ])

    expect(result.rank).toBe(1)
    expect(result.margin).toBeNull()
    expect(result.candidates.find((entry) => entry.id === 'c0')?.score).toBeNull()
  })

  it('정답 점수가 null이면 최하위로 둔다', async () => {
    const result = await evaluate([
      candidate('c0', candidateImage(inverted)),
      candidate('c1', transparentImage(), true)
    ])

    expect(result.rank).toBe(2)
    expect(result.correctDistance).toBeNull()
    expect(result.margin).toBeNull()
  })

  it('정답 이미지가 없으면 점수를 구하지 않고 제외한다', async () => {
    const result = await evaluate([
      candidate('c0', candidateImage(gradient)),
      candidate('c1', null, true)
    ])

    expect(result.excludedReason).toBe('correct-image-missing')
    expect(result.candidates).toEqual([])
    expect(result.rank).toBeNull()
  })

  it('후보가 1명뿐이면 점수는 구하되 margin 계산에서 제외한다', async () => {
    const result = await evaluate([candidate('c0', candidateImage(gradient), true)])

    expect(result.excludedReason).toBe('single-candidate')
    expect(result.correctDistance).toBeCloseTo(0, 6)
    expect(result.margin).toBeNull()
  })
})

describe('summarize', () => {
  it('1위 정확도와 distance, margin 요약을 제외 케이스와 분리해 계산한다', async () => {
    const win = await evaluate([
      candidate('c0', candidateImage(inverted)),
      candidate('c1', candidateImage(gradient), true)
    ])
    const lose = await evaluate([
      candidate('c0', candidateImage(gradient)),
      candidate('c1', candidateImage(inverted), true)
    ])
    const single = await evaluate([candidate('c0', candidateImage(gradient), true)])

    const summary = summarize(GRID_SIZE, [win, lose, single])

    expect(summary).toMatchObject({
      totalCases: 3,
      evaluatedCases: 2,
      excludedCases: 1,
      top1Count: 1,
      top1Accuracy: 0.5,
      nullScoreCount: 0
    })
    expect(summary.maxCorrectDistance).toBe(lose.correctDistance)
    expect(summary.minWrongTop1Distance).toBe(lose.bestWrongDistance)
    expect(summary.minWrongDistance).toBeCloseTo(0, 6)
    expect(summary.minCorrectTop1Margin).toBe(win.margin)
  })

  it('케이스가 없으면 정확도는 null이다', () => {
    expect(summarize(GRID_SIZE, []).top1Accuracy).toBeNull()
  })
})

describe('buildHudPortrait', () => {
  it.each([1, 1.25, 1.5, 2, 2.5])(
    'rasterScale %s에서 같은 픽셀과 마스크를 얻는다',
    (rasterScale) => {
      const size = hudFaceSize(rasterScale)
      const hud = faceImage(size, gradient)

      const portrait = buildHudPortrait(hud, rasterScale)

      expect(portrait.image.rgba).toEqual(hud.rgba)
      expect(portrait.rasterScale).toBe(rasterScale)
      expect(portrait.validMask?.[0]).toBe(0)
      expect(portrait.validMask?.[Math.floor(size / 2) * size + Math.floor(size / 2)]).toBe(1)
    }
  )

  it('rasterScale에 맞지 않는 크기의 얼굴을 거절한다', () => {
    expect(() => buildHudPortrait(faceImage(FACE, gradient), 2)).toThrow(RangeError)
  })
})

describe('manifest', () => {
  const directories: string[] = []

  function sampleDirectory(): string {
    const directory = mkdtempSync(join(tmpdir(), 'portrait-evaluation-'))
    directories.push(directory)

    return directory
  }

  function writePng(file: string, image: CharacterImage): void {
    const png = new PNG({ width: image.width, height: image.height })
    png.data = Buffer.from(image.rgba)
    mkdirSync(join(file, '..'), { recursive: true })
    writeFileSync(file, PNG.sync.write(png))
  }

  afterEach(() => {
    for (const directory of directories.splice(0)) {
      rmSync(directory, { recursive: true, force: true })
    }
  })

  const validCase = {
    id: 'case-01',
    hud: 'case-01/hud.png',
    rasterScale: 1,
    candidates: [
      { id: 'c0', image: 'case-01/candidate-0.png', correct: true, jobName: '아처' },
      { id: 'c1', image: null }
    ]
  }

  it('manifest와 PNG를 읽어 이미지 없는 후보를 null로 남긴다', () => {
    const directory = sampleDirectory()
    writeFileSync(join(directory, 'manifest.json'), JSON.stringify({ cases: [validCase] }))
    writePng(join(directory, 'case-01/hud.png'), faceImage(FACE, gradient))
    writePng(join(directory, 'case-01/candidate-0.png'), candidateImage(gradient))

    const manifest = readManifest(directory)
    const loaded = loadCase(manifest, manifest.cases[0])

    expect(loaded.hud.rgba).toEqual(faceImage(FACE, gradient).rgba)
    expect(
      loaded.candidates.map((entry) => [entry.id, entry.correct, entry.jobName, entry.image?.width])
    ).toEqual([
      ['c0', true, '아처', CANDIDATE_SIZE.width],
      ['c1', false, null, undefined]
    ])
  })

  it.each([
    ['cases가 비어 있음', { cases: [] }],
    ['정답이 없음', { cases: [{ ...validCase, candidates: [{ id: 'c0', image: null }] }] }],
    [
      '정답이 둘',
      {
        cases: [
          {
            ...validCase,
            candidates: [
              { id: 'c0', image: null, correct: true },
              { id: 'c1', image: null, correct: true }
            ]
          }
        ]
      }
    ],
    [
      '후보 id 중복',
      {
        cases: [{ ...validCase, candidates: [validCase.candidates[0], { id: 'c0', image: null }] }]
      }
    ],
    ['케이스 id 중복', { cases: [validCase, validCase] }],
    ['rasterScale이 0', { cases: [{ ...validCase, rasterScale: 0 }] }],
    ['절대 경로', { cases: [{ ...validCase, hud: '/etc/hud.png' }] }],
    [
      '문자열이 아닌 jobName',
      { cases: [{ ...validCase, candidates: [{ ...validCase.candidates[0], jobName: 1 }] }] }
    ]
  ])('잘못된 manifest를 거절한다: %s', (_name, json) => {
    expect(() => parseManifest('/samples', json)).toThrow(TypeError)
  })

  it('표본 폴더 밖을 가리키는 경로를 거절한다', () => {
    const directory = sampleDirectory()
    const manifest = parseManifest(directory, { cases: [{ ...validCase, hud: '../outside.png' }] })

    expect(() => loadCase(manifest, manifest.cases[0])).toThrow(RangeError)
  })
})
