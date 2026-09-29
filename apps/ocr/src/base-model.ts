import { createHash } from 'node:crypto'
import { OCR_ERROR_CODE, OcrError } from './errors.js'
import { MODEL_MAXIMUM_BYTES, PADDLEOCR_REVISION } from './model-library.js'
import type { OcrStore } from './store.js'

export const BASE_MODEL_ID = '8fd75251-91be-4a6b-993f-2d91294a2756'

interface BaseArtifact {
  name: 'weights.pdparams' | 'characters.txt'
  url: string
  maximumBytes: number
  sha256: string
}

// Reference bytes fetched from the official HTTPS sources on 2026-09-30.
// Digest updates require source review; remote content never sets its own expected digest.
export const BASE_MODEL_ARTIFACTS: readonly BaseArtifact[] = [
  {
    name: 'weights.pdparams',
    url: 'https://paddle-model-ecology.bj.bcebos.com/paddlex/official_pretrained_model/korean_PP-OCRv5_mobile_rec_pretrained.pdparams',
    maximumBytes: MODEL_MAXIMUM_BYTES,
    sha256: '8975dede5e0c2f47e0a7712b3d79ffdc766972f872fd0441ebcccd9d77cd52a3'
  },
  {
    name: 'characters.txt',
    url: `https://raw.githubusercontent.com/PaddlePaddle/PaddleOCR/${PADDLEOCR_REVISION}/ppocr/utils/dict/ppocrv5_korean_dict.txt`,
    maximumBytes: 1024 * 1024,
    sha256: 'a88071c68c01707489baa79ebe0405b7beb5cca229f4fc94cc3ef992328802d7'
  }
]

function verify(bytes: Buffer, artifact: BaseArtifact) {
  if (createHash('sha256').update(bytes).digest('hex') !== artifact.sha256) {
    throw new OcrError(OCR_ERROR_CODE.UNAVAILABLE)
  }
}

async function download(artifact: BaseArtifact): Promise<Buffer> {
  const response = await fetch(artifact.url, {
    redirect: 'error',
    signal: AbortSignal.timeout(120_000)
  })
  if (!response.ok || response.body === null) {
    await response.body?.cancel()
    throw new OcrError(OCR_ERROR_CODE.UNAVAILABLE)
  }
  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) {
        break
      }
      size += value.length
      if (size > artifact.maximumBytes) {
        throw new OcrError(OCR_ERROR_CODE.UPLOAD_TOO_LARGE)
      }
      chunks.push(value)
    }
    const bytes = Buffer.concat(chunks)
    verify(bytes, artifact)
    return bytes
  } finally {
    await reader.cancel().catch(() => undefined)
  }
}

/** The manifest is owned by code, never by HTTP input or environment configuration. */
export async function registerBaseModel(store: OcrStore, artifacts = BASE_MODEL_ARTIFACTS) {
  const existing = store.models().find((model) => model.id === BASE_MODEL_ID)
  if (existing !== undefined) {
    for (const artifact of artifacts) {
      verify(store.modelFile(BASE_MODEL_ID, artifact.name), artifact)
    }
    return { model: existing, duplicate: true }
  }
  const files = new Map<string, Buffer>()
  for (const artifact of artifacts) {
    files.set(artifact.name, await download(artifact))
  }
  return store.addModel(
    {
      id: BASE_MODEL_ID,
      name: '한국어 PP-OCRv5 · 기본 모델',
      preset: 'korean-ppocrv5',
      kind: 'pretrained',
      parentId: null
    },
    files
  )
}
