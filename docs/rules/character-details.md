---
type: rule
status: active
scope: apps/api character details
last-reviewed: 2026-10-19
---

# 캐릭터 상세 정보

사용자가 검색 결과에서 선택한 캐릭터는 PostgreSQL의 최신 저장값을 먼저 확인한다. 최초 접근, 만료, 명시 갱신 때는 Neople 조회 → PostgreSQL 저장 → 저장값 재조회 → JSON 정제 순서로 제공한다. 이 계약과 구현은 같은 PR의 사용자 merge로 채택한다. 기존 `GET /characters` 검색의 무저장 계약은 유지한다.

## 조회와 응답

`GET /characters/:serverId/:characterId`는 로그인 없이 제공한다. 서버는 지원하는 단일 서버 ID이며 `all`은 받지 않는다. 캐릭터 ID는 대소문자를 보존하는 1~256자의 ASCII 영숫자, `_`, `-`다. Query parameter와 HEAD는 400이다. `POST /characters/:serverId/:characterId/refresh`는 같은 식별자 규칙으로 로그인 없이 명시 갱신한다. 이 POST는 query와 body를 받지 않으며, 길이가 0이 아닌 Content-Length 또는 Transfer-Encoding이 있으면 400이다.

조회 대상은 기본정보, 능력치, 장착장비, 아바타, 크리쳐, 서약, 안개융화, 스킬스타일, 버프 강화 장비, 아바타, 크리쳐의 11개다. 타임라인, 과거 이력, 통계 집계와 Electron 상세 화면은 이 범위에 포함하지 않는다.

GET은 DB의 11개 섹션이 모두 있고 가장 오래된 `last_successful_fetch_at`부터 5분이 지나지 않았으면 저장값을 반환한다. 동일 DB snapshot에서 캐릭터의 서버와 섹션을 읽고 DB 현재 시각으로 판단하며, 가장 오래된 조회 시각이 미래이면 유효한 캐시로 취급하지 않는다. 만료 시각에 도달했거나 섹션이 빠졌으면 전체를 갱신한다. 캐시 적중은 캐릭터 행, 섹션, 시각을 갱신하지 않는다. 명시 갱신 POST는 이 5분 판정을 건너뛰되, 같은 캐릭터의 마지막 성공 조회부터 30초 동안은 기존 정제 429와 남은 초의 `Retry-After`로 거절한다. 기존 column과 DB 시각을 사용하며 다른 IP에서도 같은 cooldown을 적용한다. 겹친 갱신의 대기자는 기존 공유 작업에 합류한다. 공용 상세의 24시간 캐시 정책은 유지한다. 자동 주기 수집은 하지 않는다. 이 보안 수정 요청의 구현, 검증과 같은 PR에서 채택하고 사용자 merge 후 다른 작업에도 적용한다.

같은 프로세스에서 동일 서버, 캐릭터의 갱신이 겹치면 Neople 조회와 캐릭터 저장을 공유한다. 각 HTTP 요청의 공용 상세 연결은 개별 처리한다. 대기자 하나의 연결 종료는 다른 대기자의 갱신을 취소하지 않으며, 마지막 대기자가 사라지면 공유 작업도 취소한다. 서버 종료는 모든 공유 작업을 취소하고 정리를 기다린다. 여러 인스턴스 사이의 실행 공유는 보장하지 않는다. 갱신 중에도 유효한 저장값이 있으면 일반 GET은 그 값을 반환할 수 있다.

기본정보로 식별을 확인한 뒤 나머지 10개 섹션을 한 번에 병렬 조회한다. 2026-10-20 [#778](https://github.com/blahaj94/dfragon/issues/778)의 사용자 결정으로 3개씩 나눠 조회하던 제한을 없앴으며, 같은 PR에서 채택하고 사용자 merge 후 적용한다. 전체 Neople 조회, body 수신, 검증에 하나의 5초 제한을 적용하고 자동 재시도하지 않는다. 요청된 캐릭터, 서버와 공통 이름, 섹션의 필수 envelope를 검사한다. 시즌별 중첩 옵션은 엄격한 고정 schema로 제한하지 않으며 미장착을 나타내는 null과 알 수 없는 추가 필드를 원본에 보존한다.

11개가 모두 성공해야 한 transaction으로 저장한다. 하나라도 실패하면 기존 저장값을 유지하고 오류를 반환한다. 실패 때 이전 값을 성공 응답처럼 돌려주거나 부분 갱신하지 않는다. DB 저장, commit이 성공한 뒤 저장값을 정제해 응답한다. 여러 upstream 호출이 게임 서버의 같은 순간을 나타낸다고 보장하지는 않는다.

응답은 `character`, `status`, `equipment`, `avatar`, `creature`, `oath`, `mistAssimilation`, `skillStyle`, `buff`, `sections`, `setDetails`, `freshness`, `card`다. 공통 신상 정보는 `character`로 모으고 반복되는 헤더를 제거한다. 장비별 옵션은 보존한다. `sections`에는 섹션별 revision, 내용 갱신 시각, 최근 성공 조회 시각을 제공한다. 최상위 `freshness.lastSuccessfulFetchAt`은 11개 섹션 중 가장 오래된 성공 조회 시각이고 `freshness.expiresAt`은 그 시각에 5분을 더한 ISO 시각이다. 내용이 같아 revision이 유지되어도 성공 갱신 때 freshness는 바뀐다. 이 시각은 공용 상세의 개별 만료 시각과 구분한다.

## 카드 투영

응답 최상위 `card`는 저장된 섹션을 Desktop 카드의 세 면(캐릭터, 장비, 기타)에 맞춰 정규화한 값이다. 형태는 Desktop `SelectedCharacterSummary.card`와 같은 공유 계약이며 [#716](https://github.com/blahaj94/dfragon/issues/716)의 공유 계약을 따른다. 기존 응답 필드는 바꾸지 않는다. `apps/api/src/characters/card/project.ts`의 순수 함수가 DB, HTTP 없이 만들며 캐시 적중과 갱신 응답에 모두 붙인다. 모르는 값은 null이고 0이나 빈 값으로 바꾸지 않는다. Desktop이 strict 스키마로 검증하므로 빈 문자열과 유한하지 않은 숫자도 null로 둔다. 이미지 URL은 넣지 않고 Desktop renderer가 itemId로 만든다.

- `role`: 기본정보 `jobGrowName`에서 앞의 `眞`을 뺀 이름이 크루세이더, 인챈트리스, 패러메딕, 뮤즈면 `buffer`, 다른 문자열이면 `dealer`, 문자열이 아니면 null이다. Desktop은 이 값으로 점수 계산기를 고른다.
- `stats`: 능력치 `status`의 마을 값이다. 딜러는 공격력 증가, 공격력 증폭, 물리와 마법 크리티컬 중 큰 값이다. 버퍼는 직업의 주 스탯 이름(`townStatName`)과 값(`townStat`)이며, 뮤즈와 패러메딕은 정신력, 남자 크루세이더(직업 `프리스트(남)`)는 정신력과 체력 중 큰 쪽(같거나 체력을 모르면 정신력), 여자 크루세이더와 인챈트리스는 지능이다(2026-10-20 사용자 결정, 구현 PR의 사용자 merge 후 적용). 이전 `townIntelligence`를 바꾼 필드라 이전 Desktop은 새 API의 버퍼 카드를 받지 못한다. 직업의 공격 유형을 API가 알지 못하므로 크리티컬은 항상 둘 중 큰 값이다. 숫자와 `48.3%` 같은 숫자 문자열을 받고 그 밖의 값은 null이다. 역할이 null이면 `stats`도 null이다.
- Desktop main이 채우는 값: `stats`의 `buff30`, `buff50`과 `score`는 네이티브 점수 엔진으로, `switchingLevel`은 상세 응답의 버프 강화 장비(`skill/buff/equip/equipment`) 스위칭 스킬 레벨(`skillInfo.option.level`, 스위칭 장비를 입었을 때 장비 옵션까지 더한 레벨)로 채우며 API 응답에서는 항상 null이다(스위칭 2026-10-20 사용자 결정, 구현 PR의 사용자 merge 후 적용). 서버는 점수를 계산하지 않는다.
- `set`: 장비 `setItemInfo` 중 `slotInfo`가 가장 많은 항목이며 같으면 앞의 것이다. `setItemId`나 이름이 없는 항목은 후보에서 뺀다. `active.setPoint`의 current, min, max가 모두 숫자일 때만 `point`를 둔다. `imageItemId`는 같은 `setItemId`를 가진 장착 아이템 중 첫 번째다.
- `oath`: 서약 `info`에 itemId와 이름이 있을 때만 만든다. `setInfo`의 세트 이름, 옵션 이름, 세트 포인트와 결정(`crystal`) 목록을 담는다. 묵언의 진의는 `oathUpgrade.options`의 목록 위치를 단계 번호로 쓰며 `oathUpgrade`가 null이면 빈 목록이다.
- 희귀도 개수: 세트는 `slotInfo`, 서약은 결정의 희귀도를 처음 나온 순서로 센다. 희귀도가 없는 항목은 세지 않는다.
- `investment`: 무기, 상의, 머리어깨, 하의, 벨트, 신발, 목걸이, 팔찌, 반지, 보조장비, 마법석, 귀걸이의 12부위 고정 순서이며 칭호는 넣지 않는다. 빈 슬롯은 아이템 필드가 null이다. `reinforce`가 숫자일 때 `amplificationName`이 있으면 증폭(`amplify`), 없으면 강화(`reinforce`)다. 마법부여는 `status` 옵션만 담고 `reinforceSkill`만 있는 마법부여는 빈 목록이다.

### 마법부여 등급

`apps/api/src/characters/card/enchant-grades.json`의 부위별 종결, 준종결, 기타 항목과 장착 마법부여 `status`의 옵션 이름, 값이 순서와 무관하게 모두 같을 때만 그 등급이다. 같은 옵션이 여러 등급에 있으면 종결, 준종결, 기타 순으로 앞의 등급이다. 표에 없거나 옵션이 없으면 null(미평가)이며 기타로 바꾸지 않는다. 표의 형식이 틀리면 API가 시작하지 않는다. 표의 내용은 담당자가 정한 퍼스트서버 신규 카드 글 기준의 부위별 종결, 준종결 항목이며 규칙, 다시 만드는 절차, 항목별 근거, 같은 옵션을 주는 카드와 정할 것은 [마법부여 등급표](../reference/enchant-grades.md)에 있다. 표에 기타 항목은 두지 않는다.

### 명성 순위

`serverRank`는 우리 DB에 수집된 모든 서버 캐릭터 기준의 명성 순위다. 던전앤파이터는 서버가 나뉘어 있어도 통합 서버이므로 서버를 나누지 않는다. 필드 이름은 Desktop과의 공유 계약대로 `serverRank`를 유지한다. 전체 유저 순위가 아니므로 `scope: "stored"`, `basis: "fame"`을 붙인다. 순위는 명성이 더 큰 캐릭터 수에 1을 더한 값이며 동점은 같은 순위다. `total`은 명성이 있는 캐릭터 수이고 `observedAt`은 순위를 센 DB 시각이다. 대상 캐릭터의 명성이 null이면 `serverRank`는 null이다. 두 개수와 대상 명성은 한 statement에서 센다. 다른 캐릭터의 명성은 각자 마지막으로 갱신된 값이므로 순위는 관측 시점이 서로 다른 값을 비교한다.

순위는 상세 저장값을 확정한 뒤 별도 READ COMMITTED transaction에서 2초 statement 제한으로 센다. 제한 초과나 DB 실패는 `serverRank`만 null로 두고 카드와 상세 응답은 실패시키지 않는다. 연결 종료와 서버 종료는 기존처럼 요청 전체를 중단한다. 이 투영과 순위 계약은 같은 PR의 사용자 merge로 채택하며, 같은 서버로 순위를 세던 #716의 초안은 2026-10-19 담당자 결정으로 모든 서버 기준으로 바꿨다.

## 모험단명 검색

`GET /adventures/characters?adventureName=...`는 로그인 없이 우리 DB에 저장된 캐릭터를 모험단명으로 검색한다. 서버 구분 없이 이름을 정확히 비교하며 부분 일치, 대소문자 변환, Unicode 정규화, 공백 제거를 하지 않는다. Neople 호출, 미수집 캐릭터 발견, 검색 시 갱신은 하지 않는다. 전체 보유 캐릭터가 아니라 마지막으로 관측된 소속 목록이라는 범위를 응답의 `scope: "stored"`로 명시한다. 결과가 없으면 200과 빈 `rows`를 반환한다.

Query는 `adventureName`, 선택 `limit`, 선택 `after`만 허용하며 중복, 잘못된 percent encoding, 알 수 없는 key와 HEAD는 400이다. 모험단명은 1~~100 Unicode 코드 포인트이며 공백만 있는 값과 제어 문자는 거절한다. 이 길이는 서버 입력 상한이며 게임의 이름 생성 규칙을 정의하지 않는다. `limit`은 기본 100, 1~~100의 십진 정수다. `after`는 응답의 `nextAfter`로 받은 characterId이며 기존 ID 문자, 길이 규칙을 따른다.

응답은 `adventureName`, `scope`, `rows`, `nextAfter`다. 각 행은 캐릭터, 서버 ID, 서버명, 캐릭터명, 레벨, 직업, 전직명, 명성과 기본정보의 `lastSuccessfulFetchAt`을 담는다. 공급자의 표시 값이 기대한 문자열, 숫자가 아니면 null로 반환하며 JSONB 원본은 보존한다. characterId 오름차순으로 조회하고 다음 페이지에는 같은 모험단명과 `nextAfter`를 `after`로 전달한다. 마지막 페이지의 `nextAfter`는 null이다. 페이지 사이의 캐릭터 갱신에 대한 고정 snapshot은 제공하지 않는다.

이 검색에는 클라이언트별 호출 제한이 없다. 2026-10-20 [#778](https://github.com/blahaj94/dfragon/issues/778)의 사용자 결정으로 이전의 IP당 최근 60초 10회 한도를 없앴으며, 같은 PR에서 채택하고 사용자 merge 후 적용한다. IP별 남용 차단은 앞단 proxy가 맡는 방향이다. 이 검색은 Neople을 부르지 않으므로 반복 요청의 부담은 DB 연결 풀이 받는다. DB 풀 연결 확보, statement에는 기존 2초 제한을 사용한다. 연결 종료, 서버 종료 시 후속 처리를 중단한다. 오류는 기존 캐릭터 오류 형식의 400 `INVALID_CHARACTER_QUERY`, 500 `INTERNAL_SERVER_ERROR`이며 DB 오류 원문은 반환하지 않는다.

## 공용 아이템, 스킬, 세트 상세

DB에서 읽은 캐릭터 11개 섹션에 공용 상세를 연결한다. 캐릭터 갱신 때는 저장과 commit 후 연결하며, GET 캐시 적중 때도 필요한 공용 상세를 확인한다. 원본 캐릭터 JSONB에는 공용 상세를 섞지 않는다. 일반, 버프 장착 장비, 아바타, 엠블렘, 외형 clone, 크리쳐, 아티팩트, 외형 clone, 서약 info, 결정, 버프 아바타, 엠블렘, 외형 clone과 버프 크리쳐의 유효한 itemId가 있는 각 항목에 `itemDetail: { data, fetchedAt, status }`를 추가한다. `skillStyle` 객체에는 `skillDetails`를 추가하고 캐릭터 기본정보의 `jobId`와 습득, 진화, 강화, 체인, 버프 스킬 ID로 상세를 연결한다. `skillDetails`는 skillId를 key로 사용하는 객체이며 같은 상세를 여러 선택 항목에 복제하지 않는다. `itemDetail`과 `skillDetails`는 서버 응답용으로 예약한 필드다. ID가 없는 빈 슬롯, null, 빈 배열, 선택 옵션과 원본 배열 순서는 유지한다. 외형 clone의 상세를 장착 효과로 합산하지 않는다.

아이템은 `item_catalog.item_id`, 스킬은 `skill_catalog(job_id, skill_id)`, 세트는 `set_item_catalog.set_item_id`를 PK로 사용한다. 상세 원본 JSONB와 `fetched_at`, `expires_at`, `request_started_at`을 저장한다. 캐릭터와의 FK나 사용률 집계, 평가 테이블은 만들지 않는다.

응답 최상위 `setDetails`는 setItemId를 key로 사용하는 공용 상세 객체이며 참조가 없으면 빈 객체다. 장비 setItemInfo와 확인된 장착 아이템의 setItemId, DB에 저장 후 재조회한 아이템 상세의 setItemId를 연결한다. 세트의 구성품 전체를 재귀 조회하지 않는다. 이 사전은 적용 중인 세트 목록이 아니며 외형 참조의 세트도 포함할 수 있다. 현재 적용 효과는 캐릭터 원본의 active를 유지한다. 서약 setInfo의 숫자 setId는 일반 setItemId와 구분하고 세트 상세 API에 전달하지 않는다.

성공적으로 저장한 상세는 24시간 유효하다. 최초 접근, 만료 시 요청 안에서 갱신하며 자동 주기 수집은 하지 않는다. `fresh`는 유효한 저장값, `stale`은 갱신 실패 또는 처리 예산 종료로 이전 저장값 사용, `unavailable`은 반환할 저장값이 없어 data와 fetchedAt이 null인 상태다. 공용 조회, 저장 실패는 성공한 캐릭터 응답을 실패로 바꾸지 않으며, 저장하지 못한 upstream 원문을 성공값처럼 반환하지 않는다. 공용 DB 읽기 자체가 실패한 경우에도 unavailable이다. 클라이언트 연결 종료와 서버 종료는 전체 요청을 취소한다.

공용 상세에서도 DB 시각의 요청 시작 순서를 비교해 늦게 끝난 이전 요청의 덮어쓰기를 막는다. 실패는 이전 payload, 조회 시각을 변경하지 않는다. 아이템, 세트 다중 조회는 각각 최대 15개를 ID로 대응하고, 없는 항목이나 중복 응답 항목은 저장하지 않는다. 스킬 상세는 응답에 skillId가 없을 수 있어 단일 조회의 요청 jobId, skillId로 대응한다. jobId 및 제공된 skillId가 다르면 저장하지 않는다.

공용 참조는 최초 아이템, 스킬, 세트와 아이템 상세에서 후속 발견한 세트를 합쳐 요청마다 중복 제거 후 최대 128개를 처리하며 필요한 호출을 모두 동시에 시작한다. 2026-10-20 [#778](https://github.com/blahaj94/dfragon/issues/778)의 사용자 결정으로 최대 3개 호출만 동시에 실행하던 제한을 없앴으며, 같은 PR에서 채택하고 사용자 merge 후 적용한다. 초과 참조는 unavailable로 전달하며 캐릭터 원본은 유지한다. 후속 세트 조회까지 추가 처리 전체에 하나의 10초 취소 신호, 개별 upstream에 5초 제한을 적용한다. DB 연결 풀 대기, statement, lock에는 기존 2초 제한을 사용하므로 DB 정리까지 포함한 HTTP 전체 시간이 정확히 10초 이내라는 보장은 아니다. 자동 재시도와 요청 간 단일 실행 보장은 없으며 여러 요청/인스턴스가 같은 만료 항목을 동시에 조회할 수 있다.

장비 슬롯 수, 세트 개수, 마법부여의 직업별 스킬 증가, 숫자, 문자열 능력치, 스킬 필드 누락, 체인의 null과 배열 순서를 보존한다. 공용 tune 등의 값으로 캐릭터 장착 값을 덮어쓰지 않는다. 공용 상세는 실제 적용 능력치 계산 결과나 마법부여 평가가 아니다. 패치 후 무효화는 [DB 개발 안내](../reference/database-development.md#공용-상세-캐시)의 제품 동작을 따른다.

## 저장과 중복 처리

`characters.character_id`만 PK로 둔다. `server_id`는 일반 column이다. 같은 ID가 기존과 다른 서버로 들어오면 현재는 실패 처리한다. 공급자가 전 서버 ID 고유성이나 서버 이동을 명시적으로 보장하지 않는 상황에서 서로 다른 데이터를 조용히 합치지 않는다.

`characters.adventure_name`은 기본정보의 모험단명을 검색하기 위한 nullable text column이다. 이름은 변경될 수 있고 여러 캐릭터가 공유하므로 PK, UNIQUE, 계정 식별자로 사용하지 않는다. 비고유 B-tree `(adventure_name, character_id)` index로 이름 일치 검색과 페이지 순서를 지원한다. 별도 모험단 테이블, 소유권 인증, 우리 서비스 회원과의 연결은 추가하지 않는다.

Migration은 기존 `basic` JSONB의 문자열 `adventureName`을 채우며 누락, null, 빈 문자열, 문자열 이외 값은 null로 둔다. 원본 JSONB와 기존 내용, 조회 시각은 변경하지 않는다. 이후 성공 갱신 transaction에서 요청 순서 경쟁을 이긴 저장된 기본정보를 기준으로 column을 동기화한다. 이름이 실제로 달라질 때만 characters.updated_at을 갱신한다. 이전 요청의 원문으로 모험단명이 되돌아가거나 실패한 갱신이 소속만 변경되면 안 된다.

`characters.fame`은 서버를 나누지 않는 전체 명성 순위를 위한 nullable integer column이다. 기본정보 JSONB의 `fame`이 0 이상 2147483647 이하의 정수일 때만 채우며 누락, null, 소수, 범위 밖, 숫자 이외 값은 null이다. Migration이 기존 기본정보로 채우고, 이후 성공 갱신 transaction에서 요청 순서 경쟁을 이긴 기본정보로 모험단명과 함께 동기화한다. 모험단명이나 명성이 실제로 달라질 때만 characters.updated_at을 갱신한다. 던전앤파이터는 서버가 나뉘어 있어도 통합 서버이므로 순위는 모든 서버의 캐릭터를 함께 비교하며, 비고유 B-tree `(fame DESC, character_id)` index로 명성 비교를 지원한다. TypeORM EntitySchema가 DESC 정렬을 표현하지 못하므로 schema는 이 index의 synchronize를 끄고 migration이 정의를 소유한다.

이름 변경은 갱신된 캐릭터에만 반영한다. 다른 캐릭터는 각자 갱신될 때까지 이전 이름으로 검색될 수 있다. 고유 모험단 ID를 제공받지 않은 상태에서 동일 이름의 과거, 현재 사용자를 같은 계정으로 추정하거나 다른 캐릭터의 이름을 일괄 변경하지 않는다.

`character_api_responses`는 `(character_id, section)`당 최신 응답 JSONB 하나만 저장한다. Section은 PostgreSQL enum이며 endpoint별 저장 단위다. JSONB에 객체 key 순서는 보존되지 않지만 필드, 값과 배열 순서는 유지된다. 원본 문자열, 해시, 중복 응답, 이력은 저장하지 않는다.

PostgreSQL의 JSONB 비교에서 같으면 payload, revision, content_updated_at을 유지하고 last_successful_fetch_at만 갱신한다. 다르면 payload를 교체하고 revision을 1 올린다. 최초 revision은 1이다. Neople 갱신 결과가 동일해도 freshness 갱신을 위한 row 쓰기는 발생한다. 유효한 저장값을 반환하는 GET에는 이 쓰기가 없다.

조회 시작 직전에 DB 시각을 마이크로초 정밀도로 받아 request_started_at에 기록한다. 캐릭터 행 잠금과 섹션의 시각 조건으로 늦게 완료된 이전 요청이 새 값을 덮어쓰지 못하게 한다. 동일 시각은 먼저 저장한 값을 유지한다. 이 순서는 DB clock을 기준으로 하며 공급자 자체 버전이나 clock 역행을 해결하는 분산 버전은 아니다. 이전 요청도 최종 저장값을 다시 읽어 반환한다.

통계용 정규화 테이블이나 별도 이력 테이블은 실제 필요에 맞춰 후속으로 추가한다. 현재 JSONB 전체에 GIN index를 추가하지 않는다. 마법부여 사용률 같은 통계의 분모는 향후 수집 범위와 집계 계약에서 정한다.

## 오류, 호출 제한

상세 GET과 명시 갱신 POST에는 클라이언트별 호출 제한이 없다. 2026-10-20 [#774](https://github.com/blahaj94/dfragon/issues/774)의 사용자 결정으로 이전의 클라이언트별 최근 60초 10회 한도를 없앴으며, 같은 PR에서 채택하고 사용자 merge 후 적용한다. 캐릭터 갱신은 최대 11회의 Neople 호출을 소비하며 공용 상세 캐시 미스 시 추가 호출이 발생한다. 2026-10-20 [#778](https://github.com/blahaj94/dfragon/issues/778)의 사용자 결정으로 검색과 공유하던 프로세스 전체 최근 60초 600회, 동시 12회 Neople 예산도 없앴으며, 같은 PR에서 채택하고 사용자 merge 후 적용한다. Neople API key의 공식 할당량을 넘으면 key가 막혀 검색과 상세가 모두 공급자 오류로 실패할 수 있다. 같은 캐릭터의 명시 갱신 30초 cooldown은 유지한다.

갱신 시작 DB 시각 확보에는 취소 가능한 2초 제한을 적용하고 DB 풀 연결 확보는 2초로 제한한다. 읽기 transaction의 statement와 저장 transaction의 statement, lock 대기는 각각 2초다. 연결 해제, 종료 신호를 확인해 취소된 요청의 후속 쓰기를 중단한다.

오류 body는 `error.code`, `error.message`만 가진다. 입력 400 `INVALID_CHARACTER_QUERY`, 명시 갱신 cooldown 429 `CHARACTER_RATE_LIMITED`와 `Retry-After`, 내부/DB 오류 500 `INTERNAL_SERVER_ERROR`, 공급자 오류 502 `NEOPLE_API_ERROR`, 이용 불가 503 `NEOPLE_UNAVAILABLE`, Neople 제한 시간 504 `NEOPLE_TIMEOUT`이다. 공급자 code 분류는 기존 검색과 같고 상세 조회용 고정 문구로 반환한다. 키, 공급자 원문 오류, SQL, 요청 원문을 로그나 응답에 포함하지 않는다.

## DB 변경과 검증

TypeORM EntitySchema를 기준으로 migration을 생성, 검토하고 명시 실행한다. Runtime의 synchronize, 자동 migration은 꺼 둔다. 기존 인증 테이블과 데이터를 변경하지 않으며 운영 API 계정에는 캐릭터 두 테이블의 DML과 공용 상세 세 테이블의 SELECT, INSERT, UPDATE 권한을 별도로 적용한다. `down`은 캐릭터 데이터를 삭제하므로 격리 검증용이며 운영에서 자동 실행하지 않는다.

ERD는 [DBML](../reference/character-details.dbml), 작성, 검증 명령은 [DB 개발 안내](../reference/database-development.md)를 따른다. 5분 캐시와 명시 갱신은 기존 column을 사용하므로 별도 migration이나 권한 변경이 필요하지 않다. `characters.fame`은 migration을 추가하지만 기존 테이블 단위 권한으로 읽고 쓰므로 운영 API 계정의 권한 변경이 필요하지 않다. `test:database`는 캐시 적중, 만료, 명시 갱신, 실패 시 보존, freshness, 공유 한도와 JSONB 동등성, revision, 원자적 rollback, 경합, 이전 요청, HTTP 정제, 한도, 연결 대기 종료, 명성 column의 backfill과 rollback, 갱신 동기화, 순위의 동점, null, 2초 제한을 실제 PostgreSQL에서 확인한다. 실제 Neople, 운영 DB 실행 결과는 해당 배포 기록에서 별도로 구분한다.
