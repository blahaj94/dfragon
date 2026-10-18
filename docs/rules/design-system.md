---
type: rule
status: active
scope: application-browser-ui
last-reviewed: 2026-10-18
---

# Design System Contract

## 적용 상태와 범위

2026-10-18 결정으로 모든 workspace의 browser UI에서 SEED Design을 걷어낸다. `@dfragon/ui`가 자체 토큰과 Base UI 기반 공용 Component를 소유하고, 외형은 StyleX로 직접 그린다. Desktop은 아래 [DFragon 디자인 규칙](#dfragon-디자인-규칙)으로 다시 그리고, OCR, Accounts, Web은 SEED만 걷어내며 화면 배치는 유지한다. [PR #89의 이전 결정](https://github.com/blahaj94/ldb/pull/89)과 [SEED 채택 근거](https://github.com/blahaj94/ldb/issues/86#issuecomment-5560112909)는 이력으로 보존하며 2026-10-18 결정으로 대체한다.

이 변경은 채택 범위를 명시한 PR의 사용자 merge 후 적용한다. 코드 이행은 토큰, 공용 Component, 앱별 SEED 제거, SEED 잔여 삭제 순서로 마쳐 저장소에 SEED 코드와 의존성이 남아 있지 않다. Desktop DFragon 디자인 적용은 후속 PR에서 화면별로 진행한다.

- `@dfragon/ui`에 대응하는 토큰이나 Component가 있으면 새 사용처는 그것을 쓴다.
- Desktop의 이전 brand 색 재매핑 CSS는 삭제했으며 대신할 전역 override 예외는 두지 않는다.
- 화면 계약에 남은 기존 색 이름과 상태 표현은 해당 화면의 DFragon 디자인 적용 PR에서 이 문서의 토큰과 규칙으로 옮긴다.
- 공대 12인 화면과 상위, 랭커 티어 표시는 UI 셸과 fixture 데이터까지가 범위다. 데이터 연결은 별도 과제다.

디자인 원본은 디자인 인계 저장소 [dfragon-design](https://github.com/blahaj94/dfragon-design)의 markdown 문서와 손으로 관리하는 `design/tokens.json`이다. DFragon 디자인 시안 캔버스는 시각 참고이며, Penpot 보드와 PNG 미리보기는 superseded다.

공용 자산과 Base UI를 우선 사용해 필요한 화면을 완성한다. 공용화와 예제 구축을 제품 화면의 선행 작업으로 만들지 않는다.

## 토큰

공용 디자인 값은 `@dfragon/ui`가 CSS custom property와 StyleX용 문자열 상수로 제공한다.

- `@dfragon/ui/tokens.css`(`packages/ui/tokens.css`)가 `--df-*` 변수를 정의한다. `:root`가 다크 기본값이고 `:root[data-theme='light']`가 라이트 값이다. `prefers-reduced-motion: reduce`에서 `--df-dur-*`를 0으로 둔다.
- 모든 browser entry가 `tokens.css`, `foundation.css`, 앱 전역 글꼴 CSS 순서로 한 번 import한다.
- `@dfragon/ui/tokens.stylex`(`packages/ui/src/tokens.stylex.ts`)는 `stylex.defineConsts`로 `colors`, `space`, `radius`, `motion`, `font`를 `'var(--df-…)'` 문자열 상수로 제공한다. React는 쓰지 않지만 소비 앱의 StyleX 컴파일이 필요한 entry다.
- StyleX compiler는 import 경로가 `.stylex`로 끝나는 모듈의 값만 다른 파일에서 정적으로 읽고, 그 경로를 bundler alias가 아닌 package exports로 해석한다. 그래서 entry 이름에 `.stylex`를 붙이고 `@dfragon/ui` 내부도 `./tokens.stylex`로 가져온다. `src/shapes.ts`처럼 `stylex.create`만 쓰는 파일은 이 이름 규칙의 대상이 아니다.
- `defineVars`, `createTheme`, runtime 테마는 쓰지 않는다. 컴파일 결과에는 `var(--df-…)` 값이 그대로 들어가고 새 `:root` 변수가 생기지 않으므로, 모드 전환은 `tokens.css`만으로 끝나고 portal마다 테마를 다시 바르지 않는다.
- `packages/ui/src/shapes.ts`는 공용 `stylex.create`로 `cutTopRight`, `cutBottomRight`, `gridWell`, `hazardStripes`, `scanlines`, `srOnly`를 제공한다.
- 모드는 `document.documentElement.dataset.theme`에 `'light'` 또는 `'dark'`를 넣어 바꾼다.

색 토큰은 현재 Desktop 색 토큰의 이름(`bgCanvas`, `bgSurface`, `bgInset`, `bgControl*`, `borderDefault`, `borderStrong`, `fgDefault`, `fgMuted`, `fgSubtle`, `fgSuccess`, `fgDanger`, `card*`, 희귀도, 강화, 게임, 속성 색)을 유지하고 다음을 바꾼다.

- 추가: `bgBar`, `bgWell`, `signal`(`#F8E8C8`), `onSignal`(`#111012`), `brandLogo`(`#E83830`), `fgAdventure`, `tierTop`(`#FFB400`), `tierRanker`(`#50E3C2`), `bracket*`, `hazard`, `gridLine`
- 삭제: `bgBrand*`, `fgBrand`, `fgInfo`, `fgWarning`, `borderBrand`, `borderFocus` 같은 파랑 계열 전부

라이트 모드는 유지한다. 라이트 값은 현재 값에서 임시로 가져온 `provisional`이며, `signal`과 티어 색처럼 대응 값이 없는 토큰도 임시 값이다. dfragon-design이 라이트 값을 정하면 함께 바꾼다.

| 분류 | 값 |
| --- | --- |
| 간격 | 4, 8, 12, 16, 24px |
| 반지름 | 패널, 카드 0, 입력, 칩, 보조 버튼 2px, 자른 모서리 8px |
| 크기 | 상단 바 56px, 컨트롤 sm 32px, md 40px, lg 48px |
| 모션 | 감속 곡선 `cubic-bezier(.2,0,0,1)`, hover 120ms, 상태 전환 180ms, 숫자 증가 400ms, 반복 4s |

토큰 값의 원본은 dfragon-design `tokens.json`이다. 두 저장소 사이에 자동 동기화는 없으므로 `tokens.css`를 바꿀 때 기준이 된 디자인 저장소 commit을 함께 기록한다.

## 공용 Component와 Base UI

`@dfragon/ui`의 동작 프리미티브는 Base UI(`@base-ui/react`, 채택 시점 1.9.0)다. 옛 패키지 이름 `@base-ui-components/react`는 쓰지 않는다. 현재 설치 버전과 해결 조합은 package manifest와 lockfile에서 관리하며 이 문서에 반복하지 않는다.

| Component | 책임 |
| --- | --- |
| `Button` | `primary`, `secondary`, `ghost`, `danger` 변형과 `sm`, `md`, `lg` 크기. `primary`는 `signal` 배경에 오른쪽 위 8px 자른 모서리 |
| `IconButton` | 아이콘만 있는 버튼. 접근 가능한 이름 필수 |
| `TextField`, `TextFieldInput` | Base UI `Field`, `Input` 기반 입력 |
| `Select`, `Menu`, `Switch`, `Checkbox`, `Chip`(`Toggle`), `Tabs`, `Tooltip` | 같은 이름의 Base UI 부품 기반 |
| `DialogRoot`, `DialogTrigger`, `DialogContent`, `DialogBody`, `DialogFooter`, `DialogAction` | Base UI `Dialog` 기반. 기존 이름 유지 |
| `StatusChip` | tone `neutral`, `success`, `danger`, `waiting`. `waiting`은 중립색과 각진 모래시계 아이콘 |
| `LoadingIndicator`, `ProgressCircle` | 자체 SVG |
| `Kbd`, `CornerBrackets` | 단축키 표시, 네 모서리 꺾쇠 |
| `CardFrame` | state `default`, `selected`, `failure`, `waiting`, `top`, `ranker` |
| `NumericText` | Barlow Condensed 숫자, 400ms 증가 |
| `ContentStack`, `SupportingText`, `ExampleSection` | plain 요소와 StyleX |
| `Typo` | 변경 없음. 아래 [Typo의 명시적 예외](#typo의-명시적-예외)를 따른다 |

- 키보드 조작, 포커스 이동과 복귀, ARIA 같은 interaction과 접근성은 Base UI가 책임진다. 공용 Component는 Base UI 부품의 semantic API를 유지하고 외형만 StyleX로 그린다. 같은 역할의 Component를 이름만 바꿔 다시 감싸지 않는다.
- 이행 중에는 `ActionButton`을 `Button`으로, `StatusBadge`를 `StatusChip`으로 잇는 alias를 두고 Desktop DFragon 디자인 적용의 마지막 PR에서 제거한다.
- `@base-ui/react`는 `@dfragon/ui`의 peer dependency이자 build external이다. `@seed-design/*`, `@karrotmarket/*`는 dependency와 external에 두지 않는다. Package, CSS의 책임은 [Shared UI boundary](../architecture/overview.md#shared-ui-boundary)를 따른다.
- 업데이트에서는 바뀐 API, peer 조건, 실제 소비 경로의 호환성을 확인한다. 통상적인 호환 패치에는 별도 Rule 승인이나 전체 시각 matrix 재실행을 요구하지 않는다. 중요 동작이나 디자인 방향을 바꾸는 선택은 [제품 계약 적용 기준](../README.md#document-class)을 따른다.
- Base UI, Barlow Condensed처럼 새로 들이는 외부 코드와 자산의 license, NOTICE는 `@dfragon/licenses`의 고지 수집에 포함한다.

## DFragon 디자인 규칙

Desktop 화면은 아래 규칙으로 그린다. OCR, Accounts, Web은 공용 토큰과 Component가 주는 외형을 받되 화면 배치는 다시 그리지 않는다. 상세 값과 예시는 dfragon-design 문서를 따른다.

- 색: 무채색 바탕 위에 신호색 하나만 쓴다. 신호색 `signal`(`#F8E8C8`)은 선택, 주 버튼, 포커스에만 쓴다. 희귀도 색은 유지하고, 로고 빨강 `brandLogo`(`#E83830`)는 로고 마크에만 쓴다.
- 주의 상태: warning 색을 따로 두지 않고 중립색과 각진 모래시계 아이콘으로 표현한다.
- 글자: 라벨은 12px로 작게, 값은 Barlow Condensed `tabular-nums`로 크게 쓴다. 한글은 Pretendard를 그대로 쓴다.
- 형태: 패널과 카드는 반지름 0이며 테두리 없이 면으로 구분한다. 입력, 칩, 보조 버튼은 반지름 2px이다. 누를 수 있는 주 행동에만 오른쪽 위 모서리를 8px 자른다.
- 카드 상태: 테두리 전체를 칠하지 않고 네 모서리 꺾쇠로 표시한다. 기본, 선택, 실패(hazard 줄무늬), 대기(dashed)를 구분한다.
- 모션: hover 120ms, 상태 전환 180ms, 숫자 증가 400ms와 감속 곡선 하나만 쓴다. 튕김, 흔들림, 빛 번짐은 쓰지 않으며 `prefers-reduced-motion: reduce`에서 모두 끈다.
- 아이콘: 선 아이콘은 `stroke-linecap="square"`, `stroke-linejoin="miter"`로 그린다.
- 라벨: 화면 라벨을 영어로 쓰지 않는다. 숫자, 단축키, 제품 이름 `DFragon`은 예외다.

## Typo의 명시적 예외

이번 Typo 요청은 `@dfragon/ui`에 외부 UI 라이브러리 없이 React와 TypeScript로 구현한 `Typo.h1`–`h6`, `txtL`, `txtM`, `txtS`, `caption`을 추가하는 범위로 채택한다. 지정한 크기, 행간, 굵기는 `typographyVariants`에서 관리하며 semantic 기본 태그, HTML `as`, 기본 attribute, event와 `className`, `style`, `color`, `align`, `weight`를 지원한다. 공용 컴포넌트 추가는 PR #504에서 채택했다. 2026-09-19 후속 요청은 Penpot 클라이언트 시안과 Desktop의 현재 카드, 상세 미리보기, 설정, 캡처 화면, API가 제공하는 패스키 인증 browser 화면에 이 규격을 적용하는 범위다. 기존 공용 Component의 interaction은 유지하며 label에는 Typo를 조합한다. 라이브러리가 생성하는 서버 선택 텍스트는 공개 `typographyVariants`를 적용하고, 검색 input은 TextField의 요소 합성 API(`render`, 이행용 `asChild`)에 Typo를 연결한다. focus가 필요한 HTML element는 태그에 맞는 `ref`를 전달한다. 이 적용 범위와 browser 전용 소비 경로는 해당 PR의 사용자 merge 후 채택한다.

## 글꼴과 한국어 타이포그래피

Desktop renderer와 OCR browser UI는 앱에 번들한 Pretendard 1.3.9 가변 글꼴을 사용하며 CDN에서 받지 않는다. 글꼴 이름과 대체 순서는 각 앱 전역 글꼴 CSS의 `body` 한 곳에서 정하고 화면 스타일에 반복하지 않는다. 화면은 상속을 사용하며, 기본 글꼴이 따로 정해진 `pre` 같은 요소만 `inherit`로 연결한다. 굵기는 400, 500, 600, 700만 쓴다. Typo의 크기, 행간, 굵기, 자간은 `typographyVariants`가 소유한다.

Desktop renderer는 숫자 글꼴 Barlow Condensed(SIL OFL 1.1)를 앱에 번들하고 CDN에서 받지 않는다. 600, 700 굵기를 숫자와 기본 라틴 문자로 줄여 담고, `@font-face`는 Desktop 전역 글꼴 CSS에, 글꼴 이름은 `font` 토큰에 둔다. 숫자 값은 `NumericText`나 같은 토큰으로 이 글꼴을 쓴다. OCR은 Barlow Condensed를 번들하지 않는다.

- 같은 전역 CSS에 `word-break: keep-all`, `overflow-wrap: anywhere`를 두어 한국어를 어절 단위로 줄바꿈하고 긴 문자열은 영역 안에서 나눈다. `packages/ui/foundation.css`는 이 글꼴 적용 범위가 아닌 Accounts, Web도 공유하므로 이 기준을 두지 않는다.
- 기울임, `text-transform: uppercase`, 양수 자간을 새로 쓰지 않는다.
- 수치, 표, 타이머는 `font-variant-numeric: tabular-nums`를 쓴다. 기존 사용처는 유지하며 기존 코드의 일괄 정리는 이 기준의 선행 조건이 아니다.
- API 패스키 browser는 기존 글꼴 상속을 유지하고, Web은 이 글꼴 적용 범위가 아니다.

값과 규칙의 디자인 기준은 디자인 인계 저장소의 [Typography](https://github.com/blahaj94/dfragon-design/blob/main/design/typography.md)다. Pretendard 기준은 사용자가 승인한 Pretendard 전환 요청으로 채택했고, Barlow Condensed 기준은 2026-10-18 결정으로 채택하며 이 변경의 사용자 merge 후 적용한다.

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

Desktop, API 패스키, OCR, Web의 화면별 간격, 정렬, 너비, 영역 padding, 반응형 배치는 StyleX로 작성한다. 모든 앱은 공통 compiler 설정과 workspace catalog의 버전을 사용한다. 공용 토큰 CSS, vendor 스타일, font-face, reset, 공용 foundation 같은 전역 기반 CSS는 유지한다. 이 공통화는 사용자 요청 범위로 해당 PR에서 구현, 검증하며 사용자 merge 후 적용한다. 연결 위치와 구현 예시는 [앱 공통 StyleX](../reference/app-styling.md)를 따른다. 가능한 기존 Token과 공개된 Component 옵션을 사용한다. 기존 옵션으로 부족한 작은 표현은 공개된 style, className, CSS 변수 API에서 화면 범위로 조정할 수 있으며, 그 이유는 필요한 경우 PR에 짧게 남긴다. 현재 `@dfragon/ui`의 타입이 필요한 prop을 제외한다면 해당 기능 변경에서 upstream 지원을 확인하고 타입과 사용처를 함께 확장할 수 있다. 규칙의 허용을 현재 모든 Component의 prop 지원으로 표시하지 않는다. 이 선택에 공용 Variant 추가나 별도 승인을 요구하지 않는다.

컴포넌트 전용 StyleX는 옆의 `{name}.style.ts`에 module scope의 `stylex.create`와 named export로 둔다. JSX는 `stylex.props(base, condition && variant)`로 필요한 스타일을 합성한다. 다른 `className`과 함께 쓰면 한쪽을 덮어쓰지 않도록 합친다. 전용 스타일이 없는 컴포넌트에 빈 파일을 만들지 않는다.

공용 색, 간격, 반지름, 모션은 `@dfragon/ui/tokens.stylex`의 상수를 쓴다. 앱에만 필요한 StyleX 변수, 테마가 있으면 앱의 `.stylex.ts`에서 `defineVars`, `createTheme`를 사용한다. 앱 고유 배치는 앱이, 실제 여러 화면이 공유하는 UI는 `@dfragon/ui`가 소유한다. `@dfragon/ui`의 StyleX는 `--df-*` 변수만 참조하며, 토큰 상수의 `defineConsts` 외에 `defineVars`, `createTheme`를 쓰지 않는다. 여러 화면이 쓰는 디자인 값에 토큰이 없으면 dfragon-design `tokens.json`과 `tokens.css`에 토큰을 추가해 쓴다. StyleX API를 다시 감싼 runtime wrapper는 만들지 않는다.

라이브러리 내부 DOM을 가정한 selector, 다른 화면에 퍼지는 전역 override, focus 표시, disabled/loading 차단, 접근 가능한 이름을 깨는 변경은 피한다. 여러 사용처가 공유해야 하는 의미나 중요한 interaction 변경은 공용 정의에서 처리하고 영향을 확인한다. 스타일 조정으로 제품 동작, 접근성 결함을 숨기지 않는다.

## Example 관리

실제 화면이나 기존 Example으로 변경을 확인할 수 있으면 그것을 사용한다. 공용 자산 변경마다 새 Component, Pattern, Template Example을 만들거나 전체 gallery를 갖추는 것은 의무가 아니다. 실제 사용처로 재현하기 어려운 중요한 상태를 설명할 필요가 있을 때만 작은 Example을 추가한다.

기존 Example의 public API 사용이나 설명이 변경 때문에 틀리면 같은 PR에서 바로잡는다. 단순히 예제를 더 풍부하게 만드는 작업은 출시 선행 조건으로 두지 않는다. 예시 데이터는 비민감 합성 데이터를 쓰고 별도 gallery framework를 검증만을 위해 추가하지 않는다.

## 영향 범위 검증

[검증 명령](../../scripts/README.md#native-validation)에 따라 변경한 화면, 상태와 실제 소비 환경을 선택한다. 작은 배치 수정은 해당 화면의 build와 좁은/넓은 화면 확인으로 마칠 수 있다. Interaction 변경은 해당 키보드, focus, disabled/loading 흐름을 확인하고, Theme, Motion을 변경하면 관련 전환, reduced-motion을 확인한다.

공유 CSS, 의존성처럼 여러 환경에 영향을 주면 실제 소비 앱으로 범위를 넓힌다. 모든 변경에 모든 OS, browser, Theme, font, viewport 조합이나 공식 화면과의 pixel 비교를 요구하지 않는다. Browser 확인을 Electron 실행 성공으로 표시하지 않으며 확인한 환경, 동작과 남은 중요한 한계를 PR에 짧게 남긴다.

## 변경과 Review

리뷰는 이번 변경의 사용자 동작, 접근성, 실제 시각 결함과 다른 사용처의 회귀에 집중한다. 화면 로컬 CSS나 Example 파일을 추가하지 않았다는 사실만으로 반려하지 않는다. 공용 자산과 소비자의 실제 계약이 바뀌면 함께 반영하고 관련 검증이 끝나면 전달한다.
