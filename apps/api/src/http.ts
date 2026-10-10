import 'reflect-metadata'
import { Catch, Controller, Get, Module, NotFoundException } from '@nestjs/common'
import type { ArgumentsHost, ExceptionFilter, INestApplication } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import type { NestExpressApplication } from '@nestjs/platform-express'
import type { Request, Response } from 'express'
import { ADVENTURE_SEARCH_SERVICE, AdventureSearchController } from './adventures/http.js'
import { createAdventureSearchService } from './adventures/service.js'
import type { AdventureSearchStore } from './adventures/store.js'
import { CHARACTER_SEARCH_SERVICE, CharacterSearchController } from './characters/http.js'
import { createCharacterSearchService } from './characters/search-service.js'
import type { CharacterSearchDependencies } from './characters/types.js'
import { CHARACTER_DETAIL_SERVICE, CharacterDetailController } from './characters/details/http.js'
import { createCharacterDetailService } from './characters/details/service.js'
import type { CharacterDetailDependencies } from './characters/details/service.js'
import { characterDetailFailure } from './characters/details/errors.js'
import { NeopleSearchFailure, neopleSearchFailure } from './errors/neople-search.js'
import { setupSwagger } from './swagger/setup.js'
import {
  CHARACTER_APPEARANCE_SERVICE,
  CharacterAppearanceController
} from './characters/appearance/http.js'
import {
  createCharacterAppearanceService,
  type CharacterAppearanceDependencies
} from './characters/appearance/service.js'
import { API_BUILD_INFO, ApiVersionController, readApiBuildInfo } from './build-info.js'
import {
  type AccessLogSink,
  createAccessLog,
  recordAccessLogErrorChain,
  recordAccessLogErrorCode,
  writeAccessLogToStdout
} from './access-log.js'

const TRAILING_SLASHES_PATTERN = /\/+$/

@Catch()
class ApiHttpFilter implements ExceptionFilter {
  catch(error: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp()
    const request = context.getRequest<Request>()
    const response = context.getResponse<Response>()
    if (response.headersSent) {
      response.end()

      return
    }

    if (request.route == null && error instanceof NotFoundException) {
      response.status(404).json({ statusCode: 404, message: 'Not Found' })

      return
    }
    const path = request.path.toLowerCase().replace(TRAILING_SLASHES_PATTERN, '')
    let failure: NeopleSearchFailure | ReturnType<typeof characterDetailFailure>
    if (path === '/characters' || path === '/characters/candidates') {
      failure = error instanceof NeopleSearchFailure ? error : neopleSearchFailure('internal')
    } else {
      failure = characterDetailFailure(error)
    }

    if (failure.retryAfter != null) {
      response.setHeader('Retry-After', String(failure.retryAfter))
    }
    recordAccessLogErrorCode(response, failure.body.error.code)
    recordAccessLogErrorChain(response, error)
    response.status(failure.status).json(failure.body)
  }
}

@Controller('health')
class HealthController {
  @Get()
  health() {
    return { status: 'ok' }
  }
}

/** Public game data runs without authentication credentials or an accounts database connection. */
export async function createApiHttpApp(
  search: CharacterSearchDependencies,
  details?: CharacterDetailDependencies,
  adventures?: AdventureSearchStore,
  httpsOptions?: Readonly<{ cert: Buffer; key: Buffer }>,
  buildInfoPath = '/app/build-info.json',
  appearance?: CharacterAppearanceDependencies,
  writeAccessLog: AccessLogSink = writeAccessLogToStdout
): Promise<INestApplication> {
  const buildInfo = await readApiBuildInfo(buildInfoPath)
  @Module({
    controllers: [
      HealthController,
      ApiVersionController,
      CharacterSearchController,
      ...(appearance ? [CharacterAppearanceController] : []),
      ...(details ? [CharacterDetailController] : []),
      ...(adventures ? [AdventureSearchController] : [])
    ],
    providers: [
      { provide: API_BUILD_INFO, useValue: buildInfo },
      { provide: CHARACTER_SEARCH_SERVICE, useValue: createCharacterSearchService(search) },
      ...(appearance
        ? [
            {
              provide: CHARACTER_APPEARANCE_SERVICE,
              useValue: createCharacterAppearanceService(appearance)
            }
          ]
        : []),
      ...(details
        ? [{ provide: CHARACTER_DETAIL_SERVICE, useValue: createCharacterDetailService(details) }]
        : []),
      ...(adventures
        ? [
            {
              provide: ADVENTURE_SEARCH_SERVICE,
              useValue: createAdventureSearchService(adventures)
            }
          ]
        : [])
    ]
  })
  class ApiHttpModule {}
  const app = await NestFactory.create<NestExpressApplication>(ApiHttpModule, {
    logger: false,
    bodyParser: false,
    abortOnError: false,
    httpsOptions
  })
  try {
    app.set('trust proxy', search.trustedProxyHops ?? false)
    // Nest 기본 logger는 끈 채로 두고, 다른 middleware의 거절까지 재도록 가장 먼저 등록한다.
    app.use(createAccessLog(writeAccessLog))
    app.use((_request: Request, response: Response, next: () => void) => {
      response.setHeader('Cache-Control', 'no-store')
      response.removeHeader('X-Powered-By')
      next()
    })
    app.useGlobalFilters(new ApiHttpFilter())
    setupSwagger(app)

    return app
  } catch (error) {
    await app.close().catch(() => undefined)
    throw error
  }
}
