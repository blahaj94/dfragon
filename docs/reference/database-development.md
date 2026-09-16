---
type: reference
scope: apps/api database development
last-reviewed: 2026-09-06
---

# Schema First database 개발

API는 TypeORM `EntitySchema`를 먼저 수정하고 PostgreSQL과의 차이로 Migration을 생성한다. `apps/api/src/database/schemas`가 현재 ORM mapping이며, `apps/api/src/database/migrations`는 검토한 변경 이력이다. Schema file은 TypeScript interface와 column·PK·FK·unique·CHECK·index를 함께 정의한다. 새 dependency 없이 기존 TypeORM 1.1.1을 사용한다.

[Nest database 가이드](https://docs.nestjs.com/techniques/database)의 EntitySchema와 Migration 구성을 따른다. EF Core의 model → migration → database update와 유사하지만, TypeORM은 EF의 ModelSnapshot 대신 **접속한 DB catalog와 현재 EntitySchema**를 비교한다. 따라서 생성에 사용할 개발 DB는 먼저 기존 Migration이 모두 적용된 상태여야 한다.

## 작성과 적용

DB command는 `DB_HOST`, `DB_PORT`, `DB_USERNAME`, `DB_PASSWORD`, `DB_NAME` 설정을 사용한다. 값은 local 환경에서만 제공하고 source·문서·log에 기록하지 않는다.

1. Local 개발 DB에 기존 Migration을 적용해 비교 기준을 준비한다.

   ```bash
   pnpm --filter @ldb/api db:migrate:up
   ```

2. `apps/api/src/database/schemas`의 해당 EntitySchema와 TypeScript interface를 수정한다. 예를 들어 `users.ts`에서 property와 column mapping을 먼저 작성한다. Schema 의미를 바꾸는 작업의 승인 절차는 `docs/rules/change-control.md`를 따른다.
3. 의미를 설명하는 PascalCase 이름으로 Migration을 생성한다.

   ```bash
   pnpm --filter @ldb/api db:migrate:generate AddUserField
   ```

   이 command는 tsc build 후 compiled ESM generator를 실행하고 `apps/api/src/database/migrations/<timestamp>-AddUserField.ts`를 새로 쓴다. DB schema와 history를 변경하지 않는다. 차이가 없으면 `Database schema is current`를 출력하고 file을 만들지 않는다. 기존 file은 덮어쓰지 않는다.

4. 생성된 `up`과 `down`을 검토하고 관련 test를 추가한다. Column rename을 drop/add로 해석하는 경우와 data 변환·기존 row의 NOT NULL 전환 등은 생성 SQL의 data 보존 여부도 검토한다. Generator가 domain 의도나 data 변환을 결정하지 않는다.
5. 승인·검토한 Migration을 명시적으로 적용하고 상태를 확인한다.

   ```bash
   pnpm --filter @ldb/api db:migrate:up
   pnpm --filter @ldb/api db:migrate:show
   ```

6. API build·lint·test·typecheck와 `pnpm --filter @ldb/api test:database`를 실행한다. `db:migrate:down`은 빈 disposable DB의 rollback 검증용이며 운영에서 자동 실행하지 않는다.

Migration은 build된 `database/migrations/*.js`에서 자동 발견되므로 새 class를 별도 목록에 수기 등록하지 않는다. `show`는 등록된 전체 Migration을 history와 대조하며 fresh DB에 history table을 만들지 않는다. App과 CLI 모두 `synchronize:false`, `migrationsRun:false`를 유지한다. Migration 적용은 명시적 transaction이며 Nest lifecycle은 schema를 수정하지 않는다.

캐릭터 상세에는 `characters`와 `character_api_responses` EntitySchema·추가 migration이 등록되어 있다. [상세 계약](../rules/character-details.md)과 [DBML](character-details.dbml)을 참고한다. `test-support/character-details.mjs`는 최신 JSONB 저장·동등성·revision·원자성·경합과 HTTP 흐름을 검증한다. 공용 DataSource는 연결 풀 대기를 2초로 제한한다. 상세 GET은 11개 섹션의 가장 오래된 성공 조회 시각을 기준으로 5분 동안 캐릭터 저장값을 재사용한다. 본문 없는 `POST /characters/:serverId/:characterId/refresh`로 명시 갱신할 수 있으며 응답의 `freshness`에서 조회·만료 시각을 확인한다. 이 정책은 기존 column을 사용해 추가 migration이나 권한 변경이 없다.

## ORM 사용

Schema 자체를 repository target으로 사용한다. Nest 기능 module을 연결할 때는 `TypeOrmModule.forFeature([UserSchema])`로 등록할 수 있다. 기본 runtime-only AppModule은 아직 DB module을 연결하지 않는다.

```ts
import { UserSchema } from './database/schemas/users.js'

const users = dataSource.getRepository(UserSchema)
const user = await users.findOneBy({ id: userId })
```

`userId` 같은 camelCase property는 `user_id` DB column에 mapping된다. Transaction 안에서는 동일한 transaction manager의 `getRepository(UserSchema)`를 사용한다. API가 UUID를 생성하며 DB extension이나 자동 UUID default는 추가하지 않는다.

## 이력과 생성 한계

- 이미 작성된 초기 Migration은 기존 이력으로 보존한다. 이후 EntitySchema를 수정해도 과거 Migration이 바뀌지 않도록 Migration에서 현재 schema file을 import하지 않는다.
- TypeORM 1.1.1의 schema diff는 같은 이름의 CHECK expression 및 partial index의 WHERE 변경을 감지하지 않는다. 이런 표현을 변경할 때는 schema의 해당 constraint/index 이름도 새 이름으로 바꾸어 drop/create가 생성되도록 하고, 생성 SQL과 실제 위반 거절을 확인한다. PK 이름 변경 같은 metadata 변경 역시 SQL에 반영됐는지 확인한다.
- `Database schema is current`는 TypeORM이 감지한 차이가 없다는 뜻이다. 모든 DB invariant가 같다는 증거로 대신 쓰지 않는다. 실제 DB test는 column/collation/precision, constraint definition, PK/FK/unique/index와 위반 거절도 따로 검증한다.
- Generator는 TypeORM의 `createSchemaBuilder().log()`를 사용한다. 기본 CLI template의 일반 type import와 raw 오류 출력 대신 이 repository의 `import type`, transaction guard, 정제된 오류 출력을 유지하는 작은 writer를 사용한다.

## 현재 검증 범위

`apps/api/test-support/schema-first.mjs`는 별도 disposable DB에 EntitySchema에서 생성한 초기 Migration을 적용하고 등록된 Migration 전체와 PostgreSQL constraint definition을 대조한다. 인증 schema의 ORM 저장/조회·FK cascade, 적용 뒤 diff 없음, 임시 nullable column의 후속 Migration 생성·적용·rollback을 검증한다. 생성 file은 임시 directory에서 compile하며 test가 끝나면 삭제한다.

Docker image는 고정 index·native child·config를 검증한 뒤 같은 local image inspect의 ID를 container `.Image`와 비교한다. Classic store의 config ID와 containerd store의 index ID 차이를 허용하면서 검증한 image와의 정확한 일치를 요구한다. 실제 Docker 검증은 native `linux/arm64/v8`에서 수행했으며 `linux/amd64`와 classic store 실기 검증은 별도다.

## 패스키 schema와 검증

`schemas/users.ts`, `passkeys.ts`, `auth-login-requests.ts`가 회원·credential·일회용 요청의 interface와 EntitySchema를 정의한다. 세션·refresh schema는 유지한다. Column과 named CHECK/unique/index의 현재 형태는 schema와 `test/fixtures/passkey-database-schema.json`에서 확인한다. 과거 migration에 현재 상수를 import하거나 이미 적용된 SQL을 바꾸지 않는다.

`ReplaceOAuthWithPasskeys` migration은 schema diff에서 생성했으며 users·auth_login_requests의 쓰기를 잠근 뒤 두 table이 비어있는지 검사한다. 기존 데이터가 있으면 적용과 rollback을 모두 거절한다. 자동 삭제나 기존 계정 이관을 하지 않는다. 격리 DB에서 전체 migration·schema-first 생성 결과를 비교하고 비어있지 않은 경우의 보존을 검사한다.

## Identity session

`createIdentitySession(manager, {userId, isNewUser})`는 서버가 검증한 기존 회원을 잠근 뒤 독립 session과 최초 refresh hash를 생성한다. 회원 생성은 패스키 등록 service의 책임이다. 이 내부 타입만으로 HTTP 인증 증거를 만들 수 없다.

호출자는 active READ COMMITTED manager를 전달하고 오류를 transaction 밖으로 전파한다. 같은 manager의 typed Repository만 사용하며 자동 retry나 nested transaction을 만들지 않는다. Exchange는 자기 요청→회원→credential을 잠그고 이 함수를 합성한다. Code 소비와 JWT·session·refresh 발급이 commit된 뒤에만 응답하며 commit 불명은 성공으로 처리하지 않는다.

회원 잠금 뒤 fresh DB whole-second 시각을 session 생성·활동·refresh 발급 시각으로 사용한다. UUID·32-byte refresh는 crypto로 만들고 DB에는 decoded bytes의 SHA-256만 저장한다. 기존 nickname·session·refresh 이력은 바꾸지 않는다. 공통 상수는 `constants/auth.ts`, 내부 타입은 `types/auth.ts`, 정제 오류는 `errors/identity-session.ts`가 관리한다.

실제 브라우저·PostgreSQL 검증은 `test-support/passkey-integration.mjs`와 기존 refresh/account suite가 담당한다. 가입·재로그인·단일 교환·만료·예비 키·삭제 키 및 세션 회귀 범위는 [로그인 구현](auth-login-development.md)을 참고한다.

## Refresh transaction core

`apps/api/src/auth/refresh/index.ts`에 refresh rotation·확인된 재사용 session 폐기를 commit까지 소유하는 내부 core가 구현됐다. 전용 unit·실제 PostgreSQL 검증과 후속 HTTP 연결 경계는 [`auth-refresh-development.md`](auth-refresh-development.md)를 참고한다. 이 검증은 `/auth/refresh` HTTP 또는 logout·cleanup·운영 연결 완료를 뜻하지 않는다.

## 공용 상세 캐시 운영

`AddCharacterCatalog1789554193117`은 `item_catalog`와 `skill_catalog` 두 테이블만 추가한다. 기존 캐릭터 JSONB·인증 데이터는 변경하지 않는다. 후속 `AddSetItemCatalog1789557135610`은 같은 캐시 정책의 `set_item_catalog`만 추가한다. 아바타·엠블렘·크리쳐·아티팩트·서약·결정·버프 장착 상세는 기존 `item_catalog`를 재사용한다. [캐릭터 상세 계약](../rules/character-details.md#공용-아이템·스킬·세트-상세)과 [DBML](character-details.dbml)을 함께 참고한다.

배포 순서는 migrator로 `db:migrate:up` → runtime 계정에 공용 상세 테이블의 SELECT·INSERT·UPDATE 권한 부여 → 새 서버 배포다. `deploy/api/grant-api.sql`은 공용 상세 세 테이블의 권한을 포함하며 migration 이후 재실행할 수 있다. 별도 읽기 전용 계정은 SELECT만 부여한다. 자동 migration은 계속 비활성화한다. `down`은 공용 캐시를 삭제하므로 격리 테스트에서만 사용한다.

공용 상세는 접근 시 24시간 만료를 확인한다. 시즌 패치 직후 기존 값을 유지한 채 다음 접근에서 갱신하려면 권한이 있는 운영 연결에서 아래 SQL을 실행한다. 과거 성공 조회 시각은 바꾸지 않는다. request_started_at도 올려 무효화보다 먼저 시작한 갱신이 기존 행을 다시 유효하게 만들지 못하게 한다. 세 테이블에 이미 존재하는 행이 대상이며 전체 수집·즉시 재조회 작업은 아니다.

```sql
BEGIN;
UPDATE item_catalog
SET expires_at = LEAST(expires_at, clock_timestamp()),
    request_started_at = clock_timestamp();
UPDATE set_item_catalog
SET expires_at = clock_timestamp(), request_started_at = clock_timestamp();
UPDATE skill_catalog
SET expires_at = LEAST(expires_at, clock_timestamp()),
    request_started_at = clock_timestamp();
COMMIT;
```

`test-support/character-catalog.mjs`는 실제 PostgreSQL에서 24시간 만료, 스킬 복합 식별, 캐시 재사용·실패, 실제 row-lock 대기와 이전 요청 덮어쓰기 방지, 무효화, JSONB 보존과 rollback을 검증한다. `test-support/character-details.mjs`는 HTTP 응답에 공용 상세가 연결되지만 캐릭터 원본에는 섞이지 않는 것을 검증한다. 단위 테스트는 아이템 다중 ID 대응·스킬 단일 조회, 호출 제한·취소·실패 시 데이터 출처, 장비 옵션과 스킬 빈 슬롯 보존을 확인한다.


## 모험단명 검색 배포

`AddCharacterAdventureName1789564164377`은 `characters.adventure_name`과 비고유 `(adventure_name, character_id)` B-tree index를 추가하고 기존 기본정보 JSONB에서 이름을 채운다. PK·FK·원본 응답은 변경하지 않는다. 기존 테이블 단위 runtime 권한으로 새 column도 읽고 쓸 수 있으므로 새 역할·권한 부여는 필요하지 않다. [캐릭터 상세 계약](../rules/character-details.md#모험단명-검색), [DBML](character-details.dbml)을 참고한다.

배포는 새 이미지 build → 이전 API 중지 → migrator로 `db:migrate:up` → 새 API 시작 순서로 진행한다. 이전 API는 새 column을 동기화하지 못하므로 backfill 이후 이전 API가 쓰는 기간을 만들지 않는다. Migration의 column 추가·backfill·index 생성은 같은 transaction이며 테이블 잠금과 데이터량에 따른 중단 시간이 발생한다. 배포 중 오류가 나면 해당 단계에서 중단하고 상태를 확인한다. 운영에서 자동 `down`은 하지 않는다. 이전 API로 복구해 다시 캐릭터를 갱신했다면 새 버전 재배포 전에 migration의 backfill SQL로 column을 재동기화해야 한다.

`test-support/adventure-search.mjs`는 기존 JSONB를 가진 DB의 migration, 중복 이름·null, 서버를 가로지르는 정확 일치와 페이지 조회, 이름 변경·이전 요청·실패 시 rollback, HTTP 응답을 확인한다. 새 기능은 우리 DB에서 수집된 캐릭터만 찾으며 모험단의 전체 보유 목록 수집이나 클라이언트 화면은 포함하지 않는다.
