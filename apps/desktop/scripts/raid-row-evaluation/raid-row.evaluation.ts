import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  classifyDNFRaidValueColumn,
  detectDNFRaidParticipantWindow,
  type DNFRectangle,
  parseDNFRaidValueNotation,
  readDNFRaidParticipantMetadata
} from '@dfragon/lib'
import type { CharacterImage } from '../../src/preload/common/types/character'
import { type CaseObservation, readJobText, type RowObservation, summarize } from './evaluate'
import { createJobOcrReader, type JobOcrReader } from './job-ocr'
import { loadCaseImage, readManifest } from './manifest'
import { readRaidHeading, readValueHeadings, readValueTemplates } from './references'

const RGBA_CHANNELS = 4
const DEFAULT_OCR_MODEL = fileURLToPath(
  new URL('../../../../packages/models/ocr-finetuned/model.onnx', import.meta.url)
)
const DEFAULT_OCR_DICTIONARY = fileURLToPath(
  new URL('../../../../packages/models/ocr-finetuned/characters.txt', import.meta.url)
)

const samples = process.env.DFRAGON_RAID_ROW_SAMPLES
const reportPath = process.env.DFRAGON_RAID_ROW_REPORT
const modelPath = process.env.DFRAGON_RAID_ROW_OCR_MODEL || DEFAULT_OCR_MODEL
const dictionaryPath = process.env.DFRAGON_RAID_ROW_OCR_DICTIONARY || DEFAULT_OCR_DICTIONARY

function crop(frame: CharacterImage, region: DNFRectangle): CharacterImage {
  const rgba = new Uint8Array(region.width * region.height * RGBA_CHANNELS)
  for (let y = 0; y < region.height; y += 1) {
    const start = ((region.y + y) * frame.width + region.x) * RGBA_CHANNELS
    rgba.set(
      frame.rgba.subarray(start, start + region.width * RGBA_CHANNELS),
      y * region.width * RGBA_CHANNELS
    )
  }

  return { width: region.width, height: region.height, rgba }
}

describe.skipIf(samples === undefined || samples === '')('공대 행 판독 오프라인 평가', () => {
  it('표본마다 창 검출, 열 종류, 수치, 직업명을 읽고 정답과 비교한 요약을 출력한다', async () => {
    const manifest = readManifest(samples as string)
    const heading = readRaidHeading()
    const valueHeadings = readValueHeadings()
    const valueTemplates = readValueTemplates()
    const ocrAvailable = existsSync(modelPath) && existsSync(dictionaryPath)
    const jobReader: JobOcrReader | null = ocrAvailable
      ? await createJobOcrReader(modelPath, dictionaryPath)
      : null
    const cases: CaseObservation[] = []
    for (const entry of manifest.cases) {
      const frame = loadCaseImage(manifest, entry)
      const resolution = `${frame.width}x${frame.height}`
      const detection = detectDNFRaidParticipantWindow(frame, heading)
      if (detection.status !== 'found') {
        cases.push({
          caseId: entry.id,
          resolution,
          detection: detection.status,
          matchScore: null,
          expectedKind: entry.columnKind,
          observedKind: null,
          rows: []
        })
        continue
      }
      const observedKind = classifyDNFRaidValueColumn(
        frame,
        detection.valueHeadingRegion,
        valueHeadings
      )
      const metadata = readDNFRaidParticipantMetadata(frame, detection.rows, valueTemplates)
      const rows: RowObservation[] = []
      for (const expected of entry.rows) {
        const detected = detection.rows[expected.row - 1]
        const valueText = metadata[expected.row - 1].equipmentScoreText
        rows.push({
          caseId: entry.id,
          row: expected.row,
          resolution,
          columnKind: entry.columnKind,
          expected,
          valueText,
          notation: valueText === null ? null : parseDNFRaidValueNotation(valueText),
          jobText:
            jobReader === null
              ? null
              : await readJobText(jobReader, crop(frame, detected.jobRegion))
        })
      }
      cases.push({
        caseId: entry.id,
        resolution,
        detection: 'found',
        matchScore: detection.matchScore,
        expectedKind: entry.columnKind,
        observedKind,
        rows
      })
    }
    const summary = summarize(cases, ocrAvailable ? null : 'OCR 모델이나 사전 파일이 없습니다')

    for (const entry of cases) {
      for (const row of entry.rows) {
        console.log(
          [
            entry.caseId,
            `row ${row.row}`,
            `kind ${entry.observedKind}/${entry.expectedKind}`,
            `value ${row.valueText}/${row.expected.valueText}`,
            `job ${JSON.stringify(row.jobText)}/${row.expected.visibleJobText}`
          ].join('  ')
        )
      }
    }
    console.log(JSON.stringify(summary, null, 2))
    if (reportPath !== undefined && reportPath !== '') {
      mkdirSync(dirname(reportPath), { recursive: true })
      writeFileSync(reportPath, `${JSON.stringify({ summary, cases }, null, 2)}\n`)
    }

    expect(cases).toHaveLength(manifest.cases.length)
  })
})
