import { Controller, Get, Inject, Req, Res } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import type { Request, Response } from 'express'
import { respondWithCancellation } from '../../http-response.js'
import { ApiCharacterAppearance } from '../../swagger/operations.js'
import { CharacterDetailFailure } from '../details/errors.js'
import { parseCharacterIdentity } from '../identity.js'
import type { CharacterAppearanceService } from './service.js'

const EMPTY_CONTENT_LENGTH_PATTERN = /^0+$/
export const CHARACTER_APPEARANCE_SERVICE = Symbol('CHARACTER_APPEARANCE_SERVICE')

@ApiTags('캐릭터')
@Controller('characters')
export class CharacterAppearanceController {
  constructor(
    @Inject(CHARACTER_APPEARANCE_SERVICE) private readonly service: CharacterAppearanceService
  ) {}

  @Get(':serverId/:characterId/appearance')
  @ApiCharacterAppearance()
  async get(@Req() request: Request, @Res() response: Response): Promise<void> {
    if (
      request.method !== 'GET' ||
      request.headers['transfer-encoding'] != null ||
      (request.headers['content-length'] != null &&
        !EMPTY_CONTENT_LENGTH_PATTERN.test(request.headers['content-length']))
    ) {
      request.pause()
      response.setHeader('Connection', 'close')
      throw new CharacterDetailFailure('query')
    }
    const identity = parseCharacterIdentity(
      request.params.serverId,
      request.params.characterId,
      request.originalUrl
    )
    await respondWithCancellation(response, (signal) =>
      this.service.get(request.ip, identity, signal)
    )
  }
}
