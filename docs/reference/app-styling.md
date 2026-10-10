---
type: reference
status: active
scope: all application browser surfaces
---

# 앱 공통 StyleX

Desktop renderer, API 패스키 페이지, OCR 관리 SPA, Web은 화면 스타일을 StyleX로 작성한다. SEED의 Component, recipe, Token과 `@dfragon/ui`는 그대로 사용한다. 공통 UI 책임은 [Design System](../rules/design-system.md)을 따른다.

## 공통 설정과 소비 경로

StyleX runtime과 compiler 버전은 `pnpm-workspace.yaml`의 catalog에서 관리한다. 앱 manifest는 `@stylexjs/stylex`와 개발 의존성 `@stylexjs/unplugin`을 `catalog:`로 참조한다. `@dfragon/ui`는 `@stylexjs/stylex`를 같은 catalog 버전의 peer와 개발 의존성으로 둔다. Compiler 옵션은 `@dfragon/ui/stylex-config` 한 곳에서 가져온다. 이 entry는 빌드 전용이며 browser bundle에서 import하지 않는다.

`catalog:`는 [pnpm의 버전 참조 문법](https://pnpm.io/catalogs#the-catalog-protocol-catalog)이다. 예를 들어 앱의 `"@stylexjs/stylex": "catalog:"`는 `pnpm-workspace.yaml`의 기본 `catalog`에서 같은 패키지의 버전을 읽는다. 현재 지정된 값은 정확한 고정 버전이며 최신 버전을 자동 선택하지 않는다. 여러 앱의 manifest에 버전 번호를 반복하는 대신 catalog 한 곳을 수정하고 lockfile을 갱신해 함께 올린다. `workspace:*`는 저장소 내부 패키지를 연결하는 문법이고, `catalog:`는 의존성 버전을 참조하는 문법이다.

API와 OCR의 `@stylexjs/unplugin/esbuild` import는 StyleX compiler의 esbuild용 플러그인 진입점이다. 기존 browser build가 esbuild로 React, TypeScript와 npm 의존성을 브라우저용 JS, CSS로 묶으므로 여기에 StyleX 변환을 연결한다. 패스키 API는 그 정적 산출물을 직접 제공한다. `build.mjs`는 Node에서 실행하는 ESM 빌드 스크립트이며, 브라우저가 이 파일이나 compiler를 실행하지 않는다. 앱마다 bundler는 유지하고 StyleX 옵션, 버전을 공유한다.

- `runtimeInjection: false`: production CSS를 빌드 시 추출해 기존 CSP와 정적 stylesheet 경로를 유지한다.
- `useCSSLayers: false`: 기존 SEED 스타일과 같은 cascade에서 조합한다.
- Vite에서는 StyleX를 React plugin보다 먼저 실행한다. Vitest는 HTTP/HMR timer가 없는 Rollup adapter를 사용한다.
- esbuild는 `metafile: true`와 StyleX plugin을 함께 사용한다. 기존 CSS 출력에 추출한 스타일을 합치므로 HTML의 stylesheet 링크는 유지된다.
- Browser entry는 SEED `base.css`와 공용 `foundation.css`를 한 번 import한다. 글꼴, reset 같은 전역 기반 CSS와 vendor CSS는 StyleX로 복제하지 않는다.
- Desktop renderer entry는 `base.css` 다음에 `apps/desktop/src/frontend/src/assets/seed-brand.css`를 import해 SEED brand 토큰을 메인 컬러 파랑으로 다시 매핑한다. 허용 범위는 [Design System의 전역 override 예외](../rules/design-system.md#화면별-스타일-조정)를 따르며, 다른 앱의 SEED brand 표현은 당근 주황 그대로다.

| 소비자 | 연결 위치 |
| --- | --- |
| Desktop 제품, test, fixture | `apps/desktop/build/renderer-transforms.ts` |
| API 패스키 | `apps/accounts/browser/build.mjs` |
| OCR 관리 SPA | `apps/ocr/browser/build.mjs` |
| Web | `apps/web/vite.config.ts`, `vitest.config.ts` |
| 공용 UI Example, test | `packages/ui/examples/vite.config.ts`, `packages/ui/vitest.config.ts` |
| 공용 UI 산출물 소비 검사 | `packages/ui/test/build-consumer/vite.config.ts` |

공식 [unplugin 설정](https://stylexjs.com/docs/api/configuration/unplugin/)과 [Vite 연결](https://stylexjs.com/docs/learn/installation/vite/)을 따른다. 공용 UI library의 기존 SEED 배포/CSS 소유 경계는 유지한다. 공용 UI의 디자인 컴포넌트와 TextField 포커스 색은 SEED CSS 변수만 쓰는 `stylex.create`이며, library build는 이를 컴파일하지 않고 CSS도 내지 않는다. 위 소비자의 compiler가 앱 스타일과 함께 정적 CSS로 추출하므로 `@dfragon/ui` 기본 entry를 쓰는 앱은 StyleX compiler를 연결해야 한다. `@dfragon/ui/typo`는 StyleX를 쓰지 않는다.

## 작성 예시

파일 배치, named export, 테마, 스타일 합성의 기준은 [화면별 스타일 계약](../rules/design-system.md#화면별-스타일-조정)을 따른다. 이 문서는 compiler 연결과 현재 구현 예시를 설명한다.

`apps/accounts/browser/passkeys.style.ts`는 SEED recipe, Typo와의 조합, `apps/web/src/App.style.ts`와 `theme.stylex.ts`는 반응형 배치, 시스템 색상 테마의 예다. Desktop 테마 상태와 컴포넌트 작성 세부사항은 [Desktop 스타일](desktop-styling.md)을 참고한다.

## 검증

검증 범위는 [Design System의 영향 범위 검증](../rules/design-system.md#영향-범위-검증)을 따른다. 소비 앱의 build, 기존 UI 테스트에서 compiler와 CSS 추출을 확인할 수 있다. StyleX class hash는 생성 결과이므로 안정적인 테스트 계약이 아니다.
