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
import { OcrAuth } from './auth.js'
import type { AuthConfiguration } from './auth.js'
import { OcrStore } from './store.js'
import { OCR_ERROR_CODE, OcrError } from './errors.js'
import { cropPng, decodePng, parseUpload } from './images.js'
import { parseInputRecord, parseLabel, parseSplit } from './input.js'
import { downloadDataset } from './export.js'

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
        !['pending', 'labeled', 'excluded'].includes(state)) ||
      (kind !== undefined && kind.length > 0 && !['hud', 'participants'].includes(kind))
    ) {
      throw new OcrError(OCR_ERROR_CODE.INVALID_INPUT)
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

  @Get('samples/:id/image')
  cropped(@Param('id') id: string, @Res() response: Response) {
    const sample = this.store.sample(id)
    response.type('png').send(cropPng(decodePng(this.store.capture(sample.captureId).png), sample))
  }

  @Patch('samples/:id')
  updateSample(@Param('id') id: string, @Body() value: unknown) {
    const body = parseInputRecord(value)
    const text = parseLabel(body.text)
    if (
      typeof body.excluded !== 'boolean' ||
      (body.confirmSplitChange !== undefined && typeof body.confirmSplitChange !== 'boolean')
    ) {
      throw new OcrError(OCR_ERROR_CODE.INVALID_INPUT)
    }
    return this.store.updateSample(id, {
      text,
      excluded: body.excluded,
      confirmSplitChange: body.confirmSplitChange === true
    })
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
