# Desktop Agent Instructions

Root `AGENTS.md`와 repository Rule은 이 app에도 그대로 적용한다.

## Code organization

- Frontend는 Bulletproof React 방식으로 공용 코드, `features`, `app`을 구분한다. 기능 전용 UI·hook·타입·유틸은 소유 feature 안에 두며 필요한 하위 폴더만 만든다. 서로 다른 feature의 조합은 app에서 props·callback으로 연결하고, feature 간 직접 import와 공유 코드의 features·app 의존은 금지한다. 제품 코드에서 testing을 import하지 않는다. 테스트·fixture의 통합 조합은 구분한다.
- 독립 UI는 역할이 드러나는 파일에 named export로 두고 전용 스타일·테스트는 소유 UI와 가까이 둔다. Barrel 재수출 없이 직접 import한다. 이미지 실패·입력 draft 같은 자체 UI 상태는 허용하며 단순 태그·전달 전용 wrapper로 계층을 채우지 않는다. 공용 Button·Input은 기존 `@ldb/ui`를 사용한다. 실제 배치는 [Repository Map](../../docs/reference/repository-map.md#appsdesktop)을 따른다.
- `src/backend/main.ts`와 `src/preload/index.ts`는 composition root로 유지한다. App lifecycle, module 등록, API 노출만 두고 feature state, handler body, domain logic은 넣지 않는다.
- Feature 관련 implementation과 test는 process별 feature 위치에 함께 둔다. 예: `src/backend/capture/**`, `src/preload/api/capture.ts`.
- Backend handler와 preload invoker의 argument 및 return type은 shared IPC contract에서 파생한다.
- TypeScript IPC contract가 있더라도 renderer에서 전달되는 값은 backend trust boundary에서 runtime validation한다.
