# scripts

저장소에서 반복적으로 사용하는 local 도구입니다. 새 dependency 없이 Node.js와 기존 Git·GitHub CLI·pnpm command를 사용합니다.

서버 이미지 빌드·실행 입력은 [제품 이미지 안내](../docs/reference/api-start-development.md#서버-이미지)를 따릅니다. 서버 배포·SSH·timer·백업·복구 도구는 그 안내에서 연결한 인프라 저장소가 담당합니다.

## 작업 시작

명확한 요청은 안전한 작업 브랜치에서 바로 진행할 수 있습니다. 현재 checkout·base·미commit 변경과 진행 작업을 확인한 뒤, 사용할 기준에서 `git switch -c fix-character-search`처럼 목적이 드러나는 이름을 정합니다. 격리가 필요하면 `git worktree add -b fix-character-search ../dfragon-search <확인한-base>`를 사용합니다. 기존 작업을 덮어쓰거나 main에 직접 commit·push하지 않습니다.

## `start-task`

Issue 기반 branch·worktree 준비가 필요한 경우의 선택적 도구입니다. 일반 개발의 선행 조건이 아닙니다. `project` 인자는 GitHub Project 번호가 아니라 아래 workspace 범위입니다.

기존 OPEN Issue 확인, `origin/main` fetch, Issue별 branch와 worktree 생성을 한 번에 실행합니다. Git와 인증된 GitHub CLI가 필요하며, 대상 repository root에서 실행합니다.

```bash
node scripts/start-task.mjs api 123 fix-character-search ../dfragon-worktrees/api-123-fix-character-search
```

인자 순서는 `<project> <Issue 번호> <description> <새 worktree 경로>`입니다. 위 명령은 `api-123-fix-character-search` 브랜치를 만듭니다. `123`은 현재 저장소의 실제 OPEN Issue 번호로 바꿉니다. 마지막 인자는 아직 존재하지 않는 경로이며, 공백이 있으면 quote합니다. Base는 이번 fetch로 받은 main commit이며 현재 checkout의 미반영 변경은 포함하지 않습니다.

`project`에는 `api`, `desktop`, `web`, `ui`, `cross`, `repo` 중 하나를 전달합니다. 이 명명법은 도구를 선택했을 때의 입력 계약이며 모든 작업 브랜치에 강제하지 않습니다. `description`은 `fix-character-search`처럼 변경 동사로 시작하는 소문자 설명을 정합니다. 스크립트는 소문자로 시작하고 소문자·숫자를 하이픈 하나로 연결하는 형식을 검증하며, 동사 의미나 Issue 범위의 적합성은 담당자가 판단합니다.

기존 두 인자 명령은 사용법 오류로 거절합니다. 기존 브랜치·worktree를 바꾸거나 지우지 않으며, 같은 이름의 로컬 브랜치나 대상 경로가 이미 존재하면 생성을 거절합니다.

Root alias `pnpm start-task api 123 fix-character-search ../dfragon-worktrees/api-123-fix-character-search`도 제공합니다. 새 checkout에서는 pnpm이 dependency install을 먼저 수행할 수 있으므로, 준비만 할 때는 위 Node command를 사용합니다.

Issue 제목·URL, branch, 절대 worktree 경로, base SHA를 출력합니다. 기존 branch나 경로는 재사용하거나 덮어쓰지 않으며, 조회·fetch·생성 실패 시 non-zero로 종료합니다. 생성 후 출력된 worktree로 이동해 작업합니다.

작업·권한 기준은 [개발 흐름](../docs/rules/agent-workflow.md)을 따릅니다. 이 command는 GitHub 내용을 변경하거나 install·commit·push를 실행하지 않습니다. 경로 충돌이나 생성 실패가 있으면 원인을 확인하고 필요한 정리는 native Git command로 수행합니다.

```bash
node --test scripts/test/start-task.test.mjs
node --check scripts/start-task.mjs
```

## `format-date`

UTC ISO 시각을 한국 시간(`Asia/Seoul`)의 `2026년 9월 9일 00시 35분` 형식으로 출력합니다. 인자를 생략하면 현재 시각을 사용합니다.

```bash
node scripts/format-date.mjs '2026-09-08T15:35:00Z'
node scripts/format-date.mjs
```

입력은 `YYYY-MM-DDTHH:mm:ssZ`이며 소수 초 1–3자리를 허용합니다. 잘못된 날짜나 시간대 없는 값은 오류로 거절합니다. `formatDate(timestamp)`를 import해 재사용할 수 있습니다.

검증: `node --test scripts/test/format-date.test.mjs`, `node --check scripts/format-date.mjs`.

## `product-image-plan`

Product Images의 변경 경로를 서비스별 빌드 목록으로 바꿉니다. 앱별 경로와 공용 입력은
[서버 이미지 안내](../docs/reference/api-start-development.md#서버-이미지)를 따릅니다.
새 dependency 없이 Git과 Node.js 24를 사용합니다.

`select <plan-file>`은 GitHub event 파일과 checkout된 source commit을 확인하고,
PR의 base 또는 main push의 `before`부터 변경된 경로를 비교해 JSON 목록을 저장합니다.
Code Quality는 main push의 목록을 artifact로 전달하고 Product Images는 그 실행에서만 받습니다.
main에서는 `baseline`으로 마지막 성공 발행 실행을 찾고 `catch-up <plan-file> [baseline-plan-file]`로
아직 발행되지 않은 변경도 합칩니다. 성공 목록이 없거나 만료되었으면 전체 이미지 빌드로 복구합니다.
`output <plan-file>`은 source commit·서비스 목록을 검증한 뒤 `GITHUB_OUTPUT`에 matrix와
`has_changes`를 기록합니다. 빈 목록이면 빌드·발행을 건너뜁니다.

검증: `pnpm test:product-images`, `node --check scripts/product-image-plan.mjs`.

## `server-build-info`

Docker 빌드에서 제품 commit과 서비스명을 고정 JSON 파일로 기록합니다. 커밋 정보는 CLI 인자로만
받으며 런타임 환경변수나 GitHub의 최신 main을 읽지 않습니다. 허용 서비스는 `api`, `accounts`,
`ocr`이고 SHA는 소문자 40자리입니다. 로컬 빌드에서 빈 SHA를 전달하면 `commit: null`을 기록합니다.

```sh
node scripts/server-build-info.mjs api "$(git rev-parse HEAD)" build-info.json
node --test scripts/test/server-build-info.test.mjs
```

GitHub 이미지 빌드·발행은 내장 정보와 선택한 정확한 commit을 추가로 대조합니다.
실행 중인 서버 조회는 [제품 이미지 안내](../docs/reference/api-start-development.md#실행-중인-서버의-버전-조회)를 참고합니다.

## Native validation

로컬 API·accounts·Desktop은 각 앱 `package.json`의 `dev` 명령을 사용합니다. `pnpm --filter @dfragon/api dev`, `pnpm --filter @dfragon/accounts dev`, `pnpm --filter @dfragon/desktop dev`가 해당 앱의 `.env`를 읽으며, 개인 홈의 별도 실행 파일은 필요하지 않습니다. 최초 준비와 명시적 개발 DB migration은 [API 로컬 실행](../docs/reference/api-start-development.md#로컬-개발-명령), Desktop 설정은 [카드 화면 개발](../apps/desktop/README.md#카드-화면-개발)을 참고합니다.

실제 호출부·소비자와 변경 위험에 맞는 command를 선택합니다. 아래 조합은 workspace 전반의 검사가 필요할 때의 예제이며 매 수정의 필수 목록이 아닙니다. 아래 [pnpm regex selector와 `--sequential`](https://pnpm.io/cli/run)은 선택한 script를 이름순으로 하나씩 실행하며 실패 시 non-zero로 종료합니다. 별도 validation runner나 dependency가 필요하지 않습니다.

| 변경 범위 | Repository root에서 실행할 command |
| --- | --- |
| API | `pnpm --filter @dfragon/api run --sequential '/^(lint\|test)$/'` |
| Accounts/auth database | `pnpm --filter @dfragon/accounts test`와 `pnpm --filter @dfragon/accounts test:database` |
| API domain database | 위 API command와 `pnpm --filter @dfragon/api test:database` |
| Desktop | `pnpm --filter @dfragon/desktop run --sequential '/^(test\|lint\|build)$/'` |
| Web | `pnpm --filter @dfragon/web run --sequential '/^(test\|lint\|build)$/'` |
| Task 준비 tooling | 위 `node --test`와 `node --check` command |

API/accounts 이미지의 실행 계약은 아래 명령으로 검사합니다. Node.js 24, 설치된 workspace 의존성(`pnpm install --frozen-lockfile`), 같은 host의 Docker daemon(Docker Desktop 포함)·Buildx와 로컬에서 실행 가능한 Linux 앱 이미지가 필요합니다. PostgreSQL registry의 manifest 조회·pull을 위한 네트워크 접근도 필요합니다. [제품 이미지 안내](../docs/reference/api-start-development.md#서버-이미지)의 빌드 결과를 사용하거나, 마지막 인자를 미리 pull한 검증 대상 이미지 reference로 바꿉니다.

```bash
node apps/api/test-support/container-deployment.mjs dfragon-api:local
node apps/accounts/test-support/container-deployment.mjs dfragon-accounts:local
```

이 검사는 이미지를 빌드하지 않고 폐기 가능한 PostgreSQL·합성 credential·격리 자원을 만들어 migration 반복, accounts cleanup, entrypoint·secret mount·실행 사용자·DB 권한·HTTP 기동·정상 종료를 확인하고 자체 자원 정리를 시도합니다. 강제 종료·Docker 장애 시 자원이 남을 수 있습니다. 기존 `test:database`의 고정 PostgreSQL 이미지와 native platform 검증을 재사용하며 준비되지 않으면 실패합니다. 운영 DB나 credential은 입력하지 않습니다.

Desktop `build`는 `typecheck`를 포함하므로 위 조합에서 별도로 반복하지 않습니다. Web `build`도 `tsc -b`를 포함합니다. 빠른 feedback이 필요할 때는 기존 개별 `test`, `lint`, `typecheck` command를 먼저 실행할 수 있습니다. 여러 범위에 실제 영향을 주면 필요한 검사를 조합합니다.

API의 `test`는 `build`를 먼저 실행해 `dist`를 새로 만든 뒤 `.test-dist` compile과 test를 수행합니다. 위 API 조합은 이 build와 `tsconfig.test.json`의 compile을 포함하므로 같은 입력의 별도 typecheck를 반복하지 않습니다. 단독 `pnpm --filter @dfragon/api test`도 최신 production output을 검증합니다. Root `test`는 성공 evidence가 아닙니다. Web에는 `vitest run`을 실행하는 `test` script가 있습니다. 문서만 변경할 때 app build를 반복할 필요는 없습니다. 실제 validation 범위와 실행하지 못한 항목은 [`testing.md`](../docs/rules/testing.md)에 따라 PR에 기록합니다.

Schema First 작성·생성·적용 순서는 [`database-development.md`](../docs/reference/database-development.md)를 따른다. `db:migrate:generate`는 현재 EntitySchema와 접속한 개발 DB를 비교해 compiled ESM 계약의 Migration source를 생성하며 DB를 변경하지 않는다.

API의 `test:database`는 Docker daemon이 없거나 고정 image·native platform을 검증할 수 없으면 skip하지 않고 실패합니다. Run마다 생성한 credential, `127.0.0.1` dynamic port, ownership label이 붙은 container와 named volume만 사용하며 정상·오류·timeout·처리 가능한 signal 뒤 exact resource 부재를 확인합니다. 자원을 만들기 전에 stdout에 secret이나 연결 정보가 없는 recovery run ID와 exact container·volume 이름을 기록합니다.

`SIGKILL`, host crash, Docker daemon 장애 뒤 자원이 남으면 출력된 exact 이름을 `docker container inspect NAME --format '{{ index .Config.Labels "com.dfragon.database-test.run" }}'`과 `docker volume inspect NAME --format '{{ index .Labels "com.dfragon.database-test.run" }}'`로 각각 확인합니다. 두 결과가 출력된 run ID와 정확히 같을 때만 `docker rm --force NAME`과 `docker volume rm --force NAME`으로 회수합니다. 일치하지 않거나 inspect 자체가 실패하면 삭제하지 않습니다. 이 command는 운영 database에 사용하지 않습니다.

## `workflow`

[개발 흐름](../docs/rules/agent-workflow.md)의 그림 원본은 `scripts/workflow.mmd`입니다. `scripts/workflow.mjs`는 기존 beautiful-mermaid와 Playwright를 사용해 로컬 `.artifacts/workflow.png`를 만듭니다. 생성물은 Git에 넣지 않습니다.

```bash
pnpm workflow
```

이 명령은 browser를 설치하지 않습니다. 기존 dependency와 Playwright Chromium이 준비된 환경에서만 PNG를 생성합니다. 절차·그림 source 변경의 검토를 위해 browser 설치를 요구하지 않으며, 생성하지 않았다면 PNG 검증을 했다고 보고하지 않습니다.

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

패키지명은 `@dfragon/<app-name>` 형식이어야 하며, 앱 이름은 소문자 영문·숫자와 하이픈으로 구성해야 합니다.

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
    "lint": "eslint ."
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
