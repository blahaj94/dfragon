import { ApiTags } from '@nestjs/swagger'
import { ApiCharacterDetails } from '../../swagger/operations.js'
import { Controller, Get, Post, Inject, Req, Res } from '@nestjs/common'
import type { Request, Response } from 'express'
import { CharacterDetailFailure } from './errors.js'
import { parseCharacterIdentity } from '../identity.js'
import type { CharacterDetailService } from './service.js'
import { respondWithCancellation } from '../../http-response.js'

const EMPTY_CONTENT_LENGTH_PATTERN = /^0+$/

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
      (request.headers['content-length'] != null &&
        !EMPTY_CONTENT_LENGTH_PATTERN.test(request.headers['content-length']))
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
    await respondWithCancellation(response, (signal) => {
      if (forceRefresh) {
        return this.service.refresh(request.ip, identity, signal)
      }

      return this.service.get(request.ip, identity, signal)
    })
  }
}
