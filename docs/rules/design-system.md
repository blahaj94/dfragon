---
type: rule
status: active
scope: application-browser-ui
last-reviewed: 2026-10-09
---

# Design System Contract

## 적용 상태와 범위

SEED의 기존 Component, Token과 `@dfragon/ui`를 우선 사용해 필요한 화면을 완성한다. 공용화와 예제 구축을 제품 화면의 선행 작업으로 만들지 않는다. [PR #89의 이전 결정](https://github.com/blahaj94/ldb/pull/89)과 [SEED 채택 근거](https://github.com/blahaj94/ldb/issues/86#issuecomment-5560112909)는 이력으로 보존하며, 현재 책임과 검증 범위는 아래 기준을 따른다. 이 변경은 채택 범위를 명시한 PR의 사용자 merge 후 적용한다.

## SEED 재사용 기준

- 기존 styled Component, recipe, Token, Variant, State와 기본값을 우선 사용한다. 같은 역할을 별도 markup, CSS로 다시 구현하거나 화면 작업 때문에 디자인 시스템을 교체하지 않는다.
- Typography, Theme, 공식 interaction과 접근성 처리를 유지한다. 화면의 요구를 충족하는 기존 layout이 있으면 사용하고, 대응물이 없으면 앱 안에서 필요한 조합을 작성한다. 모든 조합을 명명한 공용 Pattern으로 등록하거나 출처 비교 문서를 작성할 의무는 없다.
- 공식 Snippet은 필요한 의존 Snippet과 함께 사용한다. 출처와 라이선스를 보존하며 DFragon에서 추가한 표현을 공식 SEED 보장으로 설명하지 않는다.
- SEED의 상표, 로고, 제품 예시 content를 DFragon 정체성이나 제품 데이터로 복제하지 않는다. Package, CSS의 책임은 [Shared UI boundary](../architecture/overview.md#shared-ui-boundary)를 따른다.

## Typo의 명시적 예외

이번 Typo 요청은 `@dfragon/ui`에 외부 UI 라이브러리 없이 React와 TypeScript로 구현한 `Typo.h1`–`h6`, `txtL`, `txtM`, `txtS`, `caption`을 추가하는 범위로 채택한다. 지정한 크기, 행간, 굵기는 `typographyVariants`에서 관리하며 semantic 기본 태그, HTML `as`, 기본 attribute, event와 `className`, `style`, `color`, `align`, `weight`를 지원한다. 공용 컴포넌트 추가는 PR #504에서 채택했다. 2026-09-19 후속 요청은 Penpot 클라이언트 시안과 Desktop의 현재 카드, 상세 미리보기, 설정, 캡처 화면, API가 제공하는 패스키 인증 browser 화면에 이 규격을 적용하는 범위다. 기존 SEED interaction은 유지하며 label에는 Typo를 조합한다. 라이브러리가 생성하는 서버 선택 텍스트는 공개 `typographyVariants`를 적용하고, 검색 input은 공식 `asChild`에 Typo를 연결한다. focus가 필요한 HTML element는 태그에 맞는 `ref`를 전달한다. 이 적용 범위와 browser 전용 소비 경로는 해당 PR의 사용자 merge 후 채택한다.

## 글꼴과 한국어 타이포그래피

Desktop renderer와 OCR browser UI는 앱에 번들한 Pretendard 1.3.9 가변 글꼴을 사용하며 CDN에서 받지 않는다. 글꼴 이름과 대체 순서는 각 앱 전역 글꼴 CSS의 `body` 한 곳에서 정하고 화면 스타일에 반복하지 않는다. 화면은 상속을 사용하며, 기본 글꼴이 따로 정해진 `pre` 같은 요소만 `inherit`로 연결한다. 굵기는 400, 500, 600, 700만 쓴다. Typo의 크기, 행간, 굵기, 자간은 `typographyVariants`가 소유한다.

- 같은 전역 CSS에 `word-break: keep-all`, `overflow-wrap: anywhere`를 두어 한국어를 어절 단위로 줄바꿈하고 긴 문자열은 영역 안에서 나눈다. `packages/ui/foundation.css`는 SEED provenance의 hash 추적 대상이므로 바꾸지 않는다.
- 기울임, `text-transform: uppercase`, 양수 자간을 새로 쓰지 않는다.
- 수치, 표, 타이머는 `font-variant-numeric: tabular-nums`를 쓴다. 기존 사용처는 유지하며 기존 코드의 일괄 정리는 이 기준의 선행 조건이 아니다.
- API 패스키 browser는 기존 글꼴 상속을 유지하고, Web은 이 글꼴 적용 범위가 아니다.

값과 규칙의 디자인 기준은 디자인 인계 저장소의 [Typography](https://github.com/blahaj94/dfragon-design/blob/main/design/typography.md)다. 이 기준은 사용자가 승인한 Pretendard 전환 요청으로 채택하며 해당 PR의 사용자 merge 후 적용한다.

## Version과 Source

현재 설치 버전과 해결 조합은 package manifest와 lockfile, 가져온 Snippet의 upstream commit, 파일, local 변경은 `packages/ui/seed-provenance.json`과 해당 source에서 관리한다. 같은 값을 Rule과 작업별 비교 문서에 반복해서 복제하지 않는다. 기존 고정 source의 근거는 [SEED source commit](https://github.com/daangn/seed-design/tree/08b3600989597f4e9017731484a409685c08aa68)에 남아 있다.

Snippet을 새로 가져오거나 수정할 때 해당 출처, local 변경과 적용되는 license, NOTICE를 갱신한다. 일반 화면 수정마다 upstream 전체를 재조사하지 않는다. CLI의 최신 출력으로 기존 source를 조용히 덮어쓰지 않는다.

업데이트에서는 바뀐 API, peer 조건, CSS, Snippet과 실제 소비 경로의 호환성을 확인한다. 통상적인 호환 패치에는 별도 Rule 승인이나 전체 시각 matrix 재실행을 요구하지 않는다. 중요 동작이나 디자인 방향을 바꾸는 선택은 [제품 계약 적용 기준](../README.md#document-class)을 따른다.

## 공통 자산과 화면의 책임

공용 Component는 반복되는 외형, 상태, interaction을 소유하고, 화면은 data, event와 화면 고유의 배치, 조합을 소유한다. 이미 공용 자산으로 충분하면 재사용한다. 한 화면에 필요한 조합은 앱 안에서 시작하며 실제로 같은 책임을 공유할 때 공용화한다. 이름만 다른 Variant나 전달뿐인 wrapper를 만들지 않는다.

## React UI 책임

이 기준은 저장소의 Desktop renderer, Accounts 패스키, OCR, Web React 화면에 공통으로 적용한다. Desktop의 폴더 구조와 process 경계는 [Desktop 구조](../architecture/desktop-code-organization.md)를, 다른 앱은 해당 제품 계약을 따른다. 기존 전체 화면을 한 번에 재구성하지 않고 현재 변경에 적용한다.

- 수정 전에 실제 앱 진입점과 호출 경로를 확인해 제품 화면, 구버전, 미리보기를 구분한다. 테스트에서 쓰이는 파일이라는 이유만으로 제품 진입점으로 판단하지 않는다.
- 컴포넌트는 표시, DOM 이벤트, 확인 문구와 대화상자를 소유한다. 입력 draft, 포커스 같은 자체 UI 상태는 컴포넌트에 남겨도 된다. 사용자 확인을 취소하면 실행하지 않고, 승인한 요청을 hook이나 실행 경계에 전달한다. 요청 hook이 사용하는 화면의 확인 창까지 직접 띄우지 않는다.
- Hook은 하나의 응집된 React 상태, 구독, 요청 수명을 소유한다. 같은 화면에서 쓰인다는 이유로 독립적인 책임을 묶거나 컴포넌트 로직을 통째로 옮기는 것으로 분리를 대신하지 않는다. 하나의 책임에 필요한 여러 state, effect는 함께 둘 수 있으며 변수마다 hook을 만들지 않는다.
- React 상태, 수명이 필요 없는 검증과 정책 계산은 순수 함수로 둔다. 단순 파생 값은 표현식으로 충분하면 그대로 사용한다. 다른 hook이나 기존 비UI 구현을 직접 사용하며 계산용 hook, 전달 전용 wrapper를 만들지 않는다.
- 중복 요청, 호출 제한 같은 실행 정책은 요청을 수행하는 쪽이 소유하고 실행 시에도 검사한다. UI는 그 결과로 비활성, 로딩 상태를 표시하며 버튼 비활성화만으로 실행 조건을 보장하지 않는다. 서버, IPC의 runtime 검증도 유지한다.
- 분리 전후의 실제 책임 소유자와 의존 방향을 확인하고 동작, 평가 순서, 오류, cleanup을 보존한다. 파일 이동이나 함수 길이 감소만으로 책임 분리가 완료됐다고 판단하지 않는다.

## 화면별 스타일 조정

Desktop, API 패스키, OCR, Web의 화면별 간격, 정렬, 너비, 영역 padding, 반응형 배치는 StyleX로 작성한다. 모든 앱은 공통 compiler 설정과 workspace catalog의 버전을 사용한다. SEED, vendor 스타일, font-face, reset, 공용 foundation 같은 전역 기반 CSS는 유지한다. 이 공통화는 사용자 요청 범위로 해당 PR에서 구현, 검증하며 사용자 merge 후 적용한다. 연결 위치와 구현 예시는 [앱 공통 StyleX](../reference/app-styling.md)를 따른다. 가능한 기존 Token과 공개된 Component 옵션을 사용한다. 기존 옵션으로 부족한 작은 표현은 공개된 style, className, CSS 변수 API에서 화면 범위로 조정할 수 있으며, 그 이유는 필요한 경우 PR에 짧게 남긴다. 현재 `@dfragon/ui`의 타입이 필요한 prop을 제외한다면 해당 기능 변경에서 upstream 지원을 확인하고 타입과 사용처를 함께 확장할 수 있다. 규칙의 허용을 현재 모든 Component의 prop 지원으로 표시하지 않는다. 이 선택에 공용 Variant 추가나 별도 승인을 요구하지 않는다.

컴포넌트 전용 StyleX는 옆의 `{name}.style.ts`에 module scope의 `stylex.create`와 named export로 둔다. JSX는 `stylex.props(base, condition && variant)`로 필요한 스타일을 합성한다. SEED recipe의 `className`과 함께 쓰면 한쪽을 덮어쓰지 않도록 합친다. 전용 스타일이 없는 컴포넌트에 빈 파일을 만들지 않는다.

공용 색, 간격은 SEED CSS 변수와 기존 테마를 우선 사용한다. StyleX 변수, 테마 정의가 필요하면 `.stylex.ts`의 `defineVars`, `createTheme`를 사용한다. 앱 고유 배치는 앱이, 실제 여러 화면이 공유하는 UI는 `@dfragon/ui`가 소유한다. StyleX API를 다시 감싼 runtime wrapper는 만들지 않는다.

라이브러리 내부 DOM을 가정한 selector, 다른 화면에 퍼지는 전역 override, focus 표시, disabled/loading 차단, 접근 가능한 이름을 깨는 변경은 피한다. 여러 사용처가 공유해야 하는 의미나 중요한 interaction 변경은 공용 정의에서 처리하고 영향을 확인한다. 스타일 조정으로 제품 동작, 접근성 결함을 숨기지 않는다.

## Example 관리

실제 화면이나 기존 Example으로 변경을 확인할 수 있으면 그것을 사용한다. 공용 자산 변경마다 새 Component, Pattern, Template Example을 만들거나 전체 gallery를 갖추는 것은 의무가 아니다. 실제 사용처로 재현하기 어려운 중요한 상태를 설명할 필요가 있을 때만 작은 Example을 추가한다.

기존 Example의 public API 사용이나 설명이 변경 때문에 틀리면 같은 PR에서 바로잡는다. 단순히 예제를 더 풍부하게 만드는 작업은 출시 선행 조건으로 두지 않는다. 예시 데이터는 비민감 합성 데이터를 쓰고 별도 gallery framework를 검증만을 위해 추가하지 않는다.

## 영향 범위 검증

[검증 명령](../../scripts/README.md#native-validation)에 따라 변경한 화면, 상태와 실제 소비 환경을 선택한다. 작은 배치 수정은 해당 화면의 build와 좁은/넓은 화면 확인으로 마칠 수 있다. Interaction 변경은 해당 키보드, focus, disabled/loading 흐름을 확인하고, Theme, Motion을 변경하면 관련 전환, reduced-motion을 확인한다.

공유 CSS, 의존성처럼 여러 환경에 영향을 주면 실제 소비 앱으로 범위를 넓힌다. 모든 변경에 모든 OS, browser, Theme, font, viewport 조합이나 공식 화면과의 pixel 비교를 요구하지 않는다. Browser 확인을 Electron 실행 성공으로 표시하지 않으며 확인한 환경, 동작과 남은 중요한 한계를 PR에 짧게 남긴다.

## 변경과 Review

리뷰는 이번 변경의 사용자 동작, 접근성, 실제 시각 결함과 다른 사용처의 회귀에 집중한다. 화면 로컬 CSS나 Example 파일을 추가하지 않았다는 사실만으로 반려하지 않는다. 공용 자산과 소비자의 실제 계약이 바뀌면 함께 반영하고 관련 검증이 끝나면 전달한다.
