---
type: rule
status: active
scope: apps/api character details
last-reviewed: 2026-09-16
---

# 캐릭터 상세 정보

사용자가 검색 결과에서 선택한 캐릭터는 Neople 조회 → PostgreSQL 저장 → 저장값 재조회 → JSON 정제 순서로 제공한다. 이 계약과 구현은 같은 PR의 사용자 merge로 채택한다. 기존 `GET /characters` 검색의 무저장 계약은 유지한다.

## 조회와 응답

`GET /characters/:serverId/:characterId`는 로그인 없이 제공한다. 서버는 지원하는 단일 서버 ID이며 `all`은 받지 않는다. 캐릭터 ID는 대소문자를 보존하는 1~256자의 ASCII 영숫자·`_`·`-`다. Query parameter와 HEAD는 400이다.

조회 대상은 기본정보, 능력치, 장착장비·아바타·크리쳐·서약, 안개융화, 스킬스타일, 버프 강화 장비·아바타·크리쳐의 11개다. 타임라인·과거 이력·통계 집계와 Electron 상세 화면은 이 범위에 포함하지 않는다.

기본정보로 식별을 확인한 뒤 나머지는 최대 3개씩 병렬 조회한다. 전체 Neople 조회·body 수신·검증에 하나의 5초 제한을 적용하고 자동 재시도하지 않는다. 요청된 캐릭터·서버와 공통 이름, 섹션의 필수 envelope를 검사한다. 시즌별 중첩 옵션은 엄격한 고정 schema로 제한하지 않으며 미장착을 나타내는 null과 알 수 없는 추가 필드를 원본에 보존한다.

11개가 모두 성공해야 한 transaction으로 저장한다. 하나라도 실패하면 기존 저장값을 유지하고 오류를 반환한다. 실패 때 이전 값을 성공 응답처럼 돌려주거나 부분 갱신하지 않는다. DB 저장·commit이 성공한 뒤 저장값을 정제해 응답한다. 여러 upstream 호출이 게임 서버의 같은 순간을 나타낸다고 보장하지는 않는다.

응답은 `character`, `status`, `equipment`, `avatar`, `creature`, `oath`, `mistAssimilation`, `skillStyle`, `buff`, `sections`, `setDetails`다. 공통 신상 정보는 `character`로 모으고 반복되는 헤더를 제거한다. 장비별 옵션은 보존한다. `sections`에는 섹션별 revision, 내용 갱신 시각, 최근 성공 조회 시각을 제공한다.

## 공용 아이템·스킬·세트 상세

캐릭터 11개 섹션의 저장과 commit 후 공용 상세를 연결한다. 원본 캐릭터 JSONB에는 공용 상세를 섞지 않는다. 일반·버프 장착 장비, 아바타·엠블렘·외형 clone, 크리쳐·아티팩트·외형 clone, 서약 info·결정, 버프 아바타·엠블렘·외형 clone과 버프 크리쳐의 유효한 itemId가 있는 각 항목에 `itemDetail: { data, fetchedAt, status }`를 추가한다. `skillStyle` 객체에는 `skillDetails`를 추가하고 캐릭터 기본정보의 `jobId`와 습득·진화·강화·체인·버프 스킬 ID로 상세를 연결한다. `skillDetails`는 skillId를 key로 사용하는 객체이며 같은 상세를 여러 선택 항목에 복제하지 않는다. `itemDetail`과 `skillDetails`는 서버 응답용으로 예약한 필드다. ID가 없는 빈 슬롯, null·빈 배열, 선택 옵션과 원본 배열 순서는 유지한다. 외형 clone의 상세를 장착 효과로 합산하지 않는다.

아이템은 `item_catalog.item_id`, 스킬은 `skill_catalog(job_id, skill_id)`, 세트는 `set_item_catalog.set_item_id`를 PK로 사용한다. 상세 원본 JSONB와 `fetched_at`, `expires_at`, `request_started_at`을 저장한다. 캐릭터와의 FK나 사용률 집계·평가 테이블은 만들지 않는다.

응답 최상위 `setDetails`는 setItemId를 key로 사용하는 공용 상세 객체이며 참조가 없으면 빈 객체다. 장비 setItemInfo와 확인된 장착 아이템의 setItemId, DB에 저장 후 재조회한 아이템 상세의 setItemId를 연결한다. 세트의 구성품 전체를 재귀 조회하지 않는다. 이 사전은 적용 중인 세트 목록이 아니며 외형 참조의 세트도 포함할 수 있다. 현재 적용 효과는 캐릭터 원본의 active를 유지한다. 서약 setInfo의 숫자 setId는 일반 setItemId와 구분하고 세트 상세 API에 전달하지 않는다.

성공적으로 저장한 상세는 24시간 유효하다. 최초 접근·만료 시 요청 안에서 갱신하며 자동 주기 수집은 하지 않는다. `fresh`는 유효한 저장값, `stale`은 갱신 실패 또는 처리 예산 종료로 이전 저장값 사용, `unavailable`은 반환할 저장값이 없어 data와 fetchedAt이 null인 상태다. 공용 조회·저장 실패는 성공한 캐릭터 응답을 실패로 바꾸지 않으며, 저장하지 못한 upstream 원문을 성공값처럼 반환하지 않는다. 공용 DB 읽기 자체가 실패한 경우에도 unavailable이다. 클라이언트 연결 종료와 서버 종료는 전체 요청을 취소한다.

공용 상세에서도 DB 시각의 요청 시작 순서를 비교해 늦게 끝난 이전 요청의 덮어쓰기를 막는다. 실패는 이전 payload·조회 시각을 변경하지 않는다. 아이템·세트 다중 조회는 각각 최대 15개를 ID로 대응하고, 없는 항목이나 중복 응답 항목은 저장하지 않는다. 스킬 상세는 응답에 skillId가 없을 수 있어 단일 조회의 요청 jobId·skillId로 대응한다. jobId 및 제공된 skillId가 다르면 저장하지 않는다.

공용 참조는 최초 아이템·스킬·세트와 아이템 상세에서 후속 발견한 세트를 합쳐 요청마다 중복 제거 후 최대 128개를 처리하고 최대 3개 호출을 동시에 실행한다. 초과 참조는 unavailable로 전달하며 캐릭터 원본은 유지한다. 후속 세트 조회까지 추가 처리 전체에 하나의 10초 취소 신호, 개별 upstream에 5초 제한을 적용한다. DB 연결 풀 대기·statement·lock에는 기존 2초 제한을 사용하므로 DB 정리까지 포함한 HTTP 전체 시간이 정확히 10초 이내라는 보장은 아니다. 자동 재시도와 요청 간 단일 실행 보장은 없으며 여러 요청/인스턴스가 같은 만료 항목을 동시에 조회할 수 있다.

장비 슬롯 수, 세트 개수, 마법부여의 직업별 스킬 증가, 숫자·문자열 능력치, 스킬 필드 누락, 체인의 null과 배열 순서를 보존한다. 공용 tune 등의 값으로 캐릭터 장착 값을 덮어쓰지 않는다. 공용 상세는 실제 적용 능력치 계산 결과나 마법부여 평가가 아니다. 패치 후 무효화는 [DB 개발 안내](../reference/database-development.md#공용-상세-캐시-운영)의 절차를 따른다.

## 저장과 중복 처리

`characters.character_id`만 PK로 둔다. `server_id`는 일반 column이다. 같은 ID가 기존과 다른 서버로 들어오면 현재는 실패 처리한다. 공급자가 전 서버 ID 고유성이나 서버 이동을 명시적으로 보장하지 않는 상황에서 서로 다른 데이터를 조용히 합치지 않는다.

`character_api_responses`는 `(character_id, section)`당 최신 응답 JSONB 하나만 저장한다. Section은 PostgreSQL enum이며 endpoint별 저장 단위다. JSONB에 객체 key 순서는 보존되지 않지만 필드·값과 배열 순서는 유지된다. 원본 문자열·해시·중복 응답·이력은 저장하지 않는다.

PostgreSQL의 JSONB 비교에서 같으면 payload·revision·content_updated_at을 유지하고 last_successful_fetch_at만 갱신한다. 다르면 payload를 교체하고 revision을 1 올린다. 최초 revision은 1이다. 동일 데이터도 freshness 갱신을 위한 row 쓰기는 발생하며 무쓰기 캐시는 아니다.

조회 시작 직전에 DB 시각을 마이크로초 정밀도로 받아 request_started_at에 기록한다. 캐릭터 행 잠금과 섹션의 시각 조건으로 늦게 완료된 이전 요청이 새 값을 덮어쓰지 못하게 한다. 동일 시각은 먼저 저장한 값을 유지한다. 이 순서는 DB clock을 기준으로 하며 공급자 자체 버전이나 clock 역행을 해결하는 분산 버전은 아니다. 이전 요청도 최종 저장값을 다시 읽어 반환한다.

통계용 정규화 테이블이나 별도 이력 테이블은 실제 필요에 맞춰 후속으로 추가한다. 현재 JSONB 전체에 GIN index를 추가하지 않는다. 마법부여 사용률 같은 통계의 분모는 향후 수집 범위와 집계 계약에서 정한다.

## 오류·호출 제한

상세 조회의 IP당 최근 60초 10회 한도는 검색 한도와 별도로 계산한다. 캐릭터 조회는 최대 11회의 Neople 호출을 소비하며 공용 상세 캐시 미스 시 추가 호출이 발생한다. 단일 프로세스 메모리 한도이며 재시작·여러 인스턴스의 통합 제한은 제공하지 않는다. Proxy 신뢰 경계는 [캐릭터 검색](character-search.md)을 따른다.

입력·설정 확인과 DB 조회 시작 시각 확보 뒤 upstream 호출 직전에 한도를 소비한다. Upstream 실패도 한도를 돌려주지 않는다. Admission 대기는 2초, DB 풀 연결 확보는 2초로 제한한다. 저장 transaction의 statement·lock 대기는 각각 2초다. 연결 해제·종료 신호를 확인해 취소된 요청의 후속 쓰기를 중단한다.

오류 body는 `error.code`, `error.message`만 가진다. 입력 400 `INVALID_CHARACTER_QUERY`, 로컬 한도 429 `CHARACTER_RATE_LIMITED`와 `Retry-After`, 내부/DB 오류 500 `INTERNAL_SERVER_ERROR`, 공급자 오류 502 `NEOPLE_API_ERROR`, 이용 불가 503 `NEOPLE_UNAVAILABLE`, Neople 제한 시간 504 `NEOPLE_TIMEOUT`이다. 공급자 code 분류는 기존 검색과 같고 상세 조회용 고정 문구로 반환한다. 키·공급자 원문 오류·SQL·요청 원문을 로그나 응답에 포함하지 않는다.

## DB 변경과 검증

TypeORM EntitySchema를 기준으로 migration을 생성·검토하고 명시 실행한다. Runtime의 synchronize·자동 migration은 꺼 둔다. 기존 인증 테이블과 데이터를 변경하지 않으며 운영 API 계정에는 캐릭터 두 테이블의 DML과 공용 상세 세 테이블의 SELECT·INSERT·UPDATE 권한을 별도로 적용한다. `down`은 캐릭터 데이터를 삭제하므로 격리 검증용이며 운영에서 자동 실행하지 않는다.

ERD는 [DBML](../reference/character-details.dbml), 작성·검증 명령은 [DB 개발 안내](../reference/database-development.md)를 따른다. `test:database`는 JSONB 동등성·revision·원자적 rollback·경합·이전 요청·HTTP 정제·한도·연결 대기 종료를 실제 PostgreSQL에서 확인한다. 실제 Neople·운영 DB 실행 결과는 해당 배포 기록에서 별도로 구분한다.
