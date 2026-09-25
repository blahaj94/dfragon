---
type: rule
status: active
scope: apps/ocr and OCR passkey callback
last-reviewed: 2026-09-25
---

# OCR 자료실

이번 요청은 별도 Linux 서버의 개인 OCR 자료 관리 API와 SPA, 기존 패스키 연결을 채택한다. 이 PR의 구현·검증에 적용하고 사용자 merge 후 다른 작업에도 적용한다. Desktop 수집 연결·자동 재시도·동기화 충돌·학습·데이터셋 버전 확정·자동 선별은 범위 밖이다. 운영 서버·계정·DNS 변경 성공을 코드 검증으로 대신하지 않는다.

## 원본과 정답

서버가 원천 데이터를 소유한다. 캡처 묶음마다 원본 PNG 한 장과 슬롯별 크롭 좌표·수집 종류·시각·원본 해상도·UI 배율 및 확인 출처를 저장한다. 크롭은 원본에서 요청 시 생성하며 원본·정답을 모델 결과로 덮어쓰지 않는다. UI 배율 미상과 추정·게임 설정 값을 구분하고 초기 선별 조건으로 강제하지 않는다. 선택하지 않은 영역을 detection 정답으로 간주하지 않는다.

SQLite 한 transaction으로 원본과 모든 샘플을 저장하며 부분 저장을 성공으로 반환하지 않는다. 같은 캡처 ID·같은 내용 재전송은 중복 저장하지 않고 다른 내용은 충돌로 알린다. 저장 한도를 넘으면 거절하고 기존 데이터를 자동 삭제하지 않는다. PNG bytes 합계 상한과 실제 디스크 사용량은 구분한다.

정답은 사람이 입력한다. 미작성 null, 제외 boolean과 원본을 보존한다. 빈 새 문자열은 정답으로 받지 않는다. 분할은 NFC 정규화한 정답 닉네임 단위로 관리하며 같은 닉네임의 샘플이 train/val/test에 나뉘지 않게 한다. 정답 수정으로 이미 배정된 분할이 달라지면 명시 확인을 받는다. 미작성은 미배정이다. 자동 비율 배정·학습 선별은 하지 않으며 내려받은 자료를 로컬에서 임의로 재분할한 결과까지 보장하지 않는다.

전체 다운로드는 시작 시 함께 읽은 정답·메타데이터·분할 목록과 변경되지 않는 원본·생성 크롭을 포함한다. 제외·미작성도 내려받을 수 있으며 영구 데이터셋 버전은 만들지 않는다.

## 패스키와 관리 권한

기존 인증 API의 RP ID·등록 패스키·계정을 유지한다. 선택 설정 `passkey.ocrReturnUrl`이 있을 때만 `clientId: ocr`를 받는다. 복귀는 서버 설정의 정확한 HTTPS `/auth/callback`이며 요청 입력으로 임의 URL을 받지 않는다. 기존 configuration fingerprint에 OCR client와 해당 주소를 추가로 묶어 Desktop/OCR 교환을 구분한다. Desktop fingerprint는 유지하며 같은 DB schema를 사용한다. 기존 challenge·cookie·QR·PKCE·일회용 code 검증은 그대로 적용한다.

OCR 서버가 verifier·기존 API token을 소유하고 HTTPS callback에서 요청별 쿠키와 PKCE로 code를 교환한다. 배포 설정의 계정 UUID와 일치한 계정만 OCR 세션을 발급한다. 첫 로그인 자동 관리자는 없다. 브라우저에는 HttpOnly·Secure·SameSite=Lax cookie만 제공하고 토큰을 localStorage에 저장하지 않는다. 변경 요청은 정확한 OCR Origin을 검사한다. 관리·업로드 권한은 동일하며 별도 역할·임시 업로드 키는 만들지 않는다.

OCR 세션은 메모리에서 최대 8시간 유지하고 process 재시작 시 사라진다. 인증 API에서 기존 세션의 활성 상태를 확인하며 만료된 access token은 단일 refresh로 갱신한다. 로그아웃은 OCR 접근을 먼저 제거한 뒤 기존 세션 종료를 요청한다. 공유 PC 자체의 침해나 강제 종료 때 upstream 세션이 즉시 폐기되는 것까지 보장하지 않는다.

## 구현과 검증

독립 Node 24·NestJS process가 API·React SPA를 같은 origin으로 제공하고 SQLite에 원본 BLOB·메타데이터·분할을 저장한다. 기존 API와 HTTP로 통신하며 app source 사이를 직접 import하지 않는다. 배포는 기존 HTTPS reverse proxy와 별도 영속 디렉터리를 사용한다. 명령·입력·한계는 [앱 안내](../../apps/ocr/README.md), 실행은 [배포 안내](../../deploy/ocr/README.md)를 따른다.

인증 client 혼동·비허용 계정·요청 cookie/Origin, 업로드 원자성·재시도·잘못된 PNG·좌표·용량, 정답 수정·분할과 export 내용을 검증한다. UI의 합성 인증 fixture 성공과 실제 패스키/운영 HTTPS 성공은 구분한다. 기존 API의 DB·가상 WebAuthn 검증에는 OCR HTTPS 복귀와 client binding을 포함한다.
