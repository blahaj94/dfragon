import type {
  DeveloperPartyCollectionStatus,
  DeveloperPartyPreviewFrame,
  DeveloperPartyPreviewResponse,
  DeveloperPartyPreviewSlot,
  DeveloperPartySlot,
  DeveloperSample,
  DeveloperSampleSource
} from '../../../preload/common/types/developer'

export type {
  DeveloperPartyCollectionStatus,
  DeveloperPartyPreviewFrame,
  DeveloperPartyPreviewResponse,
  DeveloperPartySlot as DeveloperPartySlotNumber,
  DeveloperSampleSource
}

export type DeveloperPartyPreviewSlotWithDataUrl = DeveloperPartyPreviewSlot & {
  dataUrl: string
}

export type DeveloperWorkbenchSample = DeveloperSample

// Turns safe IPC error codes into collection-specific recovery guidance.
export function getDeveloperCollectionErrorMessage(errorCode: string): string {
  if (errorCode === 'DEVELOPER_ADMIN_REQUIRED') {
    return '던파가 관리자 권한으로 실행 중입니다. DFRAGON을 종료한 뒤 관리자 권한으로 다시 실행해 주세요.'
  }
  if (errorCode === 'DEVELOPER_HOTKEY_UNAVAILABLE') {
    return 'Print Screen 단축키를 등록하지 못했습니다. 같은 단축키를 사용하는 앱을 확인한 뒤 수집 탭을 다시 열어주세요.'
  }
  if (errorCode === 'DEVELOPER_PARTY_SLOTS_NOT_FOUND') {
    return '선택한 위치의 HP·MP가 가득 찬 파티 프레임을 보여주세요. 빈 위치는 선택을 해제해 주세요.'
  }
  if (errorCode === 'DEVELOPER_GAME_NOT_FOREGROUND') {
    return '던파를 맨 앞으로 두고 다시 Print Screen을 눌러주세요.'
  }
  if (errorCode === 'DEVELOPER_CAPTURE_UNAVAILABLE') {
    return '던파의 파티 프레임이 가리지 않고 보이도록 해주세요.'
  }
  if (errorCode === 'DEVELOPER_STORAGE_UNAVAILABLE') {
    return '앱 저장소를 확인해 주세요.'
  }
  return '수집 설정을 저장하지 못했습니다. 다시 시도해 주세요.'
}

// Encodes a raw RGBA crop without resizing or changing its pixels.
export function developerPartySlotDataUrl(slot: DeveloperPartyPreviewSlot): string {
  if (slot.width < 1 || slot.height < 1 || slot.rgba.length !== slot.width * slot.height * 4) {
    throw new Error('Invalid developer party crop')
  }

  const canvas = document.createElement('canvas')
  canvas.width = slot.width
  canvas.height = slot.height
  const context = canvas.getContext('2d')
  if (context == null) {
    throw new Error('Canvas unavailable')
  }

  context.putImageData(
    new ImageData(new Uint8ClampedArray(slot.rgba), slot.width, slot.height),
    0,
    0
  )
  return canvas.toDataURL('image/png')
}
