import type { INestApplication } from '@nestjs/common'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'
import type { Request, Response } from 'express'
import { PRODUCT_NAME } from '@dfragon/lib'
import { apiSchemas } from './schemas.js'

export function setupSwagger(app: INestApplication): void {
  const config = new DocumentBuilder()
    .setTitle(`${PRODUCT_NAME} API`)
    .setDescription('캐릭터 검색·상세와 모험단 조회를 제공하는 공개 API입니다.')
    .setVersion('1.0.0')
    .addTag('캐릭터', '로그인 없이 검색과 상세 정보 조회')
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
      customSiteTitle: `${PRODUCT_NAME} API 문서`,
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
