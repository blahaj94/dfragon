---
type: reference
status: active
scope: public character search implementation
last-reviewed: 2026-10-07
---

# 공개 캐릭터 검색 개발

`GET /characters`는 로그인 없이 제공한다. 계약은 [캐릭터 검색](../rules/character-search.md)을 따른다. 이전 인증·DB 검색 구현 이력은 기존 PR에 보존하며 현재 공개 검색의 선행 조건으로 사용하지 않는다.

`GET /characters/candidates?characterName=...`는 Desktop의 OCR 식별을 위한 동일 단어 검색이다. `all`, `match`, `limit=200`을 고정하고 명성 내림차순, null 마지막 순서로 후보를 반환한다. 각 후보에는 `zoom=1`의 네오플 캐릭터 `imageUrl`을 포함한다. 이름 하나씩 호출하므로 Desktop이 첫 OCR 후보의 이미지 비교를 마친 뒤 두 번째 이름으로 넘어갈 수 있다. 기존 `GET /characters`의 `full` 검색과 응답 순서는 유지하며 두 경로는 같은 검색 한도를 공유한다.

```http
GET /characters/candidates?characterName=%EA%B0%80%EB%82%98
```

```json
{
  "rows": [
    {
      "characterId": "example-character-id",
      "characterName": "가나",
      "serverId": "cain",
      "serverName": "카인",
      "fame": 50000,
      "imageUrl": "https://img-api.neople.co.kr/df/servers/cain/characters/example-character-id?zoom=1"
    }
  ]
}
```

위 식별자는 요청 형태를 보여주는 예시다. `imageUrl`은 전체 캐릭터 이미지이므로 파티원 얼굴 크롭과의 정렬, 비교, 처음 기준을 통과한 후보 선택은 Desktop에서 수행한다. API는 이미지나 상세 정보를 미리 조회하지 않는다. 선택 후 기존 상세 API에 반환된 서버와 캐릭터 ID를 전달한다. 구체 입력과 오류 규칙은 [OCR 식별 후보 계약](../rules/character-search.md#ocr-캐릭터-식별-후보)을 따른다.

- `apps/api/src/characters/search-service.ts`: raw query·고정 API key 설정을 검증하고 직접 socket peer별 quota를 예약한 뒤 adapter를 호출한다. Authorization과 전달 헤더는 검색 자격·quota key로 사용하지 않는다.
- `search-admission.ts`: 기존 단일 process memory의 60초 10회 예약·만료·동시성 제어를 재사용한다. 같은 NAT·프록시 peer는 한도를 공유한다. IP와 검색 결과를 DB나 log에 기록하지 않는다.
- `neople-character-search.ts`: 기존 upstream 입력·응답·오류 projection과 5초 deadline, 자동 retry 없음 정책을 유지한다.
- 검색에는 JWT 검증·session 조회·활동 갱신·별도 DB 연결이 없다. 검색을 해도 로그인 session의 활동 기간이 연장되지 않는다. `/me` 등 계정 endpoint는 기존 인증을 유지한다.

`pnpm --filter @dfragon/api test`는 build와 타입 검사 후 공개 HTTP, query, quota, adapter와 domain API 회귀를 검사한다. OCR 후보 검증은 고정 `all/match`, 명성 정렬과 null 후순위, 이미지 URL, 빈 결과, 잘못된 입력과 공급자 응답, 기존 검색과 공유하는 한도를 확인한다. 가짜 공급자 또는 loopback HTTP를 사용하므로 실제 Neople 이미지의 가용성이나 인게임 얼굴 비교 정확도를 보장하지 않는다. DB 통합은 별도 `test:database`이며 후보 API에는 DB 변경이 없다.
