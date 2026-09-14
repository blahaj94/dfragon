---
type: rule
status: active
scope: repository
last-reviewed: 2026-09-14
---

# LDB Document Guide

## 읽기 안내

현재 요청과 변경 대상에서 필요한 맥락만 고른다. 기본 개발 절차는 [개발 흐름](rules/agent-workflow.md) 한 곳에서 관리한다. 작업 경로의 하위 `AGENTS.md`와 해당 제품 계약은 실제로 읽으며, 파일이 존재한다고 자동으로 읽힌 것으로 간주하지 않는다. 같은 revision에서 읽은 본문이나 과거 승인 이력을 매번 다시 읽지 않는다. 현행 의미·상태·근거가 불확실할 때만 관련 이력으로 확장한다.

| 필요한 내용 | 위치 |
| --- | --- |
| 요청·작업 단위·권한·협업·리뷰·PR | [개발 흐름](rules/agent-workflow.md) |
| 변경 영향에 맞는 검사·성공 재사용·정직한 보고 | [Testing](rules/testing.md) |
| 코드의 가독성·평가 순서·오류·신뢰 경계 | [convention.md](../convention.md) |
| 기존 구현·표준 API·패키지 선택 | [코드 재사용](rules/code-reuse.md) |
| formatter/linter 설정과 생성물 경계 | [도구 적용](rules/convention-tooling.md) |
| 설명과 GitHub 글 | [작성 기준](rules/writing.md) |
| 명령과 현재 파일 구조 | [scripts 안내](../scripts/README.md), [Repository Map](reference/repository-map.md) |
| app·package 경계 | [Architecture Overview](architecture/overview.md) |
| API runtime·검색 | [API runtime](rules/api-runtime.md), [캐릭터 검색](rules/character-search.md) |
| Web·Desktop 공용 UI·SEED·시각 검증 | [Design System](rules/design-system.md), [Shared UI boundary](architecture/overview.md#shared-ui-boundary) |
| 인증·session·DB·삭제·운영·Desktop 플랫폼 | 아래 주제별 제품 계약 |

이 표를 전부 읽는 체크리스트로 사용하지 않는다. 코드 없는 문서 작업은 해당 문서의 의미·상태·연결을 확인하며 무관한 코드 컨벤션·제품 실행 절차로 확장하지 않는다.

## Document class

Rule은 동작과 제약을 정의하고, Reference는 현재 code·config·command를 설명한다. `AGENTS.md`, `convention.md`, `docs/rules/**`, `docs/architecture/**`의 제품 계약이 Rule이며 이동 안내처럼 `type: reference`인 문서는 예외다. 작업의 일시적인 상태는 필요한 Issue·PR에서 관리한다.

Reference의 오류는 실제 파일·설정에 맞춰 고친다. Rule과 구현의 중요한 제품 계약 충돌은 임의로 선택하지 않고 영향받는 부분만 확인한다. 허용된 Rule 변경은 채택 범위·status를 PR에 명시해 구현·검증하고, 다른 작업에는 사용자 merge 후 적용한다. Proposed 제품 계약의 링크·절차 정리만으로 그 내용을 채택하지 않는다.

같은 원문을 여러 문서에 복제하지 않는다. 지침은 짧은 진입점과 필요한 주제별 계약으로 유지하고, 문서·줄 수 할당량이나 과거 운영 문서의 필수 읽기를 만들지 않는다. 비밀정보와 개인 경로·내부 대화·실행 ID·raw log를 남기지 않는다.

## 제품 계약

### Authentication contract routing

이 Rule은 #39 최종 설계에 대한 [PR #48 사용자 승인](https://github.com/blahaj94/ldb/pull/48#issuecomment-5551469519)을 반영한다. 승인된 contract는 현재 구현·검증 성공과 구분한다. 사용자가 미결정 gate 유지와 구현 금지를 명시했으므로 별도 착수 지시 전에는 구현·설치·DB 실행을 진행하지 않는다.

| 필요한 topic | Canonical Rule |
| --- | --- |
| Endpoint·parser·오류·nickname·log sink | [`rules/auth-api.md`](rules/auth-api.md) |
| Client/provider binding·OAuth 상태·TTL·provider 검증 | [`rules/auth-oauth.md`](rules/auth-oauth.md) |
| JWT/key·30일·refresh/logout 최종 경합 | [`rules/auth-session.md`](rules/auth-session.md) |
| 핵심 4개 테이블·constraint·잠금·정리/물리 보관·삭제 경계 | [`rules/auth-database.md`](rules/auth-database.md) |
| 검색 admission/quota·활동 commit·residual JWT·DB 장애·계정 기능 경합 | [`rules/auth-activity.md`](rules/auth-activity.md) |
| 인증 runtime 호환성·Migration·운영/플랫폼 미결정 gate | [`rules/auth-runtime.md`](rules/auth-runtime.md) |
| 탈퇴 재인증·삭제 상태/권한·재가입 경합·provider revoke·보관·백업 복원 | [`rules/auth-withdrawal-proposal.md`](rules/auth-withdrawal-proposal.md) |

탈퇴 D1–D5는 [PR #72 사용자 승인](https://github.com/blahaj94/ldb/pull/72#issuecomment-5557976162)으로 확정됐다. Canonical file의 기존 path는 유지하며 active Rule로 관리한다. 정책 승인과 lifecycle/schema/API의 실제 구현·운영/복원 검증은 별개이고, 기존 login/refresh·초기 4-table 검증 AC를 소급 변경하지 않는다.

배치·저장·backup·복원 환경을 검토할 때는 [인증 운영 구성](architecture/auth-operations-proposal.md)과 [복원·검증 기준](architecture/auth-operations-validation-proposal.md)을 읽는다. [PR #132 사용자 승인](https://github.com/blahaj94/ldb/pull/132#issuecomment-5572391826)을 반영한 active Rule이며 기존 path를 유지한다. D1–D5는 그대로이고 구체 환경 확보·구현·실제 운영 검증은 별도다.

### Desktop authentication contract routing

다음은 Issue #55 설계에 대한 [PR #60 사용자 승인](https://github.com/blahaj94/ldb/pull/60#issuecomment-5553807475)을 반영한다. Desktop 설계 선택은 승인됐으며 실제 지원 OS·등록값·native 검증 gate는 유지한다. 설계 승인은 제품 구현·실제 OAuth/OS 등록 또는 credential 저장소 변경의 착수 지시가 아니므로 후속 작업의 범위와 실행 조건을 별도로 확인한다.

| 필요한 topic | Canonical Rule |
| --- | --- |
| Process 책임·기존 capture 연결·최소 IPC·화면 | [`rules/desktop-auth.md`](rules/desktop-auth.md) |
| Pending/PKCE·브라우저→exchange·refresh·취소/실패·재시작 | [`rules/desktop-auth-lifecycle.md`](rules/desktop-auth-lifecycle.md) |
| 실제 환경 근거·safeStorage/파일·protocol·미검증 matrix/등록 gate | [`rules/desktop-auth-platform.md`](rules/desktop-auth-platform.md) |
| 탈퇴 전용 main receipt·상태 조회·local auth 정리·재시작 연결 | [`rules/auth-withdrawal-proposal.md`](rules/auth-withdrawal-proposal.md) |

탈퇴의 Desktop 확장은 PR #72에서 승인됐으며 기존 login pending·polling 없음과 구분한다. 구체적 IPC/화면·OS 구현과 실제 환경 검증은 별도 후속 범위다.

### Reference

- [`reference/repository-map.md`](reference/repository-map.md): workspace, app, command 현황
