---
type: reference
status: active
scope: desktop-renderer
---

# Desktop 스타일 작성

Desktop renderer의 화면별 스타일은 StyleX로 작성합니다. 공용 토큰, `@dfragon/ui` Component와 화면의 책임은 [Design System](../rules/design-system.md)을 따릅니다.

## 빌드 연결

[앱 공통 StyleX](app-styling.md)의 compiler 옵션, 버전을 사용한다. `apps/desktop/build/renderer-transforms.ts`가 공식 `@stylexjs/unplugin`과 React plugin의 순서를 관리합니다. 제품 electron-vite renderer, Vitest, auth bridge fixture가 이 설정을 함께 사용합니다. Vitest는 HTTP/HMR timer 없이 같은 compiler를 실행하는 Rollup adapter를 사용합니다. Main, preload에는 StyleX 변환을 적용하지 않습니다.

- StyleX를 React보다 먼저 실행해 Fast Refresh를 유지합니다.
- `runtimeInjection: false`로 빌드 시 CSS를 추출합니다. `useCSSLayers: false`로 공용 토큰 CSS, foundation, 앱 글꼴 CSS와 같은 cascade에서 조합합니다.
- 각 browser entry는 `@dfragon/ui/tokens.css`, `@dfragon/ui/foundation.css`, `assets/fonts.css` 순서로 한 번 import합니다. Production에서는 생성된 StyleX CSS가 이 CSS asset에 합쳐지고 HTML의 링크가 갱신됩니다.
- HTML entry를 사용하는 개발 서버에는 plugin이 CSS와 HMR runtime을 연결합니다. 수동 CSS 생성이나 별도의 StyleX CLI 실행은 필요하지 않습니다.

통합 방식은 [공식 Vite 안내](https://stylexjs.com/docs/learn/installation/vite/)와 [unplugin 설정](https://stylexjs.com/docs/api/configuration/unplugin/)을 참고합니다. 설치 버전은 workspace catalog와 lockfile에서 관리합니다.

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

기존 `className`, `style`과 같은 요소에 적용할 때는 JSX spread가 해당 prop을 덮어쓰지 않도록 합성합니다. 라이브러리 내부 DOM selector 대신 앱이 소유한 요소나 컴포넌트의 공개 API에 적용합니다. 실제 예시는 `PartyCapture.tsx`, `CharacterCandidates.tsx`, `SearchResults.tsx`에 있습니다.

## 테마 상태

제품 `index.html`, `character-detail.html`은 head에서 정적 script `public/theme-init.js`를 불러 첫 페인트 전에 시스템 설정으로 `document.documentElement`의 `data-theme`과 `color-scheme`을 넣습니다. CSP(`script-src 'self'`)가 inline script를 막아 정적 파일로 둡니다.

제품 `main.tsx`, MVP 미리보기 `fixture/mvp/main.tsx`, 인증 bridge fixture `fixture/auth-bridge/main.tsx`는 각 창의 루트에 `ColorThemeProvider`를 둡니다. Context는 `hooks/color-theme-context.ts`에 두며 Provider와 훅이 함께 참조합니다. Provider가 테마 상태와 전환, document의 `data-theme`과 inline `color-scheme` 반영, 해제 때 복원을 소유하고, 화면은 `useColorTheme()`로 같은 `light`, `toggleTheme`를 읽습니다. 컴포넌트 사이에서 테마 props를 전달하거나 훅마다 별도 상태를 만들지 않습니다. Provider 밖에서 훅을 호출하면 오류가 발생하므로 독립 렌더링 테스트에도 Provider를 포함합니다. React 포털 안의 소비자도 같은 context를 읽습니다.

기본 앱은 시작 시 시스템 테마를 읽고, 미리보기는 기존 URL의 `theme=light|dark|system`을 Provider의 초기값으로 전달합니다. 수동 전환은 현재 창에서 유지하며 설정 저장이나 실행 중 OS 테마 추적을 추가하지 않습니다. `tokens.css`가 `data-theme`으로 `--df-*` 값과 `color-scheme`을 함께 바꾸므로, 화면과 대화상자, 메뉴 포털에 테마 스타일을 따로 적용하지 않습니다. Provider의 inline `color-scheme`은 `tokens.css`와 같은 값입니다.

## 색 토큰

`@dfragon/ui/tokens.stylex`의 `colors`는 dfragon-design [색 체계](https://github.com/blahaj94/dfragon-design/blob/main/design/colors.md)의 의미 토큰을 camelCase 키로 옮긴 것입니다. 예를 들어 `bg.surface`는 `bgSurface`, `card.fgMuted`는 `cardFgMuted`입니다. 값은 모두 `var(--df-…)` 문자열이고 실제 값과 라이트 값은 `packages/ui/tokens.css`가 정합니다.

- **신호색**: `signal`, `onSignal`은 선택, 주 버튼, 포커스에 씁니다. 개발자 작업 공간의 선택 탭 아래 2px 선이 `signal`입니다.
- **카드 면**: `card*`, `bracket*`, `hatchAlert`, `gridLine`, `tierRanker*`, `bgWell`, `brandLogo`는 라이트 모드에서도 다크 값입니다. 라이트에서도 어두운 카드는 카드 토큰을 쓰고, 포커스와 선택은 `cardSignal`을 씁니다. 검색 실패의 노란색은 `bracketFailure`(꺾쇠), `cardFailure`(`!` 글자와 이름 입력 테두리), `cardFailureWeak`(`!` 칸 면)이고 모두 라이트에서도 같은 값입니다. 스냅샷에 없는 모험단의 칩과 덮는 층은 어두운 카드 위의 경고색이라 `bracketDanger`(칩 면은 그 16%)를 씁니다. 상세 창의 카드 더미도 모든 카드가 `CardFrame`의 `cardBg` 면이고, 앞 카드의 오른쪽 끝에 1px `cardBorder` 선을 그어 겹친 카드를 나눕니다. 상위, 랭커 카드의 단계 색은 `tierTop`, `tierRanker`, 랭커 면은 `tierRanker*`입니다.
- **크롭 미리보기**: 개발자 화면의 게임 크롭 칸은 두 모드에서 같은 어두운 면인 `bgWell`을 씁니다.
- **설정, 개발자 화면의 면**: 대화상자, 패널, 크롭 칸은 반지름 0(`radius.panel`)에 테두리 없이 `bgSurface`, `bgInset`, `bgWell` 면으로 구분합니다. 개발자 업로드 안내만 왼쪽 5px 띠의 색으로 상태를 보입니다.
- **상단 바**: 상단 바 면은 `bgBar`이며 창 버튼 띠 색(`preload/common/window-chrome.ts`)과 맞춥니다.
- **게임 색**: 마법부여 `enchant*`, 강화 `gameEnhance`, 증폭 `gameAmplify`는 두 모드에서 같은 값입니다. 투자 현황의 강화 열은 `EquipmentSlot.enhancement`가 강화와 증폭을 구분하지 않아 모두 `gameAmplify`로 표시합니다.

## 공용 Component 사용

dfragon-design [컴포넌트](https://github.com/blahaj94/dfragon-design/blob/main/design/components.md)의 크기와 상태는 `@dfragon/ui` Component의 `variant`, `size`로 옮기고, 시안의 픽셀을 맞추려고 공용 Component 모양을 다시 그리지 않습니다. 동작과 접근성은 Base UI 부품이 맡습니다.

| 화면 | 구현 | 참고 |
| --- | --- | --- |
| 버튼 | `Button` | 개발자 작업 공간의 보조 버튼은 `constants/button.style.ts`의 `buttonStyles.secondary`로 `bgControl`, `bgControlHover` 배경을 지정하고, 나머지 보조 버튼은 공용 `secondary` 외형을 그대로 씁니다 |
| 상단 바의 테마, 설정 버튼, 파티와 공대 머리의 접기, 스냅샷 버튼 | `IconButton` | 스냅샷은 켜고 끄는 토글이라 `pressed`를 주어 `aria-pressed`와 켜짐 모양(아이콘과 안쪽 2px 선이 `signal`)을 씁니다. 접근 가능한 이름은 `aria-label`로 줍니다. 상단 바는 `bar`, 파티와 공대 머리는 `bg.inset` 면에 오른쪽 위를 자른 48 정사각형 `lg`입니다 |
| 상단 바의 게임 연결 상태 | `StatusChip` `size="md"`를 감싼 `DialogTrigger` native button | 누르면 캡처 대화상자를 엽니다. 칩의 자른 모서리에 가리지 않게 포커스 선을 버튼 바깥에 둡니다 |
| 파티 머리의 캡처 버튼 | `Button` `primary` `lg`와 `Kbd` `surface="signal"` | 카메라 아이콘, 구분선, `Alt`, `R` 키캡을 둡니다. 키캡과 구분선은 버튼 글자색을 따라 비활성에서도 함께 흐려집니다 |
| 상단 내비의 검색 | `Menu`의 `RadioGroup`, `RadioItem`(`closeOnClick`) | trigger는 화면의 버튼(현재 항목 모양)을 `render`로 잇습니다 |
| 서버 선택 | `Select` 칩, `size="xs"`, `surface="card"` | 칩과 body portal의 목록 모두 라이트 모드에서도 카드 토큰으로 그립니다 |
| 캐릭터 카드 | `CardFrame`, `shapes.gridWell`, `NumericText` | 상태는 꺾쇠 색과 머리 오른쪽 표시로 보이고, 실패는 노란 꺾쇠, `!` 칸, 이름 입력 테두리입니다. 상위, 랭커는 `CardFrame` `top`, `ranker`가 빛줄기와 스캔선을 그립니다 |
| 공대 화면 | 축약 카드 `sections/RaidCard`(`CardFrame`, `shapes.gridWell`, `NumericText`) | DFragon 디자인 캔버스 공대 보드의 배치입니다. 32 폭 파티 라벨 열과 288 × 205.33(접으면 288 × 125.33) 고정 카드 네 열, 세 줄을 거터 12로 두고, 보드 영역만 가로, 세로로 스크롤하며 스크롤 막대(8px, `borderStrong`)는 오른쪽 콘텐츠 여백 안에 둡니다. 카드 면에 `className`을 줄 수 없어 끌기, 포커스 선(바깥 2px `signal`), 놓을 자리의 안쪽 2px 선은 카드를 감싼 자리 요소가 그립니다 |
| 모험단 순번 스냅샷 | `components/SnapshotToggle`(Base UI `Popover`, `IconButton`, `Button`), `SnapshotChip`, `SnapshotOverlay`(`shapes.alertHatch`) | 끄기 확인은 버튼에 붙은 `role="alertdialog"` 팝오버(폭 220, `bg.inset` 면, 위쪽 2px `signal` 선, `shapes.cutBottomRight`)이고 `취소`에 먼저 포커스합니다. 순번 칩은 서버 칩 뒤의 `role="img"`이며 파티는 높이 24, 공대는 높이 20입니다. 덮는 층은 `pointer-events: none`에 `aria-hidden`입니다. 판정은 React와 분리한 `lib/adventure-snapshot.ts`, 상태는 `hooks/useAdventureSnapshot.ts`의 메모리에만 둡니다 |
| 보조 창 상단 바 | `WindowBar` | 상세 창. 메인 상단 바와 같은 높이, 면, OS 창 버튼 자리 규칙을 씁니다 |
| 카드 면 탭 | `Tabs`, `surface="card"` | 탭이 폭을 나눠 채우고 현재 탭 위쪽에 2px `cardSignal` 선을 둡니다 |
| 캡처 주기 | `Select`, `size="md"` | 개발자 작업 공간 |
| 캡처할 창 | `Menu`의 `RadioGroup`, `RadioItem`(`closeOnClick`) | 대화상자 면의 스크롤 영역에 잘리지 않도록 목록은 body portal에 그리며, 목록 폭은 trigger 폭(`var(--anchor-width)`)입니다 |
| 개발자 모드 | `<label>` 안의 `Switch` | 설정 대화상자 |
| 저장 포함 | `Checkbox` | 파티, 참가자 수집 화면 |
| 저장 단축키 | `Kbd` | 개발자 참가자 수집 화면의 `Print Screen` |
| 정답 입력 필터 | `Chip`(`pressed`, `onPressedChange`) | 개발자 정답 입력 화면 |
| 게임 연결 상태 | `StatusChip` `size="md"` | 상단 바. 높이 28, 오른쪽 위를 자른 칩입니다. 확인 필요와 창 미감지는 `warning`, 인식 중은 `signal`과 `busy`입니다 |
| 캡처, 검출 상태 | `StatusChip` | 캡처 모달, 개발자 참가자 수집 화면. 개발자 화면의 `찾는 중`도 `warning`입니다 |
| 창을 찾는 중 | `StepDots` `size={5}` | 캡처 창 목록의 `던전앤파이터 찾는 중` 옆 |
| 설정, 캡처 대화상자 | `DialogRoot`, `DialogContent` | 바깥을 눌러도 닫히지 않습니다 |
| 개발자 작업 공간 탭 | 기존 `role="tablist"`의 `Button` ghost와 선택 탭 아래 2px `signal` 선 | 세 수집 탭이 섹션 인스턴스 하나와 단축키 수명을 공유해 공용 `Tabs`로 옮기지 않았습니다 |

공개 옵션으로 부족한 작은 표현은 해당 요소나 감싼 요소에 화면 범위의 StyleX를 줍니다. 공용 Component의 내부 DOM 선택자는 쓰지 않습니다. 공용 Component에 넘긴 StyleX와 공용 class가 같은 속성을 덮으면 우선순위가 CSS 순서에 달려 있으므로, 배치는 감싼 요소에 주는 편이 안전합니다.

## 검증

`pnpm --filter @dfragon/desktop build`는 typecheck와 production CSS 추출을 포함합니다. `pnpm --filter @dfragon/desktop test`는 동일한 StyleX 변환으로 기존 UI 동작을 확인합니다. 스타일 이름, 생성 class hash에 의존하는 assertion 대신 접근 가능한 이름과 표시 내용을 검사합니다.

스타일 변경은 실제 renderer에서 좁은/넓은 화면과 변경한 focus, theme 상태를 확인합니다. jsdom 테스트 성공만으로 CSS 적용이나 Electron 실행 성공을 판단하지 않습니다.
