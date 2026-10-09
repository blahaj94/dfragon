---
type: reference
status: active
scope: desktop authentication and capture integration
last-reviewed: 2026-10-10
---

# Desktop Auth Capture

[승인된 Desktop auth 경계](../rules/desktop-auth.md)에 따라 capture, OCR, 검색은 로그인 상태와 독립적으로 제공한다. 인증 로딩, 실패, 로그인, 로그아웃은 계정 안내만 변경하며 선택한 창이나 검색 화면을 초기화하지 않는다. Main은 공개 검색 API 설정과 검색용 clock을 인증 runtime과 별도로 구성한다. 이 구현 설명은 실제 로그인, native credential 저장, OS protocol registry, API/패스키 연결 완료를 뜻하지 않는다.

## 구현 위치

| File                                                                                                       | 현재 책임                                                                                                                                                                                                       |
| ---------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/desktop/src/backend/auth/coordinator.ts`, `types.ts`                                                 | 계정 인증, 로그아웃과 내부 auth generation을 관리한다. Capture IPC는 coordinator나 `captureGeneration()`에 의존하지 않는다.                                                                                      |
| `apps/desktop/src/backend/capture/ipc-handler.ts`                                                          | Source 열거, 선택, 프레임 읽기의 window/document, 선택, capture 수명을 확인한다. 제품 display media 요청은 `null`로 거절한다. 선택 무효화, trusted 빈 선택 cleanup과 안정화 통지의 수명을 검사한다.             |
| `apps/desktop/src/backend/renderer-document.ts`                                                            | 개발 URL은 HTTP(S)의 exact `localhost`, `127.0.0.1`, `[::1]`과 canonical 입력만 허용한다. Credential, 공백, control, backslash, host alias를 거절하고 Electron Vite가 제공하는 slash 없는 bare origin만 정규화한다. |
| `apps/desktop/src/backend/main.ts`                                                                         | 검증한 renderer URL, sandbox, contextIsolation, navigation/popup 차단을 구성한다. Capture와 공개 검색을 인증 설정과 별도로 등록하고, auth runtime이 있을 때만 auth IPC를 추가한다.                               |
| `apps/desktop/src/backend/capture/permission-policy.ts`                                                    | 제품 session의 모든 permission check와 request를 거절한다. 인증 여부와 플랫폼은 조건이 아니다.                                                                                                                  |
| `apps/desktop/src/preload/index.ts`, `index.d.ts`                                                          | auth/capture와 검색 feature API만 노출한다. 범용 `window.electron`과 isolation-off fallback은 없다.                                                                                                             |
| `apps/desktop/src/frontend/src/App.tsx`, `pages/login/LoginPage.tsx`, `sections/LoginSection.tsx`          | 기본 App은 CaptureControls 모달과 네 카드의 OCR 이름을 표시한다. LegacyApp의 직접 검색, PartyCapture는 기존 회귀 테스트용 `fixture/legacy`에 남긴다. 인증 상태 변경은 캡처 수명을 초기화하지 않는다.            |
| `apps/desktop/src/frontend/src/sections/PartyCapture.tsx`                                                  | 기존 source/interval, Start/Stop, 인식값 UI와 네 슬롯 검색 결과를 표시한다. 공용 UI 외형을 변경하지 않는다.                                                                                                       |
| `apps/desktop/src/frontend/src/lib/party-capture-machine.ts`, `party-capture-session.ts`                   | XState가 창 등록, 검색 준비, 프레임 확인, OCR 준비, 실행, 중지, 실패 전이를 소유한다. 세션 actor 종료는 AbortSignal과 OCR worker, 프레임 읽기 loop를 정리하며, 취소 뒤 도착한 자원도 해당 세션에서 정리한다.              |
| `apps/desktop/src/frontend/src/hooks/usePartyCapture.ts`, `useCaptureSources.ts`, `usePartyRecognition.ts` | React와 machine을 연결하고, 창 목록 조회, OCR 이름 안정화를 각각 유지한다. UI는 캡처 phase를 읽는다. Unmount에서는 main의 창 선택도 해제한다.                                                                    |

인증 generation은 capture 권한 근거가 아니다. Renderer의 revision이나 인증 snapshot도 권한 근거로 사용하지 않는다. 기존 [auth bridge](desktop-auth-bridge.md)의 구독 순서, snapshot allowlist, credential 비노출을 유지한다. Auth API 오류는 기존 고정 UI로 처리하며 명령을 자동 재전송하지 않는다.

## Renderer 캡처 상태

캡처 수명에는 XState 5와 `@xstate/react`를 사용한다. `selecting`에서 창 등록 actor가 완료되면 자동 시작 또는 수동 시작 대기로 전이한다. `capturing`은 검색 준비 → 프레임 확인 → OCR 준비 → 실행 단계를 포함하며, 중지, 재선택, 실패로 빠져나갈 때 세션 actor를 정리한다. 이전 창 등록의 늦은 결과는 종료된 actor에서 무시된다. 이미 요청한 프레임 읽기, worker는 취소가 즉시 완료되지 않을 수 있어 세션별 AbortSignal과 자원 정리를 유지한다.

창 목록 새로고침은 캡처 수명과 독립적이다. 목록 조회 실패만으로 실행 중인 캡처를 중지하지 않는다. 검색 snapshot, 수동 검색 상태는 기존 `CaptureSearch`, OCR 안정화는 `usePartyRecognition`이 계속 관리한다. 로그인 수명과 Windows 제품 캡처 권한 정책은 바꾸지 않는다.

## 권한과 수명

Source 요청의 시작 및 비동기 완료에서 등록 window, sender, main frame, exact document와 선택 수명을 검사한다. 제품 main window의 display media 요청은 선택 여부와 관계없이 거절하며, 화면은 [Windows 제품 캡처 정책](../rules/desktop-windows-capture.md#windows-제품-캡처-정책)의 네이티브 프레임 읽기로만 얻는다. Electron 44.7.0은 `null`을 거절 값으로 정의하므로 창 등록의 display media handler는 `callback(null)`을 한 번 호출하고, 이미 소비됐을 수 있는 callback은 예외가 나도 다시 호출하지 않는다. 완료 전에 선택 해제, navigation 또는 window 변경이 일어나면 이전 요청의 결과를 전달하지 않는다.

Renderer의 인증 presentation epoch와 auth runId 재연결은 계정 화면에만 적용한다. React가 로그아웃과 재로그인을 한 render로 합쳐도 capture와 직접 검색 component는 유지한다. 검색 연결 자체의 runId, capture 수명 변경은 검색 bridge가 별도로 처리한다.

Main은 로그인, 로그아웃만으로 선택을 지우지 않으며 trusted renderer의 빈 source 선택은 인증 phase와 무관하게 허용한다. 다른 window/frame/document의 cleanup 요청은 거절한다. Stop, source 변경, 프레임 읽기 실패, unmount, document 종료는 기존 capture 정리를 수행한다. Capture의 이전 AbortSignal이 취소되면 늦은 OCR은 새 instance의 상태를 변경하거나 안정화 통지를 보내지 않는다. IPC 발송 뒤 capture 수명이 끝나 생긴 통지 거절도 raw error log 없이 회수한다.

`notifyStableNicknameDetected`는 captureId, slot, observationRevision, nickname을 받아 현재 수명의 검색으로 연결한다. Main의 HTTP/전체 응답 검증과 renderer의 네 슬롯 후보, retry 구현은 [캐릭터 검색](desktop-character-search.md)을 참고한다. Raw OCR nickname은 log에 남기지 않는다. 제품 main은 trusted profile, auth restore, capture/search composition을 연결하며, 실제 API/패스키 연결과 profile의 실행 시 검사는 [Desktop auth core](desktop-auth-core.md)를 따른다.

## 검증과 제한

`main.test.ts`는 인증 설정, provider가 없어도 공개 검색 설정을 연결하고 Windows를 포함한 모든 플랫폼에서 제품 session의 permission check와 media 요청을 거절하는지 확인한다. 거절 규칙 자체는 `permission-policy.test.ts`가 확인한다. `App.test.tsx`는 인증 로딩, 실패, 로그인, 로그아웃, auth runId 재연결과 무관한 source 선택 유지, 선택 전 Start 차단과 unmount cleanup을 확인한다. 이 테스트는 Electron/media doubles를 사용하며 실제 설치 앱의 캡처 성공을 대신하지 않는다.

```sh
pnpm --filter @dfragon/desktop exec vitest run src/backend/capture src/backend/main.test.ts src/backend/main-bundle.test.ts src/frontend/src/sections src/frontend/src/lib src/frontend/src/integration src/frontend/src/hooks src/frontend/src/App.test.tsx src/frontend/src/App.capture-controls.test.tsx
pnpm --filter @dfragon/desktop run --sequential '/^(test|lint|build)$/'
git diff --check
```

Unit/hook 검증은 실제 core와 테스트용 effects, IPC, worker doubles를 사용한 경합 evidence이며 설치 앱의 Windows 캡처, OCR 관측을 대신하지 않는다. Build에는 기존 node/web typecheck가 포함된다. 검증 범위는 [검증 명령](../../scripts/README.md#native-validation)에 따라 실제 영향으로 판단한다.

실제 native 인증의 Keychain, file durability, protocol association, 패스키 설정, 다른 OS/arch/package는 이 테스트로 검증되지 않는다. 남은 지원, 배포 gate는 [Desktop auth platform](../rules/desktop-auth-platform.md)을 따른다. Auth bridge fixture나 mocked OCR의 PASS로 설치 앱의 실제 캡처, OCR 실패를 대체하지 않는다.
