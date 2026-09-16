import { Controller, Get, Inject, Req, Res } from '@nestjs/common'
import type { Request, Response } from 'express'
import { CharacterDetailFailure } from './errors.js'
import { parseCharacterIdentity } from './service.js'
import type { CharacterDetailService } from './service.js'

export const CHARACTER_DETAIL_SERVICE = Symbol('CHARACTER_DETAIL_SERVICE')

@Controller('characters')
export class CharacterDetailController {
  constructor(@Inject(CHARACTER_DETAIL_SERVICE) private readonly service: CharacterDetailService) {}

  @Get(':serverId/:characterId')
  async detail(@Req() request: Request, @Res() response: Response): Promise<void> {
    if (request.method !== 'GET') {
      throw new CharacterDetailFailure('query')
    }
    const identity = parseCharacterIdentity(
      request.params.serverId,
      request.params.characterId,
      request.originalUrl
    )
    const controller = new AbortController()
    const cancel = () => {
      if (!response.writableFinished) {
        controller.abort()
      }
    }
    response.once('close', cancel)
    try {
      const result = await this.service.refresh(request.ip, identity, controller.signal)
      if (!response.destroyed) {
        response.status(200).json(result)
      }
    } finally {
      response.removeListener('close', cancel)
    }
  }
}
