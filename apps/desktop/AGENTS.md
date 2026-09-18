# Desktop Agent Instructions

Root `AGENTS.md`와 repository Rule은 이 app에도 그대로 적용한다.

## Code organization

- Frontend UI는 `pages`(화면 배치) → `sections`(기능 조합·요청과 구독 수명) → `components`(독립 UI)의 방향으로 의존한다. 하위 UI는 상위 UI나 fixture를 import하지 않고 props·callback으로 연결한다. 컴포넌트의 이미지 실패·입력 draft 같은 자체 상태는 허용하며, 단순 태그나 전달 전용 wrapper로 계층을 채우지 않는다. 테스트·fixture의 조합은 이 제품 의존 규칙과 구분한다.
- 독립적으로 재사용할 UI는 역할이 드러나는 파일에 named export로 두고, 전용 스타일·hook·테스트는 소유한 UI와 가까이 둔다. 공용 Button·Input 같은 기본 UI는 기존 `@ldb/ui`를 사용한다.
- `src/backend/main.ts`와 `src/preload/index.ts`는 composition root로 유지한다. App lifecycle, module 등록, API 노출만 두고 feature state, handler body, domain logic은 넣지 않는다.
- Feature 관련 implementation과 test는 process별 feature 위치에 함께 둔다. 예: `src/backend/capture/**`, `src/preload/api/capture.ts`.
- Backend handler와 preload invoker의 argument 및 return type은 shared IPC contract에서 파생한다.
- TypeScript IPC contract가 있더라도 renderer에서 전달되는 값은 backend trust boundary에서 runtime validation한다.
