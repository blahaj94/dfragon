---
type: rule
status: active
enforcement: approval-required
scope: apps/desktop authentication process IPC and screens
last-reviewed: 2026-09-11
rationale: renderer가 credential이나 인증 성공을 소유하지 않고 후속 구현자가 process 경계를 추측하지 않도록 한다.
evidence: "PR #60 사용자 승인: https://github.com/blahaj94/ldb/pull/60#issuecomment-5553807475 ; 설계 근거: Issue #55; 서버 기반 PR #48 승인, PR #53 merge"
exceptions: 설계 승인은 제품 구현 착수·실제 OAuth 및 OS 등록·credential 저장소 변경을 포함하지 않는다.
review-after: 최초 Desktop 인증 구현 및 packaged platform validation 시
---

# Desktop Authentication Contract

이 문서와 [lifecycle](desktop-auth-lifecycle.md), [platform·저장·검증](desktop-auth-platform.md)은 [PR #60의 명시적 사용자 승인](https://github.com/blahaj94/ldb/pull/60#issuecomment-5553807475)을 받은 Desktop contract다. PR #60은 2026-09-05T18:13:24Z에 사용자 squash merge됐으며 merge commit은 `97b9903`다. 설계 승인은 실제 OS/배포 검증 성공이나 후속 구현 착수 지시를 대체하지 않는다. [Architecture](../architecture/overview.md)의 실제 지원 환경·등록값·native 검증 gate는 유지한다.

2026-09-15 사용자 요구에 따라 로그인은 선택 사항이다. 게임 창 선택·캡처·OCR·캐릭터 검색·결과 표시는 인증 여부와 독립적이다. 이 PR은 아래 화면·검색 계약을 함께 변경하며 사용자 merge 후 다른 작업에도 적용한다. 계정 자체의 인증·credential·저장·OAuth 계약은 유지한다.

서버의 [API](auth-api.md), [OAuth](auth-oauth.md), [session](auth-session.md), [활동](auth-activity.md), [runtime gate](auth-runtime.md)를 전제로 한다. Endpoint, TTL, JWT/refresh/session 정책, provider 설정과 DB를 변경하지 않는다. `clientId:"desktop"`은 public 등록 선택값이다. 실제 운영 URL·app identity·protocol 값은 platform 문서의 미확인 gate다.

## Process 책임과 권한

| Process            | 소유 상태·권한                                                                                                                                                      | 다른 process로 전달하는 것                                                                     |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| main               | 단일 AuthCoordinator, pending login·PKCE, token·user, session generation, HTTP/refresh single-flight, safeStorage/file, protocol event, 고정 설정 기반 browser 열기 | 아래 AuthSnapshot과 정제된 명령 결과만                                                         |
| preload            | 허용된 feature별 IPC invoker·event wrapper, listener 수명                                                                                                           | 직렬화 가능한 snapshot DTO. Credential, HTTP, 저장·로그인 상태 판단을 소유하지 않음            |
| renderer           | snapshot 복사본, 버튼/화면 상태, welcome 닫힘·capture UI·OCR resource                                                                                               | provider 선택·현재 attempt 취소·복구/로그아웃 의도. 로그인 성공·권한·URL·token을 제출하지 않음 |
| 외부 browser / API | provider 화면·cookie·state·callback 및 code 발급은 기존 서버 계약                                                                                                   | 브라우저 완료는 API 검증 완료일 뿐이며 앱의 로그인 성공은 아님                                 |

Main은 OS 사용자·app profile당 현재 계정/session 하나만 활성화한다. 계정 전환은 현재 기기 logout 후 새 로그인이다. 다른 앱 설치나 다른 기기는 별개 session이며 Desktop이 한꺼번에 폐기하지 않는다. Main memory 자체가 침해된 경우까지 credential 보호를 보장하지 않는다.

인증이 유효한지는 main 상태와 서버 응답으로 결정한다. Renderer의 route, React state, 임의로 만든 snapshot, `isNewUser`는 권한 증거가 아니다. Token은 renderer storage, browser cookie, IndexedDB, React state, IPC, URL, log에 넣지 않는다. 인증된 HTTP는 main의 고정 endpoint별 기능에서 수행하며 범용 `fetch(url,options)` IPC를 만들지 않는다.

## 기존 구조와 연결

2026-09-06, main `a82547c`에서 source/config를 읽어 확인한 내용이다. 실행 성공 evidence는 아니다.

- `apps/desktop/src/backend/main.ts`는 window/lifecycle composition root이며 capture 등록과 `loadURL`/`loadFile`을 담당한다. Auth/protocol/single-instance/store는 없다. 현재 `sandbox:false`와 임의 popup URL의 `shell.openExternal` 경로가 있다.
- `apps/desktop/src/backend/ipc.ts`, `apps/desktop/src/preload/ipc.ts`, `apps/desktop/src/preload/common/types/ipc.ts`는 `AsyncIPCFunctions`로 handler/invoker type을 연결한다. Runtime validation은 feature handler가 담당한다.
- `apps/desktop/src/backend/capture/ipc-handler.ts`는 등록 window의 `webContents`를 검사하고, display-media는 main frame·선택 source·user gesture 등도 검사한다. 안정화 OCR 문자열은 현재 log까지만 전달하며 HTTP 검색은 없다.
- `apps/desktop/src/frontend/src/App.tsx`는 capture 화면 하나다. `usePartyCapture`, `usePartyCaptureSession`, `usePartyRecognition`은 선택·stream/worker·OCR 안정화 책임을 나누고 unmount 시 capture resource를 정리한다. 계정 화면·검색 후보 화면은 없다.
- `apps/desktop/src/preload/index.ts`는 feature API 외 toolkit `electronAPI`와 context isolation이 꺼진 fallback도 노출한다. `apps/desktop/src/frontend/index.html`은 local CSP를 가진다.

후속 구현의 feature 위치는 `apps/desktop/src/backend/auth/**`, `apps/desktop/src/preload/api/auth.ts`, `apps/desktop/src/preload/common/types/auth.ts`, `apps/desktop/src/frontend/src/auth/**`를 권장한다. Shared IPC contract에는 아래 명령 type을 추가하고 backend/preload는 거기서 파생한다. `main.ts`/preload `index.ts`에는 생성·등록·노출만 둔다. 새 package나 dependency, 범용 service framework는 필요하지 않다.

인증 경계를 연결할 때 `contextIsolation:true`, `nodeIntegration:false`, `sandbox:true`를 명시하고 isolation-off fallback·범용 `window.electron` 노출을 제거한다. 기존 capture 전용 API는 유지한다. Renderer navigation/새 window는 차단하고 외부 browser 열기는 검증한 로그인 launch 전용 main 경로로만 허용한다. OAuth 화면을 BrowserWindow/webview에 넣거나 인증을 위해 CSP/webSecurity를 완화하지 않는다. Preload bundle·OCR worker·capture가 sandbox에서 작동하는지는 후속 회귀 검증 대상이며 검증 전 현재 기능과의 호환성을 주장하지 않는다. 이 항목은 현재 구현 설명이 아닌 승인된 변경 contract다. [Electron security 근거](https://www.electronjs.org/docs/latest/tutorial/security)

## 최소 IPC 계약

기존 feature naming에 맞춘 다음 5개 invoke와 1개 event만 추가한다. `getAuthState`는 local 조회이며 HTTP·활동 갱신을 일으키지 않는다.

| Channel / preload API                               | 정확한 입력                                               | 결과와 의미                                                                                                                                                                       |
| --------------------------------------------------- | --------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `getAuthState`                                      | 인자 0개                                                  | `AuthSnapshot`                                                                                                                                                                    |
| `beginLogin`                                        | object 1개 `{provider:"google"\|"discord"}`               | `AuthCommandResult`. signedOut에서만 새 attempt 시작. 중복 클릭/다른 provider 입력은 `AUTH_BUSY`, 현재 attempt 유지                                                               |
| `cancelLogin`                                       | object 1개 `{attemptId:string}`                           | `AuthCommandResult`. 현재 시작/대기/exchange attempt만 취소. 오래된 attempt는 `STALE_ATTEMPT`, 다른 attempt에 영향 없음                                                           |
| `retryAuth`                                         | 인자 0개                                                  | `AuthCommandResult`. restorePaused에서는 안전한 복원 단계만 재개, storageBlocked에서는 local 저장 진단·정리 재시도. 새 browser login·불명확한 code/refresh 재전송은 수행하지 않음 |
| `logout`                                            | 인자 0개                                                  | `AuthCommandResult`. main이 현재 credential을 선택한다. signedOut이면 no-op, 진행 중 logout이면 같은 결과 공유. 그 밖의 경합은 lifecycle을 따름                                   |
| `authStateChanged` / `onAuthStateChanged(listener)` | main→등록 renderer DTO. preload 함수 입력은 callback 하나 | unsubscribe 함수 반환. Electron event·sender·내부 error를 listener에 넘기지 않음                                                                                                  |

`AuthCommandResult = {ok:true,snapshot:AuthSnapshot} | {ok:false,error:{code:AuthCommandError},snapshot:AuthSnapshot}`다. `AuthCommandError`는 `INVALID_AUTH_COMMAND`, `AUTH_NOT_ALLOWED`, `AUTH_BUSY`, `STALE_ATTEMPT`, `AUTH_OPERATION_FAILED`만 허용한다. 뒤의 두 실행 결과와 상세 UI 안내는 snapshot을 함께 사용한다. 허용되지 않은 sender에는 snapshot 없이 정제된 `AUTH_NOT_ALLOWED` rejection만 반환한다. Raw exception/stack/server message를 반환하지 않는다. `ok:true`는 명령이 처리됐다는 뜻이며 로그인/서버 logout 성공은 snapshot으로만 판단한다.

`beginLogin`은 main에 attempt를 만들고 `startingLogin` snapshot을 반환한다. Browser/HTTP 진행은 event로 받는다. `cancelLogin`은 로컬 무효화, `logout`은 정리 종료 또는 명시적 실패 뒤 결과를 반환한다. IPC 응답 유실 시 같은 명령을 자동 재전송하지 않고 `getAuthState`로 재동기화한다. Renderer 측 bridge 연결 실패는 별도 고정 문구로 표시하며 임의 signedIn을 만들지 않는다.

AuthSnapshot의 전체 allowlist는 다음과 같다. Optional 임의 field를 통과시키지 않는다.

| Field               | 값·노출 조건                                                                                                                                        |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `runId`, `revision` | main 실행마다 새 비민감 random ID, snapshot 전이마다 증가하는 nonnegative safe integer. 서버 request/session ID와 별개                              |
| `phase`             | `signedOut`, `startingLogin`, `waitingBrowser`, `exchanging`, `restoring`, `restorePaused`, `signedIn`, `signingOut`, `storageBlocked`              |
| `providers`         | 배포 설정에서 enable한 provider allowlist. 서버 provider gate가 미해소면 해당 버튼을 표시하지 않음; renderer가 enable할 수 없음                     |
| `login`             | 로그인 진행 중 `{attemptId,provider,expiresAt}` 또는 null. attemptId는 main의 임의 UUID로 server requestId와 별개; startingLogin의 expiresAt은 null |
| `user`              | signedIn에서만 `{nickname:string}`, 그 밖은 null. API user ID·session ID·provider identity는 노출 불필요                                            |
| `entry`             | signedIn에서 `welcome` 또는 `home`, 그 밖은 null. 서버 exchange의 isNewUser로 최초 진입을 정하고 복원은 home                                        |
| `notice`            | null 또는 아래 고정 enum. UI는 자체 고정 한국어 문구를 사용                                                                                         |

`notice`는 `LOGIN_CANCELLED`, `LOGIN_EXPIRED`, `LOGIN_RETURN_INVALID`, `LOGIN_RESTART_REQUIRED`, `BROWSER_OPEN_FAILED`, `NETWORK_UNAVAILABLE`, `AUTH_SERVICE_UNAVAILABLE`, `RESTORE_RETRY_REQUIRED`, `REAUTH_REQUIRED`, `SECURE_STORAGE_UNAVAILABLE`, `TOKEN_SAVE_FAILED`, `LOCAL_CLEAR_UNCONFIRMED`, `LOGOUT_SERVER_UNCONFIRMED`만 허용한다. `phase`가 허용 action을 결정한다. Server logout·local 삭제 둘 다 실패하면 `storageBlocked/LOCAL_CLEAR_UNCONFIRMED`가 우선이고 문구에서 서버 완료도 미확인임을 함께 안내한다.

Preload event는 고정 channel 하나에서 DTO만 전달하고 개별 wrapper를 제거한다. Renderer는 먼저 subscribe한 뒤 `getAuthState`를 호출한다. 같은 runId에서는 큰 revision만 적용하므로 늦은 invoke 응답이 새 event를 덮지 않는다. Reload는 새 구독 후 조회하고 unmount 때 해제한다. Main 재연결로 runId가 달라지면 이전 bridge/subscription을 버린 뒤 새 조회로 기준을 세운다.

## Main trust boundary

모든 invoke에서 side effect 전에 다음을 검사한다. TypeScript type만으로 통과시키지 않는다.

1. `event.sender`가 살아 있는 등록 main window의 `webContents`와 동일하고 `event.senderFrame === window.webContents.mainFrame`이어야 한다. Subframe, 다른 window, destroyed/null frame은 거절한다.
2. Sender frame의 현재 document URL은 packaged renderer entry의 exact file URL이어야 한다. Dev는 main이 시작 시 확인한 exact local dev URL만 허용한다. Prefix/hostname substring 비교나 renderer가 준 origin을 사용하지 않는다. Navigation 뒤 매 호출 재검사하며 about:blank/외부 화면은 허용하지 않는다.
3. 인자 수까지 검사한다. Object는 null/array를 제외하고 exact own keys, string enum과 canonical UUID를 검사한다. Unknown key·coercion·과도한 string을 거절한다. URL·code·verifier·token·clientId·userId·sessionId·path를 받는 IPC는 없다.
4. 현재 phase, enabled provider, attemptId, generation을 검사한다. Async 완료와 event 발행 전에도 generation/window identity를 재확인한다. Clock/deadline 및 외부 응답 검증은 lifecycle을 따른다.

이 검사는 UI script의 privileged API 남용 범위를 줄이지만 허용된 renderer 자체가 침해됐을 때 사용자 클릭 의도를 증명하지는 않는다. Header/token 생성·file/URL 선택은 언제나 main이다.

## 최소 화면과 capture 경계

Capture와 검색 화면은 인증 snapshot 로딩·signedOut·로그인 진행·welcome·signedIn·로그아웃·복원/저장 실패 상태 모두에서 사용할 수 있다. 계정 화면은 로그인·취소·복원 재시도·현재 기기 로그아웃과 고정 안내만 담당한다. 로그인 실패나 계정 전환이 capture component를 재생성하거나 인식값·검색 결과를 지우지 않는다. Welcome은 계정 안내이며 캡처 진입 조건이 아니다.

Source 열거·선택, display media, OCR와 검색 IPC는 등록된 renderer의 sender/main frame/exact document와 source·capture 수명을 검사한다. signedIn·auth snapshot revision·auth generation은 이 기능의 허용 조건이 아니다. Source 변경, Stop, track 종료, capture unmount, renderer reload/navigation/destruction은 stream·worker·loop·선택 수명과 검색을 정리하고 늦은 완료를 차단한다. 로그인·로그아웃·인증 만료만으로 이 수명을 종료하지 않는다.

Main의 token 소유, account endpoint 권한 검사, sandbox와 navigation 차단은 유지한다. Renderer가 인증을 조작하지 않아도 기능을 사용할 수 있게 하며 임의 화면·camera/microphone 허용으로 확대하지 않는다. 제품 display 권한은 [Windows 제품 캡처 정책](desktop-capture-media-fixture-proposal.md#windows-제품-캡처-정책)을 따른다.

## 저장 확정 뒤 복원 안내 제안

```yaml
status: active
enforcement: approval-required
rationale: 저장이 확정돼도 access를 안전하게 사용할 수 없는 복원을 종료하고 사용자 재시도를 제공한다.
evidence: "PR #139 사용자 승인: https://github.com/blahaj94/ldb/pull/139#issuecomment-5577289923 ; merge: cfb1fa7a9e1ce6e6ac9b704842be5d02183cbfbd ; 설계 근거: https://github.com/blahaj94/ldb/issues/137"
exceptions: 기존 저장 실패·결과 불명·인증 상실 안내와 IPC shape를 바꾸지 않는다.
review-after: 초기 restore·paused retry의 저장 지연·clock 회귀와 화면 검증 후
```

- [저장 확정 뒤 복원 종료 제안](desktop-auth-lifecycle.md#저장-확정-뒤-복원-종료-제안)의 시간 문제로 복원을 마치지 못하면 `restorePaused/RESTORE_RETRY_REQUIRED`로 안내한다.
- 고정 문구는 “로그인 상태 확인을 마치지 못했습니다. 다시 시도해 주세요.”다. Network·서버·저장 장애나 인증 상실을 뜻하지 않는다. `user`와 `entry`는 null이고 보호 화면·capture는 열지 않는다.
- 처리 종료 뒤 “다시 시도”(`retryAuth`)와 현재 기기 logout을 제공한다. 진행 중에는 복원 중 표시와 중복 실행 차단을 유지하고, 다시 pause로 끝나면 다음 수동 재시도를 제공한다. 저장된 credential만으로 로그인 성공을 표시하지 않는다.
- 기존 `retryAuth`의 인자 0개·`AuthCommandResult`·snapshot/event 순서와 `ok:true`의 명령 처리 의미를 유지한다. 새 IPC, snapshot field, browser login 또는 자동 재시도를 추가하지 않는다. 이 절과 연결된 lifecycle 절은 PR #139의 substantive contract 채택·merge로 active가 됐으며, 제품 구현은 사용자가 허용한 후속 작업 범위에서 수행한다.

## 승인된 선택과 서버 별도 결정

권장안은 main 단독 소유 + feature IPC + memory-only pending/access + 암호화 refresh 보관 + 등록 private protocol + 최소 welcome/home이다. Renderer token 보관은 bridge 노출면을 늘리고, provider embedded login은 승인된 외부 browser 경계와 다르므로 채택하지 않는다. 저장/protocol의 실질 대안 비교는 platform 문서에 둔다.

이 flow에 필수인 서버 정책 변경은 없다. Browser 취소를 앱에 즉시 push하는 기능, 서버 pending 취소/status endpoint, code/refresh 응답 유실의 idempotent 재전달, onboarding 완료 저장, 계정 연결은 현 API에 없다. 필요해지면 별도 서버 Rule 결정으로 제시한다. 이 로그인 설계는 polling·error URL parameter·refresh grace를 추가하지 않는다. [승인된 탈퇴 contract](auth-withdrawal-proposal.md)의 withdrawal 전용 status/resume·main-owned receipt·재시작 1회/사용자 gesture 조회는 별도로 승인된 확장이다. 기존 login pending의 memory-only/재시작 복구 없음과 혼합하지 않으며 구체적 feature IPC·UI/OS 구현과 검증은 후속 범위다.

## OCR 검색 연결 제안

현재 구현된 검색 연결에 로그인 선택 정책을 적용한다. 이전 PR #131·#149의 auth generation·authorization·401 refresh 의존은 이 변경으로 대체한다. 아래 capture·slot 수명과 입력·응답 검증, deadline과 수동 재시도는 유지한다.

### 입력과 권한의 소유

- Renderer는 기존 OCR 안정화 결과와 그 결과의 무효화만 전달한다. HTTP와 응답 검증은 main이 소유하며 검색에는 token을 사용하지 않는다. 고정 `GET /characters`에 안정화 nickname을 `characterName`으로 보내고 선택 query는 생략한다. 입력 길이·정규화·응답 field·후보 순서·오류·quota는 [서버 검색](character-search.md)을 그대로 소비하며 Desktop에서 재정의하지 않는다.
- Main은 등록 renderer document와 선택 source·capture 수명을 검사하고 고정 공개 검색 endpoint를 호출한다. Renderer가 보내는 식별자는 상관관계 확인용이며 권한 증거가 아니다.
- Main은 Start마다 새 `captureId`를 만들고 등록 renderer document·선택 source generation에 결합한다. Media 허용과 OCR 시작·완료도 이 수명에 속해야 한다. Source 변경, media 실패·종료, Stop, capture unmount, renderer reload/navigation/destruction은 이 수명을 끝낸다. 캡처 재시작은 source 선택과 Start를 다시 요구한다.
- Renderer는 capture instance와 slot별 `observationRevision`을 소유한다. 현재 안정화 nickname이 사라지는 전이에는 `clear`를 한 번 보내고 새 안정화 결과에는 기존 notify를 보내며, 두 전이 모두 revision을 증가시킨다. 빈 slot·빈 OCR·다른 문자열의 안정화 대기로 기존 stable 값이 null이 되는 경우를 포함한다. 매 frame 전송, OCR 보정·안정화 조건·호출 주기 변경은 요구하지 않는다.
- Main은 slot별 최신 observation revision과 검색별 새 `requestId`를 소유한다. 낮거나 같은 observation revision의 중복·역순 입력은 작업을 만들지 않는다. Clear 없이 같은 nickname의 더 큰 revision을 받으면 requestId를 유지하며 진행 요청의 수용 observationRevision과 현재 결과의 revision을 함께 올리고 snapshot을 발행한다. 완료 검사는 승격한 수용 revision을 사용하며 시작 시 고정한 옛 revision만 비교해 pending으로 남기지 않는다. 새 검색이나 실패 재시도는 만들지 않는다. 다른 slot은 서로의 결과를 지우거나 요청 순서를 기다리지 않는다.

### 최소 feature IPC

검색 연결에서 아래 이름과 shape를 사용한다. 기존 `notifyStableNicknameDetected`를 확장하고, 검색 제어 invoke 하나와 event 하나를 추가하는 제안이다. 기존 source 열거·선택·display-media와 auth IPC의 권한 검사는 유지한다.

| Channel / preload API                                           | 정확한 입력                                                       | 의미                                                                                                           |
| --------------------------------------------------------------- | ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `notifyStableNicknameDetected`                                  | object 1개 `{captureId,slot,observationRevision,nickname}`        | 현재 capture의 안정화 입력. 기존 `{slot,nickname}`/`Promise<void>` 확장은 후속 검색 구현에만 적용              |
| `controlCharacterSearch`                                        | object 1개 `{action:"read"}`                                      | main의 현재 `SearchSnapshot` 조회. HTTP·활동·capture 시작 없음                                                 |
| 같은 invoke                                                     | `{action:"begin"}`                                                | Start 의도. 등록 document에서 선택 source가 있을 때 새 capture 수명 생성. 이미 살아 있는 capture가 있으면 거절 |
| 같은 invoke                                                     | `{action:"end",captureId}`                                        | 해당 수명만 무효화. 이미 끝난 ID는 no-op이며 새 capture에 영향 없음                                            |
| 같은 invoke                                                     | `{action:"clear",captureId,slot,observationRevision}`             | 해당 slot의 안정화 입력·검색·결과 무효화                                                                       |
| 같은 invoke                                                     | `{action:"retry",captureId,slot,requestId}`                       | 해당 slot의 현재 실패에 대한 사용자 재시도. Main이 보관한 nickname으로 새 requestId 생성                       |
| `characterSearchChanged` / `onCharacterSearchChanged(listener)` | main→등록 renderer `SearchSnapshot`; preload 입력은 callback 하나 | unsubscribe 반환. Electron event·sender·raw 오류를 전달하지 않음                                               |

두 invoke 결과는 `SearchCommandResult = {ok:true,snapshot:SearchSnapshot} | {ok:false,error:{code:SearchCommandError},snapshot:SearchSnapshot}`다. 명령 처리를 확인할 뿐 HTTP 성공을 뜻하지 않는다. `SearchCommandError`는 `INVALID_SEARCH_COMMAND`, `SEARCH_NOT_ALLOWED`, `STALE_SEARCH`, `SEARCH_BUSY`, `SEARCH_RETRY_NOT_READY`만 허용한다. 허용되지 않은 sender에는 snapshot 없이 정제된 `SEARCH_NOT_ALLOWED` rejection만 반환한다.

위 [Main trust boundary](#main-trust-boundary)를 모든 호출에 적용한다. Action별 exact own keys·인자 수·값을 검사한다. `captureId`·`requestId`는 main이 만든 canonical UUID, `slot`은 현재 party slot의 정수 0~3, `observationRevision`은 양의 safe integer다. `nickname`은 string이어야 하며 서버 검색 입력 계약을 적용한다. 새 관측 문자열이 검색 조건을 어기면 새 requestId의 `failure/INVALID_SEARCH_QUERY`, HTTP 0회로 끝내고 고쳐 보내지 않는다. 내부 source generation을 IPC로 노출하지 않는다.

`begin`의 현재 document·완료된 source 선택과 generation·기존 capture 부재 검사, 새 captureId 생성과 결합은 await 없는 main의 단일 동기 전이다. document/source 무효화가 먼저여서 전제가 사라졌으면 capture를 만들지 않고 `SEARCH_NOT_ALLOWED`로 거절한다. Source 선택 중 또는 기존 capture 존재는 `SEARCH_BUSY`다. Begin이 먼저 완료되면 뒤따르는 무효화가 그 capture를 끝내므로 오래된 수명이 남지 않는다.

`begin`은 수명을 만든 즉시 snapshot을 반환한다. Renderer는 자신의 Start와 capture instance가 아직 살아 있을 때만 이 ID를 사용하고, 취소된 Start의 늦은 성공은 그 ID로 `end`한다. Media 실패와 renderer cleanup은 `end`를 보내며 main은 source 변경·document 종료를 직접 관찰해 renderer 통지 없이도 무효화한다. 잘못된 sender를 제외한 cleanup용 `end`는 로그인 상태와 관계없이 허용한다.

| `SearchSnapshot` field | 정확한 값·노출 조건                                                                                          |
| ---------------------- | ------------------------------------------------------------------------------------------------------------ |
| `runId`, `revision`    | main 실행의 비민감 ID, 검색 상태 전이마다 증가하는 nonnegative safe integer. 인증 snapshot의 revision과 별개 |
| `captureId`            | 현재 수명의 UUID 또는 null                                                                                   |
| `slots`                | slot 0~3 각각 한 번씩 오름차순으로 담은 고정 4개 DTO. 각 DTO의 exact fields는 아래와 같음                    |

Slot DTO는 `{slot,observationRevision,requestId,nickname,state,rows,error}`만 가진다. 수명 시작/종료의 observationRevision은 0, requestId·nickname·error는 null, rows는 빈 array, state는 `idle`이다. Clear는 수신한 최신 observationRevision을 기록하며 나머지는 같은 idle 형태로 만든다. 상태별 조건은 다음 표를 따른다.

| `state`   | DTO와 화면의 의미                                                                               |
| --------- | ----------------------------------------------------------------------------------------------- |
| `idle`    | 인식 대기. 이전 nickname·후보·오류를 표시하지 않음                                              |
| `pending` | 현재 nickname·requestId와 “검색 중”. rows는 비우고 error는 null. 이전 성공 후보·0건·실패를 제거 |
| `success` | 현재 nickname·requestId와 검증된 비어 있지 않은 rows만 표시, error는 null                       |
| `empty`   | 현재 nickname·requestId, 빈 rows와 “검색 결과가 없습니다.”, error는 null                        |
| `failure` | 현재 nickname·requestId, 빈 rows와 정제된 error. 실패를 0건으로 표시하지 않음                   |

Rows는 서버 응답의 승인된 다섯 field만 갖는 DTO로 projection하며 값과 순서를 유지한다. Main은 전체 body와 모든 후보를 검증한 뒤 발행한다. 한 후보라도 부적합하면 전체 실패이며 부분 후보·raw body·server message·stack은 IPC로 보내지 않는다. Renderer/preload도 exact DTO와 상태별 조합을 검사하고 값은 text로 출력한다. UI의 Component·상태·접근성 표현은 [디자인 계약](design-system.md)을 따른다.

`error`는 `{code,retryAfterSeconds}` 또는 null이다. Code는 [서버의 정제 오류 code](character-search.md#정제된-오류)와 Desktop의 `SEARCH_TIMEOUT`, `SEARCH_NETWORK_ERROR`, `SEARCH_RESPONSE_INVALID`만 허용한다. HTTP status와 서버 code가 맞는지 검증하며 raw message는 사용하지 않는다. `retryAfterSeconds`는 아래 429에서만 nonnegative safe integer이고 그 밖은 null이다. 문구는 code에 대응하는 고정 한국어 안내다. 400은 검색 조건 안내·새 OCR 대기이며 같은 입력 재시도 버튼은 제공하지 않는다.

Renderer는 event를 먼저 구독한 뒤 `read`하고 같은 runId에서 더 큰 revision만 적용한다. 현재 capture instance·captureId와 일치하며 slot의 observationRevision이 현재 관측보다 오래되지 않은 상태만 보여준다. `captureId:null`은 현재 표시를 지운다. Invoke 응답 유실은 `read`로 확인하고 명령을 자동 재전송하지 않는다. Reload는 이전 capture를 재개하지 않는다. Main runId가 바뀌면 기존 구독·표시를 버리고 새 검색 조회부터 시작한다. Local source/Stop/cleanup이 발생하면 event를 기다리지 않고 화면을 지운다. Local 새 관측·clear도 해당 slot의 이전 표시를 즉시 지운다.

### 취소와 완료의 최종 판정

- 새 안정화 입력·clear·사용자 재시도는 해당 slot의 이전 요청을 무효화하고 가능한 transport를 abort한다. Source 변경·Stop·capture 종료은 모든 slot에 적용한다. 취소 자체를 failure로 표시하지 않는다.
- HTTP 전송·완료 처리·event 발행 직전에 현재 captureId·source generation·renderer document와 slot의 requestId/observationRevision을 재확인한다. 하나라도 다르면 결과·오류를 버린다. 먼저 보낸 요청이 나중에 끝나도 새 slot 상태를 바꿀 수 없다.
- 로그인 상태 변경은 capture·검색 요청·표시를 바꾸지 않는다. 취소나 화면 제거는 서버 quota의 환불을 뜻하지 않는다.

### 전체 검색 예산과 제한 응답

- 각 검색은 입력 또는 사용자 retry 접수부터 HTTP·전체 body 수신·검증까지 monotonic 15,000ms 하나를 사용한다. 완료가 deadline 이상이면 `SEARCH_TIMEOUT`이며 서버 upstream 5초와 별개다. 전송 실패는 `SEARCH_NETWORK_ERROR`, 부적합 응답은 `SEARCH_RESPONSE_INVALID`다.
- 공개 `GET /characters`에 Authorization을 보내지 않으며 auth 준비·refresh·401 회복을 호출하지 않는다. 이전 서버가 401을 반환하면 호환되지 않는 검색 응답으로 실패하며 로그인이나 재인증을 요구하지 않는다. 자동 HTTP retry는 없다.
- 재시도는 같은 capture/slot/requestId의 현재 실패에서 새 requestId와 15초 예산으로 시작한다. `INVALID_SEARCH_QUERY`는 새 관측을 기다린다. Network·timeout·응답 오류·서버 실패는 수동 retry를 제공한다.
- 429는 실패로 표시하고 유효한 양의 정수 `Retry-After`를 main의 monotonic 대기로 적용한다. 만료 시 같은 실패의 버튼만 활성화한다. 누락·부적합 header는 null로 정제하고 수동 retry를 허용한다. 자동 GET이나 quota 대기열을 만들지 않는다.
- Stop·source/document 변경·capture 종료는 해당 요청과 timer를 취소하고 늦은 결과를 버린다. 다른 slot은 독립적이며 로그인·로그아웃으로 취소하지 않는다.

## 인증 준비 미완료 검색 종료 제안

PR #149의 `SEARCH_AUTH_NOT_READY`와 인증 회복 오류는 공개 검색 전환으로 제품 검색에서 사용하지 않는다. 기존 승인 이력은 해당 PR에 보존하며 계정 인증·저장·복원 정책을 변경하는 근거로 사용하지 않는다.

## 닉네임 직접 입력과 슬롯 수정

2026-09-15 사용자가 요청한 직접 검색·수정 검색은 기존 공개 검색과 같은 입력·응답·quota·15초 예산을 사용한다. 이름을 trim·OCR 정규화·자동 교정하지 않으며 2~12 code point 및 바깥 공백·잘못된 Unicode 검사를 main에서 다시 수행한다. 로그인은 필요하지 않다.

- 직접 검색은 source 선택·캡처·OCR 없이 사용할 수 있다. 별도 검색 수명을 사용하므로 캡처 Stop/source 변경과 서로의 결과를 지우지 않는다. 등록 document 종료·navigation·renderer 종료는 모두 정리한다. 수동 검색 ID로 media를 허용하거나 캡처 검색을 조작할 수 없다.
- Preload의 `window.manualSearch`는 기존 `SearchApi`의 control/subscribe shape와 `notifyManualNickname(SearchObservation)`을 제공한다. IPC는 `controlManualSearch`, `notifyManualNickname`, `manualSearchChanged`다. 동일한 sender/main frame/exact document·exact own key·DTO 검사를 적용한다. Shared DTO의 `captureId`는 수동 채널에서는 독립 검색 세션 ID이며 media 권한이 아니다.
- 수동 `begin`은 이전 수동 세션을 종료하고 새 수명을 만든다. 시작 응답 유실 후 사용자 재검색으로 복구할 수 있고 늦은 이전 `end`·HTTP 결과는 새 세션에 영향을 주지 않는다. 캡처 `begin`의 source·gesture 전제는 유지한다.
- 슬롯에서 ‘닉네임 수정’을 선택하면 해당 슬롯의 이전 검색을 취소하고 자동 검색 제출을 멈춘다. 다른 슬롯과 영상/OCR은 계속 동작한다. 편집 입력과 수정 검색 결과는 이후 OCR로 덮어쓰지 않으며 ‘OCR 다시 사용’을 누르면 최근 안정화 관측부터 자동 검색을 재개한다. Stop/source 변경·capture 종료 시 수정 모드를 해제한다.
- 검색은 Enter 또는 명시적 버튼으로 제출하며 한글 조합 중 Enter는 제출하지 않는다. 중복된 진행 요청은 추가로 보내지 않고 새로운 이름은 이전 요청을 취소·교체한다. 오류·빈 결과·429·수동 retry는 기존 결과 UI를 재사용한다. 화면 입력값·닉네임·검색 결과를 log나 영구 저장소에 추가 기록하지 않는다.
