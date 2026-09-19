---
type: rule
status: active
scope: web-desktop-ui
last-reviewed: 2026-09-15
---

# Design System Contract

## 적용 상태와 범위

SEED의 기존 Component·Token과 `@ldb/ui`를 우선 사용해 필요한 화면을 완성한다. 공용화와 예제 구축을 제품 화면의 선행 작업으로 만들지 않는다. [PR #89의 이전 결정](https://github.com/blahaj94/ldb/pull/89)과 [SEED 채택 근거](https://github.com/blahaj94/ldb/issues/86#issuecomment-5560112909)는 이력으로 보존하며, 현재 책임과 검증 범위는 아래 기준을 따른다. 이 변경은 채택 범위를 명시한 PR의 사용자 merge 후 적용한다.

## SEED 재사용 기준

- 기존 styled Component·recipe·Token·Variant·State와 기본값을 우선 사용한다. 같은 역할을 별도 markup·CSS로 다시 구현하거나 화면 작업 때문에 디자인 시스템을 교체하지 않는다.
- Typography·Theme·공식 interaction과 접근성 처리를 유지한다. 화면의 요구를 충족하는 기존 layout이 있으면 사용하고, 대응물이 없으면 앱 안에서 필요한 조합을 작성한다. 모든 조합을 명명한 공용 Pattern으로 등록하거나 출처 비교 문서를 작성할 의무는 없다.
- 공식 Snippet은 필요한 의존 Snippet과 함께 사용한다. 출처와 라이선스를 보존하며 LDB에서 추가한 표현을 공식 SEED 보장으로 설명하지 않는다.
- SEED의 상표·로고·제품 예시 content를 LDB 정체성이나 제품 데이터로 복제하지 않는다. Package·CSS의 책임은 [Shared UI boundary](../architecture/overview.md#shared-ui-boundary)를 따른다.

## Typography의 명시적 예외

이번 Typography 요청은 `@ldb/ui`에 외부 UI 라이브러리 없이 React와 TypeScript로 구현한 `Typography.h1`–`h6`, `txtL`·`txtM`·`txtS`·`caption`을 추가하는 범위로 채택한다. 지정한 크기·행간·굵기는 `typographyVariants`에서 관리하며 semantic 기본 태그, HTML `as`, 기본 attribute·event와 `className`·`style`·`color`·`align`·`weight`를 지원한다. 이 예외는 해당 PR의 사용자 merge 후 적용하며 기존 SEED 컴포넌트나 제품 화면의 typography를 일괄 교체하지 않는다.

## Version과 Source

현재 설치 버전과 해결 조합은 package manifest와 lockfile, 가져온 Snippet의 upstream commit·파일·local 변경은 `packages/ui/seed-provenance.json`과 해당 source에서 관리한다. 같은 값을 Rule과 작업별 비교 문서에 반복해서 복제하지 않는다. 기존 고정 source의 근거는 [SEED source commit](https://github.com/daangn/seed-design/tree/08b3600989597f4e9017731484a409685c08aa68)에 남아 있다.

Snippet을 새로 가져오거나 수정할 때 해당 출처·local 변경과 적용되는 license·NOTICE를 갱신한다. 일반 화면 수정마다 upstream 전체를 재조사하지 않는다. CLI의 최신 출력으로 기존 source를 조용히 덮어쓰지 않는다.

업데이트에서는 바뀐 API·peer 조건·CSS·Snippet과 실제 소비 경로의 호환성을 확인한다. 통상적인 호환 패치에는 별도 Rule 승인이나 전체 시각 matrix 재실행을 요구하지 않는다. 중요 동작이나 디자인 방향을 바꾸는 선택은 [개발 흐름](agent-workflow.md#판단과-권한)을 따른다.

## 공통 자산과 화면의 책임

공용 Component는 반복되는 외형·상태·interaction을 소유하고, 화면은 data·event와 화면 고유의 배치·조합을 소유한다. 이미 공용 자산으로 충분하면 재사용한다. 한 화면에 필요한 조합은 앱 안에서 시작하며 실제로 같은 책임을 공유할 때 공용화한다. 이름만 다른 Variant나 전달뿐인 wrapper를 만들지 않는다.

## 화면별 스타일 조정

화면의 간격·정렬·너비·영역 padding·반응형 배치는 앱 내부 CSS로 표현할 수 있다. 가능한 기존 Token과 공개된 Component 옵션을 사용한다. 기존 옵션으로 부족한 작은 표현은 공개된 style·className·CSS 변수 API에서 화면 범위로 조정할 수 있으며, 그 이유는 필요한 경우 PR에 짧게 남긴다. 현재 `@ldb/ui`의 타입이 필요한 prop을 제외한다면 해당 기능 변경에서 upstream 지원을 확인하고 타입과 사용처를 함께 확장할 수 있다. 규칙의 허용을 현재 모든 Component의 prop 지원으로 표시하지 않는다. 이 선택에 공용 Variant 추가나 별도 승인을 요구하지 않는다.

라이브러리 내부 DOM을 가정한 selector, 다른 화면에 퍼지는 전역 override, focus 표시·disabled/loading 차단·접근 가능한 이름을 깨는 변경은 피한다. 여러 사용처가 공유해야 하는 의미나 중요한 interaction 변경은 공용 정의에서 처리하고 영향을 확인한다. 스타일 조정으로 제품 동작·접근성 결함을 숨기지 않는다.

## Example 관리

실제 화면이나 기존 Example으로 변경을 확인할 수 있으면 그것을 사용한다. 공용 자산 변경마다 새 Component·Pattern·Template Example을 만들거나 전체 gallery를 갖추는 것은 의무가 아니다. 실제 사용처로 재현하기 어려운 중요한 상태를 설명할 필요가 있을 때만 작은 Example을 추가한다.

기존 Example의 public API 사용이나 설명이 변경 때문에 틀리면 같은 PR에서 바로잡는다. 단순히 예제를 더 풍부하게 만드는 작업은 출시 선행 조건으로 두지 않는다. 예시 데이터는 비민감 합성 데이터를 쓰고 별도 gallery framework를 검증만을 위해 추가하지 않는다.

## 영향 범위 검증

[Testing](testing.md)에 따라 변경한 화면·상태와 실제 소비 환경을 선택한다. 작은 배치 수정은 해당 화면의 build와 좁은/넓은 화면 확인으로 마칠 수 있다. Interaction 변경은 해당 키보드·focus·disabled/loading 흐름을 확인하고, Theme·Motion을 변경하면 관련 전환·reduced-motion을 확인한다.

공유 CSS·의존성처럼 여러 환경에 영향을 주면 실제 소비 앱으로 범위를 넓힌다. 모든 변경에 모든 OS·browser·Theme·font·viewport 조합이나 공식 화면과의 pixel 비교를 요구하지 않는다. Browser 확인을 Electron 실행 성공으로 표시하지 않으며 확인한 환경·동작과 남은 중요한 한계를 PR에 짧게 남긴다.

## 변경과 Review

리뷰는 이번 변경의 사용자 동작, 접근성, 실제 시각 결함과 다른 사용처의 회귀에 집중한다. 화면 로컬 CSS나 Example 파일을 추가하지 않았다는 사실만으로 반려하지 않는다. 공용 자산과 소비자의 실제 계약이 바뀌면 함께 반영하고 관련 검증이 끝나면 전달한다.
