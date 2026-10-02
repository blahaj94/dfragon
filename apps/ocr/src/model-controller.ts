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
import {
  MODEL_FILES,
  MODEL_MAXIMUM_BYTES,
  MODEL_METADATA_MAXIMUM_BYTES,
  MODEL_MAXIMUM_PARTS,
  parseModelUpload
} from './model-library.js'
import { registerBaseModel } from './base-model.js'

@Controller('api')
export class OcrModelController {
  private baseRegistration: Promise<ReturnType<OcrStore['addModel']>> | null = null

  constructor(@Inject(OcrStore) private readonly store: OcrStore) {}

  @Get(['models', 'desktop/models'])
  list() {
    const models = this.store.models()

    return { schemaVersion: 1, models }
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
    FilesInterceptor('files', MODEL_FILES.length, {
      limits: {
        fileSize: MODEL_MAXIMUM_BYTES,
        files: MODEL_FILES.length,
        fields: 1,
        fieldSize: MODEL_METADATA_MAXIMUM_BYTES,
        parts: MODEL_MAXIMUM_PARTS
      }
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
    this.baseRegistration = registerBaseModel(this.store)
    try {
      return await this.baseRegistration
    } finally {
      this.baseRegistration = null
    }
  }
}
