import { applyDecorators } from '@nestjs/common'
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse
} from '@nestjs/swagger'
import { NEOPLE_SERVER_NAMES } from '../constants/neople-character-search.js'

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
const neopleFailures = {
  500: 'INTERNAL_SERVER_ERROR',
  502: 'NEOPLE_API_ERROR',
  503: 'NEOPLE_UNAVAILABLE',
  504: 'NEOPLE_TIMEOUT'
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
      status: 303,
      description: '등록된 provider 로그인 화면으로 이동',
      headers: {
        Location: { schema: { type: 'string', format: 'uri' } },
        'Set-Cookie': {
          schema: { type: 'string' },
          description: 'Secure·HttpOnly 브라우저 바인딩 쿠키'
        }
      }
    }),
    errors({ 400: 'LOGIN_REQUEST_INVALID', ...authFailures }, true)
  )
}

export function ApiCallback(provider: string) {
  return applyDecorators(
    ApiOperation({
      summary: `${provider} 로그인 콜백`,
      description:
        'Provider가 브라우저를 되돌리는 경로입니다. state 하나와 code 또는 error 중 정확히 하나, 로그인 시작 때 설정된 바인딩 쿠키가 필요합니다. 완료 HTML에서 앱으로 돌아간 뒤 /auth/exchange를 호출합니다. 기본 runtime은 Google만 활성화합니다.'
    }),
    ApiQuery({ name: 'state', required: true, type: String }),
    ApiQuery({
      name: 'code',
      required: false,
      type: String,
      description: 'provider code (error와 동시 전달 불가)'
    }),
    ApiQuery({
      name: 'error',
      required: false,
      type: String,
      description: 'provider 오류 (code와 동시 전달 불가)'
    }),
    ApiResponse({
      status: 200,
      description: '앱 복귀 버튼이 있는 완료 HTML',
      content: { 'text/html': { schema: { type: 'string' } } }
    }),
    errors(
      {
        400: 'LOGIN_REQUEST_INVALID / LOGIN_CANCELLED',
        502: 'AUTH_PROVIDER_ERROR',
        ...authFailures
      },
      true
    )
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

export function ApiCharacterSearch() {
  return applyDecorators(
    ApiOperation({
      summary: '캐릭터 검색',
      description:
        '공개 API. 검색 결과는 저장하지 않습니다. IP당 최근 60초 10회이며 실패한 upstream 호출도 한도를 소비합니다. 중복·알 수 없는 query key와 HEAD는 거절합니다.'
    }),
    ApiQuery({
      name: 'characterName',
      required: true,
      schema: { type: 'string', minLength: 2, maxLength: 12 },
      description: 'Unicode code point 2~12개. 앞뒤 공백 불가, 정규화 없음.'
    }),
    ApiQuery({
      name: 'serverId',
      required: false,
      schema: { type: 'string', enum: ['all', ...NEOPLE_SERVER_NAMES.keys()], default: 'all' }
    }),
    ApiQuery({
      name: 'limit',
      required: false,
      schema: { type: 'integer', minimum: 1, maximum: 200, default: 10 },
      description: 'ASCII 십진 숫자만 허용. 선행 0 허용.'
    }),
    success(200, 'CharacterSearchResult', '검색 결과 (0건이면 빈 rows)'),
    errors({ 400: 'INVALID_SEARCH_QUERY', 429: 'SEARCH_RATE_LIMITED', ...neopleFailures })
  )
}

export function ApiCharacterDetails(refresh = false) {
  return applyDecorators(
    ApiOperation({
      summary: refresh ? '캐릭터 상세 명시 갱신' : '캐릭터 상세 조회',
      description:
        (refresh
          ? '본문 없는 POST로 5분 캐시를 우회하여 캐릭터를 갱신합니다. '
          : '캐릭터 11개 섹션이 모두 최근 5분 안에 조회됐다면 DB 값을 반환하고 미저장·누락·만료 시 갱신합니다. ') +
        '공개 API. 갱신할 때 Neople 11개 캐릭터 섹션을 모두 조회하여 DB에 저장하고 저장값을 반환합니다. 캐릭터 조회 실패 시 부분 저장이나 이전 값 대체는 없습니다. 추가 공용 아이템·스킬·세트 상세는 24시간 캐시를 사용하며 실패 시 stale 또는 unavailable 상태를 반환합니다. 아이템 상세는 장비·아바타·엠블렘·크리쳐·아티팩트·서약·결정·버프 장착 항목에 연결하고 세트는 setDetails에 ID별로 반환합니다. 서약의 숫자 setId는 세트 상세 조회에 사용하지 않습니다. 공용 상세는 후속 세트 조회를 포함해 최대 128개 참조·동시 3호출·하나의 10초 처리 예산이며 DB 정리는 별도입니다. 캐시 적중을 포함해 GET·POST 합산 IP당 최근 60초 10회로 검색 한도와 별도입니다. 같은 프로세스에서 겹치는 동일 캐릭터 갱신은 공유합니다. 캐릭터 11회 외에 캐시 미스 시 추가 Neople 호출이 발생합니다. Query와 HEAD는 허용하지 않습니다.'
    }),
    ApiParam({
      name: 'serverId',
      schema: { type: 'string', enum: [...NEOPLE_SERVER_NAMES.keys()] }
    }),
    ApiParam({
      name: 'characterId',
      schema: { type: 'string', pattern: '^[a-zA-Z0-9_-]{1,256}$', minLength: 1, maxLength: 256 }
    }),
    success(
      200,
      'CharacterDetails',
      '정제된 상세 정보, 섹션별 revision·조회 시각과 freshness 만료 시각'
    ),
    errors({ 400: 'INVALID_CHARACTER_QUERY', 429: 'CHARACTER_RATE_LIMITED', ...neopleFailures })
  )
}

export function ApiAdventureSearch() {
  return applyDecorators(
    ApiOperation({
      summary: '모험단명으로 저장된 캐릭터 검색',
      description:
        '공개 API. 모험단명을 정규화·부분 일치 없이 정확히 비교하여 우리 DB에 저장된 캐릭터만 서버 구분 없이 반환합니다. Neople 호출·자동 수집·갱신은 하지 않습니다. 결과는 최근 저장된 소속이며 이름 변경이 아직 반영되지 않았을 수 있습니다. characterId 오름차순으로 페이지를 나누며 다음 페이지에는 같은 adventureName과 nextAfter를 after로 보냅니다. 페이지 사이 갱신에 대한 snapshot은 보장하지 않습니다. 독립 IP당 60초 10회 제한이며 HEAD·알 수 없는 query·중복 query는 400입니다.'
    }),
    ApiQuery({
      name: 'adventureName',
      required: true,
      schema: { type: 'string', minLength: 1, maxLength: 100 }
    }),
    ApiQuery({
      name: 'limit',
      required: false,
      schema: { type: 'integer', minimum: 1, maximum: 100, default: 100 }
    }),
    ApiQuery({
      name: 'after',
      required: false,
      schema: { type: 'string', pattern: '^[a-zA-Z0-9_-]{1,256}$' }
    }),
    success(
      200,
      'AdventureCharacters',
      '저장된 캐릭터 목록. 결과가 없으면 빈 rows, 마지막 페이지는 nextAfter null'
    ),
    errors({
      400: 'INVALID_CHARACTER_QUERY',
      429: 'CHARACTER_RATE_LIMITED',
      500: 'INTERNAL_SERVER_ERROR'
    })
  )
}
