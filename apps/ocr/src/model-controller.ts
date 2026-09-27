import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  Post,
  Res,
  UploadedFiles,
  UseInterceptors
} from '@nestjs/common'
import { FilesInterceptor } from '@nestjs/platform-express'
import type { Response } from 'express'
import { OcrStore } from './store.js'
import { OCR_ERROR_CODE, OcrError } from './errors.js'
import { MODEL_MAXIMUM_BYTES, PADDLEOCR_REVISION, parseModelUpload } from './model-library.js'

const baseId = '8fd75251-91be-4a6b-993f-2d91294a2756'

async function download(url: string, maximumBytes: number): Promise<Buffer> {
  const response = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(120_000) })
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
      if (size > maximumBytes) {
        throw new OcrError(OCR_ERROR_CODE.UPLOAD_TOO_LARGE)
      }
      chunks.push(value)
    }
    return Buffer.concat(chunks)
  } finally {
    await reader.cancel().catch(() => undefined)
  }
}

@Controller('api')
export class OcrModelController {
  private baseRegistration: Promise<ReturnType<OcrStore['addModel']>> | null = null

  constructor(@Inject(OcrStore) private readonly store: OcrStore) {}

  @Get(['models', 'desktop/models'])
  list() {
    return { schemaVersion: 1, models: this.store.models() }
  }

  @Get(['models/:id', 'desktop/models/:id'])
  detail(@Param('id') id: string) {
    return this.store.model(id)
  }

  @Get(['models/:id/files/:name', 'desktop/models/:id/files/:name'])
  file(@Param('id') id: string, @Param('name') name: string, @Res() response: Response) {
    const model = this.store.model(id)
    const file = model.files.find((item) => item.name === name)
    if (file === undefined) {
      throw new OcrError(OCR_ERROR_CODE.NOT_FOUND)
    }
    response.setHeader('Content-Type', 'application/octet-stream')
    response.setHeader('Content-Disposition', `attachment; filename="${file.name}"`)
    response.setHeader('Content-Length', file.bytes)
    response.send(this.store.modelFile(id, name))
  }

  @Post(['models', 'desktop/models'])
  @UseInterceptors(
    FilesInterceptor('files', 3, {
      limits: { fileSize: MODEL_MAXIMUM_BYTES, files: 3, fields: 1, fieldSize: 8192, parts: 5 }
    })
  )
  upload(
    @Body() body: unknown,
    @UploadedFiles() received: { originalname: string; buffer: Buffer }[]
  ) {
    if (
      body === null ||
      typeof body !== 'object' ||
      !('metadata' in body) ||
      typeof body.metadata !== 'string' ||
      Object.keys(body).length !== 1 ||
      !Array.isArray(received)
    ) {
      throw new OcrError(OCR_ERROR_CODE.INVALID_INPUT)
    }
    let metadata: unknown
    try {
      metadata = JSON.parse(body.metadata)
    } catch {
      throw new OcrError(OCR_ERROR_CODE.INVALID_INPUT)
    }
    const files = new Map<string, Buffer>()
    for (const file of received) {
      if (files.has(file.originalname)) {
        throw new OcrError(OCR_ERROR_CODE.INVALID_INPUT)
      }
      files.set(file.originalname, file.buffer)
    }
    return this.store.addModel(parseModelUpload(metadata), files)
  }

  @Post('models/base/korean-v5')
  async addBase() {
    if (this.baseRegistration !== null) {
      return this.baseRegistration
    }
    this.baseRegistration = this.registerBase()
    try {
      return await this.baseRegistration
    } finally {
      this.baseRegistration = null
    }
  }

  private async registerBase() {
    const existing = this.store.models().find((model) => model.id === baseId)
    if (existing !== undefined) {
      return { model: existing, duplicate: true }
    }
    const weights = await download(
      'https://paddle-model-ecology.bj.bcebos.com/paddlex/official_pretrained_model/korean_PP-OCRv5_mobile_rec_pretrained.pdparams',
      MODEL_MAXIMUM_BYTES
    )
    const dictionary = await download(
      `https://raw.githubusercontent.com/PaddlePaddle/PaddleOCR/${PADDLEOCR_REVISION}/ppocr/utils/dict/ppocrv5_korean_dict.txt`,
      1024 * 1024
    )
    return this.store.addModel(
      {
        id: baseId,
        name: '한국어 PP-OCRv5 · 기본 모델',
        preset: 'korean-ppocrv5',
        kind: 'pretrained',
        parentId: null
      },
      new Map([
        ['weights.pdparams', weights],
        ['characters.txt', dictionary]
      ])
    )
  }
}
