# 공용 UI

`@dfragon/ui`는 DFragon 디자인 토큰과 Base UI(`@base-ui/react`) 기반 공용 Component를 제공한다. 동작과 접근성은 Base UI 부품이, 외형은 `--df-*` 토큰만 쓰는 StyleX가 맡는다. 제품 data, event, platform 연결은 소비 app이 소유한다. 기준은 `docs/rules/design-system.md`와 `docs/architecture/overview.md`다.

## Public API와 CSS 책임

| Component | 바탕 | 요약 |
| --- | --- | --- |
| `Button` | native `button` | `variant` `primary`, `secondary`(기본), `ghost`, `danger`와 `size` `sm`, `md`(기본), `lg`(32, 40, 48px). `primary`는 신호색 면에 오른쪽 위 8px를 자른다. `loading`은 진행 원을 겹치고 클릭을 막지 않는다. |
| `IconButton` | native `button` | 회색 면 없이 hover 때 아이콘이 밝아진다. `aria-label`, `icon` 필수, `size` `sm`, `md`. |
| `TextField`, `TextFieldInput` | `Field`, `Input` | label, 설명, 오류(`invalid`일 때)를 입력에 연결한다. `value`, `onValueChange({ value })`, `size` `sm`, `md`, `lg`. 입력 요소 합성은 `render`. |
| `Select` | `Select` | `Root`, `Trigger`(칩, `size` `xs`, `sm`, `md`), `Value`, `Popup`(Portal, Positioner, Popup, List), `Item`, `ItemText`, `Group`, `GroupLabel`, `Separator`. |
| `Menu` | `Menu` | `Root`, `Trigger`(외형 없음, `render`로 연결), `Popup`, `Item`, `RadioGroup`, `RadioItem`, `Group`, `GroupLabel`, `Separator`. |
| `Tabs` | `Tabs` | `Root`, `List`(현재 탭 2px 선 포함), `Tab`, `Panel`. |
| `Switch`, `Checkbox`, `Chip` | `Switch`, `Checkbox`, `Toggle` | 한 요소로 쓰는 켜고 끄는 컨트롤. 이름은 감싼 label이나 `aria-label`로 준다. |
| `Tooltip` | `Tooltip` | `Provider`, `Root`, `Trigger`, `Popup`. |
| `DialogRoot`, `DialogTrigger`, `DialogContent`, `DialogBody`, `DialogFooter`, `DialogAction` | `Dialog` | 기본은 바깥 누름으로 닫지 않는다(`disablePointerDismissal` 기본 `true`). `DialogContent`가 Portal, Backdrop, Popup과 제목, 설명, 닫기 버튼을 둔다. Dialog 안에 펼친 메뉴, 목록에서 누른 Escape는 그 목록만 닫는다. |
| `StatusChip` | `span` | tone `neutral`, `success`, `danger`, `waiting`. `waiting`은 중립색과 각진 모래시계다. 상태 변화를 알릴 곳만 `role="status"`를 넘긴다. |
| `LoadingIndicator`, `ProgressCircle` | 자체 SVG | 값이 없으면 `steps()`로 끊어 도는 호, 있으면 진행 호. |
| `Kbd`, `CornerBrackets`, `CardFrame`, `NumericText` | plain | 단축키, 네 모서리 꺾쇠, 카드 상태(`default`, `selected`, `failure`, `waiting`, `top`, `ranker`), Barlow Condensed 숫자와 400ms 증가. |
| `ContentStack`, `ExampleSection`, `SupportingText` | plain | 예제와 단순 화면의 세로 묶음, 제목, 보조 글자. |
| `Typo` | plain | 아래 [Typo](#typo). |

공개 타입은 semantic prop과 ref를 유지하며 `className`, `style`을 받지 않는다. 기존 화면이 배치용 `stylex.props`를 펼쳐 넘기는 경로는 구현이 받아 자기 class 뒤에 합친다. Base UI 부품 그대로인 `Select.Root`, `Menu.Root` 같은 부품은 Base UI 문서의 API를 따른다. Select 목록을 열면 Base UI가 스크롤 막대를 숨기는 `<style>` 하나를 `head`에 넣는다. 그 밖의 위치 계산은 `style` 속성으로만 쓴다.

SEED에서 옮기는 동안 기존 이름을 남긴다. `ActionButton`(variant `brandSolid`는 `primary`, `neutral*`, `brandOutline`은 `secondary`, `criticalSolid`는 `danger`, size `xsmall`, `small`은 `sm`), `StatusBadge`(tone `positive`는 `success`, `critical`은 `danger`, `warning`은 `waiting`, `informative`는 `neutral`), `DialogTrigger`와 `TextFieldInput`의 `asChild`(`render`와 같음), `IconButton`의 효과 없는 `variant`, `TextField`의 `size` `medium`, `large`는 Desktop DFragon 디자인 적용의 마지막 PR에서 지운다.

`@base-ui/react`, React/React DOM `19.3.0`과 workspace catalog 버전의 `@stylexjs/stylex`는 peer이며 소비 환경과 같은 개발 사본을 사용한다. Library build는 Base UI, React, React DOM, JSX runtime, StyleX를 external 처리하고 CSS를 출력하지 않는다. 각 browser entry가 `@dfragon/ui/tokens.css`, `@dfragon/ui/foundation.css`를 한 번씩 import한다.

## 토큰

DFragon 디자인 토큰은 CSS custom property와 StyleX 상수 두 형태로 제공한다. 값과 이름은 dfragon-design `design/tokens.json`을 손으로 옮긴 것이며 기준 commit은 `tokens.css` 머리말에 적는다.

- `@dfragon/ui/tokens.css`: `--df-*` 변수. `:root`가 다크 기본값, `:root[data-theme='light']`가 라이트 값이며 `prefers-reduced-motion: reduce`에서 `--df-dur-*`를 0으로 둔다. `color-scheme`도 같은 선택자에서 `dark`, `light`로 정해 스크롤 막대 같은 브라우저 기본 부품이 모드를 따른다. `data-theme`이 없으면 다크다. Library JS는 이 파일을 import하지 않는다.
- `@dfragon/ui/tokens.stylex`: `colors`, `space`, `radius`, `shape`, `size`, `motion`, `font`. `stylex.defineConsts`로 `'var(--df-…)'` 문자열을 정의하며 `defineVars`, `createTheme`를 쓰지 않으므로 모드 전환은 CSS만으로 끝난다. StyleX compiler는 import 경로가 `.stylex`로 끝나는 파일의 `defineConsts`만 다른 파일에서 읽으므로 export 이름에 `.stylex`를 둔다. Package export는 source(`src/tokens.stylex.ts`)를 가리켜 소비 앱이 library를 먼저 빌드하지 않아도 compiler가 해석한다. 컴파일 없이 실행하면 `defineConsts`가 오류를 낸다.
- `shapes`: 기본 entry의 공용 `stylex.create`. `cutTopRight`, `cutBottomRight`, `gridWell`, `hazardStripes`, `scanlines`, `srOnly`.

Library build는 `tokens.stylex`를 별도 entry로 두어 `dist/tokens.stylex.js`에 남기고 `index.js`가 이 파일을 import한다. Compiler는 `defineConsts` 결과가 같은 이름으로 export될 때만 받아들이므로 library build는 식별자를 줄이지 않는다(`minify: false`).

```tsx
import * as stylex from '@stylexjs/stylex'
import { shapes } from '@dfragon/ui'
import { colors, motion, space } from '@dfragon/ui/tokens.stylex'

const styles = stylex.create({
  primary: { backgroundColor: colors.signal, color: colors.onSignal, padding: space.s8, transitionDuration: motion.durHover }
})

<button {...stylex.props(styles.primary, shapes.cutTopRight)}>검색</button>
```

## Typo

`Typo`는 외부 UI 라이브러리에 의존하지 않는 React 컴포넌트다. `Typo`, `typographyVariants`와 `TypoProps`, `TypoTag`, `TypoVariant` 타입을 public entry에서 제공한다. TypeScript 5.4 이상의 `NoInfer`로 HTML 속성이 `as`의 태그 추론을 넓히지 않도록 한다.

```tsx
import { Typo } from '@dfragon/ui'

<Typo.h1>Heading 1</Typo.h1>
<Typo.h2>Heading 2</Typo.h2>
<Typo.h3>Heading 3</Typo.h3>
<Typo.h4>Heading 4</Typo.h4>
<Typo.h5>Heading 5</Typo.h5>
<Typo.h6>Heading 6</Typo.h6>
<Typo.txtL>Large body text</Typo.txtL>
<Typo.txtM>Default body text</Typo.txtM>
<Typo.txtS>Small body text</Typo.txtS>
<Typo.caption>Caption text</Typo.caption>

<Typo.h1 as="div">Heading appearance</Typo.h1>
<Typo.h1 as="a" href="/about">About</Typo.h1>
<Typo.h2 color="#111" align="center" weight={500}>Title</Typo.h2>
<Typo.txtM id="description" aria-label="description" className="description">
  Description
</Typo.txtM>
<Typo.txtM as="button" type="button" onClick={handleClick}>
  Open details
</Typo.txtM>
<Typo.caption style={{ marginTop: 8, display: 'block' }}>Additional text</Typo.caption>
```

`h1`–`h6`는 같은 이름의 heading 태그, `txtL`, `txtM`, `txtS`는 `p`, `caption`은 `span`으로 렌더링된다. 크기, 행간, 굵기, 자간은 `typographyVariants` 한 곳에서 관리하며 `TypoBase`가 공통 style과 HTML attribute, event를 전달한다. `h1`–`h3`만 `-0.02em` 자간을 지정한다. 나머지는 자간을 inline으로 지정하지 않아 기본 자간 0을 따르며 화면 `className`의 letter-spacing을 덮지 않는다. `typographyVariants`의 행간은 `"60px"`처럼 단위를 포함하므로 `style={typographyVariants.h1}`로 직접 사용해도 px로 적용된다. 기본 margin은 0이다. 화면 간격은 wrapper의 gap 또는 텍스트 padding으로 주고, margin이 필요하면 `style`로 명시한다. 글꼴과 지정하지 않은 색은 상속된다.

스타일 우선순위는 variant → `color`, `align`, `weight` → `style`이다. `className`은 전달되지만 일반 CSS 선언은 inline style보다 우선하지 않는다. `as`는 HTML 태그를 바꾸면서 시각 variant를 유지한다. Heading 단계는 문서 구조에 맞춰 선택하고, 상호작용에는 `as="button"`, `as="a"`와 해당 native 속성을 사용한다. 임의 role, tabIndex는 추가하지 않는다. React 19의 `ref` prop을 실제 HTML element에 전달하며 `as`에 맞는 element 타입으로 검사한다. 제목 focus나 input focus를 유지할 때 사용할 수 있다.

`@dfragon/ui/typo`는 동일한 Typo API만 내보내는 React 전용 entry다. API의 인증 browser entry는 이 경로를 사용하며 Base UI를 번들에 포함하지 않는다. 해당 browser build와 TypeScript paths는 public source entry를 해석하므로 library 선행 build가 필요 없다.

## 공통 StyleX 설정

`@dfragon/ui/stylex-config`는 모든 앱과 Example, test가 사용하는 빌드 전용 compiler 옵션이다. Browser runtime에서 import하지 않는다. StyleX 버전은 workspace catalog에 둔다. 앱별 adapter 연결과 스타일 작성법은 [앱 공통 StyleX](../../docs/reference/app-styling.md)를 따른다. 이 entry를 쓰기 위해 UI library를 먼저 빌드할 필요는 없다.

Library의 StyleX는 `--df-*` 변수만 참조하고 `defineVars`나 앱 테마를 쓰지 않는다. Library build는 StyleX를 컴파일하지 않고 `stylex.create`를 그대로 내보낸다. 소비 앱과 Example, test의 StyleX compiler가 이 옵션으로 정적 CSS를 만들며, compiler 없이 전체 entry를 실행하면 `stylex.create`가 실행 시점에 오류를 낸다. 주입 runtime(`@stylexjs/stylex/lib/stylex-inject`)은 정적 stylesheet와 CSP 경로를 깨므로 쓰지 않는다. `@dfragon/ui/typo`는 StyleX 없는 React 전용 entry로 유지한다.

## Command

- `pnpm --filter @dfragon/ui build`: ESM bundle, declaration 생성 뒤 public package export의 실제 소비 검사.
- `pnpm --filter @dfragon/ui verify:build`: 기존 library 산출물의 export, dependency, CSS, 고지 검사, alias 없는 declaration, Vite 소비 fixture의 StyleX 컴파일과 산출 CSS, React 전용 entry의 ESM import 검사.
- `pnpm --filter @dfragon/ui dev:examples`: 독립 Vite Example.
- `pnpm --filter @dfragon/ui build:examples` / `preview:examples`: production Example 생성, 확인.
- `pnpm --filter @dfragon/ui test`: typecheck → Vitest interaction(접근 가능한 이름과 role로 찾는 버튼, 입력, Dialog, Select, Menu, Tabs의 키보드와 포커스 복귀), Typo → 빌드 검사 도구의 Node 회귀를 실행한다. Base UI Positioner의 크기 관측만 jsdom에서 격리한다.
- `pnpm --filter @dfragon/ui exec vitest run test/interaction.test.tsx`: 선택한 runtime 테스트만 실행한다. 파일 인수를 aggregate `test`에 전달하지 않는다.
- `pnpm --filter @dfragon/ui typecheck`: src, test, examples를 실제 `tsc --noEmit`으로 검사한다.
- `pnpm --filter @dfragon/ui test:tooling`: 임시 산출물로 누락 export, private declaration, Typo의 전이 dependency, CSS와 StyleX 주입 runtime import 거부, 토큰 상수의 위치와 export 이름, `tokens.css` 변수 정의를 확인한다. library 선행 build나 소비 앱의 산출물 삭제 없이 실행한다.
- `pnpm --filter @dfragon/ui test:consumer-lifecycle`: POSIX detached child/group 종료의 실패, 기한, 오류 보존 검사. 일반 `test`와 분리하며 현재 macOS에서 검증한다.
- `pnpm --filter @dfragon/ui lint`
- `node packages/ui/scripts/verify-build.mjs library packages/ui/dist`: 공개 export 산출물, Base UI와 StyleX를 포함한 external, `@stylexjs/stylex` 외 StyleX import 없음, SEED 패키지 import 없음, CSS 없음, 이식 가능한 declaration, 토큰 상수의 위치와 export 이름, React 전용 Typo entry.
- `node packages/ui/scripts/verify-build.mjs consumer <산출물 경로>`: 단일 React 사본, 번들된 경우 단일 Base UI 사본, stylesheet 1개, tokens.css 1회, 공용 글꼴 선언 1회, dependency license 원문 확인.
- `pnpm install --frozen-lockfile`
- `node --test packages/ui/scripts/test-consumer-resolution.mjs`: 전용 checkout의 cold consumer command 회귀. 격리, 삭제되는 산출물, Desktop 경계는 `test/consumer-resolution.md`를 먼저 확인한다.

현재 package command는 repository root에서 실행한다. 소비 app과 Example은 [Design System의 영향 범위 검증](../../docs/rules/design-system.md#영향-범위-검증)에 따라 변경한 화면, 상태, 환경을 선택해 확인한다. jsdom 결과를 실제 browser/Electron 또는 Tab 이동 성공으로 대신하지 않는다.

Vitest는 TypeScript를 변환해 runtime assertion을 실행한다. Public API의 compile-only JSX 사례와 `expectTypeOf` assertion은 `test` 첫 단계의 실제 tsc에서 검사하며, runtime PASS만으로 타입 계약을 판단하지 않는다. Library의 declaration 생성은 src만 포함하므로 test와 examples의 typecheck를 대신하지 않는다.

`test/build-consumer`의 별도 tsconfig는 source paths 없이 `@dfragon/ui`와 `@dfragon/ui/typo`의 dist declaration을 browser의 `Bundler` module resolution으로 해석한다. 같은 package specifier와 소비자 소유 CSS를 별도 Vite fixture가 소비 앱과 같은 StyleX compiler로 번들링하며 임시 결과는 `packages/ui/node_modules/.tmp/build-consumer`에 둔다. 산출 CSS에 library StyleX 선언의 atomic class가 들어 있는지 확인한다. React 전용 `typo` entry는 Node ESM import와 React 렌더링도 확인한다. 전체 UI entry는 StyleX 컴파일이 필요한 browser용이므로 Node에서 직접 import하는 경로를 지원하지 않는다.

Web, Desktop renderer, Example은 Vite/Vitest의 exact `@dfragon/ui` alias와 TypeScript paths로 public source entry를 직접 해석한다. 소비 command 전에 library build를 실행할 필요가 없으며 dev에는 source 변경이 직접 반영된다. Exact alias는 `@dfragon/ui/foundation.css` subpath를 바꾸지 않는다. Package export의 ESM/declaration 산출물은 별도 library build로 계속 검증한다.

## 고지

Library, Example, Web, Desktop renderer build는 [`@dfragon/licenses`](../licenses/README.md)의 공용 `uiNotices` plugin으로 bundle 입력 graph(미사용 입력 포함)의 dependency license/NOTICE와 module 목록, 생성 JS chunk 목록을 산출물 `notices`에 기록한다. Absolute filesystem path는 이 목록에 저장하지 않는다. `@dfragon/ui`에는 외부 source를 복사해 고친 코드가 없어 별도 수정 고지를 두지 않는다.

## 소비 entry와 실제 UI 확인

각 browser entry는 `@dfragon/ui/tokens.css` 다음에 `@dfragon/ui/foundation.css`를 한 번 import한다. 이 별도 public asset은 system font stack과 body 초기화(여백, `--df-fg-default` 글자색, `--df-bg-canvas` 바탕)만 담당하며 library JS가 import하거나 dist에 CSS bundle로 출력하지 않는다. Root font-size는 지정하지 않는다.

Web은 counter 버튼에 `Button`을 쓴다. Desktop renderer는 공용 Component와 토큰을 화면에서 직접 쓴다. Desktop의 React, UI package, Base UI는 기존 renderer dependency 배치에 맞춰 devDependency로 설치하고 renderer bundle에 포함한다.

Browser에서는 `dev:examples`와 `preview:examples`, Web의 `dev`, `preview`를 확인한다. 실제 Electron은 아래 test-only harness에서 각각 production renderer와 Example 산출물을 연다.

- `pnpm --filter @dfragon/desktop ui:fixture desktop light`
- `pnpm --filter @dfragon/desktop ui:fixture example dark`

두 번째 인자는 `system`, `light`, `dark`이며 fixture process의 Theme만 변경한다. 제품 main/preload/auth는 로드하지 않는다. Source 목록과 선택은 synthetic bridge이며 native media API는 거절 stub으로 교체한다. Stub 설치 확인 전 window를 보이지 않고 실패 시 종료하며 fallback하지 않는다. Start는 `UI fixture: media capture blocked.` 상태로 callback 진입만 확인하고 stream, OCR를 실행하지 않는다. 실제 capture 성공이나 OS permission 검증은 이 evidence의 범위가 아니다. Desktop App component test와 fixture 검증의 경계를 구분한다.

최초 구현의 실제 환경과 검증 결과는 superseded로 표시한 `docs/reference/ui-validation.md`에 이력으로 남아 있다.
