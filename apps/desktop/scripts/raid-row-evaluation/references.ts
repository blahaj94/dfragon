import { readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import type {
  DNFParticipantFrame,
  DNFRaidMetadataTemplates,
  DNFRaidScoreGlyph,
  DNFRaidValueHeadingTemplates
} from '@dfragon/lib'
import { readPng } from './manifest'

const LIBRARY_ASSETS = new URL('../../src/backend/lib/', import.meta.url)
const GLYPH_FOLDER = 'raid-value-glyphs/'
// 쉼표와 마침표는 파일 이름에서 알아보기 쉽게 영어 이름으로 적는다.
const GLYPH_FILES: Readonly<Record<string, DNFRaidScoreGlyph>> = {
  '0.png': '0',
  '1.png': '1',
  '2.png': '2',
  '3.png': '3',
  '4.png': '4',
  '5.png': '5',
  '6.png': '6',
  '7.png': '7',
  '8.png': '8',
  '9.png': '9',
  'comma.png': ',',
  'period.png': '.',
  'K.png': 'K'
}
const PARTY_SIZE = { width: 42, height: 17 } as const
const RGBA_CHANNELS = 4
const PLACEHOLDER_STRIPE = 7
const PLACEHOLDER_STEP = 30

function readAsset(name: string): DNFParticipantFrame {
  return readPng(fileURLToPath(new URL(name, LIBRARY_ASSETS)))
}

/** 창 검출 기준 헤더. 제품의 `raid-window.ts`가 읽는 같은 파일이다. */
export function readRaidHeading(): DNFParticipantFrame {
  return readAsset('raid-heading.png')
}

export function readValueHeadings(): DNFRaidValueHeadingTemplates {
  return {
    fame: readAsset('raid-value-heading-fame.png'),
    equipmentScore: readAsset('raid-value-heading-equipment-score.png')
  }
}

/**
 * 수치 글자 기준 이미지와 파티 표식 자리 표시자다. 파티 표식 기준은 저장소에 없고 이 평가는 파티를
 * 읽지 않으므로, 입력 검증만 통과하는 합성 줄무늬를 넣고 결과의 `party`는 쓰지 않는다.
 */
export function readValueTemplates(): DNFRaidMetadataTemplates {
  const folder = new URL(GLYPH_FOLDER, LIBRARY_ASSETS)
  const equipmentScoreGlyphs: DNFRaidMetadataTemplates['equipmentScoreGlyphs'][number][] = []
  for (const file of readdirSync(folder)) {
    const character = GLYPH_FILES[file]
    if (character !== undefined) {
      equipmentScoreGlyphs.push({ character, image: readAsset(`${GLYPH_FOLDER}${file}`) })
    }
  }
  const placeholder = new Uint8Array(PARTY_SIZE.width * PARTY_SIZE.height * RGBA_CHANNELS).map(
    (_, index) => (index % PLACEHOLDER_STRIPE) * PLACEHOLDER_STEP
  )

  return {
    parties: [{ party: '싱글', image: { ...PARTY_SIZE, rgba: placeholder } }],
    equipmentScoreGlyphs
  }
}
