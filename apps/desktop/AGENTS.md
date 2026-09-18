# Desktop Agent Instructions

Root `AGENTS.md`와 repository Rule은 이 app에도 그대로 적용한다.

## Frontend 책임 분리

- 수정 전에 실제 앱 진입점과 호출 경로를 확인해 현재 화면·구버전·미리보기를 구분한다. 파일이 존재하거나 테스트에서 사용된다는 이유만으로 현재 제품 화면이라고 판단하지 않는다.
- 코드가 짧아졌는지보다 각 책임의 소유 위치가 분명해졌는지를 기준으로 수정한다. 컴포넌트의 로직을 통째로 hook으로 옮기는 것만으로 책임을 분리했다고 보지 않는다.
- Hook은 하나의 응집된 상태나 수명 관리 책임을 가진다. 같은 화면에서 쓰인다는 이유로 편집 상태·입력 검증·요청 제한 등을 한 hook에 묶지 않는다. 다른 hook을 조합할 때도 조합 자체의 목적이 하나인지 확인한다. 하나의 책임에 필요한 여러 state·effect는 함께 둘 수 있으며 변수마다 hook을 만들지 않는다.
- React 상태·수명이 필요 없는 검증과 정책 계산은 순수 함수로 둔다. 단순 파생 값은 표현식으로 충분하면 그대로 사용하며, 계산을 감싸기 위한 hook이나 전달 전용 wrapper를 만들지 않는다.
- 중복 요청·호출 제한 같은 실행 정책은 요청을 수행하는 쪽이 소유하고 실행 시에도 검사한다. UI는 그 판단 결과로 비활성·로딩 상태를 표시하며 버튼 비활성화만으로 실행 정책을 보장하지 않는다.
- 입력 draft·오류 표시·포커스 같은 자체 UI 상태와 DOM 이벤트 처리는 컴포넌트에 남겨도 된다. 독립적인 책임을 드러낼 필요가 있을 때만 추출하고, 이번 변경에 필요한 범위에서 기존 동작·평가 순서·cleanup을 보존한다.

## Code organization

- Frontend UI는 `pages`(화면 배치) → `sections`(기능 조합·요청과 구독 수명) → `components`(독립 UI)의 방향으로 의존한다. 하위 UI는 상위 UI나 fixture를 import하지 않고 props·callback으로 연결한다. 컴포넌트의 이미지 실패·입력 draft 같은 자체 상태는 허용하며, 단순 태그나 전달 전용 wrapper로 계층을 채우지 않는다. 테스트·fixture의 조합은 이 제품 의존 규칙과 구분한다.
- 독립적으로 재사용할 UI는 역할이 드러나는 파일에 named export로 두고, 전용 스타일·테스트는 소유한 UI와 가까이 둔다. 공용 Button·Input 같은 기본 UI는 기존 `@ldb/ui`를 사용한다.
- Frontend `src/frontend/src/components`·`sections`는 하위 폴더 없이 배치하고 파일당 컴포넌트 하나를 선언한다. 컴포넌트의 StyleX 정의는 옆의 `{name}.style.ts`에 분리하고, 컴포넌트에서는 named export를 가져와 적용한다. 전용 스타일이 없는 컴포넌트에 빈 스타일 파일을 만들지 않는다. `sections`에는 UI 조합·스타일·UI 테스트를 두고, 독립적인 검색 연결·OCR worker 같은 비UI 구현은 `lib`에 둔다.
- Frontend의 UI와 독립적인 구현·공통 유틸리티는 `src/frontend/src/lib`, 공통 타입은 `types`, 상수는 `constants`에서 역할별 파일로 관리하고 직접 import한다. `lib`는 하위 폴더 없이 파일을 바로 두고, 각 유틸리티 함수에 역할을 설명하는 주석을 작성한다. 이 모듈은 UI 계층이나 fixture를 import하지 않는다. 요청·구독 수명을 관리하는 class도 `lib`에 두고 구현 전용 타입은 해당 파일에 유지하며, process 간 IPC contract는 기존 preload 위치를 사용한다.
- Frontend 커스텀 hook은 기능 전용 여부와 관계없이 `src/frontend/src/hooks`에 하위 폴더 없이 모으고, hook 전용 테스트는 옆에 둔다. Hook은 다른 hook과 기존 검색·OCR 등의 비UI 구현을 직접 참조할 수 있지만 UI 컴포넌트·page·fixture·testing을 import하지 않는다.
- Frontend의 `src/frontend/src/testing`에는 여러 테스트가 공유하는 유틸리티·mock·fixture만 둔다. 실제 테스트 파일은 검증하는 코드 옆에 두고, 앱 조합 통합 테스트는 기존 `integration`에 둔다. 제품 코드는 `testing`을 import하지 않는다. 직접 실행하는 미리보기·Electron fixture는 기존 `fixture`에 유지한다.
- `src/backend/main.ts`와 `src/preload/index.ts`는 composition root로 유지한다. App lifecycle, module 등록, API 노출만 두고 feature state, handler body, domain logic은 넣지 않는다.
- Feature 관련 implementation과 test는 process별 feature 위치에 함께 둔다. 예: `src/backend/capture/**`, `src/preload/api/capture.ts`.
- Backend handler와 preload invoker의 argument 및 return type은 shared IPC contract에서 파생한다.
- TypeScript IPC contract가 있더라도 renderer에서 전달되는 값은 backend trust boundary에서 runtime validation한다.
