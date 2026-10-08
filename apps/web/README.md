# Web

React·TypeScript·Vite 예제 화면입니다. 현재 사용자 동작은 `ActionButton` 카운터와 외부 문서·커뮤니티 링크이며, 검색·인증 화면은 구현되어 있지 않습니다.

## 실행과 검증

저장소 루트에서 실행합니다.

```sh
pnpm --filter @dfragon/web dev
pnpm --filter @dfragon/web test
pnpm --filter @dfragon/web lint
pnpm --filter @dfragon/web lint:oxlint
pnpm --filter @dfragon/web format:check
pnpm --filter @dfragon/web build
```

`build`는 `tsc -b`와 Vite production build를 포함하므로 같은 변경을 검증할 때 `typecheck`를 다시 실행할 필요는 없습니다.

## 테스트 경계

컴포넌트 테스트는 실제 `@dfragon/ui` public source와 SEED runtime을 사용합니다. Vitest의 exact alias는 UI의 선행 build 없이 `packages/ui/src/index.tsx`를 해석하고, 공용 StyleX compiler 옵션은 앱과 UI source를 변환합니다. UI 컴포넌트나 StyleX를 mock하지 않습니다. 공용 setup의 `ResizeObserver` 대역은 jsdom에 없는 크기 관측만 보완합니다.

카운터의 사용자에게 보이는 값, 주요 콘텐츠와 버튼의 HTML 의미, mount 간 상태 격리를 보호합니다. 단순 안내 문구·프레임워크 동작·StyleX class hash는 고정하지 않습니다. jsdom은 실제 레이아웃이나 native 키보드 활성화를 재현하지 않으므로 CSS 적용과 Tab·Enter·Space 동작은 production build를 브라우저에서 확인해야 합니다.

`index.html` → `src/main.tsx`가 제품 진입점입니다. Entry가 SEED `base.css`와 UI `foundation.css`를 가져오고, Vite의 SEED plugin과 StyleX compiler가 production CSS를 연결합니다. 선행 UI build가 없는 소비 경로의 기존 회귀검사는 [공용 UI 소비 검사 안내](../../packages/ui/test/consumer-resolution.md)에 있습니다. 이 검사는 여러 앱의 생성물·cache를 정리하므로 전용 checkout에서 실행해야 합니다.

Code Quality CI는 PR과 main push에서 Web의 lint, format, Oxlint와 함께 `test`, `build`를 실행합니다. `build`가 `tsc -b`를 포함하므로 CI에서 `typecheck`를 따로 실행하지 않습니다. 위 jsdom 한계처럼 실제 레이아웃과 키보드 동작은 CI 성공에 포함되지 않습니다.
