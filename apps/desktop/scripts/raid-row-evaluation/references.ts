import { fileURLToPath } from 'node:url'
import type {
  DNFParticipantFrame,
  DNFRaidMetadataTemplates,
  DNFRaidValueHeadingTemplates
} from '@dfragon/lib'
import { sliceRaidValueGlyphs } from '../../src/backend/lib/raid-value-glyphs'
import { readPng } from './manifest'

const LIBRARY_ASSETS = new URL('../../src/backend/lib/', import.meta.url)
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
  // 제품의 `raid-window.ts`와 같은 sprite와 자르기를 쓴다.
  const equipmentScoreGlyphs = sliceRaidValueGlyphs(readAsset('raid-value-glyphs.png'))
  const placeholder = new Uint8Array(PARTY_SIZE.width * PARTY_SIZE.height * RGBA_CHANNELS).map(
    (_, index) => (index % PLACEHOLDER_STRIPE) * PLACEHOLDER_STEP
  )

  return {
    parties: [{ party: '싱글', image: { ...PARTY_SIZE, rgba: placeholder } }],
    equipmentScoreGlyphs
  }
}
