export type CollectOcrSample = {
  captureId: string
  frameId: string
  slot: 1 | 2 | 3 | 4
  prediction: string | null
}

export const OCR_COLLECTION_STATUSES = ['queued', 'duplicate', 'skipped', 'failed'] as const
export type OcrCollectionResult = { status: (typeof OCR_COLLECTION_STATUSES)[number] }
