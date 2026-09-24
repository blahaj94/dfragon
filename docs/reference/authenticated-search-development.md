---
type: reference
status: active
scope: public character search implementation
last-reviewed: 2026-09-15
---

# 공개 캐릭터 검색 개발

`GET /characters`는 로그인 없이 제공한다. 계약은 [캐릭터 검색](../rules/character-search.md)을 따른다. 이전 인증·DB 검색 구현 이력은 기존 PR에 보존하며 현재 공개 검색의 선행 조건으로 사용하지 않는다.

- `apps/api/src/characters/search-service.ts`: raw query·고정 API key 설정을 검증하고 직접 socket peer별 quota를 예약한 뒤 adapter를 호출한다. Authorization과 전달 헤더는 검색 자격·quota key로 사용하지 않는다.
- `search-admission.ts`: 기존 단일 process memory의 60초 10회 예약·만료·동시성 제어를 재사용한다. 같은 NAT·프록시 peer는 한도를 공유한다. IP와 검색 결과를 DB나 log에 기록하지 않는다.
- `neople-character-search.ts`: 기존 upstream 입력·응답·오류 projection과 5초 deadline, 자동 retry 없음 정책을 유지한다.
- 검색에는 JWT 검증·session 조회·활동 갱신·별도 DB 연결이 없다. 검색을 해도 로그인 session의 활동 기간이 연장되지 않는다. `/me` 등 계정 endpoint는 기존 인증을 유지한다.

`pnpm --filter @dfragon/api test`는 public HTTP·query·quota·adapter 및 계정 인증 회귀를 검사한다. 이번 변경에서 486개가 통과했다. Native DB 통합 검증은 실행하지 않았으며, 해당 테스트의 검색 기대값은 session lock·활동 DB와 독립적인 동작으로 변경했다. 이 결과를 실제 Neople·배포 API 검증으로 표시하지 않는다.
