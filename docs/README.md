---
type: rule
status: active
scope: repository
last-reviewed: 2026-10-02
---

# DFragon Document Guide

## 읽기 안내

이 저장소는 제품의 동작·구조·실행 계약과 현재 구현 안내를 관리한다. 개인 에이전트의 작업·검증·작성 지침은 로컬에서 관리한다. 아래 표에서 변경 대상의 제품 계약과 실행 안내를 찾을 수 있다.

| 필요한 내용 | 위치 |
| --- | --- |
| formatter/linter 설정과 생성물 경계 | [도구 적용](rules/convention-tooling.md) |
| 제품 이미지 실행·인프라 운영 원본 | [서버 이미지 안내](reference/api-start-development.md#서버-이미지) |
| 명령과 현재 파일 구조 | [scripts 안내](../scripts/README.md), [Repository Map](reference/repository-map.md) |
| app·package 경계 | [Architecture Overview](architecture/overview.md) |
| API runtime·검색 | [API runtime](rules/api-runtime.md), [캐릭터 검색](rules/character-search.md), [캐릭터 상세](rules/character-details.md) |
| Desktop MVP 카드·상세 A안·입력 범위 | [Desktop MVP 카드 UI](rules/desktop-mvp-ui.md), [디자인 이관](reference/desktop-mvp-design-handoff.md) |
| Desktop 개발자 모드·크롭·라벨·모델 평가 | [Desktop 개발자 모드](rules/desktop-developer-mode.md) |
| OCR 이미지 업로드·정답·train/val/test·패스키 관리 SPA | [OCR 자료실](rules/ocr-workspace.md), [앱 안내](../apps/ocr/README.md) |
| 앱 공용 UI·SEED·StyleX·시각 검증 | [Design System](rules/design-system.md), [Shared UI boundary](architecture/overview.md#shared-ui-boundary), [앱 공통 StyleX](reference/app-styling.md) |
| React 화면·hook 책임과 앱별 진입점 | [공통 책임 기준](rules/design-system.md#react-ui-책임), [Desktop 구조](architecture/desktop-code-organization.md), [OCR 안내](../apps/ocr/README.md), [Repository Map](reference/repository-map.md) |
| Penpot 확정 화면·Desktop MVP 구현 이관 | [Desktop MVP 디자인 이관](reference/desktop-mvp-design-handoff.md) |
| 인증·session·DB·삭제·Desktop 플랫폼 | 아래 주제별 제품 계약 |

## Document class

Rule은 동작과 제약을 정의하고, Reference는 현재 code·config·command를 설명한다. `docs/rules/**`, `docs/architecture/**`의 제품 계약이 Rule이며 `type: reference`인 문서는 예외다. 작업의 일시적인 상태는 필요한 Issue·PR에서 관리한다.

Reference의 오류는 실제 파일·설정에 맞춰 고친다. Rule과 구현의 중요한 제품 계약 충돌은 임의로 선택하지 않고 영향받는 부분만 확인한다. 허용된 Rule 변경은 채택 범위·status를 PR에 명시해 구현·검증하고, 다른 작업에는 사용자 merge 후 적용한다. Proposed 제품 계약의 링크·절차 정리만으로 그 내용을 채택하지 않는다.

제품의 필수 책임 경계는 Rule에 두고, Reference와 앱 안내는 해당 Rule 및 현재 대표 구현을 연결한다. 예제나 기존 코드의 우연한 형태를 다른 앱의 필수 구조로 확대하지 않는다.

## 제품 계약

### Authentication contract routing

패스키 전환의 현재 계약은 [패스키 인증](rules/auth-passkeys.md), 실행 설정은 [패스키 개발 안내](reference/passkey-authentication.md)를 따른다. 가입·기기 인증·예비 키 관리의 기준을 이 두 문서에서 확인한다.

이 Rule은 #39 최종 설계에 대한 [PR #48 사용자 승인](https://github.com/blahaj94/ldb/pull/48#issuecomment-5551469519)을 반영한다. 승인된 contract는 현재 구현·검증 성공과 구분한다. 현재 요청에 포함된 구현·비운영 검증은 진행하며, 과거 설계 작업의 실행 제외를 상시 금지로 적용하지 않는다. 현재 유효한 명시적 금지와 실제 운영·credential 실행 권한은 유지한다.

| 필요한 topic | Canonical Rule |
| --- | --- |
| Endpoint·parser·오류·nickname·log sink | [`rules/auth-api.md`](rules/auth-api.md) |
| 패스키 가입·WebAuthn·QR·예비 키·앱 교환·TTL | [`rules/auth-passkeys.md`](rules/auth-passkeys.md) |
| JWT/key·30일·refresh/logout 최종 경합 | [`rules/auth-session.md`](rules/auth-session.md) |
| 핵심 5개 테이블·constraint·잠금·정리/물리 보관·삭제 경계 | [`rules/auth-database.md`](rules/auth-database.md) |
| 검색 admission/quota·활동 commit·residual JWT·DB 장애·계정 기능 경합 | [`rules/auth-activity.md`](rules/auth-activity.md) |
| 인증 runtime 호환성·Migration·운영/플랫폼 미결정 gate | [`rules/auth-runtime.md`](rules/auth-runtime.md) |
| 삭제 확정·보관·복원과 패스키 탈퇴 후속 설계 | [`rules/auth-withdrawal-proposal.md`](rules/auth-withdrawal-proposal.md) |

탈퇴 D1–D5의 [기존 승인](https://github.com/blahaj94/ldb/pull/72#issuecomment-5557976162)은 이력으로 보존한다. 삭제 확정·보관·복원 정책은 유지하며 패스키 탈퇴의 재인증·재가입 경합 설계와 API 구현은 후속이다. 문서 승인을 제품 구현·운영/복원 검증으로 해석하지 않는다.

삭제·보관과 공개 복원의 제품 안전조건은 [탈퇴·삭제·복원 계약](rules/auth-withdrawal-proposal.md)을 따른다.
배치·서버 권한·backup·복구 실행 절차는 [인프라 책임](reference/api-start-development.md#서버-이미지)이며 제품 개발의 필수 읽기로 요구하지 않는다.
과거 운영 설계의 승인은 실제 환경 확보·실행 성공을 대신하지 않는다.

### Desktop authentication contract routing

다음은 Issue #55 설계에 대한 [PR #60 사용자 승인](https://github.com/blahaj94/ldb/pull/60#issuecomment-5553807475)을 반영한다. Desktop 설계 선택은 승인됐으며 실제 등록값과 실행 권한을 확인한다. 광범위한 OS·장애 검증을 배포 선행 조건으로 두지 않는 기준은 platform 계약을 따른다. 설계 승인은 제품 구현·실제 패스키/OS 등록 또는 credential 저장소 변경의 착수 지시가 아니므로 후속 작업의 범위와 실행 조건을 별도로 확인한다.

| 필요한 topic | Canonical Rule |
| --- | --- |
| Process 책임·기존 capture 연결·최소 IPC·화면 | [`rules/desktop-auth.md`](rules/desktop-auth.md) |
| Pending/PKCE·브라우저→exchange·refresh·취소/실패·재시작 | [`rules/desktop-auth-lifecycle.md`](rules/desktop-auth-lifecycle.md) |
| 실제 환경 근거·safeStorage/파일·protocol·배포 후 검증·등록 조건 | [`rules/desktop-auth-platform.md`](rules/desktop-auth-platform.md) |
| 탈퇴 전용 main receipt·상태 조회·local auth 정리·재시작 연결 | [`rules/auth-withdrawal-proposal.md`](rules/auth-withdrawal-proposal.md) |

탈퇴의 Desktop 확장은 PR #72에서 승인됐으며 기존 login pending·polling 없음과 구분한다. 구체적 IPC/화면·OS 구현과 실제 환경 검증은 별도 후속 범위다.

### Reference

- [`reference/repository-map.md`](reference/repository-map.md): workspace, app, command 현황
- [`reference/desktop-party-geometry.md`](reference/desktop-party-geometry.md): Desktop party frame의 관측값, 후보 geometry 함수와 남은 검증
- [`reference/desktop-party-participants.md`](reference/desktop-party-participants.md): 이동 가능한 파티참가인원 팝업의 검출·빈 행 판정·닉네임 크롭과 검증 범위
- [`reference/desktop-raid-participants.md`](reference/desktop-raid-participants.md): 12행 공대원창의 위치·배율 검출, 닉네임 수집과 순수 메타데이터 판독 범위
