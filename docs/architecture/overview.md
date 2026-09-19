---
type: rule
status: active
enforcement: approval-required
scope: architecture
last-reviewed: 2026-09-15
---

# Architecture Overview

## Repository topology

LDB는 pnpm workspace monorepo다.

```text
apps/
  api/
  web/
  desktop/
packages/
  ui/
  lib/
scripts/
```

- `apps/api`: NestJS API workspace. 승인된 ESM runtime·dependency·build/test 계약은 [`../rules/api-runtime.md`](../rules/api-runtime.md)를 따른다. 구현 현황은 Reference에서 확인한다.
- `apps/web`: React, TypeScript, Vite 기반 web application.
- `apps/desktop`: Electron, React, TypeScript, electron-vite 기반 desktop application.
- `packages/ui`: 현재 tracked shared UI package `@ldb/ui`. 실제 구현·명령은 [Repository Map](../reference/repository-map.md#shared-ui)에서 확인한다.
- `packages/lib`: 앱과 UI에 의존하지 않는 공용 순수 함수 `@ldb/lib`. 아래 Shared library boundary를 따른다.
- `scripts`: repository 생성·관리 script.

상세한 file과 command 현황은 [`../reference/repository-map.md`](../reference/repository-map.md)를 따른다.

## Approved boundary

현재 workspace·app boundary와 API runtime·검증 기반이 승인됐다. 검색의 입력·응답·오류·계정 제한은 [`../rules/character-search.md`](../rules/character-search.md)를 따른다. 근거는 [PR #42 사용자 승인](https://github.com/blahaj94/ldb/pull/42#issuecomment-5550598698)이다. 인증·핵심 DB·서버 통신의 추가 승인 범위는 아래 Authentication boundary contract를 따른다.

PostgreSQL의 최초 선택 이력과 현재 갱신·검증 기준은 [`auth-runtime.md`](../rules/auth-runtime.md)를 따른다. 실제 고정 image는 검증 도구에서 확인하며 일반 패치마다 Rule 승인을 반복하지 않는다. 로컬 검증 성공을 운영 환경의 성공으로 확대하지 않는다. 인증 운영 설계의 추가 승인은 아래 Authentication boundary contract를 따르며, 다음 사항은 구체 결정·확보 또는 검증이 남아 있다.

- 선택한 인증 운영 환경의 권한·저장과 기능 검증. 공개 복원은 선택했을 때만 확인
- Web/mobile client, 실제 Desktop 지원 OS·배포 identity·callback/protocol 등록값 및 native 저장/복귀 검증
- 아래 Shared UI·Shared library boundary 이외의 shared package 종류와 dependency direction
- 승인된 탈퇴·삭제/재가입·백업 복원 정책의 실제 저장소·권한·실행 검증 gate
- 현재 요청과 MVP 운영 기준을 벗어나는 새로운 deployment boundary

미정 사항을 구현해야 하면 AI는 임의로 architecture를 확정하지 않고 사용자에게 대안과 trade-off를 제시한다.

## Authentication boundary contract

현재 중앙 API는 패스키로 회원을 인증하고 PostgreSQL에 회원·공개키·session을 저장한다. Desktop public client는 시스템 브라우저에서 인증하고 S256으로 보호한 앱 복귀 code를 교환한다. 계약은 [패스키](../rules/auth-passkeys.md), [HTTP 경계](../rules/auth-api.md), [세션](../rules/auth-session.md), [DB](../rules/auth-database.md), [활동](../rules/auth-activity.md), [runtime](../rules/auth-runtime.md)을 따른다. 이전 인증 설계 승인은 [PR #48](https://github.com/blahaj94/ldb/pull/48#issuecomment-5551469519)에 보존한다.

위 승인은 서버 인증/DB contract 범위다. 추가로 [PR #60 사용자 승인](https://github.com/blahaj94/ldb/pull/60#issuecomment-5553807475)으로 Desktop main/IPC/화면, 인증 lifecycle, OS 저장·protocol 설계가 승인됐다. Canonical contract는 [`../rules/desktop-auth.md`](../rules/desktop-auth.md), [`../rules/desktop-auth-lifecycle.md`](../rules/desktop-auth-lifecycle.md), [`../rules/desktop-auth-platform.md`](../rules/desktop-auth-platform.md)다.

탈퇴 D1–D5는 [탈퇴 계약](../rules/auth-withdrawal-proposal.md)을 따른다. 현재 [인증 운영 구성](auth-operations-proposal.md)은 한 운영자·단일 서버를 허용하고 공개 복원을 선택 기능으로 분리한다. [PR #132](https://github.com/blahaj94/ldb/pull/132)의 3대·journal/witness 설계는 이전 결정 이력이며 새 기능의 기본 착수 조건이 아니다. 공개 복원을 제공할 때는 [운영 검증 기준](auth-operations-validation-proposal.md)의 삭제 보존·최신성·옛 자격 폐기 조건을 충족한다.

설계와 실제 구현·환경 검증을 구분한다. 현재 사용자 요청에 포함된 구현·비운영 검증에는 과거 설계 작업의 착수 제외를 다시 적용하지 않는다. 미제공 복원 기능이 독립 작업을 막지 않으며, 실제 credential·인증 도메인 설정·운영 DB·배포 권한과 유효한 명시적 금지는 유지한다.

## Shared UI boundary

[Issue #86의 SEED 채택 결정](https://github.com/blahaj94/ldb/issues/86#issuecomment-5560112909)과 현재 `packages/ui` 구성을 바탕으로 아래 UI 경계를 채택한다. 이 절은 이번 PR의 사용자 merge 후 active 계약으로 적용하며, 과거 proposed 문구가 새 화면 구현의 재승인 조건이 되지 않게 한다. UI 내부 배치·스타일·Example 범위는 [Design System](../rules/design-system.md)을 따른다.

| 대상 | 책임과 dependency direction |
| --- | --- |
| `packages/ui`의 `@ldb/ui` | Browser React shared package 하나로 공식 SEED styled Component·Snippet과 실제로 공유하는 Layout·composition을 제공한다. `@ldb/ui` → SEED/React·필요한 공식 icon 방향으로 연결하며 app source·API client·backend·Electron main/preload·IPC·인증·domain을 import하지 않는다. |
| `apps/web`·`apps/desktop` renderer | `@ldb/ui`를 소비하고 제품 data·event·behavior와 app별 platform 연결을 맡는다. 서로의 source를 import하지 않는다. Desktop main/preload는 UI package를 소비하지 않는다. |
| 독립 Vite Example entry | 필요한 상태를 실제 화면에서 확인하기 어려울 때 같은 `@ldb/ui` public API와 합성 content로 확인한다. 새 화면마다 Component·Pattern·Template 예제를 갖출 의무는 없다. |

공식 요소를 불필요하게 재명명·wrapper로 감싸지 않고 SEED 이름과 semantic API를 유지한다. 화면별 스타일 허용 범위와 필요한 Example·version·Snippet source·영향 검증은 [`design-system.md`](../rules/design-system.md)가 canonical Rule이다.

### Dependency와 CSS 소유

[공식 Library Authors 가이드](https://seed-design.io/react/getting-started/library-authors)를 따른다.

- `@ldb/ui`는 `@seed-design/react`, `@seed-design/css`, React·React DOM을 peer dependency로 선언한다. 개발·test에 필요한 사본은 dev dependency로 둔다. SEED React와 CSS의 peer 범위를 각각 명시하고, 소비 app·Example은 manifest·lockfile에 기록된 호환 SEED 조합을 제공한다. React도 소비 환경과 일치시키며 검증하지 않은 지원 범위를 주장하지 않는다.
- Library를 bundle하면 `@seed-design/*`와 React·React DOM 및 JSX runtime entry를 external 처리한다. 산출물에 별도 SEED runtime·CSS 또는 React 사본이 포함되지 않는지 확인한다. Peer 선언만으로 external 처리가 보장된다고 가정하지 않는다.
- Library source에서 `@seed-design/css/*.css`를 직접 import하지 않는다. 선택한 공식 Vite 통합은 `base.css`와 Component recipe CSS를 사용하는 경로다. 이 경로에서 각 소비 app·Example의 browser entry가 `@seed-design/css/base.css`를 한 번 import하고 Theme 초기화 책임을 가진다. SEED recipe가 연결하는 Component CSS를 library의 별도 CSS 사본으로 vendor하지 않는다.
- Web·Desktop renderer·Example은 공식 `@seed-design/vite-plugin` 통합을 사용한다. Desktop의 electron-vite renderer 설정과 실제 Electron 실행 호환성은 후속 검증 대상이다. 하나의 alias만을 위해 `vite-tsconfig-paths`를 추가하지 않고 기존 Vite의 `resolve.alias`를 사용한다.
- 공식 icon package는 필요한 Snippet의 runtime dependency로, CLI는 authoring 도구로 구분한다. CLI를 제품 runtime에 포함하지 않는다. Dependency·역할 변경은 개발 흐름의 실제 영향과 권한 기준을 따른다.

Package의 published peer 범위는 조합 선정 evidence이며 실제 Web·Electron 호환성, CSS 중복 없음, accessibility·시각 일치 성공을 보증하지 않는다. 변경한 library 산출물과 영향받는 소비 환경을 검증하며 기존 Example·사용 안내가 틀려진 부분은 같은 PR에서 고친다. 모든 소비 환경과 예제를 매번 재검증하지 않는다.

## Shared library boundary

이번 공용 함수 요청으로 `packages/lib`의 `@ldb/lib`를 추가한다. 사용자 merge 후 앱 → `@ldb/lib` 방향을 채택한다. 패키지는 API·Web·Desktop에서 같은 계약을 소비할 수 있는 순수 함수를 제공하며 앱 source·UI·Node/Electron 전용 runtime·네트워크·저장소에 의존하지 않는다. 이번 적용 범위는 CP949 기반 던파 캐릭터명 형식 검사와 공개 타입·빌드·검증이다. 기존 검색·계정 닉네임·OCR 정책이나 호출부를 바꾸지 않는다. 함수의 보장 범위와 사용법은 [공용 함수 안내](../../packages/lib/README.md)를 따른다.

## Architecture change

새 공통 package의 분리는 [앱 내부 모듈과 공통 패키지 기준](../rules/code-reuse.md#앱-내부-모듈과-공통-패키지)에 따라 판단합니다. 개별 package의 생성과 의존성 방향은 아래 승인 절차를 유지합니다.

다음은 architecture 변경으로 취급한다.

- 새 app 또는 shared package 추가
- App source 사이의 직접 import 또는 새로운 dependency direction
- App 사이의 API contract와 통신 방식 변경
- Runtime, persistence, authentication, deployment boundary 도입 또는 교체
- 기존 module 전체 교체

Architecture 변경은 [`../rules/change-control.md`](../rules/change-control.md)의 approval workflow를 따른다.
