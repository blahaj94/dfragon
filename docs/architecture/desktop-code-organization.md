---
type: rule
status: active
scope: desktop source organization and process boundaries
last-reviewed: 2026-10-08
---

# Desktop 코드 구조와 프로세스 경계

기존 Desktop 제품 구조 계약을 이 문서에서 관리한다. 공통 React UI 책임과 스타일은 [Design System](../rules/design-system.md#react-ui-책임), 앱 실행과 검증 명령은 [Desktop 안내](../../apps/desktop/README.md)를 따른다.

## 코드 소유권과 의존 방향

- Frontend UI는 `pages`(화면 배치) → `sections`(기능 조합·요청과 구독 수명) → `components`(독립 UI)의 방향으로 의존한다. 하위 UI는 상위 UI나 fixture를 import하지 않고 props·callback으로 연결한다. 컴포넌트의 이미지 실패·입력 draft 같은 자체 상태는 허용하며, 단순 태그나 전달 전용 wrapper로 계층을 채우지 않는다. 테스트·fixture의 조합은 이 제품 의존 규칙과 구분한다.
- 독립적으로 재사용할 UI는 역할이 드러나는 파일에 named export로 두고, 전용 스타일·테스트는 소유한 UI와 가까이 둔다. 공용 Button·Input 같은 기본 UI는 기존 `@dfragon/ui`를 사용한다.
- Frontend `src/frontend/src/components`·`sections`는 하위 폴더 없이 배치하고 파일당 컴포넌트 하나를 선언한다. 전용 스타일은 [공통 스타일 계약](../rules/design-system.md#화면별-스타일-조정)을 따른다. `sections`에는 UI 조합·스타일·UI 테스트를 두고, 독립적인 검색 연결·OCR worker 같은 비UI 구현은 `lib`에 둔다.
- Frontend의 UI와 독립적인 구현·공통 유틸리티는 `src/frontend/src/lib`, 공통 타입은 `types`, 상수는 `constants`에서 역할별 파일로 관리하고 직접 import한다. `lib`는 하위 폴더 없이 파일을 바로 두고, 각 유틸리티 함수에 역할을 설명하는 주석을 작성한다. 이 모듈은 UI 계층이나 fixture를 import하지 않는다. 요청·구독 수명을 관리하는 class도 `lib`에 두고 구현 전용 타입은 해당 파일에 유지하며, process 간 IPC contract는 기존 preload 위치를 사용한다.
- Frontend 커스텀 hook은 기능 전용 여부와 관계없이 `src/frontend/src/hooks`에 하위 폴더 없이 모으고, hook 전용 테스트는 옆에 둔다. Hook은 다른 hook과 기존 검색·OCR 등의 비UI 구현을 직접 참조할 수 있지만 UI 컴포넌트·page·fixture·testing을 import하지 않는다.
- Frontend의 `src/frontend/src/testing`에는 여러 테스트가 공유하는 유틸리티·mock·fixture만 둔다. 실제 테스트 파일은 검증하는 코드 옆에 두고, 앱 조합 통합 테스트는 기존 `integration`에 둔다. 제품 코드는 `testing`을 import하지 않는다. 직접 실행하는 미리보기·Electron fixture는 기존 `fixture`에 유지한다.
- `src/backend/main.ts`와 `src/preload/index.ts`는 composition root로 유지한다. App lifecycle, module 등록, API 노출만 두고 feature state, handler body, domain logic은 넣지 않는다.
- Feature 관련 implementation과 test는 process별 feature 위치에 함께 둔다. 예: `src/backend/capture/**`, `src/preload/api/capture.ts`.
- Desktop main의 공통 Windows 화면 획득은 `src/backend/lib`가 소유한다. 일반 캡처와 개발자 수집은 같은 GDI, DPI, 픽셀 변환과 자원 정리 구현을 사용한다. 이 lib는 개발자 모드, 저장소, 검색, UI와 IPC handler에 의존하지 않으며 각 기능이 획득 결과를 자기 계약으로 변환한다. 네이티브 DLL과 Node API는 Desktop 내부에 유지하고 순수 함수용 `packages/lib`로 옮기지 않는다.
- Backend handler와 preload invoker의 argument 및 return type은 shared IPC contract에서 파생한다.
- TypeScript IPC contract가 있더라도 renderer에서 전달되는 값은 backend trust boundary에서 runtime validation한다.
