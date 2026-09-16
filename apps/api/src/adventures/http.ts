import { Controller, Get, Inject, Req, Res } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import type { Request, Response } from 'express'
import { ApiAdventureSearch } from '../swagger/operations.js'
import { CharacterDetailFailure } from '../characters/details/errors.js'
import type { AdventureSearchService } from './service.js'

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
    const controller = new AbortController()
    const cancel = () => {
      if (!response.writableFinished) {
        controller.abort()
      }
    }
    response.once('close', cancel)
    try {
      const result = await this.service.search(request.ip, request.originalUrl, controller.signal)
      if (!response.destroyed) {
        response.status(200).json(result)
      }
    } finally {
      response.removeListener('close', cancel)
    }
  }
}
