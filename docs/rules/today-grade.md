---
type: rule
status: active
scope: apps/api today grade
last-reviewed: 2026-10-30
evidence: "2026-10-30 #1001 상단 바 등급 퍼센트의 뜻, 조회 아이템, 캐시 시각 사용자 결정"
---

# 오늘의 등급

Desktop 상단 바 왼쪽의 등급 퍼센트를 API가 계산해 제공한다(2026-10-30 결정, [Issue #1001](https://github.com/blahaj94/dfragon/issues/1001)). 오늘의 등급은 캐릭터와 상관없이 모든 사용자에게 같은 값이다. Neople API 키는 API 서버에만 있으므로 Desktop은 Neople을 직접 부르지 않는다. 화면 표시는 [Desktop MVP 카드 UI의 상단 바](desktop-mvp-ui.md#상단-바)를 따른다.

## 조회와 계산

`GET /items/today-grade`는 로그인 없이 제공한다. API는 방어구 5부위(상의, 머리어깨, 하의, 벨트, 신발), 악세서리 3부위(팔찌, 목걸이, 반지), 특수장비 3부위(보조장비, 마법석, 귀걸이)마다 115레벨 에픽 대표 아이템 하나씩 모두 11개를 Neople 상점 판매 정보 조회(`/df/items/{itemId}/shop`)로 받는다. 퍼센트는 각 응답의 오늘의 등급 수치 `itemGradeValue`(0 이상 100 이하의 수)를 더해 11로 나누고 정수로 반올림한 값이다. 대표 아이템 목록은 `apps/api/src/today-grade/items.ts`가 가진다. 팔찌와 목걸이는 시로코 `퍼리조아`가 낀 아이템, 반지는 Desktop 점수 엔진 fixture, 나머지는 API 테스트 fixture의 아이템이다. Neople은 상점에서 파는 95레벨 에픽, 100레벨 이상 유니크, 레전더리, 에픽 장비만 이 조회를 지원한다고 안내하며, 목록의 아이템이 모두 지원 대상인지는 운영 배포 뒤 확인한다.

응답은 `{ "percent": 85, "expiresAt": "2026-10-30T15:00:00.000Z" }`처럼 퍼센트와 등급이 바뀌는 다음 0시(KST)의 ISO 시각이다.

## 캐시와 실패

등급은 매일 0시(KST)에 바뀐다. 계산한 값은 조회를 시작한 시각 기준 다음 0시까지 API 메모리에 두고, 그동안 Neople을 다시 부르지 않는다. 0시 직전에 시작한 조회는 전날 등급을 받았을 수 있으므로 끝난 시각이 아니라 시작한 시각으로 만료를 정한다. 같은 프로세스에서 겹치는 조회는 하나를 함께 기다리고, 요청 하나의 연결 종료는 그 조회를 취소하지 않는다. 서버 종료는 진행 중인 조회를 취소한다.

11개가 모두 성공해야 응답한다. 하나라도 실패하면 나머지 조회를 취소하고 부분 결과 없이 오류를 돌려주며, 실패는 캐시하지 않아 다음 요청이 다시 조회한다. 오류 본문과 상태는 캐릭터 상세와 같은 `INTERNAL_SERVER_ERROR`(500), `NEOPLE_API_ERROR`(502), `NEOPLE_UNAVAILABLE`(503), `NEOPLE_TIMEOUT`(504)이다. `itemGradeValue`가 없거나 0 이상 100 이하의 수가 아니면 502다. Neople 요청은 HTTP client 기본 timeout을 따르고 자동 재시도하지 않는다.
