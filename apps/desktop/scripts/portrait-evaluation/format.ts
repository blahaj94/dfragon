import type { CaseResult, EvaluationSummary } from './evaluate'

function fixed(value: number | null, digits: number): string {
  if (value === null) {
    return 'null'
  }

  return value.toFixed(digits)
}

function table(header: readonly string[], rows: readonly (readonly string[])[]): string {
  const widths = header.map((title, column) =>
    Math.max(title.length, ...rows.map((row) => row[column].length))
  )
  const line = (cells: readonly string[]): string =>
    cells.map((cell, column) => cell.padStart(widths[column])).join('  ')

  return [line(header), ...rows.map(line)].join('\n')
}

export function formatCaseTable(results: readonly CaseResult[]): string {
  return table(
    ['N', 'case', 'compared', 'skipped', 'rank', 'correct', 'margin', 'coverage', 'ms'],
    results.map((result) => [
      String(result.gridSize),
      result.caseId,
      String(result.comparedCandidates),
      String(result.skippedCandidateIds.length),
      result.excludedReason ? `-(${result.excludedReason})` : String(result.rank),
      fixed(result.correctDistance, 3),
      result.excludedReason ? '-' : fixed(result.margin, 3),
      fixed(result.correctCoverage, 3),
      result.elapsedMs.toFixed(1)
    ])
  )
}

/** 후보별 점수. 점수가 없는 후보는 null로 남긴다. */
export function formatCandidateTable(results: readonly CaseResult[]): string {
  return table(
    ['N', 'case', 'candidate', 'correct', 'distance', 'coverage', 'cells'],
    results.flatMap((result) =>
      result.candidates.map((candidate) => [
        String(result.gridSize),
        result.caseId,
        candidate.id,
        candidate.correct ? 'yes' : '',
        fixed(candidate.score?.distance ?? null, 3),
        fixed(candidate.score?.coverage ?? null, 3),
        candidate.score ? String(candidate.score.comparedCells) : 'null'
      ])
    )
  )
}

export function formatSummaryTable(summaries: readonly EvaluationSummary[]): string {
  return table(
    [
      'N',
      'cases',
      'excluded',
      'top1',
      'accuracy',
      'max correct',
      'min wrong top1',
      'min wrong',
      'min top1 margin',
      'null'
    ],
    summaries.map((summary) => [
      String(summary.gridSize),
      String(summary.evaluatedCases),
      String(summary.excludedCases),
      String(summary.top1Count),
      fixed(summary.top1Accuracy, 3),
      fixed(summary.maxCorrectDistance, 3),
      fixed(summary.minWrongTop1Distance, 3),
      fixed(summary.minWrongDistance, 3),
      fixed(summary.minCorrectTop1Margin, 3),
      String(summary.nullScoreCount)
    ])
  )
}

export function formatExclusions(results: readonly CaseResult[]): string[] {
  return results.flatMap((result) =>
    result.excludedReason
      ? [
          `N=${result.gridSize} ${result.caseId}: 1위 정확도와 margin에서 제외(${result.excludedReason})`
        ]
      : []
  )
}
