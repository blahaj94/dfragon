---
type: reference
status: active
enforcement: autonomous
scope: repository
last-reviewed: 2026-10-29
---

# Repository Map

이 file은 현재 repository의 사실을 설명하는 Reference document다. AI가 code와 config 변경에 맞춰 자율적으로 갱신한다.

## Workspace

- Package manager: `pnpm@12.11.2`
- Workspace pattern: `apps/*`, `packages/*`
- Root package: `@dfragon`
- Root type: ESM

외부 의존성 버전은 `pnpm-workspace.yaml`의 catalog에서만 정확한 버전으로 정한다. 각 `package.json`은 기본 `catalog:`를 참조하고, 내부 package는 `workspace:*`를 유지한다. Desktop의 Vite 7.3.7과 `@vitejs/plugin-react` 5.2.0은 `catalog:electron`을 참조한다. `electron-vite` 5.0.0의 Vite peer 범위가 `^5.0.0 || ^6.0.0 || ^7.0.0`이므로 Vite 7 계열을 유지한다. Root TypeScript 6.0.2는 문장 간격 도구의 parser 전용 `catalog:parser`를 참조한다. `catalogMode: strict`는 `pnpm add`가 catalog 밖 버전을 추가하지 못하게 하고, 각 `package.json`이 catalog를 참조하는지는 `pnpm test:tooling`의 `scripts/test/workspace-catalog.test.mjs`가 검사한다.

Dependabot은 catalog 값의 갱신을 제안한다. 기본 catalog와 named catalog에 함께 있는 `vite`, `@vitejs/plugin-react`, `@types/node`, `typescript`와 npm 별칭인 `typescript-compiler-api`는 모든 갱신을 ignore하고 사람이 직접 올린다. Dependabot은 named catalog의 버전을 현재 값으로 읽고도 새 값을 기본 catalog에 써서, minor, patch 갱신으로도 기본 catalog의 major를 내릴 수 있다(#691에서 TypeScript 7이 6.0.3으로 바뀜). `packages/licenses/overrides.json`의 `이름@버전` 키로 원문을 고정한 패키지는 버전 갱신 PR이 `Missing license text`로 빌드에서 실패할 수 있다. 이 실패는 원문 누락을 막는 의도된 게이트이므로 사람이 해당 키와 원문을 갱신해 같은 PR에 추가한다([원문 보완 안내](../../packages/licenses/README.md#원본과-수집-범위)).

## 공통 정적 검사와 정렬

Root의 `biome.json`, `scripts/biome/`의 lint 플러그인, `scripts/statement-spacing.mjs`와 직접 devDependency를 모든 프로젝트가 공유한다. 외부 의존성 버전은 `pnpm-workspace.yaml`의 catalog에서만 정한다. 모든 app과 package의 `tsc`는 기본 catalog의 TypeScript 7.0.2(Go로 다시 쓴 native compiler)이다. TypeScript 7 패키지는 compiler API를 제공하지 않으므로 root TypeScript 6.0.2는 `catalog:parser`로 참조하며 문장 간격 도구의 parser 전용이다. Lib, UI의 테스트와 검증 스크립트는 기본 catalog의 `typescript-compiler-api` 별칭(`npm:typescript@6.0.2`)으로 compiler API를 사용한다.

- `pnpm lint`, `pnpm lint:fix`: root 설정, scripts, API, Desktop, UI 등 저장소 전체의 Biome lint 비수정 검사와 안전한 자동수정.
- `pnpm format`, `pnpm format:check`: 같은 범위의 JS/TS, JSON/JSONC, CSS, HTML을 Biome로 정렬하고 JS/TS에 문장 간격 정책을 적용하거나 비수정 검사한다. YAML, Markdown과 SVG 자산은 자동 정렬 대상에 포함하지 않는다.
- `pnpm test:format-policy`: Biome 포맷 뒤 문장 간격 도구의 블록 첫 `return` 처리, 이후 `return` 빈 줄, 연속된 블록 `if` 사이 빈 줄, `else if` 연결, ASI, 확장자별 결과와 CLI 범위, 수렴을 검사한다.
- 각 workspace에서도 `pnpm --filter @dfragon/api lint`처럼 같은 네 명령을 사용한다. Workspace에 등록하지 않은 scripts는 `pnpm --dir scripts lint`와 `format:check` 등으로 직접 실행한다.

각 leaf의 명령은 root `biome.json`을 자동으로 찾아 실행 위치 아래 파일만 처리한다. 생성물, lockfile, license/notice와 기존 Desktop root tsconfig의 정렬 제외를 유지한다. 직접 관리하는 `packages/licenses/src`는 검사, 정렬 대상이다. 세부 범위는 실행되는 config와 Git ignore를 따른다.

GitHub Actions에는 CI 검사 workflow가 없고 배포 workflow만 둔다. Lint, format, 표기, 문서 검사와 앱 테스트는 로컬에서 `pnpm verify`로 실행한다. 적용 승인과 동작 보존 기준은 [`convention-tooling.md`](../rules/convention-tooling.md)를 따른다.

Root `prepare`가 설치하는 husky `pre-push` hook은 push 전에 `pnpm verify --reuse-pass`를 실행한다. 실패하면 push를 막는다. 같은 내용을 이미 통과했으면 검사를 건너뛴다. 조건은 [`verify` 안내](../../scripts/README.md#verify)에 있다. Node.js 버전은 root `package.json`의 `devEngines.runtime`으로 고정하며, pnpm이 이 버전을 내려받아 script를 실행하고 workflow의 `actions/setup-node`도 같은 값을 읽는다.

배포 workflow는 다음과 같다. 저장소 Actions 설정은 외부 action을 40자리 commit SHA로 고정하도록 요구하므로 tag로 참조한 action은 실행되지 않는다. Action, npm catalog, Docker base image 갱신은 `.github/dependabot.yml`이 기본 7일 cooldown(npm major는 14일)을 둔 월간 PR로 제안하며, 관련 패키지와 이미지는 group으로 묶는다.

- `.github/workflows/product-images.yml`: main push에서 API 이미지를 빌드해 GHCR에 발행한다. [서버 이미지](api-start-development.md#서버-이미지)를 참고한다.
- `.github/workflows/desktop-test-build.yml`: Desktop 관련 PR에서 test channel 포터블 exe를 artifact로 만든다.
- `.github/workflows/desktop-release.yml`: Release 게시나 수동 실행에서 배포 포터블 exe를 Release에 첨부한다. [포터블 exe와 GitHub Releases](../../apps/desktop/README.md#포터블-exe와-github-releases)를 참고한다.

빌드는 비용이 큰 job이라 [`build-scope.yml`](../../.github/workflows/build-scope.yml)이 정한 build scope에서만 실행한다. PR 제목이 `feat(build): ...`, `fix(build)!: ...`처럼 Conventional Commits scope가 `(build)`이거나, Dependabot PR이거나, Actions 페이지에서 수동 실행한 경우다. main push는 그 commit을 merge한 PR의 제목으로 같은 규칙을 적용한다. 판정은 `scripts/build-scope.mjs`가 하며 Windows Test Build, Product Images의 이미지 빌드, 발행이 이 결과를 따른다. 제목은 PR을 열거나 새 commit을 push할 때 읽으므로, 열린 PR의 제목에 `(build)`를 붙였으면 새 commit을 push하거나 Actions 페이지에서 Windows Test Build를 수동 실행한다.

## Shared library

- Package: `@dfragon/lib`, 위치: `packages/lib`. 앱, UI, 플랫폼 전용 runtime에 의존하지 않는 공용 함수 ESM과 TypeScript 선언을 제공한다.
- `detectPartyFrameGeometry`는 가득 찬 HP, MP와 주변 테두리에서 HUD 닉네임 위치와 래스터 배율을 검출한다. 일반 Desktop OCR이 이 함수를 사용하며, 특정 해상도 일치 조건 대신 `isValidPartyFrameSize`의 메모리 보호 한도를 적용한다. [검출 범위와 한계](desktop-party-geometry.md#일반-캡처의-검출)를 참고한다.
- `detectDNFRaidParticipantWindow`, `cropDNFRaidParticipantNicknames`는 같은 모양의 12행 공대창에서 현재 화면 행별 참가 여부와 닉네임 원본 크롭을 반환하며 Desktop의 공대 캡처에서 사용한다. `readDNFRaidParticipantMetadata`의 파티, 수치 판독, `readDNFRaidParticipantValues`의 수치 판독과 `classifyDNFRaidValueColumn`의 수치 열 종류 판별, `parseDNFRaidValueNotation`의 표기 해석은 순수 객체 반환에 한정한다. [공대원창 안내](desktop-raid-participants.md)를 참고한다.
- `validateDFNickname`은 CP949 기반 최대 12바이트 형식 검사다. 실제 게임 생성 가능 여부와 기존 검색, 계정 규칙을 대신하지 않는다. 앱은 호출하지 않으며 dfragon-ocr의 학습 닉네임 생성이 원본으로 복사해 쓴다. [사용법과 한계](../../packages/lib/README.md)를 참고한다.
- `pnpm --filter @dfragon/lib test`는 build 후 공개 export, 경계값, 문자 표를 검증한다. `build`, `lint`, `format:check`도 제공한다.

## Models

- Package: `@dfragon/models`, 위치: `packages/models`. 빌드에 넣는 학습 모델 파일과 점수 엔진 바이너리를 submodule의 고정 커밋으로 제공한다. 코드와 build 명령은 없다.
- `ocr-finetuned`: 공개 모델 저장소 [dfragon-ocr-models](https://github.com/blahaj94/dfragon-ocr-models)의 submodule이다. Desktop의 `ocr-model.config.mjs`가 `@dfragon/models/ocr-finetuned/model.onnx`, `@dfragon/models/ocr-finetuned/characters.txt`로 찾는다. [받기와 갱신](../../packages/models/README.md)을 참고한다.
- `score-engine`: 비공개 저장소 `blahaj94/dfragon-score-engine`의 submodule이며 `update = none`으로 기본 checkout에서 빠진다. Desktop의 `prepare-score-engine.mjs`가 플랫폼별 엔진 파일을 `resources/score/`에 복사한다.

## License tooling

- Package: `@dfragon/licenses`, 위치: `packages/licenses`. 빌드용 수집기, 정적 원문, 버전별 upstream 보완을 관리한다. 제품 runtime은 이 패키지를 import하지 않는다.
- 기존 UI, Desktop, lib 빌드의 고지 원문 배포 경로를 유지하며 중앙 원본을 소비한다.
- `pnpm --filter @dfragon/licenses test`: typecheck와 수집 테스트. [원문 공백과 사용법](../../packages/licenses/README.md)을 함께 확인한다.

## Applications

### `apps/api`

- Package: `@dfragon/api`, Node 26, NestJS ESM. `src/http.ts`는 캐릭터 HTTP와 `/health`를 합성한다.
- DB를 쓰지 않는다. 캐릭터 상세는 요청마다 Neople에서 조회하고, 공용 아이템 상세는 API 메모리에 24시간 캐시한다.
- 필수 입력: `PORT`, `NEOPLE_API_KEY`. `SEARCH_TRUST_PROXY`는 선택이다. 인증 설정, JWT를 사용하지 않는다.
- `test`는 build, 타입, 단위, HTTP 검증이다.
- 개발: [API 개발](api-start-development.md). 이미지 실행, 운영 책임: [제품 안내](api-start-development.md#서버-이미지).

### `apps/desktop`

- Package: `@dfragon/desktop`
- Windows MVP 배포: 이름 `DFragon`, x64 NSIS, `dfragon` identity, profile과 빌드 시 HTTPS API origin을 사용한다. 로그인은 없다. 기존 `dfragon.dev` 개발 설치본과 분리하며 [설치, 사용, 빌드 안내](../../apps/desktop/README.md)를 따른다.
- Stack: Electron, React, TypeScript, electron-vite
- Process boundary: `main`, `preload`, `renderer`
- TypeScript: `tsconfig.node.json`, `tsconfig.web.json`에 `composite: false`, `noEmit: true`와 base 설정의 `noImplicitAny: false`를 덮어쓰는 `noImplicitAny: true`를 정의하며 에디터와 `typecheck`는 같은 설정을 사용한다. Root `tsconfig.json`은 빈 `files`와 두 프로젝트 참조로 에디터의 프로젝트 탐색을 연결한다. 타입 검사는 각 설정에 `tsc -p`를 실행하고 제품 산출물은 electron-vite가 생성한다.
- Main entry: `src/backend/main.ts` → `out/backend/main.js`
- 캐릭터 검색: main 검색 수명, HTTP와 preload/renderer의 위치 및 검증은 [`desktop-character-search.md`](desktop-character-search.md)를 참고한다.
- Renderer source root: `src/frontend` → `out/frontend`. `src/frontend/src`는 아래 역할로 나눈다. 실행 진입점 `main.tsx`, `App.tsx`와 App 테스트는 root에 둔다.
  - `constants/`: 서버 목록, 카드 표시 값, 캡처 설정과 공유 StyleX 변수, 테마.
  - `components/`: `CardImage`, `CaptureControls`처럼 독립적으로 쓸 수 있는 UI와 전용 스타일, 테스트를 하위 폴더 없이 둔다. 파일당 컴포넌트 하나를 선언하고 StyleX 정의는 `{name}.style.ts`로 분리한다. 이미지 실패, 입력 draft 같은 자체 UI 상태를 가질 수 있다.
  - `sections/`: 카드, 캡처, 검색의 기능 조합을 하위 폴더 없이 배치한다. 파일당 컴포넌트 하나를 선언하고 StyleX 정의는 `{name}.style.ts`로 분리한다. `CharacterCard`와 공대 축약 카드 `RaidCard`, 캡처 상태를 공유하는 `ScreenCaptureProvider`를 두며 전용 스타일, UI 테스트를 함께 둔다. UI는 `hooks`의 커스텀 hook을 사용한다.
  - `pages/`: `party/PartyScreen`, `raid/RaidScreen`(캡처 결과로 화면 값을 계산하는 파티, 공대 화면 컨테이너), `party/PartyPage`(4개 슬롯), `raid/RaidPage`(공대 보드, 자리 맞바꾸기).
  - `fixture/`: MVP 합성 데이터, 자산, 화면 제어. 공용 글꼴은 `assets/fonts`, UI 자산 원본 고지는 `packages/licenses/notices/desktop`에 두고 공용 도구가 앱별 산출물을 만든다. 제품 페이지가 fixture를 import하지 않는다.
  - `lib/`: 화면과 독립적인 입력 검증, OCR 계산, 파티 이미지 처리, 검색 초기 슬롯 생성, 검색 연결 및 캡처 수명, OCR worker와 관련 단위 테스트를 하위 폴더 없이 배치한다.
  - `hooks/`: 캐릭터 검색, 캡처 창 목록, 인식, XState 연결을 담당하는 커스텀 hook과 hook 전용 테스트를 하위 폴더 없이 둔다. 검색, OCR의 기존 비UI 구현은 `lib/capture-search.ts`, `lib/ocr.ts`에서 직접 참조한다. 캡처 전이는 `lib/party-capture-machine.ts`가 소유한다. 창 등록과 회차 시작을 구분하고 회차마다 한 프레임으로 인식하며 이전 회차의 자원과 늦은 결과를 정리한다.
  - `testing/`: 여러 테스트가 공유하는 유틸리티, mock, fixture를 둔다. 현재 `testing/fixtures`의 검색 renderer 도우미를 공유하며, 실제 테스트 파일은 검증하는 코드 옆에 둔다.
  - `types/`: 카드, 검색, 캡처, 서버의 frontend 공통 타입. IPC 타입은 기존 preload contract에서 직접 가져온다.
  - UI 의존 방향은 `pages → sections → components`다. 하위 UI는 상위 section, page나 fixture를 import하지 않고 데이터와 callback을 받는다. 같은 계층의 작은 단위를 조합할 수 있으며 모든 사용처가 세 단계를 거칠 필요는 없다. 테스트, fixture의 조합은 이 제품 의존 규칙과 구분한다.
  - 스타일은 사용하는 UI 옆에 두고 named export로 가져온다. 독립 사용 가능한 UI는 파일명과 export 이름을 맞춰 직접 import한다. 단순 태그까지 컴포넌트로 만들거나, 재수출 전용 파일, 불필요한 wrapper로 계층을 채우지 않는다. UI와 독립적인 검색 연결, OCR 구현은 `lib`에 두고, React 상태 연결은 `hooks`와 UI가 담당한다.
- 기본 앱: `pnpm --filter @dfragon/desktop dev`는 새 카드 화면을 연다. 빈 슬롯 네 개로 시작하고 다크 테마로 고정한다. 로그인, 설정, 개발자 도구는 없다. 상단 바 게임 연결 상태 칩의 CaptureControls 캡처 창은 창 등록, 대상 변경, 중지를 연결한다. 던파 창 하나 자동 감지도 등록만 하며 Alt+R이나 파티 헤더의 캡처 버튼마다 한 프레임으로 네 슬롯을 인식하고 OCR 첫 후보를 카드에 표시한다. 미검출 슬롯은 비워 두고 화면 복귀 후 자동 재개나 주기적인 반복 인식을 하지 않는다. 합성 메인, 캡처 상태 미리보기는 `dev:preview`, 빌드 미리보기는 `build:preview` 후 `ui:fixture mvp dark`로 실행한다. 전용 build mode만 미리보기 HTML, 데이터, 이미지를 포함한다. [디자인 이관](desktop-mvp-design-handoff.md)을 참고한다.
- Renderer 스타일: StyleX가 화면별 CSS를 컴파일하며 `@dfragon/ui`의 토큰과 Component를 사용한다. 제품, test, fixture의 공통 변환과 작성법은 [Desktop 스타일](desktop-styling.md)을 참고한다.
- Command:
  - `pnpm --filter @dfragon/desktop dev`
  - `pnpm --filter @dfragon/desktop test`
  - `pnpm --filter @dfragon/desktop typecheck`
  - `pnpm --filter @dfragon/desktop lint`
  - `pnpm --filter @dfragon/desktop build`

## Shared UI

- Desktop은 `@dfragon/ui/stylex-config`와 workspace catalog를 공유한다. [앱 공통 StyleX](app-styling.md)에 연결 위치, 작성, 검증 범위를 정리한다.
<DEL>

- `packages/ui`: `@dfragon/ui`, DFragon 디자인 토큰(`tokens.css`, `tokens.stylex`), Base UI 기반 공용 Component, Typo와 중립 Example. Package/peer/CSS 소유, 고지, 명령은 `packages/ui/README.md`를 따른다.
- Library: `pnpm --filter @dfragon/ui test`, `typecheck`, `lint`, `build`.
- 독립 Example: `pnpm --filter @dfragon/ui dev:examples`, `build:examples`, `preview:examples`. 별도 app workspace는 만들지 않는다.
- Desktop renderer/Example의 source resolution과 cold regression: `packages/ui/README.md`, `packages/ui/test/consumer-resolution.md`. 소비 command는 사전 library build를 요구하지 않는다.
- 각 consumer는 공용 `tokens.css`와 `foundation.css`를 browser entry에서 한 번 import한다. Library JS는 CSS를 import하지 않고 Base UI, React/JSX runtime과 StyleX를 external 처리한다. 공용 Component의 `stylex.create`는 각 consumer의 StyleX compiler가 정적 CSS로 바꾼다.
- 산출물 검증: `node packages/ui/scripts/verify-build.mjs library packages/ui/dist`, `consumer` mode로 Example, Desktop renderer 산출물을 검사한다. 입력 graph의 미사용 dependency도 보수적으로 고지에 포함한다.
- Test-only Electron UI: `apps/desktop/scripts/ui-fixture.mjs`와 `ui-fixture-preload.cts`. `pnpm --filter @dfragon/desktop ui:fixture desktop light` 또는 `example dark`로 실제 production renderer/Example을 연다. 제품 main/preload 대신 synthetic source/선택 bridge와 media 거절 stub을 사용하며 capture/OCR 성공을 검증하지 않는다.

## Repository tooling

- `scripts/create-app.mjs`: 새 app workspace 생성 script
- `pnpm create-app`: root에서 생성 script 실행
- `scripts/start-task.mjs`: 선택적 Issue 기반 준비 도구. project, Issue 번호, description을 검증하고 OPEN Issue 확인 후 최신 main 기반 `{project}-{issue-number}-{description}` branch와 worktree 생성
- `pnpm start-task <project> <Issue 번호> <description> <새 worktree 경로>`: root에서 작업 준비; GitHub CLI 인증 필요
- `node scripts/format-date.mjs '2026-09-08T15:35:00Z'`: UTC ISO 시각을 `2026년 9월 9일 00시 35분`으로 표시; 인자 생략 시 현재 한국 시간. 사용법과 검증은 [`scripts/README.md`](../../scripts/README.md#format-date)
- `pnpm check:writing`: 제품 이름 표기와 사용자 문구 문체 검사. 기준은 [표기와 문체](../rules/writing.md), 사용법은 [`scripts/README.md`](../../scripts/README.md#check-writing)
- `pnpm check:docs`: 추적 Markdown의 상대 링크 대상, heading anchor와 code span에 적은 `apps/`, `packages/`, `.github/` 경로 검사. 사용법은 [`scripts/README.md`](../../scripts/README.md#check-docs)
- `pnpm check:static`: `lint`, `format:check`, `check:writing`, `check:docs`를 차례로 실행하고 먼저 실패한 검사에서 멈춘다. 사용법은 [`scripts/README.md`](../../scripts/README.md#native-validation)
- 작업 준비와 workspace별 native validation 예제: [`scripts/README.md`](../../scripts/README.md)
- `pnpm test:tooling`: `scripts/test/*.test.mjs`의 루트 도구, 공용 helper, 포맷, workflow 연결 검사를 실행한다.
- `pnpm verify`: 저장소 검사 job을 `scripts/verify.mjs` 목록대로 차례로 실행한다. Root `test` script도 같은 명령이다. Desktop 테스트의 HOME 조건과 준비 절차는 [`scripts/README.md`](../../scripts/README.md#verify)

## Generated and dependency output

다음 directory는 일반적인 architecture context로 읽지 않는다. 현재 요청의 구현, 검증이나 원인 확인에 필요한 경우에만 확인한다.

- `node_modules`
- `dist`
- `out`
- build artifact와 cache

## Update trigger

다음 변경이 생기면 이 Reference document를 같은 PR에서 갱신한다.

- Workspace, app, package 추가, 삭제, 이름 변경
- Runtime 또는 주요 framework 변경
- 표준 command 변경
- Process boundary 또는 source root 변경
