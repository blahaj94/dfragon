---
type: rule
status: active
scope: apps/api character details
last-reviewed: 2026-10-26
---

# 캐릭터 상세 정보

사용자가 검색 결과에서 선택한 캐릭터는 요청마다 Neople에서 조회해 JSON으로 정제해 제공한다. API는 DB를 쓰지 않으며 조회 결과를 저장하지 않는다(2026-10-26 결정, [Issue #796](https://github.com/blahaj94/dfragon/issues/796)). 응답 캐시를 도입하면 여러 노드가 공유하는 Redis로 하며 지금은 두지 않는다.

## 조회와 응답

`GET /characters/:serverId/:characterId`는 로그인 없이 제공한다. 서버는 지원하는 단일 서버 ID이며 `all`은 받지 않는다. 캐릭터 ID는 대소문자를 보존하는 1~256자의 ASCII 영숫자, `_`, `-`다. Query parameter와 HEAD는 400이다. 저장값이 없어 명시 갱신과 같은 동작이 되므로 `POST /characters/:serverId/:characterId/refresh`는 두지 않는다.

조회 대상은 기본정보, 능력치, 장착장비, 아바타, 크리쳐, 서약, 안개융화, 스킬스타일, 버프 강화 장비, 아바타, 크리쳐의 11개다. 타임라인, 과거 이력, 통계 집계와 Electron 상세 화면은 이 범위에 포함하지 않는다.

같은 프로세스에서 동일 서버, 캐릭터의 조회가 겹치면 Neople 조회를 공유한다. 각 HTTP 요청의 공용 상세 연결은 개별 처리한다. 대기자 하나의 연결 종료는 다른 대기자의 조회를 취소하지 않으며, 마지막 대기자가 사라지면 공유 작업도 취소한다. 서버 종료는 모든 공유 작업을 취소하고 정리를 기다린다. 끝난 조회의 결과는 재사용하지 않으며 여러 인스턴스 사이의 실행 공유는 보장하지 않는다.

기본정보로 식별을 확인한 뒤 나머지 10개 섹션을 동시 실행 제한 없이 한 번에 병렬 조회한다([호출 제한 결정](character-search.md#공개-검색과-호출-제한)). 전체 Neople 조회, body 수신, 검증에 하나의 5초 제한을 적용하고 자동 재시도하지 않는다. 요청된 캐릭터, 서버와 공통 이름, 섹션의 필수 envelope를 검사한다. 시즌별 중첩 옵션은 엄격한 고정 schema로 제한하지 않으며 미장착을 나타내는 null과 알 수 없는 추가 필드를 원본에 보존한다.

11개가 모두 성공해야 응답한다. 하나라도 실패하면 오류를 반환하며 부분 결과를 성공처럼 돌려주지 않는다. 여러 upstream 호출이 게임 서버의 같은 순간을 나타낸다고 보장하지는 않는다.

응답은 `character`, `status`, `equipment`, `avatar`, `creature`, `oath`, `mistAssimilation`, `skillStyle`, `buff`, `sections`, `freshness`, `card`다. 공통 신상 정보는 `character`로 모으고 반복되는 헤더를 제거한다. 장비별 옵션은 보존한다. `sections`에는 섹션별 revision, 내용 갱신 시각, 최근 성공 조회 시각을 제공한다. 저장하지 않으므로 revision은 항상 1이고 두 시각은 이번 조회 시각이다. 최상위 `freshness.lastSuccessfulFetchAt`은 조회 시각, `freshness.expiresAt`은 그 시각에 5분을 더한 ISO 시각이다. 기존 Desktop과의 호환을 위해 이 필드들의 형태를 유지한다.

## 카드 투영

응답 최상위 `card`는 Desktop 카드의 캐릭터 면이 쓰는 역할이다. 형태는 [#716](https://github.com/blahaj94/dfragon/issues/716)의 공유 계약을 따르며 `apps/api/src/characters/card/project.ts`의 순수 함수가 HTTP 없이 만든다. Desktop은 캐릭터 면만 두므로 API는 역할만 정한다(2026-10-26 결정, [Issue #796](https://github.com/blahaj94/dfragon/issues/796)).

- `role`: 기본정보 `jobGrowName`에서 앞의 `眞`을 뺀 이름이 크루세이더, 인챈트리스, 패러메딕, 뮤즈면 `buffer`, 다른 문자열이면 `dealer`, 문자열이 아니면 null이다. Desktop은 이 값으로 점수 계산기를 고른다.
- `score`: 항상 null이다. 장비 점수는 Desktop main이 네이티브 점수 엔진으로 채운다. 서버는 점수를 계산하지 않는다.
- `stats`, `serverRank`, `set`, `oath`는 항상 null이고 `investment`는 항상 빈 배열이다. 카드의 스탯 한 줄, 서버 내 명성 순위, 장비 면, 기타 면에 쓰던 값이다. 이미 배포된 Desktop이 카드 전체를 strict 스키마로 검사하므로, 그 버전이 역할과 점수를 계속 표시하도록 필드만 남긴다. 새 Desktop은 역할만 읽는다.

모험단명으로 저장된 캐릭터를 찾던 `GET /adventures/characters`도 DB에만 있던 기능이라 지웠다. 이 경로는 일반 404다.

## 공용 아이템 상세

조회한 캐릭터 11개 섹션에 공용 상세를 연결한다. 원본 캐릭터 섹션에는 공용 상세를 섞지 않는다. 일반, 버프 장착 장비, 아바타, 엠블렘, 외형 clone, 크리쳐, 아티팩트, 외형 clone, 서약 info, 결정, 버프 아바타, 엠블렘, 외형 clone과 버프 크리쳐의 유효한 itemId가 있는 각 항목에 `itemDetail: { data, fetchedAt, status }`를 추가한다. `itemDetail`은 서버 응답용으로 예약한 필드다. ID가 없는 빈 슬롯, null, 빈 배열, 선택 옵션과 원본 배열 순서는 유지한다. 외형 clone의 상세를 장착 효과로 합산하지 않는다.

공용 상세도 요청마다 조회하며 저장하지 않는다. `fresh`는 이번 요청에서 조회한 값, `unavailable`은 조회 실패나 처리 예산 종료로 data와 fetchedAt이 null인 상태다. 공용 조회 실패는 성공한 캐릭터 응답을 실패로 바꾸지 않는다. 클라이언트 연결 종료와 서버 종료는 전체 요청을 취소한다.

아이템 다중 조회는 최대 15개를 ID로 대응하고, 없는 항목이나 중복 응답 항목은 unavailable로 둔다. 스킬과 세트의 공용 상세는 조회하지 않으며 아이템 상세의 setItemId로 후속 조회하지 않는다.

공용 아이템 참조는 요청마다 중복 제거 후 최대 128개를 처리하며 필요한 호출을 동시 실행 제한 없이 모두 동시에 시작한다([호출 제한 결정](character-search.md#공개-검색과-호출-제한)). 초과 참조는 unavailable로 전달하며 캐릭터 원본은 유지한다. 추가 처리 전체에 하나의 10초 취소 신호, 개별 upstream에 5초 제한을 적용한다. 자동 재시도와 요청 간 단일 실행 보장은 없다.

장비 슬롯 수, 세트 개수, 마법부여의 직업별 스킬 증가, 숫자, 문자열 능력치, 스킬 필드 누락, 체인의 null과 배열 순서를 보존한다. 공용 tune 등의 값으로 캐릭터 장착 값을 덮어쓰지 않는다. 공용 상세는 실제 적용 능력치 계산 결과나 마법부여 평가가 아니다.

## 오류, 호출 제한

상세 GET에는 클라이언트별 호출 제한과 서버 전체 Neople 호출 예산이 없다. 결정과 위험은 [공개 검색과 호출 제한](character-search.md#공개-검색과-호출-제한)에 있다. 저장하지 않으므로 상세 요청마다 Neople 11회와 공용 아이템 참조를 15개씩 묶은 호출을 소비한다. 연결 해제, 종료 신호를 확인해 취소된 요청의 후속 처리를 중단한다.

오류 body는 `error.code`, `error.message`만 가진다. 입력 400 `INVALID_CHARACTER_QUERY`, 내부 오류 500 `INTERNAL_SERVER_ERROR`, 공급자 오류 502 `NEOPLE_API_ERROR`, 이용 불가 503 `NEOPLE_UNAVAILABLE`, Neople 제한 시간 504 `NEOPLE_TIMEOUT`이다. 공급자 code 분류는 기존 검색과 같고 상세 조회용 고정 문구로 반환한다. 키, 공급자 원문 오류, 요청 원문을 로그나 응답에 포함하지 않는다.
