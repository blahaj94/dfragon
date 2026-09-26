import { cp949Characters } from './cp949-characters.js'

export type NicknameValidationResult = { isValid: true } | { isValid: false; reason: string }

export interface DFNicknameValidationOptions {
  /** Caller-owned, case-insensitive substring rules; no official banned list is assumed. */
  bannedWords?: readonly string[]
}

const cp949CharacterSet = new Set(cp949Characters)
const whitespace = /[\s\p{White_Space}]/u
const invisibleOrControl = /[\p{Cc}\p{Cf}\p{Default_Ignorable_Code_Point}]/u
const maxBytes = 12

/**
 * Checks a CP949-based character-name format, not in-game creation availability.
 * Preserves the original input; do not substitute this for account/search validators.
 */
export function validateDFNickname(
  nickname: string,
  options: DFNicknameValidationOptions = {}
): NicknameValidationResult {
  if (nickname.length === 0 || nickname.trim().length === 0) {
    return { isValid: false, reason: '닉네임을 입력해주세요.' }
  }
  if (whitespace.test(nickname)) {
    return { isValid: false, reason: '공백(띄어쓰기)은 포함할 수 없습니다.' }
  }

  let totalBytes = 0
  for (const character of nickname) {
    const code = character.codePointAt(0)!
    const isAscii = code >= 0x21 && code <= 0x7e
    const isHangulSyllable = code >= 0xac00 && code <= 0xd7a3
    if (
      invisibleOrControl.test(character) ||
      (!isAscii && !isHangulSyllable && !cp949CharacterSet.has(character))
    ) {
      return {
        isValid: false,
        reason: '공백·제어문자·보이지 않는 문자와 CP949로 표현할 수 없는 문자는 사용할 수 없습니다.'
      }
    }
    totalBytes += isAscii ? 1 : 2
  }

  if (totalBytes > maxBytes) {
    return {
      isValid: false,
      reason: `글자수 제한을 초과했습니다. (현재 ${totalBytes}B / 최대 ${maxBytes}B)`
    }
  }

  const lowerNickname = nickname.toLowerCase()
  if (
    options.bannedWords?.some(
      (word) => word.length > 0 && lowerNickname.includes(word.toLowerCase())
    )
  ) {
    return { isValid: false, reason: '사용할 수 없는 단어가 포함되어 있습니다.' }
  }
  return { isValid: true }
}

export { estimateDNFUIScale } from './dnf-ui-scale.js'
export { estimateDNFPartyScale, projectDNFPartyRegions } from './dnf-party-geometry.js'
export type { DNFRectangle, DNFPartyRegionOptions } from './dnf-party-geometry.js'
export {
  detectDNFPartyParticipantWindow,
  cropDNFPartyParticipantNicknames
} from './dnf-party-participants.js'
export type {
  DNFParticipantFrame,
  DNFParticipantSlot,
  DNFParticipantRow,
  DNFParticipantDetection,
  DNFParticipantCropResult
} from './dnf-party-participants.js'
export {
  detectDNFRaidParticipantWindow,
  cropDNFRaidParticipantNicknames
} from './dnf-raid-participants.js'
export type {
  DNFRaidParticipantPosition,
  DNFRaidParticipantRow,
  DNFRaidParticipantDetection,
  DNFRaidParticipantCropResult
} from './dnf-raid-participants.js'
export { readDNFRaidParticipantMetadata } from './dnf-raid-metadata.js'
export type {
  DNFRaidParty,
  DNFRaidScoreGlyph,
  DNFRaidMetadataTemplates,
  DNFRaidParticipantMetadata
} from './dnf-raid-metadata.js'
