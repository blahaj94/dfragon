import type { INestApplication } from '@nestjs/common'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'
import type { Request, Response } from 'express'
import { apiSchemas } from './schemas.js'

export function setupSwagger(app: INestApplication): void {
  const config = new DocumentBuilder()
    .setTitle('LDB API')
    .setDescription(
      '캐릭터 검색·상세 조회, Desktop 로그인과 계정 API입니다. 검색·상세는 공개 API이며 계정 API는 Bearer access JWT가 필요합니다. JSON 요청은 UTF-8 application/json, 최대 16,384바이트이며 정의되지 않은 필드를 허용하지 않습니다. OAuth는 Desktop의 PKCE와 시스템 브라우저를 통해 진행합니다.'
    )
    .setVersion('1.0.0')
    .addTag('캐릭터', '로그인 없이 검색과 상세 정보 조회')
    .addTag('인증', 'Desktop 로그인 요청·교환·세션 관리')
    .addTag('계정', '로그인한 사용자의 프로필과 닉네임')
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' })
    .build()

  // 로그인 완료 화면의 script 금지 CSP는 유지하고 문서 경로만 자체 asset을 허용합니다.
  app.use('/docs', (_request: Request, response: Response, next: () => void) => {
    response.setHeader(
      'Content-Security-Policy',
      "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"
    )
    next()
  })
  SwaggerModule.setup(
    'docs',
    app,
    () => {
      const document = SwaggerModule.createDocument(app, config)
      document.components = {
        ...document.components,
        schemas: { ...document.components?.schemas, ...apiSchemas }
      }
      return document
    },
    {
      jsonDocumentUrl: 'docs/openapi.json',
      raw: ['json'],
      customSiteTitle: 'LDB API 문서',
      swaggerOptions: {
        persistAuthorization: false,
        validatorUrl: null,
        queryConfigEnabled: false,
        displayRequestDuration: true,
        docExpansion: 'list'
      }
    }
  )
}
