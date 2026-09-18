# Desktop Agent Instructions

Root `AGENTS.md`와 repository Rule은 이 app에도 그대로 적용한다.

## Code organization

- Frontend UI는 `pages`(화면 배치) → `sections`(기능 조합·요청과 구독 수명) → `components`(독립 UI)의 방향으로 의존한다. 하위 UI는 상위 UI나 fixture를 import하지 않고 props·callback으로 연결한다. 컴포넌트의 이미지 실패·입력 draft 같은 자체 상태는 허용하며, 단순 태그나 전달 전용 wrapper로 계층을 채우지 않는다. 테스트·fixture의 조합은 이 제품 의존 규칙과 구분한다.
- 독립적으로 재사용할 UI는 역할이 드러나는 파일에 named export로 두고, 전용 스타일·hook은 소유한 UI와 가까이 둔다. 공용 Button·Input 같은 기본 UI는 기존 `@ldb/ui`를 사용한다.
- Frontend 공통 유틸리티는 `src/frontend/src/lib`, 공통 타입은 `types`, 상수는 `constants`에서 역할별 파일로 관리하고 직접 import한다. `lib`는 하위 폴더 없이 파일을 바로 두고, 각 유틸리티 함수에 역할을 설명하는 주석을 작성한다. 이 모듈은 UI 계층이나 fixture를 import하지 않는다. 요청·구독 수명을 관리하는 hook·class와 구현 전용 타입은 소유한 기능에 유지하며, process 간 IPC contract는 기존 preload 위치를 사용한다.
- Frontend 테스트는 `src/frontend/src/testing`에 원본 대상의 폴더 구조를 따라 배치하고, 테스트 전용 도우미는 `testing/fixtures`에 둔다. 제품 코드는 `testing`을 import하지 않는다. 직접 실행하는 미리보기·Electron fixture는 기존 `fixture`에 유지한다.
- `src/backend/main.ts`와 `src/preload/index.ts`는 composition root로 유지한다. App lifecycle, module 등록, API 노출만 두고 feature state, handler body, domain logic은 넣지 않는다.
- Backend·preload의 feature 관련 implementation과 test는 process별 feature 위치에 함께 둔다. 예: `src/backend/capture/**`, `src/preload/api/capture.ts`.
- Backend handler와 preload invoker의 argument 및 return type은 shared IPC contract에서 파생한다.
- TypeScript IPC contract가 있더라도 renderer에서 전달되는 값은 backend trust boundary에서 runtime validation한다.
