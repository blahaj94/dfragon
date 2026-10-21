# DFragon 저장소 안내

누가 작업하든 참인 저장소 사실만 적는다. 개인 작업 습관은 각자 로컬 지침에서 관리한다.

## 먼저 읽을 곳

- [문서 안내](docs/README.md): 주제별 제품 계약(Rule)과 현재 구현 안내(Reference)
- [Repository Map](docs/reference/repository-map.md): workspace, app, package 구조와 표준 명령
- [scripts 안내의 Native validation](scripts/README.md#native-validation): 로컬 실행과 변경 범위별 검증 명령

## 설치

- Node.js 26(root `package.json`의 `devEngines.runtime`이 고정한 버전을 pnpm이 내려받아 script에 쓴다. API, accounts, OCR의 `engines`는 `>=26.11.1 <27`)과 pnpm 12.11.2(root `package.json`의 `packageManager`)를 쓴다. Desktop main, preload는 Electron 44.7.0이 내장한 Node 24.21.0에서 실행되고, 호스트 Node 26은 Desktop의 테스트, 빌드 실행기로만 쓴다.
- 의존성은 `pnpm install --frozen-lockfile`로 설치한다.
- Desktop을 CI와 같은 입력으로 테스트, 빌드하려면 `git submodule update --init --recursive packages/models/ocr-finetuned`로 OCR 모델 submodule을 받는다. 비공개 점수 엔진 submodule은 읽기 권한이 있을 때만 `git submodule update --init --checkout packages/models/score-engine`로 받으며, 없으면 점수 없이 빌드된다.

## 검증

- `pnpm verify`가 Code Quality workflow의 Docker 없는 검사 job을 같은 순서로 실행한다. Root `pnpm test`도 `pnpm verify`를 실행한다.
- `pnpm install`이 husky `pre-push` hook을 설치하며, hook이 push 전에 `pnpm verify`를 실행한다. CI는 PR 제목 scope가 `(build)`일 때만 앱 테스트와 빌드를 실행한다. 규칙은 [Repository Map의 CI 설명](docs/reference/repository-map.md)에 있다.
- Docker가 있으면 `pnpm verify:database`로 API, accounts의 `test:database`와 Desktop 검색 통합을 실행한다.
- 변경 범위별 명령 조합은 [Native validation](scripts/README.md#native-validation), 준비 조건은 [`verify` 안내](scripts/README.md#verify)를 따른다.
- OCR UI smoke(`test:ui`)와 accounts DB 테스트에는 Playwright Chromium이 필요하다. Root에서 `pnpm exec playwright install chromium`으로 한 번 설치한다. [OCR 테스트 범위](apps/ocr/README.md#테스트의-검증-범위)를 참고한다.
- Desktop 테스트는 HOME의 모든 상위 디렉터리가 root나 현재 사용자 소유이고 group, other 쓰기 권한이 없어야 통과한다. [Desktop 테스트 범위](apps/desktop/README.md#테스트-범위와-실행)를 참고한다.

## 작업 경계

- main은 ruleset에 따라 PR로만 바꾼다. 작업 브랜치에서 PR을 열고, PR merge는 저장소 소유자가 하거나 소유자가 허락한 PR을 에이전트가 대신 한다. 에이전트는 현재 PR head의 필수 check가 통과했을 때만 merge하며, 관리자 권한으로 ruleset을 건너뛰는 merge(`gh pr merge --admin`)는 하지 않는다.
- PR merge에는 필수 check 통과만 필요하고 리뷰 승인은 요구하지 않는다. `.github/CODEOWNERS`는 리뷰 요청 대상만 정한다. 저장소 관리자는 PR merge 때 이 조건을 건너뛸 수 있다.
- `v*` tag 생성과 삭제, Release 게시, Windows Portable workflow 실행, main에서 이미지를 발행하는 Product Images run의 재실행은 저장소 소유자가 한다. 절차는 [포터블 exe와 GitHub Releases](apps/desktop/README.md#포터블-exe와-github-releases)에 있다.
- Ruleset, Secret, Environment와 저장소 설정도 저장소 소유자가 바꾼다.
- 개발과 테스트에는 운영 DB와 실제 credential을 쓰지 않는다. `db:migrate:down`은 로컬의 폐기 가능한 DB에서만 실행한다([작성과 적용](docs/reference/database-development.md#작성과-적용)).
- `pnpm-lock.yaml`과 `packages/lib/src/cp949-characters.ts`처럼 도구가 만든 파일은 손으로 고치지 않고 `pnpm install`, `pnpm --filter @dfragon/lib generate:cp949` 같은 생성 명령으로 다시 만든다. 생성물, vendor, license/notice의 소유 규칙은 [Convention 도구 적용](docs/rules/convention-tooling.md#설정과-소유권)을 따른다.

## PR

최근 merge된 PR처럼 요약 뒤에 항목별 문제와 변경을 적고, 실제 실행한 검증과 머지 위험을 따로 적는다. 문서와 사용자 문구는 [표기와 문체](docs/rules/writing.md)를 따른다.
