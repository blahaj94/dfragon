---
type: rule
status: active
enforcement: approval-required
scope: Windows product capture permission and Issue 126 isolated media fixture
last-reviewed: 2026-09-15
rationale: 고정된 검증 화면에서 실제 media와 OCR 연결을 관측하되 Electron 권한 정보의 한계를 제품 보안 보장과 구분한다.
evidence: "PR #135 사용자 승인: https://github.com/blahaj94/ldb/pull/135#issuecomment-5578416858 ; 사용자 merge: 489e4aac61cffd0a6540c558e1e61a6361dd1036 ; Issue #126 판단: https://github.com/blahaj94/ldb/issues/126#issuecomment-5572323933 ; Electron 39.8.10 공식 source"
exceptions: Fixture 승인은 해당 fixture에만 적용한다. Windows 제품 정책은 아래 별도 사용자 선택과 PR 범위를 따른다.
review-after: 최초 실제 media/OCR 관측 후 또는 Electron version·fixture 문서·권한 경계 변경 전
---

# Desktop capture media 권한과 격리 검증

## Windows 제품 캡처 정책

이 절은 기존 fixture 승인을 확장한 것으로 간주하지 않는다. 사용자는 2026-09-15 개발 요청에서 아래 legacy API 한계를 수용하고 Windows 제품의 제한된 허용안 구현·설치·검증을 허용했다. 이 작업의 구현·검증에 적용하며, [PR #462](https://github.com/blahaj94/ldb/pull/462)의 사용자 merge로 다른 작업에도 활성화한다.

- Windows 제품의 등록된 main window, 살아 있고 attached 상태인 exact local main document, main의 현재 signedIn/auth·window·source generation과 유효한 capture 수명을 모두 확인한다. Source 선택과 `begin` 뒤 해당 capture당 media request를 한 번만 허용한다. Stop·인증 이탈·source 변경·navigation·창 종료로 무효화된 수명에는 허용하지 않는다.
- `media`, `isMainFrame:true`, exact `requestingUrl`, 존재하는 빈 `mediaTypes` 배열만 후보로 받는다. Camera/microphone, 다른 permission, media check는 계속 거절한다. 미구성 인증과 Windows 외 제품 entry도 계속 거절한다.
- 정상 `getDisplayMedia`에는 기존 display handler의 video-only·Start gesture·선택 창 재열거와 비동기 완료 직전 auth/source/capture 검사를 유지한다. Renderer의 기존 stream/worker/loop 정리와 늦은 OCR·검색 결과 폐기도 유지한다.
- **이 선택은 제품 renderer가 정상 API를 호출한다는 신뢰를 수용한다.** Electron 39.8.10의 빈 배열은 legacy desktop `getUserMedia`와 구별되지 않는다. 침해된 renderer는 허용 가능한 capture 수명을 만들고 legacy 경로로 선택하지 않은 창·전체 화면 또는 지원되는 system audio를 요청할 수 있다. 한 번 제한·CSP·sandbox·media check 거절은 이 우회를 차단한다는 보장이 아니다. Legacy stream의 강제 종료를 main이 보장한다고도 주장하지 않는다.
- 실제 검증은 사용자가 준비한 1920×1080 게임 창의 영상→OCR→인증된 검색→화면 결과로 한정한다. 화면·닉네임·source title/ID·credential 원문은 기록하지 않는다. Mock/fixture 결과와 실제 게임 결과를 구분하며 다른 OS·해상도 전체 검증을 선행 조건으로 추가하지 않는다.

대안은 제품 media 거절을 유지하면서 API/source를 main에서 통제할 수 있는 별도 native capture 또는 runtime 변경을 검토하는 것이다. 이 대안은 현재 구현 재사용 범위보다 크며 이번 실제 캡처 완료를 보류한다. 이 절은 아래 fixture 전용 예외와 별개인 제품 정책이며, 아래의 production 이전 금지는 이 명시적 Windows 제품 범위에 한해서 대체한다.

## 승인된 선택과 적용 경계

**권장안은 고정된 local fixture에서 정상 `getDisplayMedia` → 기존 제품 main capture handler → 실제 stream → 실제 OCR 연결을 관측하도록 한정 허용하는 것이다.** 이는 통제된 fixture code를 신뢰하는 검증 예외다. 임의 renderer code의 모든 capture API를 main이 통제한다는 보장을 추가하지 않는다.

이 문서는 [PR #135의 명시적인 사용자 승인](https://github.com/blahaj94/ldb/pull/135#issuecomment-5578416858)과 사용자 merge `489e4aac61cffd0a6540c558e1e61a6361dd1036`를 반영한 active Rule이다. 구현·실행 범위는 [Issue #126의 재개 기록](https://github.com/blahaj94/ldb/issues/126#issuecomment-5578441165)을 따른다. 기존 승인 범위의 작업과 이 예외에 의존하는 변경을 구분하며 이후 변경은 [변경 승인 절차](change-control.md#approval-evidence)를 따른다.

기존 [Desktop 인증·capture 계약](desktop-auth.md#최소-화면과-capture-경계)과 [플랫폼의 기능 완료 기준](desktop-auth-platform.md#기능-완료와-배포-후-검증)는 유지한다. 이 제안의 예외는 아래 fixture의 media request에만 적용한다. Production 인증, credential 저장, provider/API, 검색, restore 종료 정책을 결정하거나 활성화하지 않는다.

## 필요한 이유와 확인한 한계

Electron **39.8.10**의 `RequestMediaAccessPermission`은 장치 camera/microphone에만 `mediaTypes`의 `video`/`audio`를 채운다. 정상 display capture와 legacy desktop `getUserMedia`는 모두 `media` 요청과 빈 배열을 사용할 수 있다. 허용 뒤 display 경로는 `ChooseDisplayMediaDevice`로 가지만 legacy 경로는 renderer가 요청한 source를 별도로 처리한다. 따라서 빈 배열은 정상 display API나 선택 source·gesture의 증거가 아니다. [공식 media 처리 source](https://raw.githubusercontent.com/electron/electron/v39.8.10/shell/browser/web_contents_permission_helper.cc)

공개 `MediaAccessPermissionRequest`에는 API 종류·source·gesture를 구별할 field가 없다. 그 정보로 legacy 경로를 확실히 차단한다고 주장하지 않는다. [공개 요청 구조](https://raw.githubusercontent.com/electron/electron/v39.8.10/docs/api/structures/media-access-permission-request.md)

Custom request/check handler가 없으면 media 요청과 검사가 기본 허용될 수 있다. 따라서 handler를 제거하는 방식은 검증 대안이 아니다. [공식 permission manager](https://raw.githubusercontent.com/electron/electron/v39.8.10/shell/browser/electron_permission_manager.cc)

## 권장안의 필수 조건

적용 범위는 `apps/desktop/scripts/auth-capture-fixture/**`와 그 전용 config·실행 command다. 기존 제품 module을 소비할 수 있지만 예외를 production entry/session으로 이전하지 않는다. 다음 조건을 모두 만족하는 이 전용 fixture에서만 적용한다.

- 전용 실행 entry와 격리된 임시 profile/session을 사용한다. 고정된 local document와 통제된 정적 asset만 읽으며 외부 content·network·navigation·popup을 차단한다. 전체 화면이나 다른 앱 대신 검증용 synthetic window만 정상 capture source로 선택한다.
- 실제 제품 auth core·IPC·bridge·feature preload·AuthPresentation·capture module을 연결한다. Auth effects는 빈 store에서 시작하는 memory-only synthetic 구현으로 한정한다. 실제 credential·Keychain·provider·API를 사용하지 않는다.
- `sandbox:true`, `contextIsolation:true`, `nodeIntegration:false`와 기존 CSP/webSecurity 경계를 유지한다. 범용 IPC나 Electron API를 renderer에 추가하지 않는다.
- Permission request는 등록된 `webContents`의 정확한 main frame·document와 main의 현재 `signedIn` 권한을 확인한다. `media` 중 **존재하는 빈 `mediaTypes` 배열**만 예외 후보이며, 배열 누락·잘못된 type·비어 있지 않은 배열과 camera/microphone 요청은 거절한다. 다른 permission을 포괄 허용하지 않는다.
- Permission check는 명시적으로 media 거절을 유지한다. Request의 `mediaTypes`와 check의 `mediaType`을 같은 정보로 취급하지 않는다. 정상 display 관측이 check 허용까지 요구한다면 이번 예외로 확대하지 않고 실패로 남겨 추가 결정을 요청한다.
- 기존 display handler의 sender·main frame·exact document·선택 source·Start gesture 검사와 시작/비동기 완료 직전의 main `signedIn`·auth 수명 검사를 보존한다. 인증 이탈과 재로그인 뒤에는 source 선택과 Start를 다시 요구한다.
- 인증 이탈·창 종료·fixture 실패 종료 때 stream track·OCR worker·loop·인식값과 main source 선택을 정리한다. 이전 비동기 결과가 새 auth/capture 수명을 복구하거나 늦은 OCR IPC를 보내지 못하게 한다. 이 조건은 기존 제품의 Stop·오류 후 재시도 동작을 재정의하지 않는다.
- Synthetic 영상·닉네임만 사용한다. 진단 evidence는 비민감 counter·상태·일치 여부로 남긴다. 실행 중 수집한 raw nickname·화면 이미지·source title/ID 원문을 진단 log나 PR에 노출하지 않는다. 검증용 window를 찾기 위해 사전에 고정한 synthetic 식별자를 code·Reference에 명시하는 것은 허용한다. Credential·개인정보는 기록하지 않는다. 임시 profile과 검증 process는 종료 후 정리한다.

이 조건은 fixture가 정상 API만 호출하도록 통제하는 운영 범위다. 동일 renderer에서 legacy desktop `getUserMedia`를 호출할 수 없다는 privileged 보안 경계가 아니다. 통제된 fixture가 legacy API를 호출하면 선택하지 않은 화면/window 또는 해당 platform이 지원하는 system audio로 범위가 넓어질 수 있으며, camera/microphone 거절은 이 경로의 차단 증거가 아니다. JavaScript monkeypatch나 fixture의 API 호출 규약을 그러한 경계로 인정하지 않는다. 인증 미구성 기본 제품 main의 media request/check 명시 거절은 유지하고 이 예외를 production session으로 옮기지 않는다.

## 검증과 evidence

아래는 승인 후 필요한 검증이며 현재 성공 evidence가 아니다. 실행 head·Electron/OS version·command·결과를 PR에 기록하고 mock, 실제 OCR 단독, 실제 stream/OCR 연결을 분리한다.

| 상황 | 필요한 결과·evidence |
| --- | --- |
| 미등록 창·subframe·다른 document·비signedIn 또는 auth 수명 변경 | Permission/display handler 단위 검증에서 허용 0. Source 열거·선택과 비동기 완료 경합도 기존 AC대로 검증 |
| 누락/잘못된/비어 있지 않은 `mediaTypes`, camera/microphone, media check | 명시 거절. 허용된 fixture request와 기본 제품의 전면 거절을 별도로 검증 |
| 정상 source 선택·Start | 실제 제품 display handler 호출과 통과를 관측한 뒤 synthetic window의 실제 stream frame을 실제 OCR worker에 전달. Track/frame·worker 관측과 합성 기대값 일치 여부를 기록 |
| source/gesture 없음·다른 source·잘못된 frame/document | 기존 display handler를 직접 검증해 거절 확인. 이 결과를 legacy API 우회 차단 증거로 해석하지 않음 |
| capture 중 인증 이탈·늦은 OCR·재로그인 | Track 종료, worker/loop·인식값·main source 정리, 늦은 IPC 0, 재로그인 후 자동 capture 0. 새 source 선택·Start 뒤에만 재시작 |
| Sandbox·asset·노출·종료 | 실제 preload/worker/WASM/asset 호환성, 외부 접근 차단과 synthetic canary 비노출, process/profile 정리를 확인 |

Stream 획득 실패, OCR 기대값 불일치, cleanup 실패 또는 필수 관측 누락은 **FAIL**로 남긴다. Synthetic canvas를 실제 OCR worker에 넣은 단독 성공이나 test double/auth-only fixture 성공으로 실제 stream/OCR 연결을 대체하지 않는다. 성공시키려고 기존 AC를 바꾸거나 skip하지 않는다. [Issue #126](https://github.com/blahaj94/ldb/issues/126)의 당시 검증은 이력으로 보존한다. 후속 변경은 [Testing](testing.md)의 영향 범위 검증과 [개발 흐름](agent-workflow.md#리뷰와-전달)의 위험에 맞는 검토를 적용하며, 매번 Desktop 전체 validation과 독립 review를 요구하지 않는다.

## 실질적인 대안과 남는 gate

**대안은 fixture도 media를 계속 거절하고, unit/auth UI·cleanup·실제 OCR asset 검증까지만 완료하는 것이다.** 권한 예외가 없지만 실제 media/OCR 연결 AC는 미완료로 남는다. API 종류·source·gesture를 신뢰할 수 있게 구별하는 runtime/API 또는 architecture 결정을 후속 승인한 뒤 결합 검증을 재개한다. Runtime 교체나 새 dependency는 이 대안의 자동 승인 사항이 아니다.

권장안이 승인되고 실제 관측이 성공해도 production의 모든 renderer capture 경로에 대한 source/gesture 통제는 미해결이다. 위 Windows 제품 정책은 이 한계를 수용한 별도 선택이다. 그 밖의 제품 media 허용에는 이 fixture 승인을 적용하지 않는다. OS 화면 기록 권한 실패를 우회하거나 권한 설정을 자동 변경하지 않으며 실행 불가로 기록한다. 실제 인증·저장·protocol·provider 및 package 실행은 [플랫폼의 배포 구성과 실행 조건](desktop-auth-platform.md#배포-구성과-실행-조건)을 따른다.
