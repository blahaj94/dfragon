---
type: reference
status: active
scope: desktop-renderer
---

# Desktop 스타일 작성

Desktop renderer의 화면별 스타일은 StyleX로 작성합니다. SEED Component·Token과 `@ldb/ui`의 공용 UI 책임은 [Design System](../rules/design-system.md)을 따릅니다.

## 빌드 연결

`apps/desktop/build/renderer-transforms.ts`가 공식 `@stylexjs/unplugin`과 React plugin의 순서를 관리합니다. 제품 electron-vite renderer, Vitest, auth UI·bridge·capture fixture가 이 설정을 함께 사용합니다. Vitest는 HTTP/HMR timer 없이 같은 compiler를 실행하는 Rollup adapter를 사용합니다. Main·preload에는 StyleX 변환을 적용하지 않습니다.

- StyleX를 React보다 먼저 실행해 Fast Refresh를 유지합니다.
- `runtimeInjection: false`로 빌드 시 CSS를 추출합니다. 기존 SEED CSS와 같은 cascade에서 사용하도록 `useCSSLayers: false`를 명시합니다.
- 각 browser entry의 SEED `base.css`와 `@ldb/ui/foundation.css` import를 유지합니다. Production에서는 생성된 StyleX CSS가 기존 CSS asset에 합쳐지고 HTML의 링크가 갱신됩니다.
- HTML entry를 사용하는 개발 서버에는 plugin이 CSS와 HMR runtime을 연결합니다. 수동 CSS 생성이나 별도의 StyleX CLI 실행은 필요하지 않습니다.

통합 방식은 [공식 Vite 안내](https://stylexjs.com/docs/learn/installation/vite/)와 [unplugin 설정](https://stylexjs.com/docs/api/configuration/unplugin/)을 참고합니다. 설치 버전은 Desktop manifest와 workspace lockfile에서 관리합니다.

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

스타일은 module scope에서 선언하고 SEED CSS 변수를 참조합니다. 선언이 길어지면 컴포넌트 옆의 전용 스타일 파일로 분리하고 `export const styles` 같은 named export로 가져옵니다. `InvestmentTable.tsx`와 `InvestmentTable.style.ts`가 컴포넌트·전용 스타일 분리 예시입니다. 여러 스타일은 `stylex.props(base, condition && variant)`로 합성합니다. StyleX는 빌드 중 정적으로 해석하므로 일반 함수 호출이나 임의의 외부 객체를 `stylex.create` 안에 넣지 않습니다. 공유 StyleX 변수는 공식 `.stylex.ts` 모듈의 `defineVars` 방식을 사용합니다.

홀짝 행·hover·focus·disabled처럼 브라우저가 판단할 수 있는 시각 상태는 CSS pseudo-class로 표현합니다. 예를 들어 교차 행 배경은 `backgroundColor: { default: colors.card, ':nth-child(even)': colors.alternate }`로 선언하고 JSX에서는 행 인덱스를 계산하지 않습니다. 마법부여 등급처럼 유한한 UI 상태는 정적 스타일을 정의하고 상태 값으로 선택합니다. 동적 스타일 함수는 런타임 색상·그리드 좌표처럼 실제 값이 달라질 때 사용하며, 고정 테두리·크기 등은 정적 스타일에 둡니다. 데이터 선택·누락 처리·표시할 열과 같은 UI/도메인 분기는 React에 남깁니다.

기존 `className`·`style`과 같은 요소에 적용할 때는 JSX spread가 해당 prop을 덮어쓰지 않도록 합성합니다. SEED의 내부 DOM selector 대신 앱이 소유한 요소나 컴포넌트의 공개 API에 적용합니다. 실제 예시는 `PartyCapture.tsx`, `CharacterCandidates.tsx`, `SearchResults.tsx`에 있습니다.

## 검증

`pnpm --filter @ldb/desktop build`는 typecheck와 production CSS 추출을 포함합니다. `pnpm --filter @ldb/desktop test`는 동일한 StyleX 변환으로 기존 UI 동작을 확인합니다. 스타일 이름·생성 class hash에 의존하는 assertion 대신 접근 가능한 이름과 표시 내용을 검사합니다.

스타일 변경은 실제 renderer에서 좁은/넓은 화면과 변경한 focus·theme 상태를 확인합니다. jsdom 테스트 성공만으로 CSS 적용이나 Electron 실행 성공을 판단하지 않습니다.
