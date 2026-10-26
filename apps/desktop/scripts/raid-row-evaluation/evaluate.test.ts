import { describe, expect, it } from 'vitest'
import { parseDNFRaidValueNotation } from '@dfragon/lib'
import { type CaseObservation, type RowObservation, summarize } from './evaluate'
import { type ManifestCandidate, type ManifestRow, parseManifest } from './manifest'

// 합성 직업명, 수치만 쓰며 표본이나 플레이어 식별자는 넣지 않는다.
function manifestRow(overrides: Partial<ManifestRow> = {}): ManifestRow {
  return {
    row: 1,
    jobGrowName: '眞 크루세이더',
    visibleJobText: '眞 크루세이더',
    jobClipped: false,
    valueText: '12,345',
    uniqueName: null,
    candidates: [],
    ...overrides
  }
}

function candidate(overrides: Partial<ManifestCandidate>): ManifestCandidate {
  return {
    correct: false,
    fame: null,
    jobName: '프리스트(남)',
    jobGrowName: '眞 크루세이더',
    ...overrides
  }
}

function observation(
  expected: ManifestRow,
  overrides: Partial<RowObservation> = {}
): RowObservation {
  return {
    caseId: 'case-01',
    row: expected.row,
    resolution: '1067x600',
    columnKind: 'equipment-score',
    expected,
    valueText: expected.valueText,
    notation: parseDNFRaidValueNotation(expected.valueText),
    jobText: { nickname: '眞크루세이더', raw: '흑크루세더' },
    ...overrides
  }
}

function caseOf(rows: readonly RowObservation[], overrides: Partial<CaseObservation> = {}) {
  return {
    caseId: 'case-01',
    resolution: '1067x600',
    detection: 'found',
    matchScore: 0.99,
    expectedKind: 'equipment-score',
    observedKind: 'equipment-score',
    rows,
    ...overrides
  } satisfies CaseObservation
}

describe('평가 요약', () => {
  it('후보 값이 없으면 명성 차이를 not_run으로 남긴다', () => {
    const summary = summarize([caseOf([observation(manifestRow())])], 'OCR 모델이 없습니다')

    expect(summary.candidates).toEqual({
      status: 'not_run',
      reason: '후보 명성, 직업명을 담은 행이 없습니다'
    })
    expect(summary.jobOcr).toEqual({ status: 'not_run', reason: 'OCR 모델이 없습니다' })
  })

  it('정답 후보와의 명성 차이와 같은 직업 후보 간격을 계산한다', () => {
    const row = manifestRow({
      valueText: '120,000',
      candidates: [
        candidate({ correct: true, fame: 119_990 }),
        candidate({ fame: 119_000 }),
        candidate({ fame: 119_995, jobGrowName: '眞 인파이터' })
      ]
    })
    const jobNameRow = manifestRow({
      row: 2,
      valueText: '50,000',
      // 후보의 jobGrowName이 없고 jobName이 화면 직업명과 같으면 jobName으로 센다.
      candidates: [candidate({ correct: true, jobName: '眞 크루세이더', jobGrowName: null })]
    })
    const summary = summarize(
      [caseOf([observation(row, { columnKind: 'fame' }), observation(jobNameRow)])],
      null
    )

    expect(summary.candidates).toEqual({
      status: 'run',
      screenJobField: { jobGrowName: 1, jobName: 1, neither: 0 },
      fameDifferences: [10],
      // 다른 직업 후보(명성 119,995)는 간격에서 빠진다.
      fameGaps: [990]
    })
  })

  it('열 종류, 수치 판독, 직업명 OCR 일치를 표본 범위와 함께 센다', () => {
    const clipped = manifestRow({
      row: 2,
      jobGrowName: '眞 소드마스터',
      visibleJobText: '眞 소드마스',
      jobClipped: true,
      valueText: '2,212'
    })
    const summary = summarize(
      [
        caseOf([
          observation(manifestRow()),
          observation(clipped, {
            valueText: '2,272',
            notation: parseDNFRaidValueNotation('2,272'),
            jobText: { nickname: '眞소드마스E-', raw: '鳥소드마손日' }
          })
        ]),
        caseOf([], {
          caseId: 'case-02',
          detection: 'not-found',
          matchScore: null,
          expectedKind: 'fame',
          observedKind: null
        })
      ],
      null
    )

    expect(summary.coverage).toMatchObject({
      images: 2,
      rows: 2,
      resolutions: { '1067x600': 2 },
      kNotationRows: 0,
      clippedJobRows: 1
    })
    expect(summary.detection.fame).toEqual({ matched: 0, total: 1, minMatchScore: null })
    expect(summary.columnKind).toEqual({ matched: 1, total: 2 })
    expect(summary.value).toMatchObject({
      matched: 1,
      total: 2,
      failures: [{ caseId: 'case-01', row: 2, expected: '2,212', read: '2,272' }],
      notationMatched: { matched: 1, total: 2 }
    })
    expect(summary.jobOcr).toMatchObject({
      status: 'run',
      nickname: {
        exactRaw: { matched: 0, total: 2 },
        exactWithoutSpaceAndMark: { matched: 1, total: 2 },
        exactNormalized: { matched: 2, total: 2 },
        ruleMatched: { matched: 2, total: 2 },
        ruleFalseMatched: { matched: 0, total: 2 }
      },
      raw: { ruleMatched: { matched: 0, total: 2 } }
    })
  })
})

describe('manifest', () => {
  it('후보가 있으면 정답 후보가 정확히 1명이어야 한다', () => {
    const entry = {
      id: 'case-01',
      image: 'case-01.png',
      columnKind: 'fame',
      rows: [
        {
          row: 1,
          jobGrowName: '眞 검귀',
          visibleJobText: '眞 검귀',
          jobClipped: false,
          valueText: '1',
          candidates: [{ fame: 1 }, { fame: 2 }]
        }
      ]
    }

    expect(() => parseManifest('/samples', { cases: [entry] })).toThrow('정답 후보는 정확히 1명')
    expect(() =>
      parseManifest('/samples', { cases: [{ ...entry, image: '/absolute.png' }] })
    ).toThrow('상대 경로')
  })
})
