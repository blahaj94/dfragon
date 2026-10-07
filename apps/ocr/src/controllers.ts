import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Param,
  Patch,
  Post,
  Put,
  Req,
  Res
} from '@nestjs/common'
import type { Request, Response } from 'express'
import { isSyntheticUploadRequest, OcrAuth } from './auth.js'
import type { AuthConfiguration } from './auth.js'
import { OcrStore } from './store.js'
import { OCR_ERROR_CODE, OcrError } from './errors.js'
import { cropPng, decodePng, parseUpload } from './images.js'
import { parseCaptureKind, parseInputRecord, parseLabel, parseSplit } from './input.js'
import { parseSplitOptions } from './split-plan.js'
import { downloadDataset } from './export.js'
import { parseSyntheticUpload } from './synthetic-upload.js'
import { isTestCaptureRequest, parseTestCapture } from './test-capture.js'

export const OCR_CONFIG = Symbol('OCR_CONFIG')

@Controller('auth')
export class OcrAuthController {
  constructor(@Inject(OcrAuth) private readonly auth: OcrAuth) {}

  @Post('login')
  @HttpCode(200)
  login(@Req() request: Request, @Res() response: Response) {
    return this.auth.begin(request, response)
  }

  @Get('callback')
  callback(@Req() request: Request, @Res() response: Response) {
    if (request.method !== 'GET') {
      throw new OcrError(OCR_ERROR_CODE.METHOD_NOT_ALLOWED)
    }

    return this.auth.callback(request, response)
  }

  @Post('logout')
  logout(@Req() request: Request, @Res() response: Response) {
    return this.auth.logout(request, response)
  }
}

@Controller('api')
export class OcrDataController {
  constructor(
    @Inject(OcrStore) private readonly store: OcrStore,
    @Inject(OCR_CONFIG) private readonly config: AuthConfiguration
  ) {}

  @Get('session')
  session() {
    return { authenticated: true }
  }

  @Get('stats')
  stats() {
    return this.store.stats()
  }

  @Post(['captures', 'desktop/captures'])
  upload(@Body() body: unknown, @Res() response: Response) {
    const { capture, png } = parseUpload(body)
    const result = this.store.add(capture, png)
    response.status(result.duplicate ? 200 : 201).json(result)
  }

  @Post('synthetic-samples')
  uploadSynthetic(@Req() request: Request, @Body() body: unknown, @Res() response: Response) {
    // Express also matches case changes and trailing slashes; keep token admission exact.
    if (!isSyntheticUploadRequest(request)) {
      throw new OcrError(OCR_ERROR_CODE.NOT_FOUND)
    }
    const { capture, png } = parseSyntheticUpload(body)
    const result = this.store.add(capture, png)
    response.status(result.duplicate ? 200 : 201).json(result)
  }

  @Post('desktop/test-captures')
  uploadTest(@Req() request: Request, @Body() body: unknown, @Res() response: Response) {
    if (!isTestCaptureRequest(request)) {
      throw new OcrError(OCR_ERROR_CODE.NOT_FOUND)
    }
    const { capture, png } = parseTestCapture(body)
    const result = this.store.add(capture, png)
    response.status(result.duplicate ? 200 : 201).json(result)
  }

  @Get('samples')
  samples(@Req() request: Request) {
    const query = new URL(request.originalUrl, this.config.origin).searchParams
    for (const key of query.keys()) {
      if (
        !['offset', 'state', 'split', 'kind', 'text'].includes(key) ||
        query.getAll(key).length !== 1
      ) {
        throw new OcrError(OCR_ERROR_CODE.INVALID_INPUT)
      }
    }
    const offset = Number(query.get('offset') ?? '0')
    const state = query.get('state') ?? undefined
    const split = query.get('split') ?? undefined
    const kind = query.get('kind') ?? undefined
    if (
      !Number.isSafeInteger(offset) ||
      offset < 0 ||
      (state !== undefined &&
        state.length > 0 &&
        !['pending', 'labeled', 'excluded'].includes(state))
    ) {
      throw new OcrError(OCR_ERROR_CODE.INVALID_INPUT)
    }

    if (kind !== undefined && kind.length > 0) {
      if (kind !== 'synthetic') {
        parseCaptureKind(kind)
      }
    }

    if (split !== undefined && split.length > 0) {
      parseSplit(split)
    }

    return this.store.list({ offset, state, split, kind, text: query.get('text') ?? undefined })
  }

  @Get('captures/:id')
  capture(@Param('id') id: string) {
    return this.store.capture(id).capture
  }

  @Get('captures/:id/image')
  original(@Param('id') id: string, @Res() response: Response) {
    response.type('png').send(this.store.capture(id).png)
  }

  @Get(['samples/:id/image', 'desktop/samples/:id/image'])
  cropped(@Param('id') id: string, @Res() response: Response) {
    const sample = this.store.sample(id)
    response.type('png').send(cropPng(decodePng(this.store.capture(sample.captureId).png), sample))
  }

  @Get('samples/:id/context/image')
  context(@Param('id') id: string, @Res() response: Response) {
    const sample = this.store.sample(id)
    if (sample.testCollection === undefined) {
      throw new OcrError(OCR_ERROR_CODE.NOT_FOUND)
    }
    const original = decodePng(this.store.capture(sample.captureId).png)
    response.type('png').send(cropPng(original, sample.testCollection.context))
  }

  @Patch('samples/:id')
  updateSample(@Param('id') id: string, @Body() value: unknown) {
    const body = parseInputRecord(value)
    if (body.confirmSplitChange !== undefined && typeof body.confirmSplitChange !== 'boolean') {
      throw new OcrError(OCR_ERROR_CODE.INVALID_INPUT)
    }
    const confirmSplitChange = body.confirmSplitChange === true
    if (Object.hasOwn(body, 'text')) {
      const text = parseLabel(body.text)
      if (Object.hasOwn(body, 'excluded')) {
        if (typeof body.excluded !== 'boolean') {
          throw new OcrError(OCR_ERROR_CODE.INVALID_INPUT)
        }

        return this.store.updateSample(id, { text, excluded: body.excluded, confirmSplitChange })
      }

      return this.store.updateSample(id, { text, confirmSplitChange })
    }

    if (typeof body.excluded !== 'boolean') {
      throw new OcrError(OCR_ERROR_CODE.INVALID_INPUT)
    }

    return this.store.updateSample(id, { excluded: body.excluded, confirmSplitChange })
  }

  @Put('splits')
  assignSplit(@Body() value: unknown) {
    const body = parseInputRecord(value)
    const text = parseLabel(body.text)
    if (text === null) {
      throw new OcrError(OCR_ERROR_CODE.INVALID_INPUT)
    }

    return this.store.assign(text, parseSplit(body.split))
  }

  @Get('splits/statistics')
  splitStatistics() {
    return this.store.splitStats()
  }

  @Post('splits/preview')
  @HttpCode(200)
  previewSplit(@Body() value: unknown) {
    return this.store.previewSplit(parseSplitOptions(value))
  }

  @Post('splits/apply')
  @HttpCode(200)
  applySplit(@Body() value: unknown) {
    const body = parseInputRecord(value)
    if (typeof body.fingerprint !== 'string' || !/^[0-9a-f]{64}$/.test(body.fingerprint)) {
      throw new OcrError(OCR_ERROR_CODE.INVALID_INPUT)
    }

    return this.store.applySplit(parseSplitOptions(body), body.fingerprint)
  }

  @Get('desktop/dataset')
  desktopDataset() {
    const { exportedAt, samples } = this.store.exportManifest()
    // The existing Desktop evaluator supports game captures only.
    const gameSamples = samples.filter((sample) => sample.kind !== 'synthetic')

    return { exportedAt, samples: gameSamples }
  }

  @Get('export/manifest')
  manifest() {
    return this.store.exportManifest()
  }

  @Get('export')
  download(@Res() response: Response) {
    return downloadDataset(this.store, response)
  }
}

@Controller()
export class OcrHealthController {
  @Get('health')
  health() {
    return { ok: true }
  }
}
