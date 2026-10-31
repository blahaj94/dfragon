import { ApiTags } from '@nestjs/swagger'
import { ApiCharacterCandidates, ApiCharacterSearch } from '../swagger/operations.js'
import { Controller, Get, Inject, Req, Res } from '@nestjs/common'
import type { Request, Response } from 'express'
import { NeopleSearchFailure } from '../errors/neople-search.js'
import { recordAccessLogCachedResponse, recordAccessLogSharedNeopleFetch } from '../access-log.js'
import { respondWithCancellation, sendWithCancellation } from '../http-response.js'
import type { CharacterCandidatesResponse, CharacterSearchHttpService } from './types.js'

export const CHARACTER_SEARCH_SERVICE = Symbol('CHARACTER_SEARCH_SERVICE')

@ApiTags('캐릭터')
@Controller('characters')
export class CharacterSearchController {
  constructor(
    @Inject(CHARACTER_SEARCH_SERVICE) private readonly service: CharacterSearchHttpService
  ) {}

  @Get()
  @ApiCharacterSearch()
  async search(@Req() request: Request, @Res() response: Response): Promise<void> {
    assertGet(request)
    await respondWithCancellation(response, () => this.service.search(request.originalUrl))
  }

  @Get('candidates')
  @ApiCharacterCandidates()
  async candidates(@Req() request: Request, @Res() response: Response): Promise<void> {
    assertGet(request)
    await sendWithCancellation(
      response,
      () => this.service.candidates(request.originalUrl),
      (candidates) => sendCandidates(response, candidates)
    )
  }
}

function assertGet(request: Request): void {
  if (request.method !== 'GET') {
    throw new NeopleSearchFailure('query')
  }
}

function sendCandidates(response: Response, { result, source }: CharacterCandidatesResponse) {
  if (source === 'cache') {
    recordAccessLogCachedResponse(response)
  } else if (source === 'shared') {
    recordAccessLogSharedNeopleFetch(response)
  }
  response.status(200).json(result)
}
