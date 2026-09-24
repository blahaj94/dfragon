---
type: reference
status: active
scope: desktop isolated authentication bridge
last-reviewed: 2026-09-19
---

# Desktop Auth Bridge

승인된 [Desktop auth contract](../rules/desktop-auth.md)의 6 invoke와 1 event를 기존 main AuthCoordinator 및 LoginSection에 연결한다. 제품 main은 trusted 설정이 활성화된 경우 기존 auth IPC를 local renderer window에 등록하며, 설정이 없으면 로그인 버튼에서 연결 조회를 재시도할 수 있다. 이 문서의 auth-only fixture는 media를 차단한다. 실제 API/패스키, OS protocol registry, Keychain·credential file durability 접근은 이 결과에 포함하지 않는다.

## 구현 위치와 경계

| File                                                       | 현재 책임                                                                                                                          |
| ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `apps/desktop/src/backend/auth/ipc-handler.ts`             | 등록 window·main frame·exact document와 인자 검사, 정제 결과·snapshot event, async reply의 window 재검사와 dispose                 |
| `apps/desktop/src/preload/common/types/auth.ts`            | Core의 public DTO를 type-only로 재사용하고 shared IPC contract에서 feature API를 파생                                              |
| `apps/desktop/src/preload/common/types/ipc.ts`             | getAuthState/beginLogin/cancelLogin/retryAuth/managePasskeys/logout의 argument·return type                                         |
| `apps/desktop/src/preload/api/auth.ts`                     | Feature invoke, raw Electron event를 제거한 listener wrapper와 개별 unsubscribe                                                    |
| `apps/desktop/src/frontend/src/lib/auth-bridge-machine.ts` | XState로 구독·초기 조회·명령·응답 유실 재조회의 수명과 runId/revision 순서를 관리한다. 인증 phase는 main snapshot 그대로 유지한다. |
| `apps/desktop/src/frontend/src/hooks/useAuthBridge.ts`     | machine과 React를 연결하고 API 교체 시 이전 계정 표시를 즉시 가린다. pending·연결 실패는 machine 상태에서 파생한다.                |
| `apps/desktop/src/frontend/src/sections/LoginSection.tsx`  | 로그인 버튼에 snapshot·intent를 연결하며 진행 중 재클릭을 차단하고 조회·복구를 재시도                                              |

Core lifecycle은 [Desktop auth core](desktop-auth-core.md), 기존 화면은 [Desktop auth UI](desktop-auth-ui.md)를 따른다. Credential type의 runtime import나 renderer가 제출하는 로그인 성공 상태는 없다. `ok:true`는 명령 처리 결과이며 계정 표시는 main snapshot에서만 결정한다.

허용되지 않은 sender는 snapshot 없는 `AUTH_NOT_ALLOWED` rejection이다. Query인 getAuthState의 추가 인자는 `INVALID_AUTH_COMMAND` rejection이고, 5 mutation의 형식 오류는 기존 AuthCommandResult로 반환한다. 정확한 key 검사에는 enumerable 여부와 무관한 own key 전체를 사용한다. Unexpected command exception은 고정 `AUTH_OPERATION_FAILED` 결과로 정제한다.

Renderer의 연결 machine은 구독 완료 → 초기 조회 → 준비 상태로 진행하며, 명령 처리와 응답 유실 후 재조회 동안 추가 명령을 받지 않는다. 연결을 교체하거나 unmount하면 구독과 요청 actor를 종료하므로 이전 listener·query·명령의 늦은 결과를 새 연결에 적용하지 않는다. 이는 이미 main에 전달한 인증 명령 자체를 취소하거나 재전송하는 동작이 아니다.

첫 조회 전 event는 보관하고 조회 결과와 같은 runId의 더 큰 revision을 적용한다. 다른 runId는 이전 구독을 해제한 뒤 새 조회로 기준을 세운다. API 교체 시 snapshot을 폐기하므로 같은 API 객체를 다시 사용해도 이전 계정이 복구되지 않는다. snapshot의 인증 phase와 명령 결과는 renderer가 만들어내지 않는다.

초기 구독·조회 실패는 `failed`로 두고 event만으로 회복하지 않으며 로그인 버튼으로 수동 재연결한다. 명령 응답 유실은 `refreshing`에서 snapshot만 조회한다. 이 재조회도 실패하면 `unavailable`에서 계정 표시를 지우되, 이미 기준을 세운 기존 구독의 후속 event 또는 수동 재연결로 회복할 수 있다. `failed`와 `unavailable`은 동일한 연결 실패 UI를 사용한다. 기존 로그인 명령의 자동 재전송이나 설정·저장소 미준비 우회는 하지 않는다.

## 격리 Electron fixture

`apps/desktop/scripts/auth-bridge-fixture.config.ts`는 production entry와 별개로 main/preload/renderer를 build한다. 기존 presentation-only fixture는 그대로 유지한다.

- `apps/desktop/scripts/auth-bridge-fixture.mjs`: 실행별 임시 profile과 detached child group을 소유하고, child 종료 뒤 profile 삭제와 부재를 확인한다.
- `apps/desktop/scripts/auth-bridge-fixture/main.ts`: launcher가 전달한 profile을 검증하고 sandbox·contextIsolation 활성화, nodeIntegration 비활성화, network/media·navigation/popup 차단을 담당한다.
- `apps/desktop/scripts/auth-bridge-fixture/effects.ts`: 실제 coordinator에 전달할 memory-only fake HTTP/Store/Browser/Clock/Entropy. Synthetic return target과 canary는 fixture 전용이며 실제 protocol/API 등록값이 아니다. 두 번째 coordinator나 별도 인증 상태 머신을 만들지 않는다.
- `apps/desktop/scripts/auth-bridge-fixture/preload.ts`: 실제 auth feature API 6개만 contextBridge로 노출한다. Fixture 조작용 code/URL/token IPC는 없다.
- `apps/desktop/src/frontend/src/fixture/auth-bridge/`: `ColorThemeProvider`로 감싼 현재 카드 `App`을 실제 bridge에 연결한 전용 renderer.
- `apps/desktop/scripts/auth-bridge-fixture/smoke.ts`: 실제 UI 버튼·feature preload·IPC를 통한 자동 관측. Unsubscribe 함수는 renderer에만 보관하며 실행 결과로 함수 자체를 반환하지 않는다.

Repository root에서 실행한다.

```sh
pnpm --filter @dfragon/desktop auth:fixture:build
pnpm --filter @dfragon/desktop auth:fixture:smoke
pnpm --filter @dfragon/desktop auth:fixture
```

Build command는 전용 TypeScript 검사 후 Electron Vite build를 수행한다. 실행 entry는 `apps/desktop/out/auth-bridge-fixture/main/main.cjs`다. 고정 window title은 **DFRAGON Auth Bridge fixture**다.

수동 실행에서는 현재 카드 화면의 **로그인** 버튼으로 로그인 대기에 들어가며 자동으로 완료하지 않는다. 앱 메뉴의 **Complete login**으로 main 내부 synthetic return을 전달하면 로그인 버튼이 사라지고 네 카드는 유지된다. 계정 메뉴·환영 화면·화면 내 취소 버튼은 없다. 종료 메뉴나 창 닫기로 앱을 종료하면 launcher가 임시 profile을 삭제하고 부재를 확인한다.

자동 smoke는 현재 로그인 버튼을 사용한다. 취소·로그아웃은 fixture에서 실제 preload 명령으로 주입하며, 존재하지 않는 제품 UI를 검증했다고 취급하지 않는다. Empty-store start, begin/cancel, event payload의 raw event 제거·canary 비노출, unsubscribe, waiting 상태 reload, credential commit 보류 중 signedIn 비노출, 로그인 완료 뒤 버튼 소멸·로그아웃 뒤 재표시와 카드 DOM 유지, fake effect 횟수를 확인한다. `Auth bridge fixture smoke PASS`와 `cleanup PASS`, process exit 0을 함께 확인한다. 실패 진단은 고정 stage와 PASS/FAIL만 출력하며 credential·URL·raw error를 출력하지 않는다. 강제 process 종료나 host crash의 profile 정리는 정상 종료 evidence에 포함하지 않는다.

## 검증 범위와 제한

```sh
pnpm --filter @dfragon/desktop exec vitest run src/backend/auth/ipc-handler.test.ts src/preload/api/auth.test.ts src/frontend/src/hooks/useAuthBridge.test.tsx
pnpm --filter @dfragon/desktop exec vitest run scripts/auth-bridge-fixture/launcher.test.mjs
pnpm --filter @dfragon/desktop run --sequential '/^(test|lint|build)$/'
git diff --check
```

Unit 경계 검증, 실제 Electron smoke, 수동 UI 확인은 별도 evidence다. Build에는 기존 node/web typecheck가 포함되며 fixture의 전용 TypeScript/build는 별도로 실행한다. 실행한 exact revision·결과와 review는 Issue #116과 해당 PR에서 관리한다.

Fixture는 제품 restore 종료 정책을 다시 선택하거나 새 notice를 만들지 않는다. Fake store는 빈 상태로 시작하므로 제품 main에 연결된 profile·store restore·protocol·capture composition의 native 성공을 검증하지 않는다. 실제 저장소 durability와 ACL, OS protocol registry, 서버/패스키 및 다른 OS/package 검증은 후속 gate다. Sandbox fixture 성공으로 production capture/OCR 호환성이나 native 인증 완료를 주장하지 않는다.

## 제품 logout·재로그인 조합 검증

`apps/desktop/src/frontend/src/integration/logout-relogin.integration.test.tsx`는 Electron child를 시작하지 않는 Vitest/jsdom 제품 조합 테스트다. `bootstrapAuthRuntime`의 실제 coordinator에 실제 auth IPC handler, capture/search IPC handler, preload invoker와 검색 protocol 회귀용 `LegacyApp` renderer를 연결하고, 합성 IPC transport·BrowserWindow/window source·media/OCR worker와 auth HTTP/store/clock/browser/entropy harness 및 검색 HTTP를 경계로 주입한다. 따라서 다음 연결을 한 테스트에서 확인한다.

- 로그인 전부터 capture source 조회·선택과 search begin이 가능하다.
- 로그인·로그아웃·재로그인 중 같은 capture·OCR·검색 수명을 유지한다. 인증 generation은 캡처 권한의 근거가 아니다.
- 중지 명령은 track·worker·검색 수명을 정리한다.

현재 카드 화면의 UI 검증은 위 Electron auth fixture가 담당하며, 이 LegacyApp 조합 테스트를 현재 화면의 검색 결과 UI 검증으로 취급하지 않는다.

이 조합 테스트는 실제 `main.ts`의 trusted runtime 설정, Electron native media/provider/API, safeStorage·credential file durability, OS protocol registry와 packaged app을 성공으로 표시하지 않는다. 서버 204와 local 삭제 결과, refresh/exchange 경합 및 notice 분류는 기존 coordinator·store 경계 테스트의 evidence로 별도 관리한다.

```sh
pnpm --filter @dfragon/desktop exec vitest run src/frontend/src/integration/logout-relogin.integration.test.tsx
```
