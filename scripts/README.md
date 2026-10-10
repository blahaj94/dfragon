# scripts

저장소에서 반복적으로 사용하는 local 도구입니다. 새 dependency 없이 Node.js와 기존 Git, GitHub CLI, pnpm command를 사용합니다.

서버 이미지 빌드, 실행 입력은 [제품 이미지 안내](../docs/reference/api-start-development.md#서버-이미지)를 따릅니다. 서버 배포, SSH, timer, 백업, 복구 도구는 그 안내에서 연결한 인프라 저장소가 담당합니다.

## 루트 도구 회귀 검증

`pnpm test:tooling`은 `scripts/test/*.test.mjs`를 모두 실행합니다. 작업 준비, 날짜, build-info, 이미지 선택, 앱 생성, 아이콘 생성, 공용 Docker helper, lint 플러그인, 포맷 정책, 표기와 문체 검사, 문서 링크와 경로 검사, 토큰 없는 의존성 설치, `verify` 실행기와 CI 연결의 회귀 검사가 포함됩니다. Code Quality의 PR과 main push에서도 이 명령을 실행하며, 어느 테스트든 실패하면 검사가 실패합니다. Root `pnpm test`는 [`pnpm verify`](#verify)를 실행합니다.

앱 생성과 아이콘 생성 검사는 저장소 코드를 격리된 임시 디렉터리에 복사해 실제 CLI의 출력 파일, 입력 거절, 실패 코드, 정리를 확인합니다. 아이콘 변환기는 합성 파일을 만드는 fake이므로 실제 Electron 이미지 변환 품질이나 제품 아이콘은 검증하지 않습니다. Docker helper의 mock 검사와 API/accounts의 실제 `test:database`도 구분합니다.

## 작업 시작

명확한 요청은 안전한 작업 브랜치에서 바로 진행할 수 있습니다. 현재 checkout, base, 미commit 변경과 진행 작업을 확인한 뒤, 사용할 기준에서 `git switch -c fix-character-search`처럼 목적이 드러나는 이름을 정합니다. 격리가 필요하면 `git worktree add -b fix-character-search ../dfragon-search <확인한-base>`를 사용합니다. 기존 작업을 덮어쓰거나 main에 직접 commit, push하지 않습니다.

## `start-task`

Issue 기반 branch, worktree 준비가 필요한 경우의 선택적 도구입니다. 일반 개발의 선행 조건이 아닙니다. `project` 인자는 GitHub Project 번호가 아니라 아래 workspace 범위입니다.

기존 OPEN Issue 확인, `origin/main` fetch, Issue별 branch와 worktree 생성을 한 번에 실행합니다. Git와 인증된 GitHub CLI가 필요하며, 대상 repository root에서 실행합니다.

```bash
node scripts/start-task.mjs api 123 fix-character-search ../dfragon-worktrees/api-123-fix-character-search
```

인자 순서는 `<project> <Issue 번호> <description> <새 worktree 경로>`입니다. 위 명령은 `api-123-fix-character-search` 브랜치를 만듭니다. `123`은 현재 저장소의 실제 OPEN Issue 번호로 바꿉니다. 마지막 인자는 아직 존재하지 않는 경로이며, 공백이 있으면 quote합니다. Base는 이번 fetch로 받은 main commit이며 현재 checkout의 미반영 변경은 포함하지 않습니다.

`project`에는 `api`, `desktop`, `web`, `ui`, `cross`, `repo` 중 하나를 전달합니다. 이 명명법은 도구를 선택했을 때의 입력 계약이며 모든 작업 브랜치에 강제하지 않습니다. `description`은 `fix-character-search`처럼 변경 동사로 시작하는 소문자 설명을 정합니다. 스크립트는 소문자로 시작하고 소문자, 숫자를 하이픈 하나로 연결하는 형식을 검증하며, 동사 의미나 Issue 범위의 적합성은 담당자가 판단합니다.

기존 두 인자 명령은 사용법 오류로 거절합니다. 기존 브랜치, worktree를 바꾸거나 지우지 않으며, 같은 이름의 로컬 브랜치나 대상 경로가 이미 존재하면 생성을 거절합니다.

Root alias `pnpm start-task api 123 fix-character-search ../dfragon-worktrees/api-123-fix-character-search`도 제공합니다. 새 checkout에서는 pnpm이 dependency install을 먼저 수행할 수 있으므로, 준비만 할 때는 위 Node command를 사용합니다.

Issue 제목, URL, branch, 절대 worktree 경로, base SHA를 출력합니다. 기존 branch나 경로는 재사용하거나 덮어쓰지 않으며, 조회, fetch, 생성 실패 시 non-zero로 종료합니다. 생성 후 출력된 worktree로 이동해 작업합니다.

이 command는 GitHub 내용을 변경하거나 install, commit, push를 실행하지 않습니다. 경로 충돌이나 생성 실패가 있으면 원인을 확인하고 필요한 정리는 native Git command로 수행합니다.

```bash
node --test scripts/test/start-task.test.mjs
node --check scripts/start-task.mjs
```

## `statement-spacing`

공통 Biome 포맷 뒤에 실행하는 문장 간격 도구입니다. Biome는 formatter plugin을 지원하지 않으므로 TypeScript parser로 문장 목록을 읽어 필요한 빈 줄만 추가합니다. 블록, 파일, `case`의 첫 문장이 아닌 `return`은 바로 윗줄을 빈 줄로 두고, 같은 문장 목록에서 연속되는 블록 `if` 사이에도 빈 줄 한 줄을 둡니다. 첫 문장 앞 빈 줄 제거, 여러 빈 줄의 수렴, `else`, `else if` 연결과 블록 없는 `if`의 배치는 Biome 출력을 따릅니다. 주석, 반환식, 문자열 값은 바꾸지 않습니다. 문장 바로 앞의 `biome-ignore` 주석은 문장에 붙은 것으로 보고 빈 줄을 그 위에 둡니다.

Root와 각 workspace의 `format`, `format:check`가 Biome 다음에 `--write`, `--check`로 실행합니다. 실행 위치 아래의 Git 추적, 미추적 파일 중 Git ignore 대상이 아니고 root `biome.json`의 includes에 포함된 JavaScript/TypeScript만 처리합니다. 에디터의 Biome 포맷은 이 간격을 추가하지 않으므로 `format`으로 적용합니다. Biome를 갱신하거나 정책을 수정할 때 다음 회귀검사를 실행합니다.

```sh
pnpm test:format-policy
node --check scripts/statement-spacing.mjs
```

## Biome lint 플러그인

`scripts/biome/return-expression.grit`은 `return` 식의 삼항, `??`, 반환 객체 속성의 조건식을, `scripts/biome/regex-literal-constant.grit`은 `const` 초기값이 아닌 정규식 리터럴을 보고합니다. Root `biome.json`이 두 GritQL 플러그인을 등록하며 정규식 플러그인은 테스트 코드와 생성물을 제외하는 override에서만 붙습니다. 적용 기준은 [Convention 도구 적용](../docs/rules/convention-tooling.md)을 따릅니다. `pnpm test:tooling`의 `biome-return-expression.test.mjs`, `biome-regex-literal.test.mjs`가 저장소 설정을 임시 디렉터리에 복사해 거부, 허용 사례와 제외 범위를 검증합니다.

## `format-date`

UTC ISO 시각을 한국 시간(`Asia/Seoul`)의 `2026년 9월 9일 00시 35분` 형식으로 출력합니다. 인자를 생략하면 현재 시각을 사용합니다.

```bash
node scripts/format-date.mjs '2026-09-08T15:35:00Z'
node scripts/format-date.mjs
```

입력은 `YYYY-MM-DDTHH:mm:ssZ`이며 소수 초 1–3자리를 허용합니다. 잘못된 날짜나 시간대 없는 값은 오류로 거절합니다. `formatDate(timestamp)`를 import해 재사용할 수 있습니다.

검증: `node --test scripts/test/format-date.test.mjs`, `node --check scripts/format-date.mjs`.

## `check-writing`

제품 이름 표기와 사용자 문구의 문체를 검사합니다. 기준은 [표기와 문체](../docs/rules/writing.md)입니다. 인자가 없으면 Git이 추적하는 파일을 모두 읽고, 경로를 주면 현재 디렉터리 기준으로 그 파일만 검사합니다. NUL 바이트가 있는 이진 파일, submodule 항목과 검사 스크립트 자신, 그 테스트는 건너뜁니다. 위반은 `경로:줄: 규칙: 내용`으로 출력하고 non-zero로 종료합니다. Code Quality의 Static checks가 `pnpm check:writing`을 실행합니다.

```bash
pnpm check:writing
node scripts/check-writing.mjs apps/desktop/README.md
```

검증: `node --test scripts/test/check-writing.test.mjs`, `node --check scripts/check-writing.mjs`.

## `check-docs`

Git이 추적하는 파일과 ignore 대상이 아닌 새 파일 중 `*.md`의 상대 링크를 검사합니다. 링크한 파일, 디렉터리가 저장소에 있는지와 Markdown 대상의 `#anchor`가 그 문서의 heading과 맞는지 확인합니다. Anchor는 GitHub와 같은 규칙으로 만듭니다. Heading 글자를 소문자로 바꾸고 문자, 숫자, `_`, 공백, `-` 외의 문장부호를 지운 뒤 공백을 `-`로 바꾸며, 같은 heading이 다시 나오면 `-1`, `-2`를 붙입니다. 한국어 heading도 같은 규칙입니다.

`#`로 시작하는 ATX heading만 anchor로 읽습니다. Front matter, code block, code span 안의 링크와 외부 URL, 코드 파일의 `#L10` 같은 줄 anchor는 검사하지 않습니다. 위반은 `경로:줄: 규칙: 링크나 경로`로 출력하고 non-zero로 종료합니다. Code Quality의 Static checks와 `pnpm verify`가 `pnpm check:docs`를 실행합니다.

Code span 전체가 `apps/`, `packages/`, `.github/`로 시작하는 저장소 경로이면 그 파일, 디렉터리가 있는지도 확인합니다. 아직 add하지 않은 새 파일도 있는 것으로 봅니다. `*`, `<이름>`, `...`이 든 glob, 자리표시와 `:10`처럼 줄 번호를 붙인 표기, ignore 규칙에 걸리는 build 산출물과 `.env`, submodule 안의 파일은 건너뜁니다. Front matter가 `status: historical`인 문서는 과거 revision의 경로를 기록하므로 경로를 확인하지 않습니다. `scripts/...`, `docs/...`처럼 짧은 경로는 앱 디렉터리나 upstream 저장소 기준인 경우가 많아 확인하지 않습니다.

```bash
pnpm check:docs
```

검증: `node --test scripts/test/check-docs.test.mjs`, `node --check scripts/check-docs.mjs`.

## `product-image-plan`

Product Images의 변경 경로를 서비스별 빌드 목록으로 바꿉니다. 앱별 경로와 공용 입력은
[서버 이미지 안내](../docs/reference/api-start-development.md#서버-이미지)를 따릅니다.
새 dependency 없이 Git과 Node.js 24를 사용합니다.

`select <plan-file>`은 GitHub event 파일과 checkout된 source commit을 확인하고,
PR의 base 또는 main push의 `before`부터 변경된 경로를 비교해 JSON 목록을 저장합니다.
Code Quality는 main push의 목록을 artifact로 전달하고 Product Images는 그 실행에서만 받습니다.
main에서는 `baseline`으로 마지막 성공 발행 실행을 찾고 `catch-up <plan-file> [baseline-plan-file]`로
아직 발행되지 않은 변경도 합칩니다. 성공 목록이 없거나 만료되었으면 전체 이미지 빌드로 복구합니다.
`output <plan-file>`은 source commit, 서비스 목록을 검증한 뒤 `GITHUB_OUTPUT`에 matrix와
`has_changes`를 기록합니다. 빈 목록이면 빌드, 발행을 건너뜁니다.

검증: `pnpm test:product-images`, `node --check scripts/product-image-plan.mjs`.

## `server-build-info`

Docker 빌드에서 제품 commit과 서비스명을 고정 JSON 파일로 기록합니다. 커밋 정보는 CLI 인자로만
받으며 런타임 환경변수나 GitHub의 최신 main을 읽지 않습니다. 허용 서비스는 `api`, `accounts`,
`ocr`이고 SHA는 소문자 40자리입니다. 로컬 빌드에서 빈 SHA를 전달하면 `commit: null`을 기록합니다.

```sh
node scripts/server-build-info.mjs api "$(git rev-parse HEAD)" build-info.json
node --test scripts/test/server-build-info.test.mjs
```

GitHub 이미지 빌드, 발행은 내장 정보와 선택한 정확한 commit을 추가로 대조합니다.
실행 중인 서버 조회는 [제품 이미지 안내](../docs/reference/api-start-development.md#실행-중인-서버의-버전-조회)를 참고합니다.

## `dependency-snapshot`

pnpm 11 lockfile은 pnpm 실행 파일을 담은 첫 YAML 문서와 workspace 의존성을 담은 마지막 문서로 나뉩니다. 현재 GitHub dependency graph는 이 lockfile에서 첫 문서의 package만 인식해 workspace의 전이 의존성이 Dependabot alerts와 dependency review에서 빠집니다. Dependency Review workflow는 `pnpm sbom --sbom-format cyclonedx --lockfile-only` 결과를 이 도구로 Dependency submission snapshot으로 바꿔 제출합니다.

인자는 `<cyclonedx-sbom-file> <snapshot-file>`이고 `SNAPSHOT_SHA`, `SNAPSHOT_REF`(`refs/heads/<branch>`), `GITHUB_WORKFLOW`, `GITHUB_JOB`, `GITHUB_RUN_ID`를 읽습니다. Workspace가 직접 의존하는 package는 `direct`, 나머지는 `indirect`로 기록합니다. pnpm이 개발 의존성으로만 도달한다고 표시한(`excluded`) package는 `development`, 나머지는 `runtime`입니다. peer 조합처럼 bom-ref만 다르고 purl이 같은 package는 하나로 합치며, 한 변형이라도 `direct`, `runtime`이면 그 값을 쓰고 하위 의존성은 중복 없이 모읍니다. 그래프가 불완전하거나 commit, branch 값이 올바르지 않으면 파일을 쓰지 않고 실패합니다.

main push는 Dependabot alerts의 기준을, 같은 저장소 PR은 dependency review가 비교할 PR head를 제출합니다. Fork PR은 쓰기 권한이 없어 제출하지 않고, review는 정적 dependency graph만 비교합니다.

검증: `node --test scripts/test/dependency-snapshot.test.mjs`, `node --check scripts/dependency-snapshot.mjs`.

## `verify`

`pnpm verify`는 Code Quality workflow의 검사 job 가운데 Docker가 필요 없는 job을 로컬에서 다시 실행합니다. Root `pnpm test`도 같은 명령입니다. 정적 검사(`lint`, `format:check`, `check:writing`, `check:docs`), 루트 도구 테스트, 공용 package, Desktop test와 typecheck, API, accounts, OCR, Web job의 run 명령을 workflow와 같은 순서로 실행합니다. Docker PostgreSQL을 쓰는 API, accounts의 `test:database`와 Desktop 검색 통합은 `pnpm verify:database`로 따로 실행합니다.

명령 목록은 `scripts/verify.mjs`에 있고, `scripts/test/code-quality-workflow.test.mjs`가 workflow의 job, run 명령과 어긋나면 실패합니다. CI가 runner를 준비하려고 실행하는 Playwright 설치, main push의 이미지 선택(`image-plan`)과 결과 집계(`lint-and-format`) job은 대응에서 제외합니다. 의존성 설치는 먼저 끝냈다고 봅니다.

Job 안에서는 앞 명령이 실패하면 남은 명령을 건너뛰고 다른 job은 계속 실행합니다. 끝에 실패한 job, 명령, 종료 코드와 건너뛴 명령 수를 모아 출력하고 non-zero로 종료합니다. Job끼리 같은 build 산출물을 쓰므로 병렬로 실행하지 않습니다. 의존성과 Electron runtime이 준비된 Apple silicon Mac에서 전체 실행에 약 3분 걸렸습니다.

```bash
pnpm verify
pnpm verify:database
```

- `pnpm install --frozen-lockfile`로 의존성을 설치합니다. CI의 Desktop job은 OCR 모델 submodule도 받으므로 같은 입력으로 확인하려면 `git submodule update --init --recursive apps/desktop/models/finetuned`를 실행합니다.
- Desktop 테스트는 HOME의 모든 상위 디렉터리가 root나 현재 사용자 소유이고 group, other 쓰기 권한이 없어야 통과합니다. [Desktop 테스트 범위](../apps/desktop/README.md#테스트-범위와-실행)를 참고합니다.
- `verify:database`에는 같은 host의 Docker daemon(Docker Desktop 포함)과 Buildx, 고정 PostgreSQL 이미지를 받을 네트워크, accounts 패스키 시나리오용 Playwright Chromium이 필요합니다. Chromium은 `pnpm exec playwright install chromium`으로 한 번 설치하고, Linux에서 브라우저 시스템 라이브러리가 없으면 CI처럼 `--with-deps`를 붙입니다.

로컬 통과는 Linux runner의 Code Quality 결과, Windows의 Desktop workflow, Product Images 실행을 대신하지 않습니다. 실행기는 macOS, Linux에서 확인했고 Windows에서는 확인하지 않았습니다. Shell 없이 `pnpm`을 시작하므로 `pnpm.cmd`만 있는 Windows 환경에서는 명령을 시작하지 못할 수 있습니다.

## Native validation

로컬 API, accounts, Desktop은 각 앱 `package.json`의 `dev` 명령을 사용합니다. `pnpm --filter @dfragon/api dev`, `pnpm --filter @dfragon/accounts dev`, `pnpm --filter @dfragon/desktop dev`가 해당 앱의 `.env`를 읽으며, 개인 홈의 별도 실행 파일은 필요하지 않습니다. 최초 준비와 명시적 개발 DB migration은 [API 로컬 실행](../docs/reference/api-start-development.md#로컬-개발-명령), Desktop 설정은 [카드 화면 개발](../apps/desktop/README.md#카드-화면-개발)을 참고합니다.

실제 호출부, 소비자와 변경 위험에 맞는 command를 선택합니다. 아래 조합은 workspace 전반의 검사가 필요할 때의 예제이며 매 수정의 필수 목록이 아닙니다. 아래 [pnpm regex selector와 `--sequential`](https://pnpm.io/cli/run)은 선택한 script를 이름순으로 하나씩 실행하며 실패 시 non-zero로 종료합니다. 별도 validation runner나 dependency가 필요하지 않습니다.

| 변경 범위 | Repository root에서 실행할 command |
| --- | --- |
| Code Quality 전체 | `pnpm verify`, Docker가 있으면 `pnpm verify:database` |
| API | `pnpm --filter @dfragon/api run --sequential '/^(lint\|test)$/'` |
| Accounts/auth database | `pnpm --filter @dfragon/accounts test`와 `pnpm --filter @dfragon/accounts test:database` |
| API domain database | 위 API command와 `pnpm --filter @dfragon/api test:database` |
| Desktop | `pnpm --filter @dfragon/desktop run --sequential '/^(test\|lint\|build)$/'` |
| Web | `pnpm --filter @dfragon/web run --sequential '/^(test\|lint\|build)$/'` |
| Task 준비 tooling | 위 `node --test`와 `node --check` command |

Code Quality의 Static checks와 같은 검사를 로컬에서 한 번에 실행할 때는 root에서 `pnpm check:static`을 사용합니다. `lint`, `format:check`, `check:writing`, `check:docs`를 CI와 같은 순서로 실행하며 먼저 실패한 검사에서 멈춥니다.

API/accounts 이미지의 실행 계약은 아래 명령으로 검사합니다. Node.js 24, 설치된 workspace 의존성(`pnpm install --frozen-lockfile`), 같은 host의 Docker daemon(Docker Desktop 포함), Buildx와 로컬에서 실행 가능한 Linux 앱 이미지가 필요합니다. PostgreSQL registry의 manifest 조회, pull을 위한 네트워크 접근도 필요합니다. [제품 이미지 안내](../docs/reference/api-start-development.md#서버-이미지)의 빌드 결과를 사용하거나, 마지막 인자를 미리 pull한 검증 대상 이미지 reference로 바꿉니다.

```bash
node apps/api/test-support/container-deployment.mjs dfragon-api:local
node apps/accounts/test-support/container-deployment.mjs dfragon-accounts:local
```

이 검사는 이미지를 빌드하지 않고 폐기 가능한 PostgreSQL, 합성 credential, 격리 자원을 만들어 migration 반복, accounts cleanup, entrypoint, secret mount, 실행 사용자, DB 권한, HTTP 기동, 정상 종료를 확인하고 자체 자원 정리를 시도합니다. 강제 종료, Docker 장애 시 자원이 남을 수 있습니다. 기존 `test:database`의 고정 PostgreSQL 이미지와 native platform 검증을 재사용하며 준비되지 않으면 실패합니다. 운영 DB나 credential은 입력하지 않습니다.

Desktop `build`는 `typecheck`를 포함하므로 위 조합에서 별도로 반복하지 않습니다. Web `build`도 `tsc -b`를 포함합니다. 빠른 feedback이 필요할 때는 기존 개별 `test`, `lint`, `typecheck` command를 먼저 실행할 수 있습니다. 여러 범위에 실제 영향을 주면 필요한 검사를 조합합니다.

API의 `test`는 `build`를 먼저 실행해 `dist`를 새로 만든 뒤 `.test-dist` compile과 test를 수행합니다. 위 API 조합은 이 build와 `tsconfig.test.json`의 compile을 포함하므로 같은 입력의 별도 typecheck를 반복하지 않습니다. 단독 `pnpm --filter @dfragon/api test`도 최신 production output을 검증합니다. Root `test`는 `pnpm verify`와 같습니다. Web에는 `vitest run`을 실행하는 `test` script가 있습니다. 문서만 변경할 때 app build를 반복할 필요는 없습니다. 실행 결과에는 실제 검증 범위와 실행하지 못한 항목을 구분해 기록합니다.

Schema First 작성, 생성, 적용 순서는 [`database-development.md`](../docs/reference/database-development.md)를 따른다. `db:migrate:generate`는 현재 EntitySchema와 접속한 개발 DB를 비교해 compiled ESM 계약의 Migration source를 생성하며 DB를 변경하지 않는다.

Accounts와 API의 PostgreSQL 컨테이너, 이미지 검증, 정리 원본은 `scripts/test-support/docker-postgres.mjs`입니다. 앱별 runner는 schema와 seed 등 앱 책임만 유지합니다. 공통 회귀 검증은 `node --test scripts/test/docker-postgres.test.mjs`로 실행하며 두 앱의 `test`에도 포함됩니다. Docker를 실행하는 실제 DB, 컨테이너 통합 검증과 이 mock 기반 helper 검증은 구분합니다.

Code Quality는 PR과 main push마다 API와 accounts의 `test:database`를 GitHub runner의 Docker에서 별도 job(`API database integration`, `Accounts database integration`)으로 실행하며, 로컬에서는 `pnpm verify:database`가 두 job과 Desktop 검색 통합 job의 명령을 차례로 실행합니다. Runner는 `linux/amd64`이므로 고정 PostgreSQL 이미지의 amd64 digest를 검증합니다. Accounts job은 패스키 시나리오의 가상 인증기를 위해 Playwright Chromium을 먼저 설치합니다. 두 job은 main ruleset의 필수 check인 `lint-and-format` 집계에 포함되어 실패하면 PR merge가 막힙니다. main에서는 Product Images가 Code Quality 전체 실행의 성공을 확인하므로, 두 job이 실패하면 이미지도 빌드, 발행하지 않습니다.

API의 `test:database`는 Docker daemon이 없거나 고정 image, native platform을 검증할 수 없으면 skip하지 않고 실패합니다. Run마다 생성한 credential, `127.0.0.1` dynamic port, ownership label이 붙은 container와 named volume만 사용하며 정상, 오류, timeout, 처리 가능한 signal 뒤 exact resource 부재를 확인합니다. 자원을 만들기 전에 stdout에 secret이나 연결 정보가 없는 recovery run ID와 exact container, volume 이름을 기록합니다.

`SIGKILL`, host crash, Docker daemon 장애 뒤 자원이 남으면 출력된 exact 이름을 `docker container inspect NAME --format '{{ index .Config.Labels "com.dfragon.database-test.run" }}'`과 `docker volume inspect NAME --format '{{ index .Labels "com.dfragon.database-test.run" }}'`로 각각 확인합니다. 두 결과가 출력된 run ID와 정확히 같을 때만 `docker rm --force NAME`과 `docker volume rm --force NAME`으로 회수합니다. 일치하지 않거나 inspect 자체가 실패하면 삭제하지 않습니다. 이 command는 운영 database에 사용하지 않습니다.

검증이 실패하면 API, accounts runner는 실패한 단계 이름 아래에 정제한 원인을 출력합니다. Docker 명령 실패는 `Docker command failed: buildx imagetools inspect (exit code 1)`처럼 하위 명령과 종료 상태, stderr의 앞 2줄과 뒤 3줄을 남깁니다. `--env` 값, 연결 문자열의 사용자 정보, password나 token 같은 이름에 붙은 값과 생성한 DB 비밀번호는 `[redacted]`로 가립니다. Docker CLI 설정 위치를 옮긴 환경에서도 buildx 같은 plugin을 찾도록 `DOCKER_CONFIG`를 Docker 명령에 전달합니다.

## `create-app`

새로운 API 애플리케이션 workspace를 생성합니다.

저장소 루트에서 실행:

```bash
pnpm create-app --name @dfragon/api
```

`-n` 축약 옵션도 지원합니다.

```bash
pnpm create-app -n @dfragon/api
```

스크립트 프로젝트의 생성기를 직접 실행할 수도 있습니다.

```bash
node scripts/create-app.mjs --name @dfragon/api
```

패키지명은 `@dfragon/<app-name>` 형식이어야 하며, 앱 이름은 소문자 영문, 숫자와 하이픈으로 구성해야 합니다.

```bash
pnpm create-app --name @dfragon/party-api
```

생성 결과:

```text
apps/party-api/
├── src/
└── package.json
```

생성되는 `package.json`의 기본값:

```json
{
  "name": "@dfragon/party-api",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "",
    "build": "",
    "test": "",
    "typecheck": "tsc --noEmit",
    "lint": "biome lint"
  }
}
```

`dev`, `build`, `test` 스크립트는 API 서버 프레임워크를 정한 뒤 구현합니다.

### 안전 규칙

- 기존 `apps/<app-name>` 디렉터리가 있으면 생성하지 않고 종료합니다.
- 기존 파일을 덮어쓰지 않습니다.
- 생성기 자체는 `pnpm install`을 자동 실행하지 않습니다.
- 생성 후 workspace 인식 여부는 다음 명령으로 확인할 수 있습니다.

```bash
pnpm list -r --depth -1
```

npm으로 루트 명령을 실행하는 경우에는 스크립트 인자 앞에 `--`를 추가합니다.

```bash
npm run create-app -- --name @dfragon/api
```

구현은 같은 디렉터리의 [`create-app.mjs`](./create-app.mjs)에 있습니다.
