---
type: rule
status: active
enforcement: approval-required
scope: apps/api authentication dependencies and database operations
last-reviewed: 2026-09-15
rationale: 인증의 runtime 호환성, Migration과 DB 실행 조건을 정의한다.
evidence: "PR #48 사용자 승인: https://github.com/blahaj94/ldb/pull/48#issuecomment-5551469519 ; 설계 근거: Issue #39 Proposal Revision 2 https://github.com/blahaj94/ldb/issues/39#issuecomment-5551313691"
exceptions: 문서 변경은 dependency 설치, lockfile 변경이나 DB 실행의 착수 허용이 아니다.
review-after: runtime 호환성 또는 DB 실행 조건 변경 시
---

# Authentication Runtime Contract

이 문서는 [PR #48의 사용자 승인](https://github.com/blahaj94/ldb/pull/48#issuecomment-5551469519)을 반영한 인증 runtime과 DB 실행 계약입니다. [`api-runtime.md`](api-runtime.md)의 Node 24/Nest 12/ESM/TypeScript 5.9 및 tsc→Node 검증 계약을 유지합니다. 정책 승인과 실제 구현, 호환성 검증 및 운영 실행은 구분하며, 후속 작업은 [`change-control.md`](change-control.md)의 사용자 실행 허용 범위를 따릅니다.

## 의존성 기록과 호환성

패키지 목록, 버전과 변경 절차는 [`API runtime의 의존성 관리`](api-runtime.md#의존성-관리)를 따릅니다. 인증 전용의 패키지 허용 목록이나 exact version별 재승인 조건은 두지 않습니다. 이 변경은 [Issue #302](https://github.com/blahaj94/ldb/issues/302)의 사용자 요청을 반영하며, 해당 문서 변경을 포함한 PR의 사용자 merge로 적용합니다.

기존 패키지 선택의 승인 이력은 [PR #48](https://github.com/blahaj94/ldb/pull/48#issuecomment-5551469519)과 [`@types/pg` 선택 PR #118](https://github.com/blahaj94/ldb/pull/118#issuecomment-5570381432)에 보존합니다. 실제 변경에서는 engine과 peer 조건, compiled ESM 및 TypeScript 호환성과 영향받는 인증·DB 동작을 검증합니다. 패키지 선택만으로 검증 성공을 주장하지 않습니다.

로컬 DB는 기존 Docker-only 조건을 유지합니다. PostgreSQL server, image와 local validation의 선택 및 승인 상태는 아래 구간을 따릅니다.

## PostgreSQL 선택과 Docker 검증

| 상태 항목 | 현재 값 |
| --- | --- |
| 선택 상태 | **승인됨** |
| 선택 승인 evidence | [PR #50 사용자 승인](https://github.com/blahaj94/ldb/pull/50#issuecomment-5552245712) (2026-09-05T13:48:26Z) |

이 표와 다음 digest·version은 최초 선택의 승인 이력이다. 현재 실행 값은 검증 도구에서 확인하고 변경은 아래 이미지 갱신 기준을 따른다. 선택 이력 자체를 실제 호환성·운영 검증 성공으로 표시하지 않는다.

### 선택과 근거

2026-09-05 확인 기준 PostgreSQL 18의 current minor는 18.6이고 2030-11-14까지 지원된다. PostgreSQL은 지원 major의 current minor 사용을 권고한다. 기존 schema가 쓰는 constraint, `COLLATE "C"`, partial unique index, `INSERT ... ON CONFLICT`, row lock은 PostgreSQL 18 공식 문서에 있는 기능이다. 따라서 server major 18과 아래 Docker Official Image를 후속 local integration 기준으로 제안한다. 이 문서 검토는 `pg 8.23.0`·`typeorm 1.1.1`의 실제 ESM 연결 성공 evidence가 아니며 그 확인은 아래 실행 matrix에 남긴다.

- Image reference: `docker.io/library/postgres:18.6-trixie@sha256:4ef4dbc939d61acea57712655ddb4b4ab27419c913f94cca0cd57cb3ea3c2280`
- 위 digest는 tag가 가리키는 `application/vnd.oci.image.index.v1+json` **manifest index digest**다. 실행 platform image manifest digest와 혼동하지 않는다.
- Official tag는 여러 architecture를 제공하지만 이 integration contract의 target은 native `linux/amd64`와 native `linux/arm64/v8`만이다. Index가 가리키는 image manifest는 각각 `sha256:7341002d2b8c7c5bdd7542a671a95b36196c0b5b888daf454ae4fc33ba5346d7`, `sha256:6fd9e18b6fedda0a34e4d53ad6fdbd4289a217300af573c31ec7084e6d9cf329`다. 한 platform의 성공은 그 platform만 증명하며 둘 모두의 검증 성공이나 운영 architecture 확정을 뜻하지 않는다.
- Tag만 고정하면 base image rebuild 때 같은 tag가 다른 content를 가리킬 수 있으므로 index digest도 함께 고정한다. 실행 시 target platform을 명시하고 실제 선택된 child digest가 위 값인지 기록한다. Index의 `unknown/unknown` provenance descriptor는 실행 platform으로 세지 않는다.

근거는 [PostgreSQL versioning policy](https://www.postgresql.org/support/versioning/), [PostgreSQL 18 constraint](https://www.postgresql.org/docs/18/ddl-constraints.html)·[partial index](https://www.postgresql.org/docs/18/indexes-partial.html)·[`INSERT`](https://www.postgresql.org/docs/18/sql-insert.html)·[locking](https://www.postgresql.org/docs/18/explicit-locking.html), [Docker Official Image 목록](https://github.com/docker-library/official-images/blob/b6c89f1d7f2351bbeb960a5ba0bd6d7d5a11e5bb/library/postgres), [18.6-trixie Dockerfile](https://github.com/docker-library/postgres/blob/e00e1bd34ec5c8a8e7ad89b273b3d42efaf6d5bc/18/trixie/Dockerfile), [Docker Hub tag metadata](https://hub.docker.com/v2/repositories/library/postgres/tags/18.6-trixie), [OCI image index](https://github.com/opencontainers/image-spec/blob/v1.1.1/image-index.md), [Debian bookworm](https://www.debian.org/releases/bookworm/)·[trixie lifecycle](https://www.debian.org/releases/trixie/)다. Registry V2 response body의 SHA-256과 `Docker-Content-Digest`, Docker Hub index/child metadata를 2026-09-05에 대조했으며 image는 pull하지 않았다.

PostgreSQL 19는 확인 시점 Beta 3이므로 선택하지 않는다. PostgreSQL과 base OS의 지원 기간은 별개다. Debian 13 trixie는 2028-08-09까지 full support, 2030-06-30까지 LTS인 반면 Debian 12 bookworm은 이미 LTS 단계이고 2028-06-30에 종료된다. 기존 distro 제약이 없는 새 integration image이므로 더 긴 base 지원 기간을 가진 trixie를 선택한다. 다만 trixie LTS도 PostgreSQL 18 지원 종료일 2030-11-14보다 먼저 끝나므로 그 전에 variant를 재검토해야 한다. 대안인 `17.11-bookworm`은 PostgreSQL 지원도 2029-11-08에 끝나고 17 이하 image data mount는 `/var/lib/postgresql/data`라서 더 이른 major upgrade와 다른 volume 경계를 수용해야 한다. `18.6-bookworm`은 같은 server version이지만 base 지원 기간이 짧고, `18.6-alpine3.24`는 image 크기를 줄일 수 있지만 musl 기반 차이를 추가한다.

PostgreSQL 18 image의 `PGDATA`는 `/var/lib/postgresql/18/docker`, declared `VOLUME`은 `/var/lib/postgresql`이다. Disposable named volume은 parent 경로 `/var/lib/postgresql`에 mount하고 `PGDATA`를 위 version-specific 경로로 명시한다. 이 경계는 local test data를 run마다 버리기 위한 것이며 운영 volume topology, backup, restore, major upgrade 정책을 정하지 않는다. [Official Image 문서](https://hub.docker.com/_/postgres)는 Docker용 환경변수와 `/docker-entrypoint-initdb.d`가 empty data directory에서만 작동하고 init script용 임시 daemon은 Unix socket만 listen한다고 설명한다.

### 로컬 DB 격리와 재사용

1. 로컬 PostgreSQL은 Docker의 비운영 전용 환경에서 실행한다. 개발 중에는 소유자와 사용 중인 작업이 명확한 container·volume을 재사용할 수 있다. 각 검증의 DB/schema·fixture를 격리하거나 초기화해 순서 의존과 이전 결과의 오염을 막는다. Fresh Migration·rollback·teardown 자체의 검증은 새 disposable DB에서 수행한다. Host bind는 `127.0.0.1`로 제한하고 병렬 실행은 port와 DB를 분리한다. Test credential은 비운영 값만 쓰며 repository나 log에 남기지 않는다.
2. 현재 검증 도구에 고정된 image digest와 선택 platform을 사용하고 해당 image의 `PGDATA`/volume 경로를 따른다. 위 값은 최초 승인 조합의 이력이며 업데이트의 현재 값은 검증 도구와 변경 PR에서 관리한다. App schema용 init script를 `/docker-entrypoint-initdb.d`에 넣지 않는다. Image entrypoint는 empty `PGDATA`에 PostgreSQL cluster와 test DB를 초기화할 뿐이며 auth domain table은 readiness 뒤 compiled JavaScript Migration의 단일 명시 실행만 만든다.
3. Readiness는 Migration이 쓸 것과 같은 host TCP 경로·database·user·password로 인증하고 bounded retry 안에서 `SELECT 1`이 성공해야 충족된다. Container running/health 상태나 `pg_isready`만으로 migration-ready를 주장하지 않는다. 환경을 생성·갱신할 때 실제 server version과 선택 image/platform을 확인하고 기록한다. 같은 환경에서 테스트만 다시 실행할 때 이 조사를 반복하지 않는다.
4. 일회성 환경은 정상 종료, 관측 가능한 실패·timeout, 처리 가능한 `SIGINT`·`SIGTERM`에서 `finally` 성격의 teardown을 수행한다. 재사용 환경은 작업이 만든 fixture·연결을 정리하고 소유자가 종료할 때 container·volume을 회수한다. 기존 disposable 검증 도구를 수정 없이 재사용 모드로 실행할 수 있다고 가정하지 않는다. 각 자원에 run ownership ID를 붙이고 이번 run의 ID와 일치하는 exact container, named volume, network만 삭제해 부재를 확인한다. `SIGKILL`, host crash, Docker daemon 장애에서는 즉시 teardown을 보장하지 않으며 잔여 resource와 삭제 지연을 공개한다. 다음 실행의 recovery도 알려진 run ownership ID가 일치하는 exact resource만 회수한다. Global prune, 이름 pattern에 의한 광역 삭제, 기존·운영 resource 삭제를 금지한다. Disposable volume 삭제는 test fixture teardown이며 [`auth-database.md`](auth-database.md)의 revoked/idle session과 인증 요청 row cleanup·보관 정책을 실행하거나 바꾸는 것이 아니다.

아래 사례는 schema/Migration과 관련 경계가 바뀔 때 해당 범위를 선택한다. 최초 도입이나 major·저장 형식 변경은 범위를 넓히고, 일반 기능 수정마다 전체 목록을 반복하지 않는다. 실제 개발·배포에 선택한 platform을 검증하며 다른 platform의 미실행만으로 독립 작업을 막지 않는다.

| 검증 | 실행과 통과 기준 |
| --- | --- |
| Fresh apply | App relation이 없는 새 test DB에서 compiled ESM DataSource/Migration을 한 번 명시 실행한다. `auth-database.md`의 auth domain table은 패스키를 포함한 5개다. 별도의 TypeORM Migration history metadata는 실행 기반 내부 table로 구분하며 새 auth domain table 승인으로 세지 않는다. |
| Re-run no-op | 같은 Migration을 다시 실행해 pending Migration과 schema 변경이 없음을 확인한다. |
| Migration 목록·schema | Applied Migration 목록과 catalog를 조회해 column/nullability/collation, named unique·FK·CHECK, 일반 index와 partial unique index가 승인 contract와 일치하고 예상 밖 auth relation이 없음을 확인한다. `users(id)`, `auth_sessions(id)`, `auth_refresh_tokens(token_hash)`, `auth_login_requests(id)`, `auth_passkeys(id)` 각각은 정확한 column 집합의 `PRIMARY KEY` constraint여야 하며 `UNIQUE NOT NULL`로 대체해 통과시키지 않는다. |
| 위반 거절 | 각각 격리한 transaction에서 duplicate credential ID·미소비 refresh, orphan FK, nonempty/시간/revoked pair/hash/status별 CHECK, partial unique 위반이 해당 constraint/index에서 거절되고 rollback 뒤 fixture가 오염되지 않음을 확인한다. |
| 자동 schema 변경 없음 | `synchronize:false`, `migrationsRun:false`로 app을 시작·종료한 전후 catalog가 동일해야 한다. App 시작이 fresh DB에 auth table이나 Migration history를 만들지 않고 migrated DB도 바꾸지 않는다. |
| Disposable rollback | 별도의 빈 disposable test DB에 Migration up을 먼저 명시 적용해 auth schema와 applied history를 확인한 뒤 down을 실행한다. Auth domain table 제거와 Migration history의 일관성을 확인하며 빈 DB에서 즉시 down한 no-op를 성공으로 세거나 운영 destructive down의 근거로 사용하지 않는다. |

`auth-database.md`의 transaction manager, user→session→refresh 및 인증 요청 선행 잠금 순서, lock 뒤 fresh time 재확인, cleanup/terminal null·삭제 의미는 그대로다. 위 schema 검증을 runtime 경합 성공으로 표시하지 않는다. 관련 flow가 바뀔 때 필요한 DB integration을 선택하고 유효한 기존 결과는 재사용한다.

### 이미지 갱신

같은 major의 호환 patch·security update와 tag/digest 갱신은 일반 dependency 변경으로 처리한다. 바뀐 image/version·관련 release 정보와 선택 platform의 연결·Migration 호환성을 변경 PR에서 확인하며, 매번 Rule proposal이나 전체 matrix 계획을 만들지 않는다. Major·저장 경로·운영 데이터 호환성·복구 방식이 바뀌는 경우에는 영향과 필요한 Migration 검증을 함께 다룬다. 고정 digest를 보안 업데이트를 미루는 이유로 사용하지 않는다.

## 승인된 Migration 계약

- `synchronize:false`, `migrationsRun:false`로 앱 시작이 schema를 자동 변경하지 않는다.
- TypeORM compiled JavaScript DataSource/Migration CLI로 승인된 tsc→Node ESM 실행을 유지한다. ts-node/Nest CLI나 새 runner를 추가하지 않는다.
- 현재 schema는 [인증 DB](auth-database.md)의 5개 table을 사용한다. 과거 migration을 수정하지 않고 패스키 전환 migration을 이어 적용한다. 전환 up/down은 대상 table 쓰기를 잠근 뒤 users·auth_login_requests가 비었을 때만 허용한다. 새 DB apply, 재실행 no-op, 직접 constraint 위반 거절, Migration 목록/schema를 후속 검증한다.
- 배포 담당의 단일 명시 실행으로 transaction 적용하며 동시 자동 실행을 금지한다. 운영 destructive down을 자동 실행하지 않는다. Rollback 검증은 빈 disposable test DB에 한정한다.
- 운영 변경은 검토한 forward migration/백업 절차의 별도 승인을 따른다. DB credential·key/패스키 필수 설정은 해당 module을 연결할 때부터 listen 전에 값/stack 없이 정제 검증한다. 미연결 runtime-only app에 이 설정을 요구하지 않는다.

기존 Migration 명령과 구현은 `apps/api/package.json`과 `apps/api/src/database/`에서 확인한다. 현재 요청에 포함된 구현과 비운영 검증은 [개발 흐름](agent-workflow.md)에 따라 진행한다. 과거 설계 작업의 설치·실행 제외를 새 요청의 금지로 재사용하지 않으며, 실제 운영 DB와 파괴적 실행에는 해당 실행 권한이 필요하다.

## 기본 API의 배포 설정 입력

단일 secret JSON 파일을 시작 때 한 번 읽는 경계는 [PR #128](https://github.com/blahaj94/ldb/pull/128#issuecomment-5572382154)의 승인 이력을 유지한다. 현재 파일은 `accessJwt`와 `passkey` 두 object만 받는다. 설정 예제는 [패스키 실행 안내](../reference/passkey-authentication.md)를 따른다.

- `accessJwt`: issuer·audience·signingKey(kid/privateKeyPem)·verificationKeys(kid/publicKeyPem 배열). 기존 issuer/verifier를 사용하고 정상 key 교체·복원 예외는 [세션](auth-session.md)을 따른다.
- `passkey`: apiOrigin·rpId·rpName·returnUrl. HTTPS exact origin, 같은 hostname의 RP ID와 허용된 앱 복귀 주소를 검증한다. 설정 fingerprint가 바뀌면 기존 transient 요청을 거절한다. RP 도메인 변경은 기존 패스키 호환성 문제이므로 배포 전에 확정한다.
- `AUTH_CONFIG_FILE`은 절대 경로다. UTF-8 JSON의 field/type을 엄격히 검사하고 unknown field·coercion·fallback·자동 key 생성을 허용하지 않는다. PEM 줄바꿈은 JSON escape로 전달한다.
- DB·PORT·NEOPLE_API_KEY는 기존 환경변수로 받는다. 파일은 배포가 실행 주체만 읽도록 저장소·image·log 밖에 준비한다. API는 파일 생성·권한 변경·secret manager 호출을 하지 않는다. 설정 교체는 새 파일 준비 후 process 재시작으로 적용한다.
- `LOCAL_HTTPS_CERT_FILE`·`LOCAL_HTTPS_KEY_FILE`은 함께 지정하는 선택적 개발 PEM 입력이다. 절대 경로·읽기·PEM/key 일치·localhost origin/PORT를 검증하고 `127.0.0.1`에서 HTTPS로만 listen한다. 실행 담당이 인증서 발급·신뢰를 준비하며 TLS 검증을 끄지 않는다. 제품 패스키 개발 주소는 `https://localhost:<PORT>`다.
- 모든 설정과 key를 DB 초기화·listen 전에 검증한다. 오류 원문·값·경로·stack 대신 고정 실패 메시지와 nonzero exit만 남긴다. 시작 시 migration이나 외부 인증을 자동 실행하지 않는다.
- 정상 종료·signal·부분 초기화·listen 실패에서 이번 앱·검색 취소를 먼저 시도한 뒤 DB 연결을 정리한다. 앱 종료 실패가 DB 정리를 생략하게 하지 않는다. 강제 종료·host 장애의 즉시 정리는 보장하지 않는다.

HTTP 합성과 기존 계정·검색 deadline은 유지한다. 제품의 인증 우회 mode나 실제 credential을 상속하는 테스트 설정을 추가하지 않는다.

## 승인과 미결정 gate

API/security/schema/보관·key 주기·활동 분류·admission/DB 장애·body/deadline 정책은 승인됐다. PostgreSQL server·image·local validation 선택의 상태와 evidence는 위 canonical 구간만 따른다. 선택 승인 여부와 별개로 다음 미정이 필요한 구현은 별도 결정/검증을 완료해야 한다.

- 선택한 운영 환경의 single process 조건, clock·cleanup·key 운영 절차. 장비·역할과 복원 선택은 [인증 운영 구성](../architecture/auth-operations-proposal.md)을 따름
- 실제 선택한 dependency 조합의 compiled ESM/TypeScript/runtime compatibility
- 실제 인증 HTTPS origin·RP ID·앱 protocol과 Electron OS 저장/IPC·browser/OS 검증. Desktop의 남은 platform 조건은 [Desktop contract](desktop-auth.md)를 따름

- 공개 ingress와 서비스 전체 abuse 대응. 구현된 process 단위 제한을 다중 instance 전체 제한으로 확대 해석하지 않음
- [탈퇴·삭제](auth-withdrawal-proposal.md)의 패스키 재인증·경합 후속 설계, control store 내구성·writer fencing·보관·장애 대응과 선택한 복원 검증

탈퇴의 정책 승인과 남은 운영/구현 gate를 구분한다. 위 환경 gate는 로그인 핵심 설계 완료를 막지 않으며 탈퇴 Rule 승인은 제품 구현·백업/복원 실행의 자동 착수 지시가 아니다. 현재 요청에 구현·비운영 검증이 포함되면 과거 설계 승인 때의 실행 제외를 이유로 재허락을 요구하지 않는다. 유효한 명시적 금지와 실제 credential·운영 DB·배포 권한은 유지하고, 요청한 범위에 [Testing](testing.md)의 관련 검증을 수행한다.
