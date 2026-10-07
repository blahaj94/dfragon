import { ApiTags } from '@nestjs/swagger'
import { ApiCharacterCandidates, ApiCharacterSearch } from '../swagger/operations.js'
import { Controller, Get, Inject, Req, Res } from '@nestjs/common'
import type { Request, Response } from 'express'
import { neopleSearchFailure } from '../errors/neople-search.js'
import { respondWithCancellation } from '../http-response.js'
import type { CharacterSearchHttpService } from './types.js'

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
    await this.respond(request, response, false)
  }

  @Get('candidates')
  @ApiCharacterCandidates()
  async candidates(@Req() request: Request, @Res() response: Response): Promise<void> {
    await this.respond(request, response, true)
  }

  private async respond(request: Request, response: Response, candidates: boolean): Promise<void> {
    const isGet = request.method === 'GET'
    if (!isGet) {
      throw neopleSearchFailure('query')
    }
    await respondWithCancellation(response, (signal) => {
      if (candidates) {
        return this.service.candidates(request.ip, request.originalUrl, signal)
      }

      return this.service.search(request.ip, request.originalUrl, signal)
    })
  }
}
