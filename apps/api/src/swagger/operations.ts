import { applyDecorators } from '@nestjs/common'
import { ApiOperation, ApiParam, ApiQuery, ApiResponse } from '@nestjs/swagger'
import { CHARACTER_ID_PATTERN_SOURCE } from '../characters/identity.js'
import { NEOPLE_SERVER_NAMES } from '../constants/neople-character-search.js'

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

const neopleFailures = {
  500: 'INTERNAL_SERVER_ERROR',
  502: 'NEOPLE_API_ERROR',
  503: 'NEOPLE_UNAVAILABLE',
  504: 'NEOPLE_TIMEOUT'
}

export function ApiCharacterSearch() {
  return applyDecorators(
    ApiOperation({
      summary: '캐릭터 검색',
      description:
        '공개 API. 검색 결과는 저장하지 않습니다. IP당 최근 60초 10회이며 실패한 upstream 호출도 한도를 소비합니다. 중복, 알 수 없는 query key와 HEAD는 거절합니다.'
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

export function ApiCharacterCandidates() {
  return applyDecorators(
    ApiOperation({
      summary: 'OCR 닉네임의 캐릭터 비교 후보 조회',
      description:
        '공개 API. 닉네임 하나를 전체 서버에서 정확히 일치하는 wordType=match로 검색합니다. fame이 있는 후보를 내림차순, fame이 null인 후보를 뒤에 반환하며 동률과 null 사이에는 공급자 순서를 유지합니다. imageUrl은 zoom=1인 전체 캐릭터 이미지이며 얼굴 크롭과 비교는 Desktop에서 수행합니다. 반환 순서대로 비교하여 기준을 먼저 통과한 캐릭터를 선택하고, 모두 실패한 뒤 다음 OCR 닉네임을 요청합니다. 검색 결과와 이미지는 API에 저장하지 않습니다. /characters와 합산 IP당 최근 60초 10회이며 실패한 upstream 호출도 한도를 소비합니다. characterName 외 query key, 중복 query와 HEAD는 거절합니다.'
    }),
    ApiQuery({
      name: 'characterName',
      required: true,
      schema: { type: 'string', minLength: 1, maxLength: 12 },
      description: 'Unicode code point 1~12개. 앞뒤 공백 불가, 정규화 없음.'
    }),
    success(200, 'CharacterCandidatesResult', '비교 순서의 후보와 이미지 URL (0건이면 빈 rows)'),
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
          : '캐릭터 11개 섹션이 모두 최근 5분 안에 조회됐다면 DB 값을 반환하고 미저장, 누락, 만료 시 갱신합니다. ') +
        '공개 API. 갱신할 때 Neople 11개 캐릭터 섹션을 모두 조회하여 DB에 저장하고 저장값을 반환합니다. 캐릭터 조회 실패 시 부분 저장이나 이전 값 대체는 없습니다. 추가 공용 아이템, 스킬, 세트 상세는 24시간 캐시를 사용하며 실패 시 stale 또는 unavailable 상태를 반환합니다. 아이템 상세는 장비, 아바타, 엠블렘, 크리쳐, 아티팩트, 서약, 결정, 버프 장착 항목에 연결하고 세트는 setDetails에 ID별로 반환합니다. 서약의 숫자 setId는 세트 상세 조회에 사용하지 않습니다. 공용 상세는 후속 세트 조회를 포함해 최대 128개 참조, 동시 3호출, 하나의 10초 처리 예산이며 DB 정리는 별도입니다. 캐시 적중을 포함해 GET, POST 합산 IP당 최근 60초 10회로 검색 한도와 별도입니다. 같은 프로세스에서 겹치는 동일 캐릭터 갱신은 공유합니다. 캐릭터 11회 외에 캐시 미스 시 추가 Neople 호출이 발생합니다. Query와 HEAD는 허용하지 않습니다.'
    }),
    ApiParam({
      name: 'serverId',
      schema: { type: 'string', enum: [...NEOPLE_SERVER_NAMES.keys()] }
    }),
    ApiParam({
      name: 'characterId',
      schema: { type: 'string', pattern: CHARACTER_ID_PATTERN_SOURCE, minLength: 1, maxLength: 256 }
    }),
    success(
      200,
      'CharacterDetails',
      '정제된 상세 정보, 섹션별 revision, 조회 시각과 freshness 만료 시각'
    ),
    errors({ 400: 'INVALID_CHARACTER_QUERY', 429: 'CHARACTER_RATE_LIMITED', ...neopleFailures })
  )
}

export function ApiCharacterAppearance() {
  return applyDecorators(
    ApiOperation({
      summary: '캐릭터 외형 식별 정보 조회',
      description:
        '공개 API. Neople equip/avatar를 한 번 조회하여 캐릭터 직업과 아바타 슬롯, 장착 아이템, clone 외형만 반환합니다. 옵션, 엠블렘, 장비 정보는 포함하지 않습니다. 아바타가 null이면 빈 배열, clone이 없으면 itemId와 itemName이 모두 null입니다. 원본 슬롯 순서를 유지하며 중복 슬롯이나 불완전한 clone은 전체 실패입니다. 저장이나 캐시는 하지 않습니다. 독립 IP당 최근 60초 64회이며 실패한 공급자 호출도 소비합니다. 검색, 상세, 공용 상세와 공급자 전체 60초 600회 및 동시 12회 한도를 공유합니다. 공급자 body 소비까지 5초 deadline과 연결 종료 취소를 적용하며 자동 재시도는 없습니다. Query, 요청 본문과 HEAD는 허용하지 않습니다.'
    }),
    ApiParam({
      name: 'serverId',
      schema: { type: 'string', enum: [...NEOPLE_SERVER_NAMES.keys()] }
    }),
    ApiParam({
      name: 'characterId',
      schema: { type: 'string', pattern: CHARACTER_ID_PATTERN_SOURCE, minLength: 1, maxLength: 256 }
    }),
    success(200, 'CharacterAppearance', '캐릭터 직업과 아바타 외형 식별 필드'),
    errors({ 400: 'INVALID_CHARACTER_QUERY', 429: 'CHARACTER_RATE_LIMITED', ...neopleFailures })
  )
}

export function ApiAdventureSearch() {
  return applyDecorators(
    ApiOperation({
      summary: '모험단명으로 저장된 캐릭터 검색',
      description:
        '공개 API. 모험단명을 정규화, 부분 일치 없이 정확히 비교하여 우리 DB에 저장된 캐릭터만 서버 구분 없이 반환합니다. Neople 호출, 자동 수집, 갱신은 하지 않습니다. 결과는 최근 저장된 소속이며 이름 변경이 아직 반영되지 않았을 수 있습니다. characterId 오름차순으로 페이지를 나누며 다음 페이지에는 같은 adventureName과 nextAfter를 after로 보냅니다. 페이지 사이 갱신에 대한 snapshot은 보장하지 않습니다. 독립 IP당 60초 10회 제한이며 HEAD, 알 수 없는 query, 중복 query는 400입니다.'
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
      schema: { type: 'string', pattern: CHARACTER_ID_PATTERN_SOURCE }
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
