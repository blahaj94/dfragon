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
          : { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } }
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
        '공개 API. 검색 결과는 저장하지 않습니다. IP별, 서버 전체 호출 제한은 없습니다. 중복, 알 수 없는 query key와 HEAD는 거절합니다.'
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
    errors({ 400: 'INVALID_SEARCH_QUERY', ...neopleFailures })
  )
}

export function ApiCharacterCandidates() {
  return applyDecorators(
    ApiOperation({
      summary: 'OCR 닉네임의 캐릭터 비교 후보 조회',
      description:
        '공개 API. 닉네임 하나를 전체 서버에서 정확히 일치하는 wordType=match로 검색합니다. fame이 있는 후보를 내림차순, fame이 null인 후보를 뒤에 반환하며 동률과 null 사이에는 공급자 순서를 유지합니다. jobName, jobGrowName은 Neople 검색 응답의 값이며 없으면 null입니다. imageUrl은 zoom=1인 전체 캐릭터 이미지이며 얼굴 크롭과 비교는 Desktop에서 수행합니다. 반환 순서대로 비교하여 기준을 먼저 통과한 캐릭터를 선택하고, 모두 실패한 뒤 다음 OCR 닉네임을 요청합니다. 검색 결과와 이미지는 API에 저장하지 않습니다. IP별, 서버 전체 호출 제한은 없습니다. characterName 외 query key, 중복 query와 HEAD는 거절합니다.'
    }),
    ApiQuery({
      name: 'characterName',
      required: true,
      schema: { type: 'string', minLength: 1, maxLength: 12 },
      description: 'Unicode code point 1~12개. 앞뒤 공백 불가, 정규화 없음.'
    }),
    success(200, 'CharacterCandidatesResult', '비교 순서의 후보와 이미지 URL (0건이면 빈 rows)'),
    errors({ 400: 'INVALID_SEARCH_QUERY', ...neopleFailures })
  )
}

export function ApiCharacterDetails() {
  return applyDecorators(
    ApiOperation({
      summary: '캐릭터 상세 조회',
      description:
        '공개 API. 요청마다 Neople 11개 캐릭터 섹션을 모두 조회하여 반환하며 저장하지 않습니다. 캐릭터 조회 실패 시 부분 결과는 없습니다. 공용 아이템 상세도 요청마다 조회하며 실패하면 unavailable 상태를 반환합니다. 아이템 상세는 장비, 아바타, 엠블렘, 크리쳐, 아티팩트, 서약, 결정, 버프 장착 항목에 연결합니다. 공용 아이템 상세는 최대 128개 참조, 하나의 10초 처리 예산이며 15개씩 묶은 호출을 모두 동시에 시작합니다. IP별, 서버 전체 호출 제한은 없습니다. 같은 프로세스에서 겹치는 동일 캐릭터 조회는 공유합니다. Query와 HEAD는 허용하지 않습니다.'
    }),
    ApiParam({
      name: 'serverId',
      schema: { type: 'string', enum: [...NEOPLE_SERVER_NAMES.keys()] }
    }),
    ApiParam({
      name: 'characterId',
      schema: { type: 'string', pattern: CHARACTER_ID_PATTERN_SOURCE, minLength: 1, maxLength: 256 }
    }),
    success(200, 'CharacterDetails', '정제된 상세 정보, 섹션별 조회 시각과 freshness 만료 시각'),
    errors({ 400: 'INVALID_CHARACTER_QUERY', ...neopleFailures })
  )
}
