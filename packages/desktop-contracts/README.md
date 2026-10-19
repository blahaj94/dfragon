# @dfragon/desktop-contracts

Desktop의 main, preload, renderer가 함께 쓰는 IPC 계약 패키지입니다. 프로세스 사이에 오가는 DTO 타입, IPC 채널 이름, 오류 코드, snapshot 검증, 창 색처럼 세 프로세스가 같은 값을 써야 하는 정의를 둡니다. 예전에는 Desktop의 `src/preload/common`에 있었고, 깊은 상대 경로 대신 패키지 이름으로 가져오도록 옮겼습니다.

```ts
import { SEARCH_ERRORS, type SearchSlot } from '@dfragon/desktop-contracts/types/search'
import { AUTH_AVAILABLE_ARGUMENT } from '@dfragon/desktop-contracts/types/auth'
```

`src` 아래 파일 경로가 그대로 import 경로입니다. `src/types/search.ts`는 `@dfragon/desktop-contracts/types/search`로 가져옵니다.

## 경계

- Desktop만 소비합니다. 제품 source는 소비 앱의 source, Electron, Node 전용 API에 의존하지 않으며 `zod`와 `@dfragon/lib`만 씁니다. 계약 테스트는 Vitest로 실행하고, 창 색 테스트는 `packages/ui/tokens.css`를 읽어 값을 대조합니다.
- 별도 build 산출물이 없습니다. `exports`가 TypeScript source를 가리키고, Desktop의 TypeScript, electron-vite, Vitest가 source를 해석해 각 프로세스에 번들합니다. 그래서 Desktop은 이 패키지를 `devDependencies`에 두고 main 번들에서 external로 빼지 않습니다.
- 프로세스별 구현은 Desktop에 남습니다. main handler는 `apps/desktop/src/backend`, preload invoker는 `apps/desktop/src/preload/api`, 화면 상태는 renderer가 소유합니다. renderer에서 온 값은 이 패키지의 타입이 있더라도 main의 신뢰 경계에서 runtime 검증합니다.
- `search/card-test-fixture`, `search/search-test-fixture`는 Desktop 테스트와 Electron fixture가 함께 쓰는 합성 자료입니다. 제품 코드는 import하지 않습니다.

## 명령

- `pnpm --filter @dfragon/desktop-contracts test`: typecheck 뒤 Vitest로 계약 테스트를 실행합니다.
- `typecheck`, `lint`, `format:check`도 제공합니다.
