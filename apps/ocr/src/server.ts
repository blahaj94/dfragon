import 'reflect-metadata'
import { BadRequestException, Catch, Module, NotFoundException } from '@nestjs/common'
import type { ArgumentsHost, ExceptionFilter } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import type { NestExpressApplication } from '@nestjs/platform-express'
import { json } from 'express'
import type { Request, Response, NextFunction } from 'express'
import cookieParser from 'cookie-parser'
import { fileURLToPath } from 'node:url'
import { OcrAuth } from './auth.js'
import type { AuthConfiguration } from './auth.js'
import { OcrStore } from './store.js'
import { OCR_ERROR_CODE, OcrError, httpFailure } from './errors.js'
import { OCR_UPLOAD } from './constants.js'
import {
  OCR_CONFIG,
  OcrAuthController,
  OcrDataController,
  OcrHealthController
} from './controllers.js'

@Catch()
class OcrHttpFilter implements ExceptionFilter {
  catch(error: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>()
    if (response.headersSent) {
      response.destroy()
      return
    }
    const failure =
      error instanceof NotFoundException
        ? new OcrError(OCR_ERROR_CODE.NOT_FOUND)
        : error instanceof BadRequestException
          ? new OcrError(OCR_ERROR_CODE.INVALID_INPUT)
          : httpFailure(error)
    response.status(failure.status).json({ error: failure.code })
  }
}

function isDesktopRequest(request: Request): boolean {
  if (request.method === 'POST' && request.originalUrl === '/api/desktop/captures') {
    return true
  }
  return (
    request.method === 'GET' &&
    (request.originalUrl === '/api/desktop/dataset' ||
      /^\/api\/desktop\/samples\/[0-9a-f-]{36}-[1-4]\/image$/.test(request.originalUrl))
  )
}

export async function createOcrApp(
  config: AuthConfiguration,
  store: OcrStore,
  auth = new OcrAuth(config)
) {
  @Module({
    controllers: [OcrAuthController, OcrDataController, OcrHealthController],
    providers: [
      { provide: OCR_CONFIG, useValue: config },
      { provide: OcrAuth, useValue: auth },
      { provide: OcrStore, useValue: store }
    ]
  })
  class OcrModule {}

  const app = await NestFactory.create<NestExpressApplication>(OcrModule, {
    logger: false,
    bodyParser: false
  })
  app.disable('x-powered-by')
  app.useGlobalFilters(new OcrHttpFilter())
  app.use(cookieParser())
  app.use((request: Request, response: Response, next: NextFunction) => {
    response.set({
      'Cache-Control': 'no-store',
      'Referrer-Policy': 'no-referrer',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy':
        "default-src 'none'; script-src 'self'; style-src 'self'; font-src 'self'; img-src 'self' blob:; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'"
    })
    if (
      isDesktopRequest(request)
        ? request.headers.origin !== undefined
        : !['GET', 'HEAD'].includes(request.method) && request.headers.origin !== config.origin
    ) {
      next(new OcrError(OCR_ERROR_CODE.ORIGIN_REQUIRED))
      return
    }
    next()
  })

  // 큰 본문을 읽기 전에 인증한다. Nest guard는 body parser 이후 실행되므로 여기서는 middleware를 사용한다.
  app.use('/api', (request: Request, _response: Response, next: NextFunction) => {
    void (
      isDesktopRequest(request) ? auth.requireDesktopOwner(request) : auth.require(request)
    ).then(() => next(), next)
  })
  let activeUploads = 0
  const parseUploadBody = json({ limit: OCR_UPLOAD.bodyLimit, strict: true, inflate: false })
  app.use(
    ['/api/captures', '/api/desktop/captures'],
    (request: Request, response: Response, next: NextFunction) => {
      if (request.method !== 'POST' || request.path !== '/') {
        next()
        return
      }
      if (activeUploads >= OCR_UPLOAD.maximumConcurrent) {
        next(new OcrError(OCR_ERROR_CODE.UPLOAD_BUSY))
        return
      }
      activeUploads++
      response.once('close', () => {
        activeUploads--
      })
      parseUploadBody(request, response, next)
    }
  )
  // Nest의 전역 parser보다 먼저 업로드 경로에만 큰 한도를 적용한다.
  app.useBodyParser('json', { limit: OCR_UPLOAD.ordinaryBodyLimit, strict: true, inflate: false })
  app.useStaticAssets(fileURLToPath(new URL('../browser/', import.meta.url)), {
    index: 'index.html',
    etag: false,
    maxAge: 0
  })

  await app.init()
  return {
    app,
    close: async () => {
      await app.close()
      await auth.close()
    }
  }
}
