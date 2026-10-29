import {
  validateDFNickname,
  detectDNFPartyParticipantWindow,
  cropDNFPartyParticipantNicknames,
  detectDNFRaidParticipantWindow,
  cropDNFRaidParticipantNicknames,
  readDNFRaidParticipantMetadata,
  readDNFRaidParticipantValues,
  classifyDNFRaidValueColumn,
  parseDNFRaidValueNotation,
  parseServerBuildInfo,
  matchesDNFSearchNicknamePolicy,
  DNF_SEARCH_NICKNAME_LIMITS,
  type NicknameValidationResult,
  type DFNicknameValidationOptions,
  type DNFRectangle,
  type DNFParticipantFrame,
  type DNFParticipantSlot,
  type DNFParticipantRow,
  type DNFParticipantDetection,
  type DNFParticipantCropResult,
  type DNFRaidParticipantPosition,
  type DNFRaidParticipantRow,
  type DNFRaidParticipantDetection,
  type DNFRaidParticipantCropResult,
  type DNFRaidParty,
  type DNFRaidScoreGlyph,
  type DNFRaidParticipantValue,
  type DNFRaidMetadataTemplates,
  type DNFRaidParticipantMetadata,
  type DNFRaidValueColumnKind,
  type DNFRaidValueHeadingTemplates,
  type DNFRaidValueNotation,
  type ServerBuildInfo,
  type ServerService
} from '@dfragon/lib'
import { OCR_DATA_LIMITS } from '@dfragon/lib/ocr-contract'
import manifest from '@dfragon/lib/package.json' with { type: 'json' }

export const packageName: string = manifest.name

export function nicknameMessage(
  nickname: string,
  options: DFNicknameValidationOptions
): string | null {
  const result: NicknameValidationResult = validateDFNickname(nickname, options)
  if (result.isValid) {
    return null
  }

  return result.reason
}

export function searchInput(nickname: string) {
  const allowed = matchesDNFSearchNicknamePolicy(nickname)
  const minimum = DNF_SEARCH_NICKNAME_LIMITS.minimumCodePoints
  const maximum = DNF_SEARCH_NICKNAME_LIMITS.maximumCodePoints

  return { nickname, allowed, minimum, maximum }
}

// 값을 쓰지 않고 타입 검사에서 속성 접근만 확인하려고 인자로 받는다.
function readOnlyForTypeCheck(_value: unknown): void {}

export function partyRows(frame: DNFParticipantFrame, heading: DNFParticipantFrame) {
  const detection: DNFParticipantDetection = detectDNFPartyParticipantWindow(frame, heading)
  const result: DNFParticipantCropResult = cropDNFPartyParticipantNicknames(frame, heading)
  if (result.status !== 'found') {
    // @ts-expect-error 실패 결과에서 검출된 행을 읽을 수 없어야 한다.
    readOnlyForTypeCheck(result.rows)

    return []
  }
  const rows: DNFParticipantRow[] = result.rows
  const samples = result.rows.map((row) => {
    const slot: DNFParticipantSlot = row.slot
    const nickname: DNFRectangle = row.nickname
    const crop: DNFParticipantFrame | null = row.crop

    return { slot, nickname, crop }
  })

  return { detection, rows, samples }
}

export function raidRows(frame: DNFParticipantFrame, heading: DNFParticipantFrame) {
  const detection: DNFRaidParticipantDetection = detectDNFRaidParticipantWindow(frame, heading)
  const result: DNFRaidParticipantCropResult = cropDNFRaidParticipantNicknames(frame, heading)
  if (result.status !== 'found') {
    // @ts-expect-error 실패 결과에서 닉네임 크롭 행을 읽을 수 없어야 한다.
    readOnlyForTypeCheck(result.rows)

    return []
  }
  const rows: DNFRaidParticipantRow[] = result.rows
  const samples = result.rows.map((row) => {
    const position: DNFRaidParticipantPosition = row.row
    const crop: DNFParticipantFrame | null = row.nicknameCrop

    return { position, crop }
  })

  return { detection, rows, samples }
}

export function readRaidLabels(
  frame: DNFParticipantFrame,
  rows: readonly DNFRaidParticipantRow[],
  party: DNFRaidParty,
  glyph: DNFRaidScoreGlyph,
  partyImage: DNFParticipantFrame,
  glyphImage: DNFParticipantFrame
) {
  const templates: DNFRaidMetadataTemplates = {
    parties: [{ party, image: partyImage }],
    equipmentScoreGlyphs: [{ character: glyph, image: glyphImage }]
  }
  const labels: DNFRaidParticipantMetadata[] = readDNFRaidParticipantMetadata(
    frame,
    rows,
    templates
  )

  return labels.map((label) => {
    const row: DNFRaidParticipantPosition = label.row
    const party: DNFRaidParty | null = label.party
    const equipmentScoreText: string | null = label.equipmentScoreText

    return { row, party, equipmentScoreText }
  })
}

export function readRaidValues(
  frame: DNFParticipantFrame,
  rows: readonly DNFRaidParticipantRow[],
  glyph: DNFRaidScoreGlyph,
  glyphImage: DNFParticipantFrame
): (string | null)[] {
  const values: DNFRaidParticipantValue[] = readDNFRaidParticipantValues(frame, rows, [
    { character: glyph, image: glyphImage }
  ])

  return values.map((value) => value.valueText)
}

export function readRaidValueColumn(
  frame: DNFParticipantFrame,
  region: DNFRectangle,
  row: DNFRaidParticipantRow,
  templates: DNFRaidValueHeadingTemplates,
  text: string
) {
  const kind: DNFRaidValueColumnKind = classifyDNFRaidValueColumn(frame, region, templates)
  const notation: DNFRaidValueNotation | null = parseDNFRaidValueNotation(text)
  const jobRegion: DNFRectangle = row.jobRegion

  return { kind, notation, jobRegion }
}

export function versionResponse(value: unknown, service: ServerService): ServerBuildInfo | null {
  return parseServerBuildInfo(value, service)
}

export function collectableSlots(kind: keyof typeof OCR_DATA_LIMITS.maximumCropsByKind): number[] {
  const maximum = OCR_DATA_LIMITS.maximumCropsByKind[kind]

  return Array.from({ length: maximum }, (_, index) => index + 1)
}

export function ocrImageBudget() {
  const pngBytes: number = OCR_DATA_LIMITS.maximumPngBytes
  const dimension: number = OCR_DATA_LIMITS.maximumDimension
  const pixels: number = OCR_DATA_LIMITS.maximumPixels
  const uiScale: number = OCR_DATA_LIMITS.maximumUiScale
  const labelLength: number = OCR_DATA_LIMITS.maximumLabelLength

  return { pngBytes, dimension, pixels, uiScale, labelLength }
}
