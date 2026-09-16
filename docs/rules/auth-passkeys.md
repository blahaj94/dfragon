---
type: rule
status: active
scope: API and Desktop passkey authentication
last-reviewed: 2026-09-16
---

# 패스키 인증

가입·로그인은 패스키 전용이다. 기존 실사용 계정 이관은 없으며 이메일·비밀번호·전화번호·별도 계정 복구를 제공하지 않는다. 이 PR의 구현·검증에 적용하고 사용자 merge 후 활성화한다. 아래 규칙이 인증·회원 식별·설정·재인증의 기준이다. 세션·refresh·JWT·검색 활동 정책은 기존 계약을 유지한다. 관련 문서도 이 계약에 맞춘 패스키 경계를 따른다.

## 가입과 로그인

- 내부 random UUID로 회원을 식별한다. 사용자는 로그인용 아이디를 입력하지 않는다. 닉네임 초기 생성과 수정 규칙은 유지한다.
- WebAuthn discoverable credential을 등록한다. `residentKey: required`, `userVerification: required`, attestation `none`을 사용하고 서버 검증에서도 UV를 요구한다. 기기 종류를 platform으로 제한하지 않아 브라우저의 휴대폰 hybrid QR·보안 키를 사용할 수 있다.
- HTTPS 인증 origin과 RP ID는 서버 설정으로 고정한다. RP ID는 인증 origin의 hostname과 같아야 한다. RP 도메인 변경은 기존 패스키 호환성을 깨므로 배포 전 실제 도메인을 확정한다.
- 등록 옵션·서명 검증·브라우저 JSON 변환은 SimpleWebAuthn에 맡긴다. 브라우저 origin·RP ID·challenge·서명·UV와 저장 credential ID·회원 user handle을 모두 확인한다. 회원 ID의 UTF-8 bytes를 user handle로 사용하며 이메일·실명을 넣지 않는다.
- 첫 패스키 등록 검증 성공 후 회원과 credential을 같은 transaction으로 만든다. 앱 복귀 전에 창을 닫아도 생성된 패스키로 다시 로그인할 수 있다. 사용자 한 명이 새 패스키로 별도 계정을 만드는 것은 허용하며 1인 1계정을 보장하지 않는다.
- 패스키 credential ID는 전역 PK다. 기존 키를 다른 계정에 연결하는 upsert를 하지 않는다. 동기화된 동일 패스키는 동일 계정에 접근한다.

## Desktop과 브라우저 연결

Desktop main이 S256 challenge로 `/auth/login-requests`를 호출하고 응답의 URL만 시스템 브라우저에서 연다. 현재 API의 `provider` 값은 `passkey` 하나다. 로그인 화면에서 기존 계정 로그인과 새 계정 생성을 분리한다.

요청 전체 TTL은 600초다. 일회용 launch ticket을 소비하면 요청별 Secure·HttpOnly·SameSite=Lax·Path=/ `__Host-` cookie를 발급한다. Browser JSON 요청은 exact Origin과 해당 cookie를 함께 확인하며 CORS를 열지 않는다. JSON byte cap, no-store, no-referrer, nonce CSP와 frame-ancestors none을 적용한다. QR은 브라우저/OS가 제공하며 자체 QR 승인 프로토콜은 만들지 않는다. QR 경로는 지원 브라우저와 가까운 기기의 Bluetooth를 요구할 수 있다.

패스키 인증 성공 후 최대 60초의 일회용 앱 복귀 code를 발급한다. 앱은 원래 request ID·client ID·verifier로 교환한다. 서버가 credential의 존재·소유 관계를 재확인하고 session·refresh 발급과 code 소비를 같은 transaction에서 commit한다. 응답 유실 시 토큰을 재전달하지 않고 새 로그인을 시작한다. 삭제된 키의 미교환 code는 거부한다.

Challenge는 요청과 register/authenticate/add 목적에 연결하고 한 번만 검증한다. 새 옵션 발급은 이전 challenge를 대체한다. 잘못된 패스키 증명은 그 브라우저의 challenge를 소비하며 다른 요청을 바꾸지 않는다. 처리 중 설정 fingerprint가 달라진 요청은 거부한다.

## 예비 패스키 관리

앱의 `패스키 관리`는 고정된 `/auth/passkeys/manage`를 외부 브라우저에서 연다. 관리할 계정의 패스키로 다시 인증해야 목록·추가·삭제가 가능하다. Renderer가 임의 URL·회원 ID·credential을 main에 전달하지 않는다.

관리 요청은 생성부터 600초 동안만 유효하며 별도의 앱 session을 발급하지 않는다. 인증한 회원과 credential ID에 묶고 모든 동작에서 해당 키의 존재를 재확인한다. 계정당 최대 20개까지 추가할 수 있다. 마지막 패스키 삭제는 거부한다. 현재 관리 인증에 사용한 키를 삭제하면 그 관리 권한도 종료한다. 다른 창에서 해당 키를 삭제한 경우 기존 관리 권한도 사용할 수 없다.

패스키 삭제는 이미 발급된 Desktop session을 종료하지 않고, 기기·패스키 제공자에 저장된 credential도 원격 삭제하지 않는다. 화면에서 이를 안내한다. 분실 대응의 전체 기기 session 폐기는 이 변경의 기능이 아니다. 모든 패스키를 잃으면 계정을 복구할 수 있음을 암시하지 않는다.

## 저장·잠금·정리

`users`는 UUID·nickname·created_at을 저장한다. `auth_passkeys`는 credential ID·user FK·공개키·counter·transports·device type·backup flag·등록/최근 사용 시각을 저장한다. 개인키·지문·얼굴·PIN은 수집하지 않는다. 공개키도 계정에 연결된 데이터이므로 로그나 공개 응답에 내보내지 않는다.

`auth_login_requests`는 login/manage 목적, 설정 fingerprint, 만료·상태, 앱 proof hash, browser binding hash, WebAuthn challenge와 목적, 등록 예정 회원·검증 회원·credential ID, code hash와 deadline을 저장한다. 완료 상태에서는 proof·회원 연결 정보를 null 처리한다. 전체 만료·완료 요청은 기존 cleanup으로 삭제한다. 만료는 접근 시 즉시 거부하지만 물리 삭제 완료 시각과는 구분한다.

잠금은 request → user → credential 순서다. 마지막 키 개수 검사와 추가/삭제는 user 잠금으로 직렬화한다. 모든 관련 잠금과 서명 검증 뒤 fresh DB 시각으로 만료를 재확인한다. 로그인 세션 발급 시 기존 user → session → refresh 순서를 이어 사용한다.

요청 제한은 API process마다 분당 IP별 120회, 전체 1,200회다. 생성·관리 시작·브라우저 mutation에 적용하며 IP 제한 거절은 전체 quota를 소비하지 않는다. 기존 단일 신뢰 proxy 설정이 있으면 해당 경계의 client IP를 사용한다. 다중 instance 전체 제한·1인 1계정·대량 계정 악용 방지를 보장하지 않는다.

## Migration과 검증 범위

기존 migration은 이력으로 보존한다. 새 schema에서 생성한 forward migration으로 이전 외부 인증 field를 제거하고 패스키 table을 만든다. 변경 transaction은 대상 table 쓰기를 먼저 잠근 뒤 users·로그인 요청이 비어있는지 검사한다. 데이터가 있으면 up/down 모두 거부하며 자동 삭제·자동 이관하지 않는다. 운영 DB에는 이 작업에서 migration을 실행하지 않는다.

실제 WebAuthn 가상 인증기를 사용하는 브라우저/DB 검증, 단일 소비·만료·잘못된 서명/계정·삭제된 키·예비 키·세션 회귀를 검사한다. 가상 인증기 성공을 실제 휴대폰 QR·Bluetooth·운영 HTTPS·packaged Desktop OS 복귀 검증으로 확대하지 않는다.
