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
  if (errorCode === 'DEVELOPER_HOTKEY_UNAVAILABLE') {
    return 'Print Screen 단축키를 등록하지 못했습니다.'
  }
  if (
    errorCode === 'DEVELOPER_CAPTURE_UNAVAILABLE' ||
    errorCode === 'DEVELOPER_GAME_NOT_FOREGROUND' ||
    errorCode === 'DEVELOPER_PARTY_SLOTS_NOT_FOUND'
  ) {
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
