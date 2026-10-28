---
type: reference
status: active
scope: desktop-renderer
---

# Desktop 스타일 작성

Desktop renderer의 화면별 스타일은 StyleX로 작성합니다. 공용 토큰, `@dfragon/ui` Component와 화면의 책임은 [Design System](../rules/design-system.md)을 따릅니다.

## 빌드 연결

[앱 공통 StyleX](app-styling.md)의 compiler 옵션, 버전을 사용한다. `apps/desktop/build/renderer-transforms.ts`가 공식 `@stylexjs/unplugin`과 React plugin의 순서를 관리합니다. 제품 electron-vite renderer, Vitest, auth bridge fixture가 이 설정을 함께 사용합니다. Vitest는 HTTP/HMR timer 없이 같은 compiler를 실행하는 Rollup adapter를 사용합니다. Main, preload에는 StyleX 변환을 적용하지 않습니다.

Plugin 순서, CSS 추출, entry의 CSS import 순서는 [앱 공통 StyleX](app-styling.md#공통-설정과-소비-경로)를 따릅니다. Desktop의 앱 전역 글꼴 CSS는 `assets/fonts.css`이며, HTML entry를 사용하는 개발 서버에는 plugin이 CSS와 HMR runtime을 연결하므로 수동 CSS 생성이나 별도의 StyleX CLI 실행은 필요하지 않습니다.

## 컴포넌트 작성

```tsx
import * as stylex from '@stylexjs/stylex'
import { colors, space } from '@dfragon/ui/tokens.stylex'

const styles = stylex.create({
  actions: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: space.s12,
    color: colors.fgMuted
  }
})

// JSX
<div {...stylex.props(styles.actions)}>{children}</div>
```

스타일은 module scope에서 선언하고 색, 간격, 반지름, 모션은 `@dfragon/ui/tokens.stylex`의 상수를 씁니다. `components`, `sections`의 스타일 정의는 컴포넌트 옆의 `{name}.style.ts`로 분리하고 `export const styles` 같은 named export로 가져옵니다. `InvestmentTable.tsx`와 `InvestmentTable.style.ts`가 컴포넌트, 전용 스타일 분리 예시입니다. 여러 스타일은 `stylex.props(base, condition && variant)`로 합성합니다. StyleX는 빌드 중 정적으로 해석하므로 일반 함수 호출이나 임의의 외부 객체를 `stylex.create` 안에 넣지 않습니다. Desktop에는 앱 고유 `.stylex.ts` 테마가 없으며, 여러 화면이 쓰는 새 디자인 값은 `@dfragon/ui` 토큰으로 추가합니다.

홀짝 행, hover, focus, disabled처럼 브라우저가 판단할 수 있는 시각 상태는 CSS pseudo-class로 표현합니다. 예를 들어 교차 행 배경은 `backgroundColor: { default: colors.cardBg, ':nth-child(even)': colors.cardStripe }`로 선언하고 JSX에서는 행 인덱스를 계산하지 않습니다. 마법부여 등급처럼 유한한 UI 상태는 정적 스타일을 정의하고 상태 값으로 선택합니다. 동적 스타일 함수는 런타임 색상, 그리드 좌표처럼 실제 값이 달라질 때 사용하며, 고정 테두리, 크기 등은 정적 스타일에 둡니다. 데이터 선택, 누락 처리, 표시할 열과 같은 UI/도메인 분기는 React에 남깁니다.

기존 `className`, `style`과 같은 요소에 적용할 때는 JSX spread가 해당 prop을 덮어쓰지 않도록 합성합니다. 라이브러리 내부 DOM selector 대신 앱이 소유한 요소나 컴포넌트의 공개 API에 적용합니다.

## 테마 상태

Desktop은 다크 테마 하나만 씁니다. 제품 `main.tsx`와 MVP 미리보기 `fixture/mvp/main.tsx`는 루트에 `ColorThemeProvider`를 두고, Provider는 마운트할 때 `document.documentElement`의 `data-theme`과 inline `color-scheme`을 `dark`로 두며 해제할 때 이전 값을 되돌립니다. 시스템 설정과 저장된 라이트 설정은 읽지 않고, 테마 전환 hook과 버튼은 없습니다. `tokens.css`가 `data-theme`으로 `--df-*` 값을 고르므로 화면과 대화상자, 메뉴 포털에 테마 스타일을 따로 적용하지 않습니다.

## 색 토큰

`@dfragon/ui/tokens.stylex`의 `colors`는 dfragon-design [색 체계](https://github.com/blahaj94/dfragon-design/blob/main/design/colors.md)의 의미 토큰을 camelCase 키로 옮긴 것입니다. 예를 들어 `bg.surface`는 `bgSurface`, `card.fgMuted`는 `cardFgMuted`입니다. 값은 모두 `var(--df-…)` 문자열이고 실제 값과 라이트 값은 `packages/ui/tokens.css`가 정합니다.

- **신호색**: `signal`, `onSignal`은 선택, 주 버튼, 포커스에 씁니다.
- **카드 면**: `card*`, `bracket*`, `hatchAlert`, `gridLine`, `tierRanker*`, `scoreDealer`, `scoreBuffer`, `bgWell`, `brandLogo`는 카드 면 토큰입니다. 점수 라벨과 값은 카드 값의 역할에 따라 딜러 `scoreDealer`, 버퍼 `scoreBuffer`로 칠하고 상위, 랭커 카드는 명성과 점수 모두 단계 색이 앞섭니다. 카드의 포커스와 선택은 `cardSignal`을 씁니다. 검색 실패의 노란색은 `bracketFailure`(꺾쇠), `cardFailure`(`!` 글자와 이름 칸 테두리), `cardFailureWeak`(`!` 칸 면)입니다. 스냅샷에 없는 모험단의 칩과 오버레이는 어두운 카드 위의 경고색이라 `bracketDanger`(칩 면은 그 16%)를 씁니다. 상위, 랭커 카드의 단계 색은 `tierTop`, `tierRanker`, 랭커 면은 `tierRanker*`입니다.
- **대화상자의 면**: 대화상자와 패널은 반지름 0(`radius.panel`)에 테두리 없이 `bgSurface`, `bgInset` 면으로 구분합니다.
- **상단 바**: 상단 바 면은 `bgBar`이며 창 버튼 띠 색(`preload/common/window-chrome.ts`)과 맞춥니다.

## 공용 Component 사용

dfragon-design [컴포넌트](https://github.com/blahaj94/dfragon-design/blob/main/design/components.md)의 크기와 상태는 `@dfragon/ui` Component의 `variant`, `size`로 옮기고, 시안의 픽셀을 맞추려고 공용 Component 모양을 다시 그리지 않습니다. 동작과 접근성은 Base UI 부품이 맡습니다.

| 화면 | 구현 | 참고 |
| --- | --- | --- |
| 버튼 | `Button` | 보조 버튼은 공용 `secondary` 외형을 그대로 씁니다 |
| 파티와 공대 헤더의 스냅샷 버튼 | `IconButton` | 켜고 끄는 토글이라 `pressed`를 주어 `aria-pressed`와 켜짐 모양(아이콘과 안쪽 2px 선이 `signal`)을 씁니다. 접근 가능한 이름은 `aria-label`로 줍니다. 상단 바 안의 헤더에 맞춰 `lg`를 28 정사각형, 16px 아이콘으로 줄이고 오른쪽 위를 자릅니다 |
| 상단 바의 게임 연결 상태 | `StatusChip` `size="md"`를 감싼 `DialogTrigger` native button | 누르면 캡처 대화상자를 엽니다. 칩의 자른 모서리에 가리지 않게 포커스 링을 버튼 바깥에 둡니다 |
| 파티, 공대 헤더의 캡처 버튼 | `Button` `primary` `sm` | 높이 28로 줄이고 카메라 아이콘과 `Alt R` 글자만 둡니다. 접근 가능한 이름은 `<대상> 캡처, 단축키 Alt R`입니다 |
| 상단 내비의 검색 | `Menu`의 `RadioGroup`, `RadioItem`(`closeOnClick`) | trigger는 화면의 버튼(현재 항목 모양)을 `render`로 잇습니다 |
| 서버 선택 | `Select` 칩, `surface="card"` | 이름 칸 안 오른쪽의 높이 16 칩(`ServerSelect` `variant="field"`)이고, body portal의 목록도 카드 토큰으로 그립니다 |
| 캐릭터 카드 | `CardFrame`, `shapes.gridWell`, `components/NameField`, `components/StatLine` | 상태는 꺾쇠 색, 이름 칸 테두리(`NameField`의 `tone`), 헤더 줄 오른쪽 표시로 보이고, 실패는 노란 꺾쇠, `!` 칸, 노란 이름 칸 테두리입니다. 명성과 점수는 `StatLine` 한 줄입니다. 상위, 랭커는 `CardFrame` `top`, `ranker`가 빛줄기와 스캔선을 그립니다 |
| 공대 화면 | 축약 카드 `sections/RaidCard`(`CardFrame`, `shapes.gridWell`, `NameField`, `StatLine`) | DFragon 디자인 캔버스 축소 시안의 공대 보드입니다. 파티 번호 열 없이 창 폭을 네 등분한 카드 네 열, 세 줄을 간격 8로 두고, 넘치면 보드 영역이 스크롤합니다. 카드 면에 `className`을 줄 수 없어 드래그, 포커스 링(바깥 2px `signal`), 드롭 대상의 안쪽 2px 선은 카드를 감싼 자리 요소가 그립니다 |
| 모험단 순번 스냅샷 | `components/SnapshotToggle`(Base UI `Popover`, `IconButton`, `Button`), `SnapshotChip`, `SnapshotOverlay`(`shapes.alertHatch`) | 끄기 확인은 버튼에 붙은 `role="alertdialog"` 팝오버(폭 220, `bg.inset` 면, 위쪽 2px `signal` 선, `shapes.cutBottomRight`)이고 `취소`에 먼저 포커스합니다. 순번 칩은 카드 헤더 줄 오른쪽의 `role="img"`이며 파티는 높이 24, 공대는 높이 20입니다. 오버레이는 `pointer-events: none`에 `aria-hidden`입니다. 판정은 React와 분리한 `lib/adventure-snapshot.ts`, 상태는 `hooks/useAdventureSnapshot.ts`의 메모리에만 둡니다. 회차 번호(`#N`)는 같은 hook이 캡처 머신의 `startedRounds`(START를 받아들인 횟수)와 켠 시점의 값 차이로 계산하고, 상단 바 헤더의 인원수 뒤 `role="img"` 글자(Barlow Condensed 16 700, `signal`)로 그립니다 |
| 캡처할 창 | native radio 타일(`components/CaptureSourceSelect`) | 한 줄 타일 목록입니다. 타일은 최대 220 폭, 높이 44이고 넘치면 가로로 스크롤합니다. 찾는 중, 조회 실패 안내 타일은 radio가 아니라 그 앞에 둡니다 |
| 게임 연결 상태 | `StatusChip` `size="md"` | 상단 바. 높이 28, 오른쪽 위를 자른 칩입니다. 확인 필요와 창 미감지는 `warning`, 인식 중은 `signal`과 `busy`입니다 |
| 캡처 상태 | `StatusChip` | 캡처 창 헤더 줄 |
| 창을 찾는 중 | `StepDots` `size={5}` | 캡처 창 목록의 `던전앤파이터 찾는 중` 옆 |
| 캡처 창 | `DialogRoot`, `DialogTrigger`와 Base UI `Dialog`의 `Portal`, `Backdrop`, `Popup` | 게임 연결 상태 칩 아래 오른쪽 정렬의 760 × 104 가로 패널입니다. 공용 `DialogContent`는 화면 가운데에 놓고 창 전체를 덮어서, 상단 바 아래만 덮도록 Base UI `Dialog`를 직접 씁니다 |
| 후보 창 | `components/CandidateWindow` | 카드 자리 위에 겹쳐 뜨는 창입니다. 초상화 64 × 64 버튼 한 줄과 오른쪽 위 24 × 24 닫기 버튼이고, 닫은 뒤의 `후보 N` 칩은 카드 헤더 줄에 둡니다 |
| 새 버전 알림 | `StatusChip`을 감싼 `Menu` trigger(`components/UpdateNotice`) | 게임 연결 상태 칩 왼쪽의 칩이고, 메뉴에 `Release 열기`와 `닫기`를 둡니다 |

공개 옵션으로 부족한 작은 표현은 해당 요소나 감싼 요소에 화면 범위의 StyleX를 줍니다. 공용 Component의 내부 DOM 선택자는 쓰지 않습니다. 공용 Component에 넘긴 StyleX와 공용 class가 같은 속성을 덮으면 우선순위가 CSS 순서에 달려 있으므로, 배치는 감싼 요소에 주는 편이 안전합니다.

## 검증

`pnpm --filter @dfragon/desktop build`는 typecheck와 production CSS 추출을 포함합니다. `pnpm --filter @dfragon/desktop test`는 동일한 StyleX 변환으로 기존 UI 동작을 확인합니다. 스타일 이름, 생성 class hash에 의존하는 assertion 대신 접근 가능한 이름과 표시 내용을 검사합니다.

스타일 변경은 실제 renderer에서 좁은/넓은 화면과 변경한 focus, theme 상태를 확인합니다. jsdom 테스트 성공만으로 CSS 적용이나 Electron 실행 성공을 판단하지 않습니다.
