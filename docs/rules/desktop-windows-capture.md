---
type: rule
status: active
enforcement: approval-required
scope: Windows native product capture
last-reviewed: 2026-10-10
rationale: 제품 캡처는 main이 검증한 Windows 창의 보이는 영역만 네이티브로 읽고, API 종류와 source를 구별할 수 없는 Electron media 권한은 허용하지 않는다.
evidence: "Windows 네이티브 캡처: PR #594 사용자 merge 8c057727 ; 테스트 버전 자동 캡처와 수집: Issue #595, PR #596 사용자 merge 8e12cc35 ; 이전 Windows media 허용: PR #462 ; Electron 44.7.0 교체 재확인: Issue #618, v44.7.0 공식 source ; 격리 media fixture와 그 권한 예외(PR #135 승인, merge 489e4aac, Issue #126)는 2026-10-10 사용자 요청으로 fixture와 함께 폐기"
exceptions: 없음. 테스트 빌드의 자동 수집은 아래 별도 절과 배포 설정을 따른다.
review-after: Electron version, 화면 획득 방식 또는 권한 경계 변경 전
---

# Desktop Windows 캡처 정책

## Windows 제품 캡처 정책

개발자 모드에서 검증한 화면 획득 구현을 공통 lib로 옮겨 일반 캡처에서도 사용하는 변경이다. 본 PR의 사용자 merge 후 제품 경계로 적용하며, 이전 Electron 영상 스트림 경로는 제품에서 사용하지 않는다.

- `backend/lib/win32-window-capture.ts`가 실제 화면에 보이는 창의 클라이언트 영역을 GDI로 복사하고 DPI와 네이티브 자원을 정리한다. 개발자 수집의 영역 검출과 저장, 일반 캡처의 주기와 OCR은 각 기능에 남긴다.
- Main은 창 목록에 있는 선택을 확인한 뒤 창 핸들과 프로세스를 결합한다. 같은 핸들이 다른 프로세스에 재사용되면 읽지 않는다. Renderer는 임의 좌표나 창 핸들 대신 현재 `captureId`만 `readCaptureFrame`으로 전달한다.
- 각 프레임 요청은 등록된 main window, exact document, 현재 source와 capture 수명을 확인한다. 읽기 완료 후에도 다시 확인하고 중지, source 변경, navigation 또는 창 종료 뒤의 응답은 전달하지 않는다. 로그인과 무관하게 동작한다.
- 일반 캡처는 다른 창에 가려진 픽셀을 투명하게 제외하고 보이는 파티 영역의 인식을 이어간다. 창 전체가 가려졌거나 최소화, 종료, 이동 중인 경우 원본 픽셀을 전달하지 않고 대기한다. 캡처 전후의 위치와 소유 프로세스, 가림 여부를 확인한다. 아직 검색하지 않은 슬롯은 화면이 돌아오면 인식을 이어가며 이미 완료한 결과는 Alt+R 전까지 유지한다. 가려진 창이나 최소화된 창의 백그라운드 캡처는 제공하지 않는다.
- 원본 크기와 RGBA를 유지하고 한 변 8192px, 총 33,000,000픽셀 상한을 적용한다. Preload도 크기와 바이트 수를 검증한다. 테스트 빌드의 OCR 회차와 Alt+Print Screen 수집은 아래 별도 업로드 정책을 따른다.
- 제품은 모든 Electron media request와 permission check를 거절한다. `getDisplayMedia`의 gesture나 스트림 권한을 정상 캡처의 전제 조건으로 사용하지 않는다. Windows 외 환경은 미지원 안내를 반환한다.

기존 Windows media 허용은 [PR #462](https://github.com/blahaj94/ldb/pull/462)의 사용자 merge로 채택했던 결정이다. 그 구현의 로그인 독립성, 원문 비노출과 캡처 수명 보호는 유지하며, 화면 획득과 권한 경로만 위의 공통 네이티브 구현으로 대체한다.

## 테스트 버전 자동 캡처와 자료 수집

[Issue #595](https://github.com/blahaj94/dfragon/issues/595)의 변경은 구현 PR의 사용자 merge 후 적용한다. Windows 배포 실행 파일은 시작할 때 관리자 권한을 요청한다. 사용자가 UAC를 거절하면 실행하지 못하며, 캡처를 사용하지 않아도 이 권한이 필요하다. 실행 중 우회 승격이나 OS 보안 설정 변경은 수행하지 않는다.

앱 시작 시 또는 이후 던파 창이 하나만 감지되면 자동으로 선택해 캡처한다. Alt+R은 전체 검색 회차를 새로 시작하고 Alt+Print Screen은 새 원본과 검출된 파티원 슬롯을 확인창 없이 수집한다. 두 단축키는 던파 또는 해당 DFragon 프로세스가 전경일 때만 동작하며 다른 앱의 입력은 가로채지 않는다. 개발자 수집의 일반 Print Screen과 중복 처리하지 않는다.

테스트 빌드는 OCR을 실행하는 회차마다 검출된 슬롯을 한 번 수집한다. 안정화 반복과 수동 서버, 닉네임 조회는 중복 업로드하지 않는다. Main이 보관한 실제 원본과 검출 좌표를 사용하고 renderer의 임의 경로, URL이나 원본 이미지 제출을 허용하지 않는다. 업로드 실패는 검색을 중단하지 않는다. 닉네임 학습 크롭과 얼굴을 포함한 전체 슬롯 문맥을 함께 보관하고 OCR 예측은 미검수 메타데이터로만 취급한다.

비로그인 수집은 [OCR 자료실](ocr-workspace.md)의 별도 테스트 수집 경로로 제한하며 기존 자료 조회와 관리 권한은 유지한다. 배포 설정을 통한 수집 활성화와 실제 운영 업로드는 코드 검증과 구분한다. 안정 버전에는 테스트용 자동 업로드를 활성화하지 않는다.

## Electron media 권한의 한계

Electron **44.7.0**의 `RequestMediaAccessPermission`은 장치 camera/microphone에만 `mediaTypes`의 `video`/`audio`를 채운다. 정상 display capture와 legacy desktop `getUserMedia`는 모두 `media` 요청과 빈 배열을 사용할 수 있다. 허용 뒤 display 경로는 `ChooseDisplayMediaDevice`로 가지만 legacy 경로는 renderer가 요청한 source를 별도로 처리한다. 따라서 빈 배열은 정상 display API나 선택 source, gesture의 증거가 아니다. [공식 media 처리 source](https://raw.githubusercontent.com/electron/electron/v44.7.0/shell/browser/web_contents_permission_helper.cc)

공개 `MediaAccessPermissionRequest`에는 API 종류, source, gesture를 구별할 field가 없다. 그 정보로 legacy 경로를 확실히 차단한다고 주장하지 않는다. [공개 요청 구조](https://raw.githubusercontent.com/electron/electron/v44.7.0/docs/api/structures/media-access-permission-request.md)

Custom request/check handler가 없으면 media 요청과 검사가 기본 허용될 수 있다. 따라서 제품은 handler를 제거하지 않고 명시적으로 거절한다. [공식 permission manager](https://raw.githubusercontent.com/electron/electron/v44.7.0/shell/browser/electron_permission_manager.cc)
