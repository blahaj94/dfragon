---
type: rule
status: active
enforcement: approval-required
scope: architecture
last-reviewed: 2026-10-29
---

# Architecture Overview

## Repository topology

DFragon은 pnpm workspace monorepo다.

```text
apps/
  api/
  desktop/
packages/
  ui/
  lib/
  licenses/
  models/
scripts/
```

- `apps/api`: 캐릭터 공개 NestJS API workspace. DB 없이 요청마다 Neople API를 조회한다. 승인된 ESM runtime, dependency, build/test 계약은 [`../rules/api-runtime.md`](../rules/api-runtime.md)를 따른다. 구현 현황은 Reference에서 확인한다.
- `apps/desktop`: Electron, React, TypeScript, electron-vite 기반 desktop application.
- `packages/ui`: 현재 tracked shared UI package `@dfragon/ui`. 실제 구현, 명령은 [Repository Map](../reference/repository-map.md#shared-ui)에서 확인한다.
- `packages/lib`: 앱과 UI에 의존하지 않는 공용 순수 함수 `@dfragon/lib`. 아래 Shared library boundary를 따른다.
- `packages/licenses`: 빌드 시 고지 원문, 수집, 배포 자료를 관리하는 `@dfragon/licenses`. 제품 runtime에서 import하지 않는다.
- `packages/models`: 빌드에 넣는 학습 모델 파일을 제공하는 `@dfragon/models`. 아래 Model package boundary를 따른다.
- `scripts`: repository 생성, 관리 script.

상세한 file과 command 현황은 [`../reference/repository-map.md`](../reference/repository-map.md)를 따른다.

## Approved boundary

현재 workspace, app boundary와 API runtime, 검증 기반이 승인됐다. 검색의 입력, 응답, 오류는 [`../rules/character-search.md`](../rules/character-search.md)를 따른다. 회원 인증 서비스와 DB는 두지 않는다(2026-10-26 결정, [Issue #796](https://github.com/blahaj94/dfragon/issues/796)). API는 DB 없이 동작한다. 공용 아이템 정보만 API 메모리에 24시간 캐시하며, 지금은 서버 한 대, 인스턴스 하나라 메모리로 충분하다(2026-10-29 결정, [Issue #992](https://github.com/blahaj94/dfragon/issues/992)). 여러 노드로 늘리면 캐시를 노드가 공유하는 저장소(Redis)로 옮긴다. 다음 사항은 구체 결정, 확보 또는 검증이 남아 있다.

- Web/mobile client
- 아래 Shared UI, Shared library boundary 이외의 shared package 종류와 dependency direction
- 현재 요청과 MVP 운영 기준을 벗어나는 새로운 deployment boundary

미정 사항을 구현해야 하면 AI는 임의로 architecture를 확정하지 않고 사용자에게 대안과 trade-off를 제시한다.

Desktop은 파티, 공대 캡처와 검색, 카드의 캐릭터 면만 둔다. 로그인, 설정, 개발자 도구, OCR 수집 업로드, 캐릭터 상세 창과 카드의 장비, 기타 면은 두지 않는다(2026-10-26 결정, [Issue #796](https://github.com/blahaj94/dfragon/issues/796)).

## 점수 엔진 경계

비공개 저장소가 만든 C 네이티브 점수 엔진(Windows DLL, macOS dylib)은 Desktop main process가 띄운 Node worker thread 하나에서 `koffi`로 불러 쓴다(2026-10-19 결정, [Issue #716](https://github.com/blahaj94/dfragon/issues/716), worker 이전은 [Issue #987](https://github.com/blahaj94/dfragon/issues/987)). Main의 경계는 `apps/desktop/src/backend/score/engine.ts`, worker 진입은 `worker.ts`다. 엔진은 OS thread마다 첫 계산을 초기화하므로 준비와 모든 계산을 같은 worker에서 하고, main은 계산을 기다리는 동안 막히지 않는다.

| 대상 | 책임 |
| --- | --- |
| 비공개 엔진 저장소 | 엔진의 소스, 계산 데이터, 빌드, Release를 소유한다. |
| 이 저장소 | 엔진을 불러 쓰는 로더와 바이너리 입수 script만 둔다. 엔진의 소스, 데이터, 바이너리를 commit하지 않는다. |
| `apps/desktop` main | Main process의 점수 worker가 엔진을 `koffi`로 로드하고 호출하는 유일한 실행 위치다. 결과 검증과 진단은 main이 맡는다. |
| renderer, preload, `apps/api` | 엔진을 로드하거나 import하지 않는다. renderer는 main이 계산해 전달한 결과만 받는다. |

- **빌드 조건**: 엔진 바이너리는 CI secret으로 입수한다. 엔진 없는 빌드를 허용한다.
- **코드 노출 한계**: 컴파일된 코드도 역공학으로 해석할 수 있다. 이 경계는 소스와 데이터를 공개 저장소 밖에 두는 소유 분리이며, Desktop에 실린 바이너리의 로직이 끝까지 숨겨진다고 보장하지 않는다.

## Shared UI boundary

`@dfragon/ui`가 자체 토큰과 Base UI 기반 공용 Component를 소유한다(2026-10-18 결정). 아래 경계의 build 산출물 검사는 `packages/ui/scripts/verify-build.mjs`가 맡는다. UI 내부 배치, 스타일, 토큰, Example 범위와 이행 기준은 [Design System](../rules/design-system.md)을 따른다.

| 대상 | 책임과 dependency direction |
| --- | --- |
| `packages/ui`의 `@dfragon/ui` | Browser React shared package 하나로 자체 토큰(`tokens.css`, `tokens.stylex`), Base UI 기반 공용 Component, 공용 형태와 실제로 공유하는 Layout, composition, 디자인 컴포넌트, Typo를 제공한다. `@dfragon/ui` → Base UI/React, StyleX runtime 방향으로 연결하며 app source, 앱 테마, API client, backend, Electron main/preload, IPC, 인증, domain을 import하지 않는다. |
| `apps/desktop` renderer | `@dfragon/ui`를 소비하고 제품 data, event, behavior와 app별 platform 연결을 맡는다. Desktop main/preload는 UI package를 소비하지 않는다. |
| 독립 Vite Example entry | 필요한 상태를 실제 화면에서 확인하기 어려울 때 같은 `@dfragon/ui` public API와 합성 content로 확인한다. 새 화면마다 Component, Pattern, Template 예제를 갖출 의무는 없다. |

공용 Component는 Base UI 부품의 semantic API와 접근성 동작을 유지하고 외형만 StyleX로 그린다. 같은 역할의 Component를 이름만 바꿔 다시 감싸지 않는다. 화면별 스타일 허용 범위와 필요한 Example, 토큰, version, 영향 검증은 [`design-system.md`](../rules/design-system.md)가 canonical Rule이다.

### Dependency와 CSS 소유

- `@dfragon/ui`는 `@base-ui/react`, `@stylexjs/stylex`, React, React DOM을 peer dependency로 선언한다. 개발, test에 필요한 사본은 dev dependency로 둔다. 소비 app, Example은 manifest, lockfile에 기록된 호환 조합을 제공한다. React도 소비 환경과 일치시키며 검증하지 않은 지원 범위를 주장하지 않는다.
- Library를 bundle하면 `@base-ui/react`, `@stylexjs/stylex`와 React, React DOM 및 JSX runtime entry를 external 처리한다. 산출물에 별도 Base UI runtime, StyleX runtime, CSS 또는 React 사본이 포함되지 않는지 확인한다. Peer 선언만으로 external 처리가 보장된다고 가정하지 않는다. `@seed-design/*`, `@karrotmarket/*`는 dependency와 external에 두지 않는다.
- Library source에서 CSS를 직접 import하지 않는다. `tokens.css`와 `foundation.css`는 package export로 제공하고, 각 소비 app, Example의 browser entry가 `tokens.css`, `foundation.css`, 앱 전역 글꼴 CSS 순서로 한 번 import한다. 테마는 다크 하나라 `tokens.css`가 `:root`에 다크 색 변수와 `color-scheme: dark`를 두며, 소비 앱은 테마 값을 따로 넣지 않는다. Base UI는 스타일을 제공하지 않으므로 별도 vendor CSS를 두지 않는다.
- Library의 StyleX는 `--df-*` 변수만 참조한다. 토큰 상수는 `stylex.defineConsts`로 정의하며 `defineVars`, `createTheme`, 앱 테마는 쓰지 않는다. Library build는 StyleX를 컴파일하지 않고 CSS를 내지 않으며, 소비 앱이 `@dfragon/ui/stylex-config`로 변환한다. `@dfragon/ui/tokens.stylex`는 React 없는 `defineConsts` entry라 소비 앱의 StyleX 컴파일이 필요하고, `@dfragon/ui/typo`는 StyleX 없는 React 전용 entry로 유지한다.
- Base UI는 별도 bundler plugin 없이 소비한다. Desktop의 electron-vite renderer와 실제 Electron(CSP 포함) 호환성은 [Desktop 이행 PR](https://github.com/blahaj94/dfragon/pull/704)에서 확인했다. 하나의 alias만을 위해 `vite-tsconfig-paths`를 추가하지 않고 기존 Vite의 `resolve.alias`를 사용한다.
- 아이콘은 `@dfragon/ui`와 앱이 소유한 SVG 컴포넌트로 그린다. Dependency, 역할 변경은 [제품 계약 적용 기준](../README.md#document-class)과 해당 runtime, 배포 계약을 따른다.

Package의 published peer 범위는 조합 선정 evidence이며 실제 Electron 호환성, CSS 중복 없음, accessibility, 시각 일치 성공을 보증하지 않는다. 변경한 library 산출물과 영향받는 소비 환경을 검증하며 기존 Example, 사용 안내가 틀려진 부분은 같은 PR에서 고친다. 모든 소비 환경과 예제를 매번 재검증하지 않는다.

## Shared library boundary

`packages/lib`의 `@dfragon/lib`는 앱 → library 방향으로 소비하는 순수 함수를 제공하며 앱 source, UI, Node/Electron 전용 runtime, 네트워크, 저장소에 의존하지 않는다. 제공하는 함수의 범위는 [공용 함수 안내](../../packages/lib/README.md)를 따른다. 이미지 디코딩, 게임 캡처, OCR, 저장과 화면 연결은 소비 앱이 소유한다.

## License tooling boundary

`@dfragon/licenses`는 UI, Desktop, 공용 library의 **빌드 도구 의존성**으로 고지 원문, 수집, 산출물 생성을 담당한다. 제품 runtime 의존성으로 연결하지 않는다. 소유 app/package는 source provenance와 사용 자산을 전달하고, 중앙 도구는 소유 앱의 제품 코드를 import하지 않는다. 기존 LICENSE/NOTICE와 source 수정 표시는 보존한다. 확인되지 않은 원문과 법률상 추가 조건을 수집 성공으로 대체하지 않는다. [사용법과 한계](../../packages/licenses/README.md)를 따른다.

## Model package boundary

OCR 파인튜닝 모델 submodule은 `packages/models`의 workspace package `@dfragon/models`에 둔다.

| 대상 | 책임과 dependency direction |
| --- | --- |
| `packages/models`의 `@dfragon/models` | 모델 저장소를 submodule로 고정 커밋에 묶고 `exports`로 모델, 사전 파일 경로를 제공한다. 코드와 dependency가 없으며 앱 source를 참조하지 않는다. |
| `apps/desktop` | 빌드 설정에서 패키지 이름으로 모델 파일을 찾아 renderer 자원으로 복사한다. 어떤 모델을 넣을지와 호환성 검증은 Desktop이 소유한다. |

점수 엔진 바이너리도 같은 패키지의 submodule(`score-engine`)로 입수한다. 바이너리 저장소가 비공개라 기본 checkout에서 빠지며(`update = none`) 권한이 없는 checkout은 점수 없이 빌드한다. 어떤 엔진을 넣을지는 submodule 커밋으로 고정하고 Desktop이 플랫폼별 파일을 패키지 자원으로 복사한다.


모델 원본과 학습은 모델 저장소가 소유하며 이 저장소에 모델 파일을 commit하지 않는다. 점수 엔진의 소스와 빌드는 비공개 엔진 저장소가 소유한다. 사용법과 갱신 절차는 [패키지 안내](../../packages/models/README.md)를 따른다.

## Architecture change

같은 책임은 먼저 소유 앱의 모듈에 둔다. 별도 package는 독립 계약, 앱으로 되돌아가지 않는 의존성과 실제 경계 이점이 있을 때 분리한다. 앱이 package를 소비하고 package는 소비 앱의 source, 전역 상태에 의존하지 않는다. 미래의 재사용 가능성이나 테스트 편의만으로 package를 만들지 않는다. 개별 package의 생성과 의존성 방향은 아래 승인 절차를 유지한다.

다음은 architecture 변경으로 취급한다.

- 새 app 또는 shared package 추가
- App source 사이의 직접 import 또는 새로운 dependency direction
- App 사이의 API contract와 통신 방식 변경
- Runtime, persistence, authentication, deployment boundary 도입 또는 교체
- 기존 module 전체 교체

Architecture 변경은 [제품 계약 적용 기준](../README.md#document-class)에 따라 채택 범위, status를 PR에 명시하고 사용자 merge 후 다른 작업에 적용한다. 이 절차는 운영, credential, 배포 실행 권한이나 미확정 제품 조건을 대신하지 않는다.
