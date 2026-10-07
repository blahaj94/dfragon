import { Controller, Get, Inject, Req, Res } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import type { Request, Response } from 'express'
import { ApiAdventureSearch } from '../swagger/operations.js'
import { CharacterDetailFailure } from '../characters/details/errors.js'
import type { AdventureSearchService } from './service.js'
import { respondWithCancellation } from '../http-response.js'

export const ADVENTURE_SEARCH_SERVICE = Symbol('ADVENTURE_SEARCH_SERVICE')

@ApiTags('모험단')
@Controller('adventures')
export class AdventureSearchController {
  constructor(@Inject(ADVENTURE_SEARCH_SERVICE) private readonly service: AdventureSearchService) {}

  @Get('characters')
  @ApiAdventureSearch()
  async search(@Req() request: Request, @Res() response: Response): Promise<void> {
    if (request.method !== 'GET') {
      throw new CharacterDetailFailure('query')
    }
    await respondWithCancellation(response, (signal) =>
      this.service.search(request.ip, request.originalUrl, signal)
    )
  }
}
