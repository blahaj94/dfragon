import { ApiTags } from '@nestjs/swagger'
import { ApiCharacterDetails, ApiCharacterRefresh } from '../../swagger/operations.js'
import { Controller, Get, Inject, Post, Req, Res } from '@nestjs/common'
import type { Request, Response } from 'express'
import { CharacterDetailFailure } from './errors.js'
import { parseCharacterIdentity } from '../identity.js'
import type { CharacterDetailService } from './service.js'
import { respondWithCancellation } from '../../http-response.js'
import { recordAccessLogNeopleStage, recordAccessLogSharedNeopleFetch } from '../../access-log.js'
import type { NeopleStageTimings } from './neople-stages.js'

export const CHARACTER_DETAIL_SERVICE = Symbol('CHARACTER_DETAIL_SERVICE')

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
    await respondWithCancellation(response, (signal) => {
      return this.service.get(identity, signal, timings)
    })
  }

  @Post(':serverId/:characterId/refresh')
  @ApiCharacterRefresh()
  async refresh(@Req() request: Request, @Res() response: Response): Promise<void> {
    const identity = readIdentity(request)
    const timings = accessLogTimings(response)
    await respondWithCancellation(response, (signal) => {
      return this.service.refresh(identity, signal, timings)
    })
  }
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
