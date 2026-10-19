/// <reference types="electron-vite/node" />
// Renderer 통합 테스트가 캡처 IPC를 함께 검사해 web 타입 검사에도 `?asset` 선언이 필요하다.
import { readFileSync } from 'node:fs'
import { PNG } from 'pngjs'
import {
  classifyDNFRaidValueColumn,
  cropDNFRaidParticipantNicknames,
  readDNFRaidParticipantValues,
  type DNFParticipantFrame,
  type DNFRaidMetadataTemplates,
  type DNFRaidParticipantCropResult,
  type DNFRaidParticipantDetection,
  type DNFRaidValueColumnKind,
  type DNFRaidValueHeadingTemplates
} from '@dfragon/lib'
import raidHeadingPath from './raid-heading.png?asset'
import fameHeadingPath from './raid-value-heading-fame.png?asset'
import equipmentScoreHeadingPath from './raid-value-heading-equipment-score.png?asset'
import valueGlyphsPath from './raid-value-glyphs.png?asset'
import { sliceRaidValueGlyphs } from './raid-value-glyphs'

type ValueGlyphs = DNFRaidMetadataTemplates['equipmentScoreGlyphs']
type FoundDetection = Extract<DNFRaidParticipantDetection, { status: 'found' }>

// 수치 칸 판독은 FHD 이하 프레임에서만 검증했다. 더 큰 프레임은 수치를 읽지 않는다.
const VALUE_FRAME_LIMIT = { width: 1920, height: 1080 }

let raidHeading: DNFParticipantFrame | null = null
let valueHeadings: DNFRaidValueHeadingTemplates | null = null
let valueGlyphs: ValueGlyphs | null = null

// 함께 보관한 UI 0% 기준 이미지는 감마와 alpha 변환 없이 읽는다.
function readReference(path: string): DNFParticipantFrame {
  const { width, height, data } = PNG.sync.read(readFileSync(path))

  return { width, height, rgba: data }
}

function getRaidHeading(): DNFParticipantFrame {
  raidHeading ??= readReference(raidHeadingPath)

  return raidHeading
}

function getValueHeadings(): DNFRaidValueHeadingTemplates {
  valueHeadings ??= {
    fame: readReference(fameHeadingPath),
    equipmentScore: readReference(equipmentScoreHeadingPath)
  }

  return valueHeadings
}

function getValueGlyphs(): ValueGlyphs {
  valueGlyphs ??= sliceRaidValueGlyphs(readReference(valueGlyphsPath))

  return valueGlyphs
}

/**
 * 한 프레임에서 12행 공대 상세 창을 찾고 참가 행의 닉네임 원본을 복사한다. 개발자 작업 공간의 공대원창
 * 크롭과 일반 공대 캡처가 같은 검출과 크롭을 쓴다.
 */
export function cropRaidWindowNicknames(frame: DNFParticipantFrame): DNFRaidParticipantCropResult {
  return cropDNFRaidParticipantNicknames(frame, getRaidHeading())
}

/**
 * 찾은 공대 상세 창의 수치 열 종류와 행마다 수치 칸의 표기를 읽는다. 표기는 화면 순서이며 빈 행과 읽지
 * 못한 행은 null이다.
 */
export function readRaidWindowValues(
  frame: DNFParticipantFrame,
  detection: Pick<FoundDetection, 'valueHeadingRegion' | 'rows'>
): { valueColumn: DNFRaidValueColumnKind; valueTexts: (string | null)[] } {
  const valueColumn = classifyDNFRaidValueColumn(
    frame,
    detection.valueHeadingRegion,
    getValueHeadings()
  )
  if (frame.width > VALUE_FRAME_LIMIT.width || frame.height > VALUE_FRAME_LIMIT.height) {
    const valueTexts = detection.rows.map(() => null)

    return { valueColumn, valueTexts }
  }
  const values = readDNFRaidParticipantValues(frame, detection.rows, getValueGlyphs())
  const valueTexts = values.map((value) => value.valueText)

  return { valueColumn, valueTexts }
}
