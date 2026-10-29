import { applyDecorators } from '@nestjs/common'
import { ApiOperation, ApiParam, ApiQuery, ApiResponse } from '@nestjs/swagger'
import { CHARACTER_ID_PATTERN_SOURCE } from '../characters/identity.js'
import { NEOPLE_SERVER_NAMES } from '../constants/neople-character-search.js'

function success(schema: string, description: string) {
  return ApiResponse({
    status: 200,
    description,
    schema: { $ref: `#/components/schemas/${schema}` }
  })
}

function errors(definitions: Record<number, string>) {
  return applyDecorators(
    ...Object.entries(definitions).map(([status, description]) =>
      ApiResponse({
        status: Number(status),
        description,
        content: { 'application/json': { schema: { $ref: '#/components/schemas/ApiError' } } }
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
    success('CharacterSearchResult', '검색 결과 (0건이면 빈 rows)'),
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
    success('CharacterCandidatesResult', '비교 순서의 후보와 이미지 URL (0건이면 빈 rows)'),
    errors({ 400: 'INVALID_SEARCH_QUERY', ...neopleFailures })
  )
}

const characterParams = [
  ApiParam({
    name: 'serverId',
    schema: { type: 'string', enum: [...NEOPLE_SERVER_NAMES.keys()] }
  }),
  ApiParam({
    name: 'characterId',
    schema: { type: 'string', pattern: CHARACTER_ID_PATTERN_SOURCE, minLength: 1, maxLength: 256 }
  })
]

export function ApiCharacterDetails() {
  return applyDecorators(
    ApiOperation({
      summary: '캐릭터 상세 조회',
      description:
        '공개 API. Neople 11개 캐릭터 섹션을 모두 조회하여 반환합니다. 캐릭터 조회 결과는 API 메모리에 1시간 캐시하며 그동안 같은 캐릭터는 Neople을 다시 부르지 않습니다. 그동안 처음 만든 응답 본문을 그대로 보냅니다. 공용 아이템이 하나라도 unavailable인 응답은 저장하지 않습니다. sections의 시각과 freshness.lastSuccessfulFetchAt은 Neople에서 받은 시각, freshness.expiresAt은 그 1시간 뒤입니다. 캐릭터 조회 실패 시 부분 결과는 없으며 실패는 캐시하지 않습니다. 공용 아이템 상세는 API 메모리에 24시간 캐시하며 조회에 실패하면 unavailable 상태를 반환합니다. 아이템 상세는 장비, 아바타, 엠블렘, 크리쳐, 아티팩트, 서약, 결정, 버프 장착 항목에 연결합니다. 공용 아이템 상세는 최대 128개 참조이며, 동시에 들어온 요청들의 아이템을 중복 없이 15개씩 묶어 조회합니다. IP별, 서버 전체 호출 제한은 없습니다. 같은 프로세스에서 겹치는 동일 캐릭터 조회는 공유합니다. Query와 HEAD는 허용하지 않습니다.'
    }),
    ...characterParams,
    success('CharacterDetails', '정제된 상세 정보, 섹션별 조회 시각과 freshness 만료 시각'),
    errors({ 400: 'INVALID_CHARACTER_QUERY', ...neopleFailures })
  )
}

export function ApiCharacterRefresh() {
  return applyDecorators(
    ApiOperation({
      summary: '캐릭터 상세 강제 갱신',
      description:
        '공개 API. 캐릭터 캐시를 건너뛰고 Neople 11개 캐릭터 섹션을 다시 받아 캐시를 덮어쓴 뒤 상세 조회와 같은 응답을 반환합니다. 같은 캐릭터를 이미 Neople에서 받는 중이면 그 조회를 함께 기다립니다. 공용 아이템 상세는 캐시를 그대로 쓰고, 새로 만든 응답 본문이 이후 상세 조회의 응답이 됩니다. 새로 받지 못하면 상세 조회와 같은 오류를 반환하고 기존 캐시는 그대로 둡니다. Query는 허용하지 않으며 body는 읽지 않습니다.'
    }),
    ...characterParams,
    success('CharacterDetails', '다시 받은 상세 정보, 섹션별 조회 시각과 freshness 만료 시각'),
    errors({ 400: 'INVALID_CHARACTER_QUERY', ...neopleFailures })
  )
}

export function ApiTodayGrade() {
  return applyDecorators(
    ApiOperation({
      summary: '오늘의 등급 조회',
      description:
        '공개 API. 방어구 5, 악세서리 3, 특수장비 3부위의 엘더 페어리 장비(115레벨 레전더리) 11개를 Neople 상점 판매 정보 조회로 받아 오늘의 등급(itemGradeValue)의 평균을 반환합니다. 결과는 등급이 바뀌는 다음 0시(KST)까지 API 메모리에 캐시하고, 겹치는 조회는 공유합니다. 아이템 하나라도 실패하면 부분 결과 없이 실패하며 실패는 캐시하지 않습니다.'
    }),
    success('TodayGrade', '오늘의 등급 퍼센트와 만료 시각'),
    errors(neopleFailures)
  )
}
