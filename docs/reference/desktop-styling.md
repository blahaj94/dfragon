---
type: reference
status: active
scope: desktop-renderer
---

# Desktop 스타일 작성

Desktop renderer의 화면별 스타일은 StyleX로 작성합니다. SEED Component, Token과 `@dfragon/ui`의 공용 UI 책임은 [Design System](../rules/design-system.md)을 따릅니다.

## 빌드 연결

[앱 공통 StyleX](app-styling.md)의 compiler 옵션, 버전을 사용한다. `apps/desktop/build/renderer-transforms.ts`가 공식 `@stylexjs/unplugin`과 React plugin의 순서를 관리합니다. 제품 electron-vite renderer, Vitest, auth bridge fixture가 이 설정을 함께 사용합니다. Vitest는 HTTP/HMR timer 없이 같은 compiler를 실행하는 Rollup adapter를 사용합니다. Main, preload에는 StyleX 변환을 적용하지 않습니다.

- StyleX를 React보다 먼저 실행해 Fast Refresh를 유지합니다.
- `runtimeInjection: false`로 빌드 시 CSS를 추출합니다. 기존 SEED CSS와 같은 cascade에서 사용하도록 `useCSSLayers: false`를 명시합니다.
- 각 browser entry의 SEED `base.css`와 `@dfragon/ui/foundation.css` import를 유지합니다. Production에서는 생성된 StyleX CSS가 기존 CSS asset에 합쳐지고 HTML의 링크가 갱신됩니다.
- HTML entry를 사용하는 개발 서버에는 plugin이 CSS와 HMR runtime을 연결합니다. 수동 CSS 생성이나 별도의 StyleX CLI 실행은 필요하지 않습니다.

통합 방식은 [공식 Vite 안내](https://stylexjs.com/docs/learn/installation/vite/)와 [unplugin 설정](https://stylexjs.com/docs/api/configuration/unplugin/)을 참고합니다. 설치 버전은 workspace catalog와 lockfile에서 관리합니다.

## 컴포넌트 작성

```tsx
import * as stylex from '@stylexjs/stylex'

const styles = stylex.create({
  actions: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 'var(--seed-dimension-x3)'
  }
})

// JSX
<div {...stylex.props(styles.actions)}>{children}</div>
```

스타일은 module scope에서 선언하고 SEED CSS 변수를 참조합니다. `components`, `sections`의 스타일 정의는 컴포넌트 옆의 `{name}.style.ts`로 분리하고 `export const styles` 같은 named export로 가져옵니다. `InvestmentTable.tsx`와 `InvestmentTable.style.ts`가 컴포넌트, 전용 스타일 분리 예시입니다. 여러 스타일은 `stylex.props(base, condition && variant)`로 합성합니다. StyleX는 빌드 중 정적으로 해석하므로 일반 함수 호출이나 임의의 외부 객체를 `stylex.create` 안에 넣지 않습니다. 공유 StyleX 변수는 공식 `.stylex.ts` 모듈의 `defineVars` 방식을 사용합니다.

홀짝 행, hover, focus, disabled처럼 브라우저가 판단할 수 있는 시각 상태는 CSS pseudo-class로 표현합니다. 예를 들어 교차 행 배경은 `backgroundColor: { default: colors.cardBg, ':nth-child(even)': colors.cardStripe }`로 선언하고 JSX에서는 행 인덱스를 계산하지 않습니다. 마법부여 등급처럼 유한한 UI 상태는 정적 스타일을 정의하고 상태 값으로 선택합니다. 동적 스타일 함수는 런타임 색상, 그리드 좌표처럼 실제 값이 달라질 때 사용하며, 고정 테두리, 크기 등은 정적 스타일에 둡니다. 데이터 선택, 누락 처리, 표시할 열과 같은 UI/도메인 분기는 React에 남깁니다.

기존 `className`, `style`과 같은 요소에 적용할 때는 JSX spread가 해당 prop을 덮어쓰지 않도록 합성합니다. SEED의 내부 DOM selector 대신 앱이 소유한 요소나 컴포넌트의 공개 API에 적용합니다. 실제 예시는 `PartyCapture.tsx`, `CharacterCandidates.tsx`, `SearchResults.tsx`에 있습니다.

## 테마 상태

제품 `main.tsx`, MVP 미리보기 `fixture/mvp/main.tsx`, 인증 bridge fixture `fixture/auth-bridge/main.tsx`는 각 창의 루트에 `ColorThemeProvider`를 둡니다. Context는 `hooks/color-theme-context.ts`에 두며 Provider와 훅이 함께 참조합니다. Provider가 테마 상태와 전환, document의 SEED color mode 반영을 소유하고, 화면은 `useColorTheme()`로 같은 `light`, `toggleTheme`를 읽습니다. 컴포넌트 사이에서 테마 props를 전달하거나 훅마다 별도 상태를 만들지 않습니다. Provider 밖에서 훅을 호출하면 오류가 발생하므로 독립 렌더링 테스트에도 Provider를 포함합니다. React 포털 안의 소비자도 같은 context를 읽습니다.

기본 앱은 시작 시 시스템 테마를 읽고, 미리보기는 기존 URL의 `theme=light|dark|system`을 Provider의 초기값으로 전달합니다. 수동 전환은 현재 창에서 유지하며 설정 저장이나 실행 중 OS 테마 추적을 추가하지 않습니다. StyleX 테마 적용은 화면이 소유합니다. 라이트 테마에서도 카드 면은 다크 색상을 유지합니다.

`constants/theme.stylex.ts`의 `colors`는 dfragon-design [색 체계](https://github.com/blahaj94/dfragon-design/blob/main/design/colors.md)의 의미 토큰을 camelCase 키로 옮긴 것입니다. 예를 들어 `bg.brand.solid`는 `bgBrandSolid`, `card.fgMuted`는 `cardFgMuted`입니다. 값은 SEED 팔레트 변수 `--seed-color-palette-*`를 참조하고, 기본값은 다크 단계이며 `lightTheme`은 라이트에서 단계가 다른 토큰만 덮어씁니다. SEED 팔레트는 같은 단계 이름이 color mode마다 다른 값이므로, `defineVars`의 기본값은 `:root`에서 document의 `data-seed-color-mode`로 해석됩니다. 따라서 document color mode와 `lightTheme` 적용 범위가 맞아야 의미 토큰이 디자인 값과 같습니다. 라이트에서는 `<main>`뿐 아니라 그 밖으로 렌더링되는 대화상자, 메뉴 포털에도 `light && lightTheme`을 다시 적용합니다. 하위 요소에 다른 `data-seed-color-mode`를 두면 그 요소의 SEED 토큰은 바뀌지만 `:root`에서 해석된 `colors` 기본값은 바뀌지 않습니다.

카드 토큰 `card*`, 게임 색 `enchant*`, `gameAmplify`는 두 모드에서 같은 리터럴입니다. 개발자 화면의 게임 크롭 미리보기 배경 `bgPreview`도 리터럴이지만 색 체계에 없는 예외입니다. 게임 화면 크롭을 모드와 관계없이 어두운 면에 두려고 `bg.inset`의 다크 값(`#16171B`)을 씁니다. 라이트에서도 어두운 카드와 서버 메뉴는 카드 토큰을 쓰고, 명성 숫자, 포커스 링, 상태색은 디자인대로 의미 토큰을 그대로 씁니다. 디자인 카드 세트에 없는 `cardControlHover`, `cardBrandWeak`, `cardFgBrand`는 서버 메뉴의 hover, 선택 배경, 선택 글자와 체크 표시에, `cardBorderStrong`은 카드 hover 테두리에 `bg.controlHover`, `bg.brand.weak`, `fg.brand`, `border.strong`의 다크 값을 둔 것입니다. 상세 창의 카드 더미는 디자인 보드대로 앞 카드만 `cardBg`이고 뒤 카드는 테마를 따르는 `bgSurface`입니다. 투자 현황의 강화 열은 `EquipmentSlot.enhancement`가 강화와 증폭을 구분하지 않아 모두 `gameAmplify`로 표시하며, 디자인의 무기 강화 색 `game.enhance`는 구분할 데이터가 생길 때 더합니다. 화면이 쓰는 토큰만 정의하며, 새로 필요한 색은 색 체계의 의미 토큰 이름과 값으로 추가합니다.

## 디자인 컴포넌트 대응

dfragon-design [컴포넌트](https://github.com/blahaj94/dfragon-design/blob/main/design/components.md)의 크기와 상태는 SEED 컴포넌트와 크기 단계로 옮기고, 시안의 픽셀을 맞추려고 SEED 모양을 다시 그리지 않습니다. 디자인 버튼 md(40)는 SEED `medium`에 `Typo.txtM` 700 라벨을, sm은 SEED `small`(36)에 `Typo.txtS` 700 라벨을 씁니다. secondary 버튼은 SEED `neutralWeak` 배경을 그대로 쓰며, 이 값은 디자인 `bg.control`보다 한 단계 밝습니다. 라이트에서는 `neutralWeak`가 `bg.canvas`와 같은 회색이라, `bg.canvas` 위에 바로 놓이는 개발자 작업 공간의 보조 버튼에는 `bg.control`, `bg.controlHover` 배경을 지정합니다.

아이콘만 있는 `ActionButton`은 `layout="iconOnly"`와 SEED `Icon`으로 만듭니다(`<Icon svg={<SettingsIcon />} size="x6" />`). SEED는 개발 빌드와 Vitest에서 `Icon` 없이 SVG를 바로 넣으면 오류를 냅니다. medium iconOnly는 좌우 여백이 10이라 24px 아이콘을 넣으면 폭이 44가 됩니다. 디자인 `IconButton`의 40 정사각형에 맞추려고 화면 스타일에서 여백만 8로 줄입니다(`CaptureControls`, `SettingsSection`, `PartyPage`).

SEED 공개 옵션으로 부족한 작은 표현은 해당 요소의 className에서 SEED CSS 변수만 화면 범위로 바꿉니다. `.seed-*` 선택자나 라이브러리 내부 DOM 선택자는 쓰지 않습니다. SEED가 변수 이름을 바꾸면 조용히 SEED 기본 표현으로 돌아가므로 SEED를 갱신할 때 이 사용처를 함께 확인합니다.

- `TextField`의 포커스 테두리는 `--seed-color-stroke-neutral-contrast`를 씁니다. 디자인의 `border.focus`가 필요한 입력은 이 변수만 `colors.borderFocus`로 바꿉니다. 라이선스 검색(`OpenSourceNotices`)은 SEED `TextField`의 className에, 정답 입력란(`DeveloperSampleEditor`)은 공용 `TextField`가 className을 받지 않으므로 감싼 요소에 지정합니다.
- 서버 목록(`ServerSelect`) 항목은 SEED가 강조 항목 안쪽에 덧그리는 눌림 면을 `--seed-color-bg-transparent-pressed: transparent`로 끕니다. 포인터 hover와 키보드 이동이 같은 강조 상태를 쓰므로 강조 항목의 `border.focus` 1px 테두리는 남깁니다.

SEED에 같은 이름의 컴포넌트가 없거나 그대로 쓰면 의미, 배치가 달라지는 곳은 다음처럼 구현합니다.

| 디자인 | 구현 | 이유 |
| --- | --- | --- |
| `Chip`(정답 입력 필터) | SEED `Chip.Root`에 `aria-pressed`, 선택 칩은 `bg.brand.weak`, `border.brand`, `fg.brand` 700 | 설치한 `@seed-design/react` 2.4.1에는 `Chip.Toggle`이 없습니다. `ControlChip`은 deprecated이고 키보드 포커스 표시를 지우며, `SegmentedControl`은 radio로 의미가 바뀝니다 |
| `Checkbox`(저장 포함) | SEED `Checkbox.Root.Primitive` 안의 `Control`, `Indicator`, `HiddenInput` | styled `Checkbox.Root`는 최소 높이 32와 체크 위치 여백 때문에 고정 높이 행의 머리 줄을 늘리거나 체크 위치를 어긋나게 합니다 |
| `StatusBadge` | SEED `Badge` large | 캡처 모달은 SEED `weak` 모양 그대로 tone만 고르고, 개발자 창 검출 상태는 `bg.inset` 알약과 상태색 8px 점을 더합니다 |
| `Switch`(개발자 모드) | SEED `Switch` size 24 | 디자인 36 × 20에 가장 가까운 단계입니다. 꺼짐 트랙은 SEED 기본색입니다 |
| `SelectTrigger`, `Menu` | SEED `Select` medium과 화면 범위 StyleX | 캡처 주기는 폭 160, `bg.control` 트리거로 맞춥니다. 서버 선택의 24 트리거와 32 항목은 SEED 크기 단계에 없어 StyleX로 맞춥니다 |
| `Tab`(개발자 작업 공간) | 기존 `role="tablist"`의 `ActionButton` medium에 선택 탭 아래 2px `bg.brand.solid` | 세 수집 탭이 섹션 인스턴스 하나와 단축키 수명을 공유합니다. 값마다 내용을 나누는 SEED `Tabs` 전환은 마운트 방식과 함께 따로 정합니다 |

## 검증

`pnpm --filter @dfragon/desktop build`는 typecheck와 production CSS 추출을 포함합니다. `pnpm --filter @dfragon/desktop test`는 동일한 StyleX 변환으로 기존 UI 동작을 확인합니다. 스타일 이름, 생성 class hash에 의존하는 assertion 대신 접근 가능한 이름과 표시 내용을 검사합니다.

스타일 변경은 실제 renderer에서 좁은/넓은 화면과 변경한 focus, theme 상태를 확인합니다. jsdom 테스트 성공만으로 CSS 적용이나 Electron 실행 성공을 판단하지 않습니다.
