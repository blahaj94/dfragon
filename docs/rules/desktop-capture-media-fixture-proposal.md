---
type: rule
status: active
enforcement: approval-required
scope: Windows native product capture and legacy isolated media fixture
last-reviewed: 2026-10-08
rationale: 고정된 검증 화면에서 실제 media와 OCR 연결을 관측하되 Electron 권한 정보의 한계를 제품 보안 보장과 구분한다.
evidence: "PR #135 사용자 승인: https://github.com/blahaj94/ldb/pull/135#issuecomment-5578416858 ; 사용자 merge: 489e4aac61cffd0a6540c558e1e61a6361dd1036 ; Issue #126 판단: https://github.com/blahaj94/ldb/issues/126#issuecomment-5572323933 ; Electron 39.8.10 공식 source"
exceptions: Fixture 승인은 해당 fixture에만 적용한다. Windows 제품 정책은 아래 별도 사용자 선택과 PR 범위를 따른다.
review-after: 최초 실제 media/OCR 관측 후 또는 Electron version, fixture 문서, 권한 경계 변경 전
---

# Desktop capture media 권한과 격리 검증

## Windows 제품 캡처 정책

개발자 모드에서 검증한 화면 획득 구현을 공통 lib로 옮겨 일반 캡처에서도 사용하는 변경이다. 본 PR의 사용자 merge 후 제품 경계로 적용하며, 이전 Electron 영상 스트림 경로는 제품에서 사용하지 않는다.

- `backend/lib/win32-window-capture.ts`가 실제 화면에 보이는 창의 클라이언트 영역을 GDI로 복사하고 DPI와 네이티브 자원을 정리한다. 개발자 수집의 영역 검출과 저장, 일반 캡처의 주기와 OCR은 각 기능에 남긴다.
- Main은 창 목록에 있는 선택을 확인한 뒤 창 핸들과 프로세스를 결합한다. 같은 핸들이 다른 프로세스에 재사용되면 읽지 않는다. Renderer는 임의 좌표나 창 핸들 대신 현재 `captureId`만 `readCaptureFrame`으로 전달한다.
- 각 프레임 요청은 등록된 main window, exact document, 현재 source와 capture 수명을 확인한다. 읽기 완료 후에도 다시 확인하고 중지, source 변경, navigation 또는 창 종료 뒤의 응답은 전달하지 않는다. 로그인과 무관하게 동작한다.
- 일반 캡처는 다른 창에 가려진 픽셀을 투명하게 제외하고 보이는 파티 영역의 인식을 이어간다. 창 전체가 가려졌거나 최소화, 종료, 이동 중인 경우 원본 픽셀을 전달하지 않고 대기한다. 캡처 전후의 위치와 소유 프로세스, 가림 여부를 확인한다. 아직 검색하지 않은 슬롯은 화면이 돌아오면 인식을 이어가며 이미 완료한 결과는 Alt+R 전까지 유지한다. 가려진 창이나 최소화된 창의 백그라운드 캡처는 제공하지 않는다.
- 원본 크기와 RGBA를 유지하고 한 변 8192px, 총 33,000,000픽셀 상한을 적용한다. Preload도 크기와 바이트 수를 검증한다. 테스트 빌드의 OCR 회차와 Alt+Print Screen 수집은 아래 별도 업로드 정책을 따른다.
- 제품은 모든 Electron media request와 permission check를 거절한다. `getDisplayMedia`의 gesture나 스트림 권한을 정상 캡처의 전제 조건으로 사용하지 않는다. Windows 외 환경은 미지원 안내를 반환한다.

기존 Windows media 허용은 [PR #462](https://github.com/blahaj94/ldb/pull/462)의 사용자 merge로 채택했던 결정이다. 그 구현의 로그인 독립성, 원문 비노출과 캡처 수명 보호는 유지하며, 화면 획득과 권한 경로만 위의 공통 네이티브 구현으로 대체한다. 아래 media 관련 승인과 한계는 기존 격리 fixture의 이력과 범위로 유지한다.

## 테스트 버전 자동 캡처와 자료 수집

[Issue #595](https://github.com/blahaj94/dfragon/issues/595)의 변경은 구현 PR의 사용자 merge 후 적용한다. Windows 배포 실행 파일은 시작할 때 관리자 권한을 요청한다. 사용자가 UAC를 거절하면 실행하지 못하며, 캡처를 사용하지 않아도 이 권한이 필요하다. 실행 중 우회 승격이나 OS 보안 설정 변경은 수행하지 않는다.

앱 시작 시 또는 이후 던파 창이 하나만 감지되면 자동으로 선택해 캡처한다. Alt+R은 전체 검색 회차를 새로 시작하고 Alt+Print Screen은 새 원본과 검출된 파티원 슬롯을 확인창 없이 수집한다. 두 단축키는 던파 또는 해당 DFragon 프로세스가 전경일 때만 동작하며 다른 앱의 입력은 가로채지 않는다. 개발자 수집의 일반 Print Screen과 중복 처리하지 않는다.

테스트 빌드는 OCR을 실행하는 회차마다 검출된 슬롯을 한 번 수집한다. 안정화 반복과 수동 서버, 닉네임 조회는 중복 업로드하지 않는다. Main이 보관한 실제 원본과 검출 좌표를 사용하고 renderer의 임의 경로, URL이나 원본 이미지 제출을 허용하지 않는다. 업로드 실패는 검색을 중단하지 않는다. 닉네임 학습 크롭과 얼굴을 포함한 전체 슬롯 문맥을 함께 보관하고 OCR 예측은 미검수 메타데이터로만 취급한다.

비로그인 수집은 [OCR 자료실](ocr-workspace.md)의 별도 테스트 수집 경로로 제한하며 기존 자료 조회와 관리 권한은 유지한다. 배포 설정을 통한 수집 활성화와 실제 운영 업로드는 코드 검증과 구분한다. 안정 버전에는 테스트용 자동 업로드를 활성화하지 않는다.

## 이전 media fixture의 위치

`auth-capture-fixture.config.ts`는 전용 renderer에서만 `legacy-capture-session.ts`를 연결하고 main에서 `registerCaptureMediaForFixture`를 명시적으로 호출한다. 제품 번들에는 이 renderer 대체 설정을 적용하지 않는다. 해당 fixture의 영상 스트림 성공은 새 Windows GDI 캡처 성공으로 보고하지 않는다. 새 제품의 실제 외부 창과 게임 캡처 검증은 Windows에서 별도로 수행한다.

## 승인된 선택과 적용 경계

**권장안은 고정된 local fixture에서 정상 `getDisplayMedia` → 기존 제품 main capture handler → 실제 stream → 실제 OCR 연결을 관측하도록 한정 허용하는 것이다.** 이는 통제된 fixture code를 신뢰하는 검증 예외다. 임의 renderer code의 모든 capture API를 main이 통제한다는 보장을 추가하지 않는다.

이 문서는 [PR #135의 명시적인 사용자 승인](https://github.com/blahaj94/ldb/pull/135#issuecomment-5578416858)과 사용자 merge `489e4aac61cffd0a6540c558e1e61a6361dd1036`를 반영한 active Rule이다. 구현, 실행 범위는 [Issue #126의 재개 기록](https://github.com/blahaj94/ldb/issues/126#issuecomment-5578441165)을 따른다. 기존 승인 범위의 작업과 이 예외에 의존하는 변경을 구분하며 이후 변경은 [제품 계약 적용 기준](../README.md#document-class)을 따른다.

기존 [Desktop 인증, capture 계약](desktop-auth.md#최소-화면과-capture-경계)과 [플랫폼의 기능 완료 기준](desktop-auth-platform.md#기능-완료와-배포-후-검증)는 유지한다. 이 제안의 예외는 아래 fixture의 media request에만 적용한다. Production 인증, credential 저장, provider/API, 검색, restore 종료 정책을 결정하거나 활성화하지 않는다.

## 필요한 이유와 확인한 한계

Electron **39.8.10**의 `RequestMediaAccessPermission`은 장치 camera/microphone에만 `mediaTypes`의 `video`/`audio`를 채운다. 정상 display capture와 legacy desktop `getUserMedia`는 모두 `media` 요청과 빈 배열을 사용할 수 있다. 허용 뒤 display 경로는 `ChooseDisplayMediaDevice`로 가지만 legacy 경로는 renderer가 요청한 source를 별도로 처리한다. 따라서 빈 배열은 정상 display API나 선택 source, gesture의 증거가 아니다. [공식 media 처리 source](https://raw.githubusercontent.com/electron/electron/v39.8.10/shell/browser/web_contents_permission_helper.cc)

공개 `MediaAccessPermissionRequest`에는 API 종류, source, gesture를 구별할 field가 없다. 그 정보로 legacy 경로를 확실히 차단한다고 주장하지 않는다. [공개 요청 구조](https://raw.githubusercontent.com/electron/electron/v39.8.10/docs/api/structures/media-access-permission-request.md)

Custom request/check handler가 없으면 media 요청과 검사가 기본 허용될 수 있다. 따라서 handler를 제거하는 방식은 검증 대안이 아니다. [공식 permission manager](https://raw.githubusercontent.com/electron/electron/v39.8.10/shell/browser/electron_permission_manager.cc)

## 권장안의 필수 조건

적용 범위는 `apps/desktop/scripts/auth-capture-fixture/**`와 그 전용 config, 실행 command다. 기존 제품 module을 소비할 수 있지만 예외를 production entry/session으로 이전하지 않는다. 다음 조건을 모두 만족하는 이 전용 fixture에서만 적용한다.

- 전용 실행 entry와 격리된 임시 profile/session을 사용한다. 고정된 local document와 통제된 정적 asset만 읽으며 외부 content, network, navigation, popup을 차단한다. 전체 화면이나 다른 앱 대신 검증용 synthetic window만 정상 capture source로 선택한다.
- 실제 제품 auth core, IPC, bridge, feature preload, AuthPresentation, capture module을 연결한다. Auth effects는 빈 store에서 시작하는 memory-only synthetic 구현으로 한정한다. 실제 credential, Keychain, provider, API를 사용하지 않는다.
- `sandbox:true`, `contextIsolation:true`, `nodeIntegration:false`와 기존 CSP/webSecurity 경계를 유지한다. 범용 IPC나 Electron API를 renderer에 추가하지 않는다.
- Permission request는 등록된 `webContents`의 정확한 main frame, document를 확인한다. 로그인은 필요하지 않다. `media` 중 **존재하는 빈 `mediaTypes` 배열**만 예외 후보이며, 배열 누락, 잘못된 type, 비어 있지 않은 배열과 camera/microphone 요청은 거절한다. 다른 permission을 포괄 허용하지 않는다.
- Permission check는 명시적으로 media 거절을 유지한다. Request의 `mediaTypes`와 check의 `mediaType`을 같은 정보로 취급하지 않는다. 정상 display 관측이 check 허용까지 요구한다면 이번 예외로 확대하지 않고 실패로 남겨 추가 결정을 요청한다.
- 기존 display handler의 sender, main frame, exact document, 선택 source, Start gesture 검사와 시작/비동기 완료 직전의 source, document, capture 수명 검사를 보존한다. 로그인, 로그아웃으로 source 선택과 Start를 다시 요구하지 않는다.
- Stop, 창 종료, fixture 실패 종료 때 stream track, OCR worker, loop, 인식값과 main source 선택을 정리한다. 이전 비동기 결과가 새 capture 수명을 복구하거나 늦은 OCR IPC를 보내지 못하게 한다. 이 조건은 기존 제품의 Stop, 오류 후 재시도 동작을 재정의하지 않는다.
- Synthetic 영상, 닉네임만 사용한다. 진단 evidence는 비민감 counter, 상태, 일치 여부로 남긴다. 실행 중 수집한 raw nickname, 화면 이미지, source title/ID 원문을 진단 log나 PR에 노출하지 않는다. 검증용 window를 찾기 위해 사전에 고정한 synthetic 식별자를 code, Reference에 명시하는 것은 허용한다. Credential, 개인정보는 기록하지 않는다. 임시 profile과 검증 process는 종료 후 정리한다.

이 조건은 fixture가 정상 API만 호출하도록 통제하는 운영 범위다. 동일 renderer에서 legacy desktop `getUserMedia`를 호출할 수 없다는 privileged 보안 경계가 아니다. 통제된 fixture가 legacy API를 호출하면 선택하지 않은 화면/window 또는 해당 platform이 지원하는 system audio로 범위가 넓어질 수 있으며, camera/microphone 거절은 이 경로의 차단 증거가 아니다. JavaScript monkeypatch나 fixture의 API 호출 규약을 그러한 경계로 인정하지 않는다. 이 fixture 예외를 production session으로 옮기지 않는다. Windows 제품의 로그인과 독립적인 허용 범위는 위 별도 정책을 따른다.

## 검증과 evidence

아래는 승인 후 필요한 검증이며 현재 성공 evidence가 아니다. 실행 head, Electron/OS version, command, 결과를 PR에 기록하고 mock, 실제 OCR 단독, 실제 stream/OCR 연결을 분리한다.

| 상황                                                                    | 필요한 결과, evidence                                                                                                                                                    |
| ----------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 미등록 창, subframe, 다른 document, 끝난 capture 수명                      | Permission/display handler 단위 검증에서 허용 0. Source 열거, 선택과 비동기 완료 경합도 기존 AC대로 검증                                                                 |
| 누락/잘못된/비어 있지 않은 `mediaTypes`, camera/microphone, media check | 명시 거절. 허용된 fixture request와 기본 제품의 전면 거절을 별도로 검증                                                                                                 |
| 정상 source 선택, Start                                                  | 실제 제품 display handler 호출과 통과를 관측한 뒤 synthetic window의 실제 stream frame을 실제 OCR worker에 전달. Track/frame, worker 관측과 합성 기대값 일치 여부를 기록 |
| source/gesture 없음, 다른 source, 잘못된 frame/document                   | 기존 display handler를 직접 검증해 거절 확인. 이 결과를 legacy API 우회 차단 증거로 해석하지 않음                                                                       |
| capture 중 로그인, 로그아웃, Stop                                         | 로그인 변경 중 capture 유지. Stop 뒤 track, worker, loop, 인식값 정리와 늦은 IPC 차단                                                                                      |
| Sandbox, asset, 노출, 종료                                                 | 실제 preload/worker/WASM/asset 호환성, 외부 접근 차단과 synthetic canary 비노출, process/profile 정리를 확인                                                            |

Stream 획득 실패, OCR 기대값 불일치, cleanup 실패 또는 필수 관측 누락은 **FAIL**로 남긴다. Synthetic canvas를 실제 OCR worker에 넣은 단독 성공이나 test double/auth-only fixture 성공으로 실제 stream/OCR 연결을 대체하지 않는다. 성공시키려고 기존 AC를 바꾸거나 skip하지 않는다. [Issue #126](https://github.com/blahaj94/ldb/issues/126)의 당시 검증은 이력으로 보존한다. 후속 변경은 실제 영향 범위의 검증과 위험에 맞는 검토를 적용하며, 매번 Desktop 전체 validation과 독립 review를 요구하지 않는다. 현재 검증 명령은 [scripts 안내](../../scripts/README.md#native-validation)에서 확인한다.

## 실질적인 대안과 남는 gate

**대안은 fixture도 media를 계속 거절하고, unit/auth UI, cleanup, 실제 OCR asset 검증까지만 완료하는 것이다.** 권한 예외가 없지만 실제 media/OCR 연결 AC는 미완료로 남는다. API 종류, source, gesture를 신뢰할 수 있게 구별하는 runtime/API 또는 architecture 결정을 후속 승인한 뒤 결합 검증을 재개한다. Runtime 교체나 새 dependency는 이 대안의 자동 승인 사항이 아니다.

권장안이 승인되고 실제 관측이 성공해도 production의 모든 renderer capture 경로에 대한 source/gesture 통제는 미해결이다. 위 Windows 제품 정책은 이 한계를 수용한 별도 선택이다. 그 밖의 제품 media 허용에는 이 fixture 승인을 적용하지 않는다. OS 화면 기록 권한 실패를 우회하거나 권한 설정을 자동 변경하지 않으며 실행 불가로 기록한다. 실제 인증, 저장, protocol, provider 및 package 실행은 [플랫폼의 배포 구성과 실행 조건](desktop-auth-platform.md#배포-구성과-실행-조건)을 따른다.
