import { z } from 'zod'
import {
  OCR_COLLECTION_STATUSES,
  type CollectOcrSample,
  type OcrCollectionResult
} from './types/ocr-collection'

const MAX_PREDICTION_LENGTH = 128
const sampleSchema = z.strictObject({
  captureId: z.uuid(),
  frameId: z.uuid(),
  slot: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
  prediction: z.string().max(MAX_PREDICTION_LENGTH).nullable()
})
const resultSchema = z.strictObject({ status: z.enum(OCR_COLLECTION_STATUSES) })

/** 이미지, 경로와 좌표를 받지 않고 main이 발급한 프레임 참조만 허용한다. */
export function parseCollectOcrSample(args: readonly unknown[]): CollectOcrSample | null {
  if (args.length !== 1) {
    return null
  }
  const result = sampleSchema.safeParse(args[0])
  if (!result.success) {
    return null
  }

  return result.data
}

/** 수집 실패를 검색 흐름 밖의 정제된 상태로 전달한다. */
export function parseOcrCollectionResult(value: unknown): OcrCollectionResult {
  const result = resultSchema.safeParse(value)
  if (!result.success) {
    return { status: 'failed' }
  }

  return result.data
}
