export type DeveloperSettings = { enabled: boolean }

export type DeveloperPartySlot = 1 | 2 | 3 | 4
export type DeveloperCollectionKind = 'hud' | 'participants'

export type DeveloperParticipantWindow = {
  width: number
  height: number
  rgba: Uint8Array
  // Nickname rectangles relative to the detected window, in original pixels.
  rows: {
    slot: DeveloperPartySlot
    occupied: boolean
    x: number
    y: number
    width: number
    height: number
  }[]
}

export type DeveloperSampleSource = {
  slot: DeveloperPartySlot
  frameWidth: number
  frameHeight: number
  scale: number
}

export type DeveloperSample = {
  id: string
  createdAt: string
  width: number
  height: number
  text: string | null
  excluded: boolean
  remote?: { kind: DeveloperCollectionKind; split: 'unassigned' | 'train' | 'val' | 'test' }
  source: DeveloperSampleSource | null
}

export type DeveloperFrame = { pngDataUrl: string; width: number; height: number }

export type DeveloperPartyPreviewSlot = {
  slot: DeveloperPartySlot
  width: number
  height: number
  rgba: Uint8Array
}

export type DeveloperPartyPreviewFrame = {
  width: number
  height: number
  scale: number
  capturedAt: string
  slots: DeveloperPartyPreviewSlot[]
  participantWindow?: DeveloperParticipantWindow
}

export type DeveloperPartyCollectionStatus = {
  armed: boolean
  slots: DeveloperPartySlot[]
  revision: number
  lastSavedAt: string | null
  lastSavedCount?: number
  error: string | null
  upload?: DeveloperUploadStatus
}

export type DeveloperUploadStatus =
  'signedOut' | 'uploading' | 'uploaded' | 'failed' | 'ownerRequired' | 'storageFull'

export type DeveloperPartyPreviewResponse = {
  frame: DeveloperPartyPreviewFrame | null
  previewError: string | null
  collection: DeveloperPartyCollectionStatus
}

export type DeveloperApi = {
  getSettings: () => Promise<DeveloperSettings>
  setEnabled: (enabled: boolean) => Promise<DeveloperSettings>
  listSamples: () => Promise<DeveloperSample[]>
  listOcrSamples: () => Promise<DeveloperSample[]>
  closeOcrSamples: () => Promise<void>
  readImage: (id: string) => Promise<string>
  addSample: (pngDataUrl: string) => Promise<DeveloperSample>
  saveLabel: (id: string, text: string | null) => Promise<DeveloperSample>
  setSampleExcluded: (id: string, excluded: boolean) => Promise<DeveloperSample>
  captureFrame: () => Promise<DeveloperFrame>
  previewParty: (kind?: DeveloperCollectionKind) => Promise<DeveloperPartyPreviewResponse>
  setPartyCollectionSlots: (
    slots: DeveloperPartySlot[] | null,
    kind?: DeveloperCollectionKind
  ) => Promise<DeveloperPartyCollectionStatus>
}
