---
type: rule
status: active
scope: repository
last-reviewed: 2026-10-30
---

# 던삐삐 Document Guide

## 읽기 안내

이 저장소는 제품의 동작, 구조, 실행 계약과 결정 기록을 관리한다. 누가 작업하든 참인 설치, 검증 명령과 작업 경계는 루트 [AGENTS.md](../AGENTS.md)에 두고, 개인 작업 습관은 각자 로컬에서 관리한다. 아래 표에서 변경 대상의 제품 계약과 실행 안내를 찾을 수 있다.

| 필요한 내용 | 위치 |
| --- | --- |
| formatter/linter 설정과 생성물 경계 | [도구 적용](rules/convention-tooling.md) |
| 제품 이미지 실행, 인프라 운영 원본 | [서버 이미지 안내](../apps/api/README.md#서버-이미지) |
| 명령과 현재 파일 구조 | [scripts 안내](../scripts/README.md), 각 app, package의 README |
| app, package 경계 | [Architecture Overview](architecture/overview.md) |
| API runtime, 검색 | [API runtime](rules/api-runtime.md), [캐릭터 검색](rules/character-search.md), [캐릭터 상세](rules/character-details.md), [오늘의 등급](rules/today-grade.md) |
| Desktop MVP 카드, 입력 범위 | [Desktop MVP 카드 UI](rules/desktop-mvp-ui.md) |
| Desktop 새 버전 알림, 자동 설치를 미룬 결정 | [ADR 0001 새 버전 알림만 두고 자동 설치는 미룬다](adr/0001-update-notice-without-auto-install.md) |
| 앱 공용 UI, 디자인 토큰, Base UI, StyleX, 시각 검증 | [Design System](rules/design-system.md), [Shared UI boundary](architecture/overview.md#shared-ui-boundary), [공통 StyleX 설정](../packages/ui/README.md#공통-stylex-설정) |
| React 화면, hook 책임과 앱별 진입점 | [공통 책임 기준](rules/design-system.md#react-ui-책임), [Desktop 구조](architecture/desktop-code-organization.md) |
| 제품 이름 표기, 사용자 문구 문체, 표기 검사 | [표기와 문체](rules/writing.md) |

## Document class

Rule은 동작과 제약을 정의한다. `docs/rules/**`, `docs/architecture/**`의 제품 계약이 Rule이다. 현재 code, config, command의 설명은 설명하는 코드 옆 README와 주석에 두고 `docs/`에 따로 두지 않는다. 작업의 일시적인 상태는 필요한 Issue, PR에서 관리한다.

ADR(Architecture Decision Record)은 `docs/adr/**`에 번호 순서로 두는 결정 기록이다. 맥락, 확인한 사실, 선택지, 결정, 결과를 결정 당시 기준으로 적고 뒤에 고쳐 쓰지 않는다. 결정이 바뀌면 새 ADR을 추가하고 이전 ADR의 `superseded-by`에 연결한다. Rule은 현재 계약만 적고, 결정의 이유, 날짜, Issue는 해당 ADR을 링크한다.

README의 오류는 실제 파일, 설정에 맞춰 고친다. Rule과 구현의 중요한 제품 계약 충돌은 임의로 선택하지 않고 영향받는 부분만 확인한다. 허용된 Rule 변경은 채택 범위, status를 PR에 명시해 구현, 검증하고, 다른 작업에는 사용자 merge 후 적용한다. Proposed 제품 계약의 링크, 절차 정리만으로 그 내용을 채택하지 않는다.

제품의 필수 책임 경계는 Rule에 두고, README는 해당 Rule 및 현재 대표 구현을 연결한다. 예제나 기존 코드의 우연한 형태를 다른 앱의 필수 구조로 확대하지 않는다.
