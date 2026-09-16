import { readFile } from 'node:fs/promises'
import { passkeyPage } from './page.js'
import 'reflect-metadata'
import { ADVENTURE_SEARCH_SERVICE, AdventureSearchController } from '../../adventures/http.js'
import { createAdventureSearchService } from '../../adventures/service.js'
import type { AdventureSearchStore } from '../../adventures/store.js'
import {
  Catch,
  Controller,
  Get,
  Inject,
  Module,
  NotFoundException,
  Post,
  Param,
  Req,
  Res
} from '@nestjs/common'
import type { ArgumentsHost, ExceptionFilter, INestApplication } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { setupSwagger } from '../../swagger/setup.js'
import {
  ApiLoginRequest,
  ApiLoginExchange,
  ApiRefresh,
  ApiLogout,
  ApiAuthorize
} from '../../swagger/operations.js'
import { NestFactory } from '@nestjs/core'
import type { NestExpressApplication } from '@nestjs/platform-express'
import type { Request, Response } from 'express'
import { LOGIN, LOGIN_ERRORS } from '../../constants/login.js'
import { createCharacterSearchService } from '../../characters/search-service.js'
import { CHARACTER_SEARCH_SERVICE, CharacterSearchController } from '../../characters/http.js'
import type { CharacterSearchDependencies } from '../../characters/types.js'
import {
  CHARACTER_DETAIL_SERVICE,
  CharacterDetailController
} from '../../characters/details/http.js'
import { createCharacterDetailService } from '../../characters/details/service.js'
import type { CharacterDetailDependencies } from '../../characters/details/service.js'
import { characterDetailFailure } from '../../characters/details/errors.js'
import { NeopleSearchFailure, neopleSearchFailure } from '../../errors/neople-search.js'
import { LoginFailure, loginFailure } from '../../errors/login.js'
import type { LoginHttpService, SessionHttpService } from '../../types/login.js'
import { AccountFailure } from '../account/errors.js'
import { ACCOUNT_SERVICE, AccountController } from '../account/http.js'
import { createAccountService } from '../account/index.js'
import type { AccountDependencies } from '../account/types.js'
import { LogoutFailure } from '../logout/errors.js'
import { logoutSession } from '../logout/index.js'
import { RefreshFailure } from '../refresh/errors.js'
import { rotateRefresh } from '../refresh/index.js'
import type { RefreshDependencies } from '../refresh/types.js'
import { parseCreation, parseExchange, parseRefreshToken } from './input.js'
import { jsonError, loginJsonParser } from './json-parser.js'

const LOGIN_SERVICE = Symbol('LOGIN_SERVICE')
const SESSION_SERVICE = Symbol('SESSION_SERVICE')
const htmlEntities: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => htmlEntities[character]!)
}

function loginPage(message: string, returnUrl?: string): string {
  const messageHtml = `<p>${escapeHtml(message)}</p>`
  const hasReturnUrl = returnUrl != null
  let returnLink = ''
  if (hasReturnUrl) {
    const hasTruthyReturnUrl = Boolean(returnUrl)
    if (hasTruthyReturnUrl) {
      returnLink = `<a href="${escapeHtml(returnUrl)}">앱으로 돌아가기</a>`
    }
  }

  const pageHtml = [
    '<!doctype html>',
    '<html lang="ko">',
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width">',
    '<title>로그인</title>',
    '<body>',
    messageHtml,
    returnLink,
    '</body></html>'
  ].join('')
  return pageHtml
}

function readOriginalQuery(request: Request): URLSearchParams {
  // Framework의 query object 대신 원본에서 읽어 중복 parameter를 보존한다.
  return new URL(request.originalUrl, 'https://request.invalid').searchParams
}

function authHttpFailure(
  error: unknown
): LoginFailure | RefreshFailure | LogoutFailure | AccountFailure {
  const isSessionFailure = error instanceof RefreshFailure || error instanceof LogoutFailure
  const isAccountFailure = error instanceof AccountFailure
  const isKnownAuthFailure = isSessionFailure || isAccountFailure
  return isKnownAuthFailure ? error : loginFailure(error)
}

@Catch()
class LoginHttpFilter implements ExceptionFilter {
  catch(error: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp()
    const request = context.getRequest<Request>()
    const response = context.getResponse<Response>()
    if (response.headersSent) {
      response.end()
      return
    }

    const hasRegisteredRoute = request.route != null
    const isNotFound = error instanceof NotFoundException
    const isUnregisteredRoute = !hasRegisteredRoute && isNotFound
    if (isUnregisteredRoute) {
      // Nest의 원문 message에는 credential을 포함한 URL이 있을 수 있어 반사하지 않는다.
      response.status(404).json({ statusCode: 404, message: 'Not Found' })
      return
    }

    const path = request.path.toLowerCase().replace(/\/+$/, '')
    if (path.startsWith('/characters/') || path === '/adventures/characters') {
      const failure = characterDetailFailure(error)
      if (failure.retryAfter != null) {
        response.setHeader('Retry-After', String(failure.retryAfter))
      }
      response.status(failure.status).json(failure.body)
      return
    }
    const isSearchPath = path === '/characters'
    if (isSearchPath) {
      const isSearchFailure = error instanceof NeopleSearchFailure
      const failure = isSearchFailure ? error : neopleSearchFailure('internal')
      const hasRetryAfter = failure.retryAfter != null
      if (hasRetryAfter) {
        response.setHeader('Retry-After', String(failure.retryAfter))
      }
      response.status(failure.status).json(failure.body)
      return
    }
    const failure = authHttpFailure(error)
    const isAccountPath = path === '/me' || path === '/me/nickname'
    const isGet = request.method === 'GET'
    const shouldRenderHtml = isGet && !isAccountPath
    if (shouldRenderHtml) {
      response.status(failure.status).type('html').send(loginPage(failure.message))
    } else {
      jsonError(response, failure)
    }
  }
}

@ApiTags('인증')
@Controller('auth')
class SessionController {
  constructor(@Inject(SESSION_SERVICE) private readonly service: SessionHttpService) {}

  @Post('refresh')
  @ApiRefresh()
  async refresh(@Req() request: Request, @Res() response: Response): Promise<void> {
    const rawToken = parseRefreshToken(request.body)
    const tokens = await this.service.refresh(rawToken)
    response.status(200).json(tokens)
  }

  @Post('logout')
  @ApiLogout()
  async logout(@Req() request: Request, @Res() response: Response): Promise<void> {
    const rawToken = parseRefreshToken(request.body)
    await this.service.logout(rawToken)
    response.status(204).end()
  }
}

@ApiTags('인증')
@Controller('auth')
class LoginController {
  constructor(@Inject(LOGIN_SERVICE) private readonly service: LoginHttpService) {}

  @Post('login-requests')
  @ApiLoginRequest()
  async create(@Req() request: Request, @Res() response: Response): Promise<void> {
    const input = parseCreation(request.body)
    const created = await this.service.create(input)
    response.status(201).json(created)
  }

  @Post('exchange')
  @ApiLoginExchange()
  async exchange(@Req() request: Request, @Res() response: Response): Promise<void> {
    const input = parseExchange(request.body)
    const tokens = await this.service.exchange(input)
    response.status(200).json(tokens)
  }

  @Get('login/authorize')
  @ApiAuthorize()
  async authorize(@Req() request: Request, @Res() response: Response): Promise<void> {
    // Express의 HEAD→GET fallback이 일회용 ticket을 소비하지 못하게 한다.
    const isGet = request.method === 'GET'
    if (!isGet) {
      throw new LoginFailure(LOGIN_ERRORS.REQUEST_INVALID)
    }

    const query = readOriginalQuery(request)
    const hasSingleQueryParameter = query.size === 1
    if (!hasSingleQueryParameter) {
      throw new LoginFailure(LOGIN_ERRORS.REQUEST_INVALID)
    }
    const hasSingleTicket = query.getAll('ticket').length === 1
    if (!hasSingleTicket) {
      throw new LoginFailure(LOGIN_ERRORS.REQUEST_INVALID)
    }

    const ticket = query.get('ticket')!
    const authorization = await this.service.authorize(ticket)
    response.setHeader('Set-Cookie', authorization.cookie)
    const page = passkeyPage(authorization)
    response.setHeader('Content-Security-Policy', page.policy)
    response.status(200).type('html').send(page.html)
  }

  @Get('passkeys/manage')
  async manage(@Req() request: Request, @Res() response: Response): Promise<void> {
    if (request.method !== 'GET') {
      throw new LoginFailure(LOGIN_ERRORS.REQUEST_INVALID)
    }
    const authorization = await this.service.manage()
    const page = passkeyPage(authorization)
    response.setHeader('Set-Cookie', authorization.cookie)
    response.setHeader('Content-Security-Policy', page.policy)
    response.status(200).type('html').send(page.html)
  }

  @Get('passkeys/client.js')
  async client(@Res() response: Response): Promise<void> {
    const script = await readFile(new URL('../../browser/passkeys.js', import.meta.url), 'utf8')
    response.status(200).type('application/javascript').send(script)
  }

  @Get('passkeys/client.css')
  async clientStyle(@Res() response: Response): Promise<void> {
    const css = await readFile(new URL('../../browser/passkeys.css', import.meta.url), 'utf8')
    response.status(200).type('text/css').send(css)
  }

  @Post('passkeys/:action')
  async browser(
    @Param('action') action: string,
    @Req() request: Request,
    @Res() response: Response
  ): Promise<void> {
    const origins = request.rawHeaders.filter(
      (value, index) => index % 2 === 0 && value.toLowerCase() === 'origin'
    )
    if (origins.length !== 1) {
      throw new LoginFailure(LOGIN_ERRORS.REQUEST_INVALID)
    }
    const result = await this.service.browser(
      action,
      request.body,
      request.headers.cookie ?? '',
      request.headers.origin
    )
    response.status(200).json(result)
  }
}

/** 실제 server composition 또는 격리 test가 service를 주입한다. 환경변수 test mode는 없다. */
export function createSessionHttpService(deps: RefreshDependencies): SessionHttpService {
  return {
    refresh: (rawToken) => rotateRefresh(deps, rawToken),
    logout: (rawToken) => logoutSession(deps.dataSource, rawToken)
  }
}

export async function createLoginHttpApp(
  service: LoginHttpService,
  sessionService?: SessionHttpService,
  accountDependencies?: AccountDependencies,
  searchDependencies?: CharacterSearchDependencies,
  httpsOptions?: Readonly<{ cert: Buffer; key: Buffer }>,
  detailDependencies?: CharacterDetailDependencies,
  adventureStore?: AdventureSearchStore
): Promise<INestApplication> {
  const hasSessionService = sessionService != null
  const hasAccountDependencies = accountDependencies != null
  const hasSearchDependencies = searchDependencies != null
  const controllers = [
    LoginController,
    ...(adventureStore ? [AdventureSearchController] : []),
    ...(hasSessionService ? [SessionController] : []),
    ...(hasAccountDependencies ? [AccountController] : []),
    ...(hasSearchDependencies ? [CharacterSearchController] : []),
    ...(detailDependencies ? [CharacterDetailController] : [])
  ]
  const providers = [
    ...(adventureStore
      ? [
          {
            provide: ADVENTURE_SEARCH_SERVICE,
            useValue: createAdventureSearchService(adventureStore)
          }
        ]
      : []),
    ...(detailDependencies
      ? [
          {
            provide: CHARACTER_DETAIL_SERVICE,
            useValue: createCharacterDetailService(detailDependencies)
          }
        ]
      : []),
    { provide: LOGIN_SERVICE, useValue: service },
    ...(hasSessionService ? [{ provide: SESSION_SERVICE, useValue: sessionService }] : []),
    ...(hasAccountDependencies
      ? [
          {
            provide: ACCOUNT_SERVICE,
            useValue: createAccountService(accountDependencies)
          }
        ]
      : []),
    ...(hasSearchDependencies
      ? [
          {
            provide: CHARACTER_SEARCH_SERVICE,
            useValue: createCharacterSearchService(searchDependencies)
          }
        ]
      : [])
  ]

  @Module({
    controllers,
    providers
  })
  class LoginHttpModule {}

  const app = await NestFactory.create<NestExpressApplication>(LoginHttpModule, {
    logger: false,
    bodyParser: false,
    abortOnError: false,
    httpsOptions
  })
  try {
    // Only an explicitly configured, isolated single-proxy deployment trusts XFF.
    app.set('trust proxy', searchDependencies?.trustedProxyHops ?? false)
    const windows = new Map<string, { until: number; count: number }>()
    let globalWindow = { until: 0, count: 0 }
    app.use((request: Request, response: Response, next: () => void) => {
      const path = request.path.toLowerCase().replace(/\/+$/, '')
      if (
        (request.method === 'POST' &&
          (path === '/auth/login-requests' || path.startsWith('/auth/passkeys/'))) ||
        path === '/auth/passkeys/manage'
      ) {
        const now = Date.now()
        if (now >= globalWindow.until) {
          globalWindow = { until: now + 60_000, count: 0 }
          windows.clear()
        }
        const address = request.ip ?? request.socket.remoteAddress ?? 'unknown'
        const window = windows.get(address) ?? { until: globalWindow.until, count: 0 }
        if (window.count >= 120 || globalWindow.count >= 1200) {
          response.setHeader('Retry-After', '60')
          response.setHeader('Cache-Control', 'no-store')
          jsonError(response, LOGIN_ERRORS.RATE_LIMIT)
          return
        }
        window.count += 1
        globalWindow.count += 1
        windows.set(address, window)
      }
      next()
    })
    app.use((request: Request, response: Response, next: () => void) => {
      response.setHeader('Cache-Control', 'no-store')
      response.removeHeader('X-Powered-By')
      const isGet = request.method === 'GET'
      if (isGet) {
        response.setHeader('Referrer-Policy', 'no-referrer')
        response.setHeader('Content-Security-Policy', LOGIN.contentSecurityPolicy)
      }
      next()
    })
    app.use(loginJsonParser)
    app.useGlobalFilters(new LoginHttpFilter())
    setupSwagger(app)
    return app
  } catch (error) {
    await app.close().catch(() => undefined)
    throw error
  }
}
