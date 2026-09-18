---
type: reference
status: active
enforcement: autonomous
scope: repository
last-reviewed: 2026-09-12
---

# Repository Map

이 file은 현재 repository의 사실을 설명하는 Reference document다. AI가 code와 config 변경에 맞춰 자율적으로 갱신한다.

## Workspace

- Package manager: `pnpm@11.23.0`
- Workspace pattern: `apps/*`, `packages/*`
- Root package: `@ldb`
- Root type: ESM

## 공통 정적 검사와 정렬

Root의 `eslint.config.mjs`, `.prettierrc.json`, `.prettierignore`와 직접 devDependency를 모든 프로젝트가 공유한다. API/Desktop의 compiler는 기존 TypeScript 5.9, Web/UI는 기존 6.0 계열이며 root TypeScript는 ESLint parser 전용이다.

- `pnpm lint`, `pnpm lint:fix`: root 설정·scripts·API·Desktop·Web·UI의 ESLint 비수정 검사와 자동수정.
- `pnpm format`, `pnpm format:check`: 같은 범위의 JS/TS·JSON/JSONC·YAML·CSS/SCSS/LESS·HTML을 Prettier로 정렬하거나 비수정 검사한다. Markdown은 자동 정렬 대상에 포함하지 않는다.
- 각 workspace에서도 `pnpm --filter @ldb/api lint`처럼 같은 네 명령을 사용한다. Workspace에 등록하지 않은 scripts는 `pnpm --dir scripts lint`와 `format:check` 등으로 직접 실행한다.
- `pnpm lint:oxlint`: Web/UI의 기존 Oxlint 전체 검사를 보조 실행한다. 개별 명령은 `pnpm --filter @ldb/web lint:oxlint`, `pnpm --filter @ldb/ui lint:oxlint`다. ESLint와 대응하지 않는 기본 검사도 유지하기 위해 Oxlint 설정과 dependency를 보존한다.

각 leaf의 formatter 명령은 root config와 ignore 경로를 명시한다. 생성물·OCR·고정 SEED source·foundation/provenance·lockfile·license/notice와 기존 Desktop root tsconfig의 정렬 제외를 유지한다. 직접 관리하는 `packages/ui/build/notices.ts`는 검사·정렬 대상이다. 세부 범위는 실행되는 config와 ignore를 따른다.

`.github/workflows/code-quality.yml`은 read-only 권한으로 root ESLint·Prettier 비수정 검사와 Web/UI 보조 Oxlint를 실행한다. 같은 범위의 leaf 검사를 CI에서 중복 실행하지 않는다. 적용 승인과 동작 보존 기준은 [`convention-tooling.md`](../rules/convention-tooling.md)를 따른다.

## Applications

### `apps/api`

- Package: `@ldb/api`
- Type: ESM
- Stack: Node 24, NestJS 12, TypeScript
- Entry: `src/main.ts` → `dist/main.js`
- API 문서: `/docs`의 Swagger UI와 `/docs/openapi.json`. `src/swagger`의 명시적 schema·설명을 controller metadata와 합쳐 제공한다. [사용 방법](api-start-development.md#swagger-api-문서)을 참고한다.
- 필수 runtime 설정: `PORT`, `DB_*`, `NEOPLE_API_KEY`, `AUTH_CONFIG_FILE`. `src/runtime`에서 설정을 검증하고 기존 인증·계정·검색 factory와 소유 DB를 기본 main에 연결한다. 정확한 입력·실행 순서는 [`api-start-development.md`](api-start-development.md)를 참고한다.
- Test compile: `test`가 `dist`를 먼저 clean build한 뒤 `src`, `test`를 `.test-dist`로 compile한다. 단독 실행에서도 runtime entry와 login test가 최신 production output을 사용한다. Test module의 loopback HTTP로 runtime을 검증한다.
- Database: `src/database/schemas`의 typed EntitySchema가 ORM mapping과 Migration 생성의 시작점이다. 작성 순서·생성 한계는 [`database-development.md`](database-development.md)를 참고한다. `src/database/data-source.ts`의 compiled ESM DataSource와 `src/database/cli.ts`의 정제된 CLI가 `src/database/migrations`의 인증 초기·캐릭터 상세 Migration을 명시 실행한다. 기본 main의 `src/runtime/application.ts`는 기존 DataSource factory로 DB 수명을 소유한다. `AppModule`은 별도 runtime 테스트용 빈 module로 유지한다.
- Auth 정의: `src/constants/auth.ts`의 provider·오류·nickname·refresh 값에서 `src/types/auth.ts`의 공통 타입을 파생한다. Identity session 오류는 `src/errors/identity-session.ts`가 관리한다.
- Identity session: `src/auth/identity-session.ts`가 검증된 기존 user를 잠그고 독립 session·최초 refresh를 만든다. 회원 생성은 패스키 등록 service가 담당한다. 같은 transaction의 code 소비가 commit된 뒤에만 token을 응답한다. [DB 개발 안내](database-development.md#identity-session)를 참고한다.
- 패스키 로그인: `src/auth/login/service.ts`가 가입·WebAuthn 검증·예비 키 관리를, `exchange.ts`가 일회용 앱 교환을 담당한다. `browser/passkeys.ts`를 같은 origin에서 제공하며 기본 main에 연결한다. 설정과 실제 기기 검증 경계는 [패스키 실행](passkey-authentication.md)을 참고한다.
- Refresh/logout HTTP: 기존 Nest factory의 선택적 session service가 `POST /auth/refresh`, `POST /auth/logout`을 같은 16,384-byte strict JSON parser와 정제 filter에 연결한다. `src/auth/refresh`의 기존 transaction ownership을 유지하고 `src/auth/logout`이 제출 token의 해당 session만 종료한다. 기본 main도 같은 session service를 연결한다. Source·격리 검증 범위는 [`auth-refresh-development.md`](auth-refresh-development.md)를 참고한다.
- 인증 데이터 정리: `src/auth/cleanup`의 명시 command가 종료 session·연결 refresh 전체와 terminal·만료 인증 요청을 잠금 뒤 재판정해 삭제한다. 기존 DB 설정·DataSource를 재사용하며 시작 자동 호출과 하루 1회 운영 연결은 미완료다. 삭제·보존과 실패 결과의 의미는 [`auth-cleanup-development.md`](auth-cleanup-development.md)를 참고한다.
- Account HTTP: 기존 Nest factory의 선택적 account dependency가 `GET /me`, `PATCH /me/nickname`을 연결한다. `src/auth/account`가 기존 JWT verifier와 user→session 잠금을 재사용해 활동 commit 후 기능 transaction을 재확인하고 nickname을 native Unicode grapheme 기준으로 검증한다. 연결점과 HTTP/DB 경합 evidence는 [`auth-account-development.md`](auth-account-development.md)를 참고한다.
- Public search HTTP: `GET /characters`는 로그인 없이 strict raw query·직접 socket peer별 memory quota·Neople adapter에 연결한다. 검색은 JWT·session DB·활동 기록에 의존하지 않으며 계정 endpoint의 인증은 유지한다. [`검색 개발`](authenticated-search-development.md)을 참고한다.
- Character detail HTTP: `GET /characters/:serverId/:characterId`는 5분 동안 DB 값을 재사용하고 최초·만료 시 Neople 11개 응답을 최신 JSONB로 저장한 뒤 정제한다. 본문 없는 `POST /characters/:serverId/:characterId/refresh`는 명시 갱신한다. `src/characters/details`와 [캐릭터 상세 계약](../rules/character-details.md), [DBML](character-details.dbml)을 참고한다.
- Adventure search HTTP: `GET /adventures/characters?adventureName=...`는 `characters.adventure_name` index로 수집된 캐릭터를 정확 일치·서버 통합·페이지 조회한다. Neople 호출이나 전체 보유 캐릭터 발견은 하지 않는다. 구현은 `src/adventures`, 계약은 [모험단명 검색](../rules/character-details.md#모험단명-검색)을 따른다.
- Database CLI 설정: `DB_HOST`, `DB_PORT`, `DB_USERNAME`, `DB_PASSWORD`, `DB_NAME`. 이 값은 DB command와 DB를 연결하는 기본 API start에 필요하다.
- Migration 설정: `synchronize:false`, `migrationsRun:false`, `migrationsTransactionMode:'all'`. TypeORM은 최초 up에서 내부 history table을 먼저 준비하고, auth DDL과 해당 history row는 Migration의 active transaction 안에서 적용한다. `db:migrate:show`는 fresh DB에 history table을 만들지 않는 read-only 조회다.
- Docker integration: `test-support/database-integration.mjs`가 고정 PostgreSQL image를 native platform의 isolated container·named volume·loopback dynamic port에서 검증하고 run ownership이 일치하는 exact resource만 정리한다.
- Command:
  - `pnpm --filter @ldb/api dev`
  - `pnpm --filter @ldb/api start`
  - `pnpm --filter @ldb/api test`
  - `pnpm --filter @ldb/api typecheck`
  - `pnpm --filter @ldb/api lint`
  - `pnpm --filter @ldb/api build`
  - `pnpm --filter @ldb/api test:database`
  - `pnpm --filter @ldb/api auth:cleanup`
  - `pnpm --filter @ldb/api db:migrate:generate AddUserField` (EntitySchema와 개발 DB 차이로 Migration file 생성)
  - `pnpm --filter @ldb/api db:migrate:up`
  - `pnpm --filter @ldb/api db:migrate:show`
  - `pnpm --filter @ldb/api db:migrate:down` (빈 disposable DB rollback 검증 전용; 운영 자동 실행 아님)

### `apps/web`

- Package: `@ldb/web`
- Stack: React, TypeScript, Vite
- Command:
  - `pnpm --filter @ldb/web dev`
  - `pnpm --filter @ldb/web test`
  - `pnpm --filter @ldb/web typecheck`
  - `pnpm --filter @ldb/web build`
  - `pnpm --filter @ldb/web lint`
  - `pnpm --filter @ldb/web preview`

### `apps/desktop`

- Package: `@ldb/desktop`
- Windows MVP 배포: 이름 `LDB`, x64 NSIS, `ldb` identity·profile·protocol과 빌드 시 HTTPS API origin을 사용한다. 기존 `ldb.dev` 개발 설치본과 분리하며 [설치·사용·빌드 안내](../../apps/desktop/README.md)를 따른다.
- Stack: Electron, React, TypeScript, electron-vite
- Process boundary: `main`, `preload`, `renderer`
- TypeScript: `tsconfig.node.json`·`tsconfig.web.json`에 `composite: false`, `noEmit: true`를 정의하며 에디터와 `typecheck`는 같은 설정을 사용한다. Root `tsconfig.json`은 빈 `files`와 두 프로젝트 참조로 에디터의 프로젝트 탐색을 연결한다. 타입 검사는 각 설정에 `tsc -p`를 실행하고 제품 산출물은 electron-vite가 생성한다. 인증 fixture도 이 설정을 상속하며 명령에서 `composite`를 덮어쓰지 않는다.
- Main entry: `src/backend/main.ts` → `out/backend/main.js`
- Auth core: `src/backend/auth/coordinator.ts`의 단일 main coordinator가 pending·generation·credential writer와 restore·refresh·logout을 소유한다. 제품 main은 완전한 trusted runtime 설정에서 conditional bootstrap과 macOS credential adapter를 구성하며, 실제 native 성공과 지원 OS는 미확정 gate다. 상세 검증 범위는 [`desktop-auth-core.md`](desktop-auth-core.md)를 참고한다.
- 캐릭터 검색: main 검색 수명·HTTP와 preload/renderer·격리 fixture의 위치 및 검증은 [`desktop-character-search.md`](desktop-character-search.md)를 참고한다. 실제 서버 소비 검증은 별도 `apps/desktop/scripts/search-server-integration/README.md`를 따른다.
- Renderer source root: `src/frontend` → `out/frontend`. `src/frontend/src`는 아래 역할로 나눈다. 실행 진입점 `main.tsx`·`App.tsx`와 App 테스트는 root에 두고, 앱 조합 통합 테스트는 `integration`에 둔다.
  - `constants/`: 서버 목록, 카드 면·장비 배치·인증 문구·캡처 설정과 공유 StyleX 변수·테마.
  - `components/`: `CardImage`·`InvestmentTable`·`CharacterCandidates`·`SlotNicknameEditor`·`SignedInAccount`처럼 독립적으로 쓸 수 있는 UI와 전용 스타일·테스트를 하위 폴더 없이 둔다. 파일당 컴포넌트 하나를 선언하고 StyleX 정의는 `{name}.style.ts`로 분리한다. 이미지 실패·입력 draft 같은 자체 UI 상태를 가질 수 있다.
  - `sections/`: 카드·인증·캡처·검색의 기능 조합을 하위 폴더 없이 배치한다. 파일당 컴포넌트 하나를 선언하고 StyleX 정의는 `{name}.style.ts`로 분리한다. `EquipmentGrid`의 장비 배치, `CharacterCard`·`DetailDeck`의 전환, `AuthSection`의 인증 연결, `ManualSearch`·`PartyCapture`의 요청·구독 수명을 담당하며 전용 스타일·UI 테스트를 함께 둔다. UI는 `hooks`의 커스텀 hook을 사용한다.
  - `pages/`: `party/PartyPage`(4개 슬롯), `character-detail/CharacterDetailPage`(상세), `login/LoginPage`(인증·홈 배치), `home/HomePage`(legacy fixture의 직접 검색·캡처 홈).
  - `fixture/`: MVP 합성 데이터·자산·화면 제어, 구버전 조합 `legacy/LegacyApp`, 인증 UI·bridge·capture 실행 화면. 공용 글꼴은 `assets/fonts`, 배포 고지는 `src/frontend/public/notices/desktop`에 둔다. 제품 페이지가 fixture를 import하지 않는다.
  - `lib/`: 화면과 독립적인 입력 검증·OCR 계산·파티 이미지 처리·검색 초기 슬롯 생성·검색 연결 및 캡처 수명·OCR worker와 관련 단위 테스트를 하위 폴더 없이 배치한다. 각 유틸리티 함수에는 역할 설명 주석을 둔다.
  - `hooks/`: 인증 연결, 캐릭터 검색, 캡처 창 선택·세션·인식·조합을 담당하는 커스텀 hook과 테마 전환 hook, hook 전용 테스트를 하위 폴더 없이 둔다. 검색·OCR의 기존 비UI 구현은 `lib/capture-search.ts`·`lib/ocr.ts`에서 직접 참조한다.
  - `testing/`: 여러 테스트가 공유하는 유틸리티·mock·fixture를 둔다. 현재 `testing/fixtures`의 검색 renderer 도우미를 공유하며, 실제 테스트 파일은 검증하는 코드 옆 또는 기존 `integration`에 둔다.
  - `types/`: 카드·인증·검색·캡처·서버의 frontend 공통 타입. IPC 타입은 기존 preload contract에서 직접 가져온다.
  - UI 의존 방향은 `pages → sections → components`다. 하위 UI는 상위 section·page나 fixture를 import하지 않고 데이터와 callback을 받는다. 같은 계층의 작은 단위를 조합할 수 있으며 모든 사용처가 세 단계를 거칠 필요는 없다. 테스트·fixture의 조합은 이 제품 의존 규칙과 구분한다.
  - 스타일은 사용하는 UI 옆에 두고 named export로 가져온다. 독립 사용 가능한 UI는 파일명과 export 이름을 맞춰 직접 import한다. 단순 태그까지 컴포넌트로 만들거나, 재수출 전용 파일·불필요한 wrapper로 계층을 채우지 않는다. UI와 독립적인 검색 연결·OCR 구현은 `lib`에 두고, React 상태 연결은 `hooks`와 UI가 담당한다.
- 기본 앱: `pnpm --filter @ldb/desktop dev`와 `dev:app`은 새 카드 화면을 연다. 빈 슬롯 네 개와 테마 전환을 제공하며 검색·캡처·인증·상세 연결은 후속이다. 구버전 조합은 legacy fixture와 기존 기능 테스트에서만 사용한다. 합성 메인·상세 미리보기는 `dev:preview`, 빌드 미리보기는 `mvp:build` 후 `ui:fixture mvp dark`로 실행한다. 전용 build mode만 미리보기 HTML·데이터·이미지를 포함한다. [디자인 이관](desktop-mvp-design-handoff.md)을 참고한다.
- Renderer 스타일: StyleX가 화면별 CSS를 컴파일하며 SEED·`@ldb/ui`를 함께 사용한다. 제품·test·fixture의 공통 변환과 작성법은 [Desktop 스타일](desktop-styling.md)을 참고한다.
- Command:
  - `pnpm --filter @ldb/desktop dev`
  - `pnpm --filter @ldb/desktop test`
  - `pnpm --filter @ldb/desktop typecheck`
  - `pnpm --filter @ldb/desktop lint`
  - `pnpm --filter @ldb/desktop build`

## Shared UI

- 실제 검증 환경·결과·upstream Motion 지원 제한: `docs/reference/ui-validation.md`.
- `packages/ui`: `@ldb/ui`, 공식 SEED Snippet·Layout과 중립 Example. Package/peer/CSS 소유·고정 source·고지·명령은 `packages/ui/README.md`를 따른다.
- Library: `pnpm --filter @ldb/ui test`, `typecheck`, `lint`, `build`.
- 독립 Example: `pnpm --filter @ldb/ui dev:examples`, `build:examples`, `preview:examples`. 별도 app workspace는 만들지 않는다.
- Web/Desktop renderer/Example의 source resolution과 cold regression: `packages/ui/README.md`, `packages/ui/test/consumer-resolution.md`. 소비 command는 사전 library build를 요구하지 않는다.
- 각 consumer는 SEED base.css와 별도 공용 foundation.css를 browser entry에서 한 번 import한다. Library JS는 CSS를 import하지 않고 SEED/React/JSX runtime을 external 처리한다.
- Source 재생성·hash/local diff: `packages/ui/scripts/prepare-seed-source.mjs`, `packages/ui/seed-provenance.json`.
- 산출물 검증: `node packages/ui/scripts/verify-build.mjs library packages/ui/dist`, `consumer` mode로 Example·Web·Desktop renderer 산출물을 검사한다. 입력 graph의 미사용 dependency도 보수적으로 고지에 포함한다.
- Test-only Electron UI: `apps/desktop/scripts/ui-fixture.mjs`와 `ui-fixture-preload.cts`. `pnpm --filter @ldb/desktop ui:fixture desktop light` 또는 `example dark`로 실제 production renderer/Example을 연다. 제품 main/preload 대신 synthetic source/선택 bridge와 media 거절 stub을 사용하며 capture/OCR 성공을 검증하지 않는다.

## Repository tooling

- `scripts/create-app.mjs`: 새 app workspace 생성 script
- `pnpm create-app`: root에서 생성 script 실행
- `scripts/start-task.mjs`: 선택적 Issue 기반 준비 도구. project·Issue 번호·description을 검증하고 OPEN Issue 확인 후 최신 main 기반 `{project}-{issue-number}-{description}` branch와 worktree 생성
- `pnpm start-task <project> <Issue 번호> <description> <새 worktree 경로>`: root에서 작업 준비; GitHub CLI 인증 필요
- `node scripts/format-date.mjs '2026-09-08T15:35:00Z'`: UTC ISO 시각을 `2026년 9월 9일 00시 35분`으로 표시; 인자 생략 시 현재 한국 시간. 사용법과 검증은 [`scripts/README.md`](../../scripts/README.md#format-date)
- `scripts/workflow.mmd`: 기본 개발 흐름의 원본. `pnpm workflow`는 준비된 browser로 `.artifacts/workflow.png`를 생성하며 browser를 설치하지 않는다.
- 작업 준비와 workspace별 native validation 예제: [`scripts/README.md`](../../scripts/README.md)
- Root `test` script는 현재 placeholder이며 성공하는 validation command가 아니다.

### AI PR review

- Unprivileged signal workflow: `.github/workflows/ai-pr-review.yml`
- Trusted provider workflow: `.github/workflows/ai-pr-review-trusted.yml`
- Review 기준 안내: [review.md](../../.github/ai-review/prompts/review.md)
- Provider 요청 runtime: `scripts/pr-review/src`
- Test: `scripts/pr-review/test`
- Command:
  - `pnpm test:pr-review`
  - `pnpm typecheck:pr-review`

Signal workflow는 same-repository의 non-draft Pull Request에 `@ldb-review` label이 있을 때만 실행한다. `labeled`, `synchronize`, `ready_for_review`, `reopened` event를 처리하며 fork Pull Request는 제외한다. PR code를 checkout하지 않고 write permission과 Secret을 받지 않는다.

Trusted workflow는 signal workflow가 완료된 뒤 `workflow_run`으로 실행된다. Default branch code만 checkout하고 source workflow result, linked Pull Request, label, draft, fork, current head SHA를 GitHub API로 다시 확인한다. 단일 trigger job이 요청 검증과 provider 댓글 게시를 수행하며 PAT는 해당 step에만 전달한다. Workflow token은 contents read 권한만 가진다.

현재 provider adapter는 `codex`다. Provider-neutral label을 Codex GitHub integration의 `@codex review` comment로 변환한다. 지정된 trigger 작성자의 comment 중 같은 head SHA의 `ldb-ai-review:codex` marker가 있으면 요청을 생략한다. 별도로 실행되는 Codex 기본 리뷰나 수동 요청은 이 검사에 포함되지 않으므로 라벨 요청 전에 해당 head의 기존 리뷰 상태를 확인한다. Trigger identity는 repository Secret `LDB_REVIEW_TRIGGER_TOKEN`을 사용한다. 이 값은 `ldb` repository만 선택한 expiring fine-grained PAT이며 `Pull requests: Read and write` 이외의 추가 repository permission을 부여하지 않는다.

Repository Secret `LDB_REVIEW_TRIGGER_TOKEN`은 2026-08-29에 등록했다. 같은 날 controlled pilot PR #5에서 signal, trusted Policy job, 사용자 identity provider trigger, Codex review, P1 inline finding, same-head deduplication E2E가 모두 통과했다. Pilot PR은 merge하지 않고 닫았다.

현재 adapter는 요청 comment를 게시하며 `.github/ai-review/prompts/review.md`를 provider prompt로 전달하지 않는다. 실제 결과의 형식·보고 심각도는 provider의 지원 범위와 설정을 따르며 저장소가 별도 summary를 게시하지 않는다.

현재 결과 정규화 schema와 validator는 없습니다. Provider-neutral review 목표는 유지하며, 향후 직접 provider 응답을 소비하는 실행 계약이 정해지면 실제 입력과 소비자를 기준으로 결과 계약을 다시 설계합니다.

Issue 연결·커밋 제목/순서·변경 줄 수의 행정 검사와 advisory summary 게시 경로는 없다. `@ldb-review`는 선택적 요청이며 PR마다 자동으로 붙이지 않는다. 라벨이 유지된 후속 head는 기존 signal event를 통해 요청한다. 요청 게시와 실제 리뷰 완료는 구분한다.

## Generated and dependency output

다음 directory는 일반적인 architecture context로 읽지 않는다. 현재 요청의 구현·검증이나 원인 확인에 필요한 경우에만 확인한다.

- `node_modules`
- `dist`
- `out`
- build artifact와 cache

## Update trigger

다음 변경이 생기면 이 Reference document를 같은 PR에서 갱신한다.

- Workspace, app, package 추가·삭제·이름 변경
- Runtime 또는 주요 framework 변경
- 표준 command 변경
- Process boundary 또는 source root 변경
