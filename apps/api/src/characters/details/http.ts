import { ApiTags } from '@nestjs/swagger'
import { ApiCharacterDetails } from '../../swagger/operations.js'
import { Controller, Get, Post, Inject, Req, Res } from '@nestjs/common'
import type { Request, Response } from 'express'
import { CharacterDetailFailure } from './errors.js'
import { parseCharacterIdentity } from './service.js'
import type { CharacterDetailService } from './service.js'

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
    await this.respond(request, response, false)
  }

  @Post(':serverId/:characterId/refresh')
  @ApiCharacterDetails(true)
  async refresh(@Req() request: Request, @Res() response: Response): Promise<void> {
    // No body is accepted; refuse framed payloads before acquiring quota or touching the DB.
    if (
      request.headers['transfer-encoding'] != null ||
      (request.headers['content-length'] != null && !/^0+$/.test(request.headers['content-length']))
    ) {
      request.pause()
      response.setHeader('Connection', 'close')
      throw new CharacterDetailFailure('query')
    }
    await this.respond(request, response, true)
  }

  private async respond(
    request: Request,
    response: Response,
    forceRefresh: boolean
  ): Promise<void> {
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
      const result = forceRefresh
        ? await this.service.refresh(request.ip, identity, controller.signal)
        : await this.service.get(request.ip, identity, controller.signal)
      if (!response.destroyed) {
        response.status(200).json(result)
      }
    } finally {
      response.removeListener('close', cancel)
    }
  }
}
