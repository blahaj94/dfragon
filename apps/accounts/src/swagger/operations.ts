import { applyDecorators } from '@nestjs/common'
import { ApiBearerAuth, ApiBody, ApiOperation, ApiQuery, ApiResponse } from '@nestjs/swagger'

function body(schema: string) {
  return ApiBody({ required: true, schema: { $ref: `#/components/schemas/${schema}` } })
}

function success(status: number, schema: string, description: string) {
  return ApiResponse({ status, description, schema: { $ref: `#/components/schemas/${schema}` } })
}

function errors(definitions: Record<number, string>, html = false) {
  return applyDecorators(
    ...Object.entries(definitions).map(([status, description]) =>
      ApiResponse({
        status: Number(status),
        description,
        content: html
          ? { 'text/html': { schema: { type: 'string' } } }
          : { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } },
        ...(status === '429'
          ? {
              headers: {
                'Retry-After': {
                  description: '재시도까지 남은 초',
                  schema: { type: 'integer', minimum: 1 }
                }
              }
            }
          : {})
      })
    )
  )
}

const authFailures = { 500: 'AUTH_INTERNAL_ERROR', 503: 'AUTH_UNAVAILABLE' }
const jsonFailures = {
  413: 'REQUEST_TOO_LARGE — 최대 16,384바이트',
  415: 'UNSUPPORTED_MEDIA_TYPE — UTF-8 JSON만 허용'
}

export function ApiLoginRequest() {
  return applyDecorators(
    ApiOperation({
      summary: '로그인 요청 생성',
      description:
        'Desktop이 S256 PKCE challenge로 요청을 만듭니다. 응답의 browserUrl을 시스템 브라우저에서 열어 주세요. 요청은 10분 동안 유효합니다.'
    }),
    body('LoginRequest'),
    success(201, 'CreatedLoginRequest', '로그인 요청과 일회용 브라우저 URL'),
    errors({ 400: 'INVALID_AUTH_REQUEST', ...jsonFailures, ...authFailures })
  )
}

export function ApiLoginExchange() {
  return applyDecorators(
    ApiOperation({
      summary: '로그인 코드 교환',
      description:
        '앱 복귀 URL의 일회용 code와 원래 codeVerifier로 로그인합니다. code는 60초 동안 유효하며 한 번만 소비할 수 있습니다.'
    }),
    body('LoginExchange'),
    success(200, 'LoginTokens', '토큰·사용자 정보·신규 가입 여부'),
    errors({
      400: 'INVALID_AUTH_REQUEST / LOGIN_EXCHANGE_INVALID',
      ...jsonFailures,
      ...authFailures
    })
  )
}

export function ApiRefresh() {
  return applyDecorators(
    ApiOperation({
      summary: '토큰 갱신',
      description:
        'refreshToken을 한 번 소비하고 새 access/refresh token을 발급합니다. access JWT는 필요하지 않습니다. 소비된 토큰의 재사용이 확인되면 해당 세션이 폐기됩니다.'
    }),
    body('RefreshRequest'),
    success(200, 'RefreshTokens', '교체된 토큰'),
    errors({
      400: 'INVALID_AUTH_REQUEST',
      401: 'AUTHENTICATION_REQUIRED',
      ...jsonFailures,
      ...authFailures
    })
  )
}

export function ApiLogout() {
  return applyDecorators(
    ApiOperation({
      summary: '로그아웃',
      description:
        'refreshToken에 연결된 세션을 폐기합니다. 알 수 없거나 이미 종료된 토큰도 204를 반환합니다.'
    }),
    body('RefreshRequest'),
    ApiResponse({ status: 204, description: '완료 (응답 본문 없음)' }),
    errors({ 400: 'INVALID_AUTH_REQUEST', ...jsonFailures, ...authFailures })
  )
}

export function ApiAuthorize() {
  return applyDecorators(
    ApiOperation({
      summary: '브라우저 로그인 시작',
      description:
        '시스템 브라우저에서 browserUrl로 방문하는 경로입니다. 일회용 ticket을 소비하고 브라우저 바인딩 쿠키를 설정합니다. 다른 query나 HEAD 요청은 허용하지 않습니다.'
    }),
    ApiQuery({
      name: 'ticket',
      required: true,
      type: String,
      description: '로그인 요청의 browserUrl에 포함된 일회용 값'
    }),
    ApiResponse({
      status: 200,
      description: '패스키 가입·로그인 HTML',
      headers: {
        'Set-Cookie': {
          schema: { type: 'string' },
          description: 'Secure·HttpOnly 브라우저 바인딩 쿠키'
        }
      }
    }),
    errors({ 400: 'LOGIN_REQUEST_INVALID', ...authFailures }, true)
  )
}

export function ApiProfile(update = false) {
  return applyDecorators(
    ApiBearerAuth(),
    ApiOperation({
      summary: update ? '닉네임 변경' : '내 프로필 조회',
      description:
        '유효한 access JWT와 활성 계정·세션이 필요합니다. Authorization: Bearer 헤더를 사용합니다.'
    }),
    ...(update ? [body('NicknameRequest'), errors(jsonFailures)] : []),
    success(200, 'AccountProfile', '사용자 ID와 닉네임'),
    errors({
      400: update ? 'INVALID_AUTH_REQUEST / INVALID_NICKNAME' : 'INVALID_AUTH_REQUEST',
      401: 'AUTHENTICATION_REQUIRED',
      ...authFailures
    })
  )
}
