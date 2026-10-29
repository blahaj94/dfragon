import { ApiTags } from '@nestjs/swagger'
import { ApiCharacterDetails, ApiCharacterRefresh } from '../../swagger/operations.js'
import { Controller, Get, Inject, Post, Req, Res } from '@nestjs/common'
import type { Request, Response } from 'express'
import { CharacterDetailFailure } from './errors.js'
import { parseCharacterIdentity } from '../identity.js'
import type { CharacterDetailResponse, CharacterDetailService } from './service.js'
import { sendWithCancellation } from '../../http-response.js'
import {
  recordAccessLogCachedResponse,
  recordAccessLogNeopleStage,
  recordAccessLogSharedNeopleFetch
} from '../../access-log.js'
import type { NeopleStageTimings } from './neople-stages.js'

export const CHARACTER_DETAIL_SERVICE = Symbol('CHARACTER_DETAIL_SERVICE')
// The same Content-Type Express `json` sets, so a stored body goes out with the headers it always had.
const JSON_CONTENT_TYPE = 'application/json; charset=utf-8'

@ApiTags('캐릭터')
@Controller('characters')
export class CharacterDetailController {
  constructor(@Inject(CHARACTER_DETAIL_SERVICE) private readonly service: CharacterDetailService) {}

  @Get(':serverId/:characterId')
  @ApiCharacterDetails()
  async detail(@Req() request: Request, @Res() response: Response): Promise<void> {
    if (request.method !== 'GET') {
      throw new CharacterDetailFailure('query')
    }
    const identity = readIdentity(request)
    const timings = accessLogTimings(response)
    await sendWithCancellation(
      response,
      (signal) => this.service.get(identity, signal, timings),
      (detail) => sendDetail(request, response, detail)
    )
  }

  @Post(':serverId/:characterId/refresh')
  @ApiCharacterRefresh()
  async refresh(@Req() request: Request, @Res() response: Response): Promise<void> {
    const identity = readIdentity(request)
    const timings = accessLogTimings(response)
    await sendWithCancellation(
      response,
      (signal) => this.service.refresh(identity, signal, timings),
      (detail) => sendDetail(request, response, detail)
    )
  }
}

// Caddy compresses an unencoded body itself and passes an already encoded one through.
function sendDetail(
  request: Request,
  response: Response,
  { body, reused }: CharacterDetailResponse
) {
  if (reused) {
    recordAccessLogCachedResponse(response)
  }
  response.vary('Accept-Encoding')
  response.setHeader('Content-Type', JSON_CONTENT_TYPE)
  const brotli = body.brotli
  if (brotli !== undefined && request.acceptsEncodings('br') === 'br') {
    response.setHeader('Content-Encoding', 'br')
    response.status(200).send(brotli)

    return
  }
  response.status(200).send(body.json)
}

function readIdentity(request: Request) {
  return parseCharacterIdentity(
    request.params.serverId,
    request.params.characterId,
    request.originalUrl
  )
}

function accessLogTimings(response: Response): NeopleStageTimings {
  return {
    record: (stage, durationMs) => recordAccessLogNeopleStage(response, stage, durationMs),
    markShared: () => recordAccessLogSharedNeopleFetch(response)
  }
}
