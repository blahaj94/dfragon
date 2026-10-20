import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { describe, expect, it } from 'vitest'
import { createPortraitColorScorer } from '../../src/backend/search/portrait-color'
import { type CaseResult, evaluateCase, type PolicyBase, summarize } from './evaluate'
import {
  formatCandidateTable,
  formatCaseTable,
  formatExclusions,
  formatSummaryTable
} from './format'
import { loadCase, readManifest } from './manifest'

const GRID_SIZES = [4, 6, 8] as const
// 제품 정책의 후보값이며 환경 변수로 바꿔 가며 비교한다.
const DEFAULT_POLICY: PolicyBase = {
  minCoverage: 0.5,
  minComparedCells: 6,
  topFraction: 0.5,
  anchorRadius: 2
}

function readNumber(name: string, fallback: number): number {
  const text = process.env[name]
  if (text === undefined || text === '') {
    return fallback
  }
  const value = Number(text)
  if (!Number.isFinite(value)) {
    throw new TypeError(`${name}은 숫자여야 합니다`)
  }

  return value
}

const samples = process.env.DFRAGON_PORTRAIT_SAMPLES
const reportPath = process.env.DFRAGON_PORTRAIT_REPORT

describe.skipIf(samples === undefined || samples === '')('얼굴 색 비교 오프라인 평가', () => {
  it('gridSize별로 케이스마다 모든 후보를 비교해 정답 순위와 거리를 출력한다', async () => {
    const manifest = readManifest(samples as string)
    const policyBase: PolicyBase = {
      minCoverage: readNumber('DFRAGON_PORTRAIT_MIN_COVERAGE', DEFAULT_POLICY.minCoverage),
      minComparedCells: readNumber(
        'DFRAGON_PORTRAIT_MIN_COMPARED_CELLS',
        DEFAULT_POLICY.minComparedCells
      ),
      topFraction: readNumber('DFRAGON_PORTRAIT_TOP_FRACTION', DEFAULT_POLICY.topFraction),
      anchorRadius: readNumber('DFRAGON_PORTRAIT_ANCHOR_RADIUS', DEFAULT_POLICY.anchorRadius)
    }
    const anchors = process.env.DFRAGON_PORTRAIT_ANCHORS !== '0'
    const signal = new AbortController().signal
    const results: CaseResult[] = []
    for (const gridSize of GRID_SIZES) {
      const scorer = createPortraitColorScorer({ ...policyBase, gridSize })
      for (const entry of manifest.cases) {
        results.push(
          await evaluateCase({
            loaded: loadCase(manifest, entry),
            gridSize,
            scorer,
            anchors,
            signal
          })
        )
      }
    }
    const summaries = GRID_SIZES.map((gridSize) =>
      summarize(
        gridSize,
        results.filter((result) => result.gridSize === gridSize)
      )
    )

    console.log(`policy ${JSON.stringify(policyBase)} anchors ${anchors}`)
    console.log(formatCaseTable(results))
    if (process.env.DFRAGON_PORTRAIT_DETAIL === '1') {
      console.log(formatCandidateTable(results))
    }
    for (const line of formatExclusions(results)) {
      console.log(line)
    }
    console.log(formatSummaryTable(summaries))
    if (reportPath !== undefined && reportPath !== '') {
      mkdirSync(dirname(reportPath), { recursive: true })
      writeFileSync(
        reportPath,
        `${JSON.stringify({ policy: policyBase, results, summaries }, null, 2)}\n`
      )
    }

    expect(results).toHaveLength(GRID_SIZES.length * manifest.cases.length)
  })
})
