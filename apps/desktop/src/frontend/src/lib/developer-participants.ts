import { DEVELOPER_ERRORS } from '../constants/developer'
import { DEVELOPER_ERROR_CODES } from '../../../preload/common/developer-errors'
import { getDeveloperCollectionErrorMessage } from './developer-party'
import type { DeveloperCollectionKind } from '../../../preload/common/types/developer'

/** Describes detection/recovery without exposing algorithm or IPC details in the workbench. */
export function getParticipantPreviewMessage(
  code: string,
  kind: Exclude<DeveloperCollectionKind, 'hud'> = 'participants'
): { title: string; detail: string } {
  const windowName = kind === 'raid' ? '공대원창' : '파티원창'
  if (code === DEVELOPER_ERROR_CODES.GAME_NOT_FOUND) {
    return {
      title: '던전앤파이터를 실행해주세요.',
      detail: '게임 창을 찾으면 미리보기를 시작해요.'
    }
  }
  if (code === DEVELOPER_ERROR_CODES.PARTICIPANT_WINDOW_NOT_FOUND) {
    return { title: '파티참가인원 창을 열어주세요.', detail: '창이 보이면 자동으로 다시 찾을게요.' }
  }
  if (code === DEVELOPER_ERROR_CODES.RAID_WINDOW_NOT_FOUND) {
    return {
      title: '공대 상세 창을 열어주세요.',
      detail: '12인 공대 상세 창 전체가 보이면 자동으로 다시 찾을게요.'
    }
  }
  if (code === DEVELOPER_ERROR_CODES.PARTY_SLOTS_NOT_FOUND) {
    return {
      title: '저장할 닉네임이 없어요.',
      detail: '참가자가 있는지와 저장 선택을 확인해주세요.'
    }
  }
  if (
    code === DEVELOPER_ERROR_CODES.CAPTURE_UNAVAILABLE ||
    code === DEVELOPER_ERROR_CODES.PARTICIPANT_WINDOW_UNCERTAIN ||
    code === DEVELOPER_ERROR_CODES.RAID_WINDOW_UNCERTAIN ||
    code === DEVELOPER_ERRORS.PREVIEW_FAILED
  ) {
    return {
      title: `${windowName}이 잘 보이게 해주세요.`,
      detail:
        kind === 'raid'
          ? '공대 상세 창 전체가 가려지지 않았는지 확인해주세요. 창이 여러 개 보이면 하나만 남겨주세요.'
          : '창이 가려지지 않았는지 확인해주세요. 지원 해상도는 1067×600~1920×1080이에요.'
    }
  }
  if (
    code === DEVELOPER_ERROR_CODES.STORAGE_UNAVAILABLE ||
    code === DEVELOPER_ERROR_CODES.OPERATION_FAILED
  ) {
    return {
      title: '이미지를 저장하지 못했어요.',
      detail: '저장소를 확인한 뒤 게임에서 Print Screen 키로 다시 시도해주세요.'
    }
  }
  if (code) {
    return { title: getDeveloperCollectionErrorMessage(code), detail: '' }
  }
  return {
    title: `${windowName}을 찾고 있어요.`,
    detail:
      kind === 'raid'
        ? '게임에서 12인 공대 상세 창을 열어주세요.'
        : '게임에서 파티참가인원 창을 열어주세요.'
  }
}
