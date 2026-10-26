---
type: rule
status: active
enforcement: approval-required
scope: Windows native product capture
last-reviewed: 2026-10-26
rationale: 제품 캡처는 main이 검증한 Windows 창의 보이는 영역만 네이티브로 읽고, API 종류와 source를 구별할 수 없는 Electron media 권한은 허용하지 않는다.
evidence: "Windows 네이티브 캡처: PR #594 merge ; 공대 캡처: 2026-10-19 사용자 요청 ; 자동 창 등록: Issue #595, PR #596 merge ; 수집 업로드와 개발자 도구 제거: Issue #796 ; 2026-10-21 현재 Electron 공식 source 재확인 ; 격리 media fixture와 그 권한 예외는 2026-10-10 사용자 요청으로 폐기"
exceptions: 없음.
review-after: Electron version, 화면 획득 방식 또는 권한 경계 변경 전
---

# Desktop Windows 캡처 정책

## Windows 제품 캡처 정책

일반 캡처는 공통 lib의 화면 획득 구현을 사용하며, Electron 영상 스트림 경로는 제품에서 사용하지 않는다.

- `backend/lib/win32-window-capture.ts`가 실제 화면에 보이는 창의 클라이언트 영역을 GDI로 복사하고 DPI와 네이티브 자원을 정리한다. 일반 캡처의 회차 진행과 OCR은 각 기능에 남긴다.
- Main은 창 목록에 있는 선택을 확인한 뒤 창 핸들과 프로세스를 결합한다. 같은 핸들이 다른 프로세스에 재사용되면 읽지 않는다. Renderer는 임의 좌표나 창 핸들 대신 현재 `captureId`만 `readCaptureFrame`으로 전달한다.
- 각 프레임 요청은 등록된 main window, exact document, 현재 source와 capture 수명을 확인한다. 읽기 완료 후에도 다시 확인하고 중지, source 변경, navigation 또는 창 종료 뒤의 응답은 전달하지 않는다.
- 회차는 Alt+R 또는 파티 머리의 캡처 버튼 한 번으로 네 파티 슬롯을 인식하고 검색하는 한 번의 실행이다. 이전 회차의 검색, 인식 상태를 비우고 검색 수명을 시작한 뒤 게임 창 프레임을 한 장만 읽어 보관한다. 네 슬롯의 닉네임, 얼굴 크롭, OCR과 얼굴 비교 검색은 모두 이 회차 프레임을 사용한다. 회차 처리가 끝나면 다음 회차 시작, 창 변경, 중지 전까지 일반 인식용 프레임을 더 읽지 않는다. 검색 결과, 재시도와 수동 조회는 회차의 입력과 결과를 유지하며 새 프레임 읽기를 일으키지 않는다.
- 공대 화면의 회차는 Alt+R 또는 공대 머리의 캡처 버튼 한 번으로 12행 공대 상세 창의 공대원 이름을 인식하고 공대 12자리를 조회하는 한 번의 실행이다. 2026-10-19 사용자 요청으로 채택했다. 이전 공대 자리의 검색, 인식 상태를 비우고 공대 검색 수명을 시작한 뒤 같은 선택 창의 프레임을 한 장만 읽는다. Main은 그 프레임에서 공대원창 검출로 창을 찾아 12행의 닉네임, 직업명 원본 크롭과 수치 칸 표기, 수치 열 종류(명성, 장비 점수, 모름)를 renderer에 전달하고 프레임 원본은 보내지 않는다. 화면의 1~12행을 그대로 공대 1~12번 자리(1파티 1~4, 2파티 5~8, 3파티 9~12)에 두며 R/Y/G, 싱글 표식으로 자리를 다시 배치하지 않는다(2026-10-19 사용자 결정). 공대 상세 창에는 서버와 얼굴이 없으므로 각 이름은 얼굴 비교 없이 같은 이름의 후보를 찾고, 2026-10-20 [#760](https://github.com/blahaj94/dfragon/issues/760) 결정에 따라 renderer가 읽은 그 행의 직업명과 main이 읽은 수치로 후보를 고른다. 선택 규칙은 [공대 식별 흐름](character-search.md#desktop의-공대-식별-흐름)을 따르고, 직업과 수치를 확인하지 못하면 그룹 안 최고 명성 후보를 대체 표시한다. 수치 칸은 FHD 이하 프레임에서만 읽고, 더 큰 프레임은 수치 없이 직업명만 쓴다. 직업명 칸만 가려진 행은 직업명 없이 처리한다. 공대 상세 창 미검출, 모호한 후보, 공대원 이름 미검출, 가림과 읽기 실패는 안내 후 그 회차를 끝내고 다시 읽지 않는다. 가려진 행만 비워 두고 나머지 행은 같은 프레임으로 처리한다.
- 일반 캡처는 다른 창에 가려진 픽셀을 투명하게 제외한다. 창 전체가 가려졌거나 최소화, 종료, 이동 중인 경우 원본 픽셀을 전달하지 않는다. 캡처 전후의 위치와 소유 프로세스, 가림 여부를 확인한다. 회차 프레임을 쓸 수 없거나 파티 프레임을 검출하지 못하면 안내를 표시하고 해당 회차의 인식을 끝낸다. 다시 읽거나 화면이 돌아오기를 기다리지 않으며 사용자가 Alt+R이나 캡처 버튼으로 새 회차를 시작한다. 일부 슬롯만 미검출이면 그 슬롯은 비워 두고 검색하지 않으며 나머지 슬롯은 같은 회차 프레임으로 처리한다. 가려진 창이나 최소화된 창의 백그라운드 캡처는 제공하지 않는다.
- 원본 크기와 RGBA를 유지하고 한 변 8192px, 총 33,000,000픽셀 상한을 적용한다. Preload도 크기와 바이트 수를 검증한다.
- 제품은 모든 Electron media request와 permission check를 거절한다. `getDisplayMedia`의 gesture나 스트림 권한을 정상 캡처의 전제 조건으로 사용하지 않는다. Windows 외 환경은 미지원 안내를 반환한다.

원문 비노출과 캡처 수명 보호는 이전 Windows media 경로와 같게 유지한다.

## 자동 창 등록과 회차 시작

Windows 배포 실행 파일은 시작할 때 관리자 권한을 요청한다. 사용자가 UAC를 거절하면 실행하지 못하며, 캡처를 사용하지 않아도 이 권한이 필요하다. 실행 중 우회 승격이나 OS 보안 설정 변경은 수행하지 않는다.

앱 시작 시 또는 이후 던파 창이 하나만 감지되면 main에 자동으로 등록한다. 상단 바의 게임 연결 상태 칩이 여는 캡처 모달에서 직접 선택할 때도 창만 등록하며 인식은 시작하지 않는다. 회차는 Alt+R 또는 파티 머리의 캡처 버튼으로 시작한다. 두 입력은 같은 회차 시작 요청을 renderer의 캡처 상태로 보내므로 받는 상태, 거절, 상태 문구와 결과가 같다. 캡처 버튼은 Alt+R이 회차를 시작할 수 없는 상태(창 등록 전, 창 등록 중, 등록 실패, 검색 수명 시작 중, 중지 뒤)에서 누를 수 없지만, 이 비활성화가 실행 조건을 대신하지 않으며 캡처 상태와 main의 검색 수명, 프레임 요청 검증이 그대로 판단한다. 버튼은 새 IPC를 쓰지 않는다. 진행 중이나 완료 뒤의 회차 시작은 이전 회차를 정리하고 처음부터 새 회차를 시작하며 늦은 이전 결과를 반영하지 않는다. 검색 수명을 시작하는 동안 누른 Alt+R과 캡처 버튼은 무시한다. 창 변경은 진행 중 회차와 검색 수명을 정리하고 새 창만 등록한다. 중지한 뒤에는 Alt+R이나 캡처 버튼으로 다시 시작하지 않으며 창을 다시 고른 뒤 시작해야 한다.

Alt+R은 보이는 화면의 회차만 시작한다. 파티 화면에서는 파티 회차, 공대 화면에서는 공대 회차를 시작하며 공대 머리의 캡처 버튼도 Alt+R과 같은 공대 회차 시작 요청을 보낸다. 받는 상태와 거절, 진행 중 재시작, 검색 수명을 시작하는 동안의 무시는 파티 회차와 같다. 두 화면의 회차는 서로 다른 검색 수명을 쓰므로 화면을 옮겨도 늦게 끝난 회차는 자기 화면의 자리에만 반영된다. 공대 회차는 파티 캡처의 창 등록을 함께 쓴다. 창 등록 전, 등록 중, 등록 실패와 중지 뒤에는 시작하지 않으며, 창이 바뀌거나 중지되면 진행 중 공대 회차를 끝내고 늦은 결과를 반영하지 않는다. Main도 그 회차의 OCR 이름 통지를 거절하고 진행 중인 OCR 기원 조회를 취소한다. 이미 마친 공대 자리와 사용자가 직접 조회한 자리는 유지한다. Main은 공대 프레임 요청마다 공대 수명을 시작할 때의 창 선택과 지금의 선택, 등록 문서가 같은지 읽기 전과 뒤에 확인한다. 공대 캡처 버튼의 비활성화도 이 검증을 대신하지 않는다.

Desktop은 OCR 자료를 수집하거나 업로드하지 않는다. Alt+Print Screen 수집 단축키와 테스트 빌드의 회차별 자동 수집은 2026-10-26에 지웠다([Issue #796](https://github.com/blahaj94/dfragon/issues/796)).

## Electron media 권한의 한계

Electron **44.7.2**의 `RequestMediaAccessPermission`은 장치 camera/microphone에만 `mediaTypes`의 `video`/`audio`를 채운다. 정상 display capture와 legacy desktop `getUserMedia`는 모두 `media` 요청과 빈 배열을 사용할 수 있다. 허용 뒤 display 경로는 `ChooseDisplayMediaDevice`로 가지만 legacy 경로는 renderer가 요청한 source를 별도로 처리한다. 따라서 빈 배열은 정상 display API나 선택 source, gesture의 증거가 아니다. [공식 media 처리 source](https://raw.githubusercontent.com/electron/electron/v44.7.2/shell/browser/web_contents_permission_helper.cc)

공개 `MediaAccessPermissionRequest`에는 API 종류, source, gesture를 구별할 field가 없다. 그 정보로 legacy 경로를 확실히 차단한다고 주장하지 않는다. [공개 요청 구조](https://raw.githubusercontent.com/electron/electron/v44.7.2/docs/api/structures/media-access-permission-request.md)

Custom request/check handler가 없으면 media 요청과 검사가 기본 허용될 수 있다. 따라서 제품은 handler를 제거하지 않고 명시적으로 거절한다. [공식 permission manager](https://raw.githubusercontent.com/electron/electron/v44.7.2/shell/browser/electron_permission_manager.cc)
