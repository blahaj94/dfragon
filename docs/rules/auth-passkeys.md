---
type: rule
status: active
scope: accounts and Desktop passkey authentication
last-reviewed: 2026-10-10
evidence: "2026-10-10 사용자 결정: 시스템 브라우저 로그인과 loopback 복귀, 자체 휴대폰 QR 제거, Penpot 03 페이지 재구성"
---

# 패스키 인증

가입, 로그인은 패스키 전용이다. 인증은 accounts 서비스와 독립 PostgreSQL이 담당하며 이메일, 비밀번호, 전화번호, 별도 계정 복구를 제공하지 않는다. 아래 규칙이 인증, 회원 식별, 설정, 재인증의 기준이다. 세션, refresh, JWT, 검색 활동 정책은 기존 계약을 유지한다. 관련 문서도 이 계약에 맞춘 패스키 경계를 따른다.

## 가입과 로그인

- 내부 random UUID로 회원을 식별한다. 사용자는 로그인용 아이디를 입력하지 않는다. 닉네임 초기 생성과 수정 규칙은 유지한다.
- WebAuthn discoverable credential을 등록한다. `residentKey: required`, `userVerification: required`, attestation `none`을 사용하고 서버 검증에서도 UV를 요구한다. 기기 종류를 platform으로 제한하지 않아 브라우저의 휴대폰 hybrid QR, 보안 키를 사용할 수 있다.
- HTTPS 인증 origin과 RP ID는 서버 설정으로 고정한다. RP ID는 인증 origin의 hostname과 같아야 한다. 운영 인증 origin/RP는 accounts.dfragon.com 하나다. 이전 API 주소의 패스키 로그인과 RP 이전 경로는 제공하지 않는다.
- 등록 옵션, 서명 검증, 브라우저 JSON 변환은 SimpleWebAuthn에 맡긴다. 브라우저 origin, RP ID, challenge, 서명, UV와 저장 credential ID, 회원 user handle을 모두 확인한다. 회원 ID의 UTF-8 bytes를 user handle로 사용하며 이메일, 실명을 넣지 않는다.
- 첫 패스키 등록 검증 성공 후 회원과 credential을 같은 transaction으로 만든다. 앱 복귀 전에 브라우저 탭을 닫아도 생성된 패스키로 다시 로그인할 수 있다. 사용자 한 명이 새 패스키로 별도 계정을 만드는 것은 허용하며 1인 1계정을 보장하지 않는다.
- 패스키 credential ID는 전역 PK다. 기존 키를 다른 계정에 연결하는 upsert를 하지 않는다. 동기화된 동일 패스키는 동일 계정에 접근한다.

## Desktop과 브라우저 연결

Desktop main이 S256 challenge와 loopback 복귀 주소 `returnUrl: http://127.0.0.1:<port>/auth/callback`으로 `/auth/login-requests`를 호출하고 응답의 URL만 Electron `shell.openExternal`로 시스템 기본 브라우저에서 연다. 서버의 `apps/accounts/src/auth/login/input.ts`는 요청의 `returnUrl`이 이 형식과 정확히 일치할 때만 받으며 포트(1024~65535)만 가변이다(RFC 8252 7.3). `apps/accounts/browser/return-target.ts`는 브라우저가 이동하기 전에 code가 붙은 복귀 주소를 검증한다. 기존 길이, control/공백/backslash 금지 검사와 `<returnTarget>?code=<canonical-code>` 정확 일치 규칙은 유지한다. 현재 API의 `provider` 값은 `passkey` 하나다. 로그인 화면은 `패스키로 로그인`, `새 계정 만들기`만 둔다. 이 절은 2026-10-10 사용자 결정으로 승인된 변경 contract이며 현재 구현(격리 Electron BrowserWindow, `dfragon://` 복귀)이 아니다. 제거는 구현 PR에서 한다.

accounts는 Desktop 요청의 `returnUrl`을 검증해 해당 요청 행에 저장하고 인증 완료 때 그 값만 사용한다. Scheme은 `http`, host는 정확히 `127.0.0.1`, path는 `/auth/callback`이며 포트는 선행 0 없는 10진수 1024~65535다. Userinfo, query, fragment 없이 URL 정규화 결과와 원문이 같아야 한다. 서버 `passkey.returnUrl` 설정은 사용하지 않는다. OCR의 고정 `ocrReturnUrl` 흐름은 유지한다.

요청 전체 TTL은 600초다. 일회용 launch ticket을 소비하면 요청별 Secure, HttpOnly, SameSite=Lax, Path=/ `__Host-` cookie를 발급한다. Browser JSON 요청은 exact Origin과 해당 cookie를 함께 확인하며 CORS를 열지 않는다. JSON byte cap, no-store, no-referrer, nonce CSP와 frame-ancestors none을 적용한다. 인증은 브라우저/OS의 기본 패스키 인증만 제공한다. 휴대폰은 브라우저 패스키 창의 `다른 기기 사용` hybrid QR로 처리하며 지원 브라우저와 가까운 기기의 Bluetooth를 요구할 수 있다. 외부 브라우저의 세션 cookie는 브라우저가 보관하고, 로그인 요청마다 새 패스키 인증을 요구하는 정책은 유지한다.

패스키 인증 완료 후 최대 60초의 일회용 앱 복귀 code를 발급한다. 인증 완료 페이지는 `인증 완료`를 보여 주고 `<returnUrl>?code=<code>`로 바로 이동하며 `앱으로 돌아가기` 버튼도 같은 주소를 연다. 복귀에는 code 하나만 싣는다. 만료 뒤 페이지는 `로그인 요청이 유효하지 않습니다. 다시 로그인해 주세요.`와 `앱에서 새 로그인을 시작하세요.`를 보여 준다. 앱은 원래 request ID, client ID, verifier로 교환한다. 서버가 credential의 존재, 소유 관계를 재확인하고 session, refresh 발급과 code 소비를 같은 transaction에서 commit한다. 응답 유실 시 토큰을 재전달하지 않고 새 로그인을 시작한다. 삭제된 키의 미교환 code는 거부한다.

Challenge는 요청과 register/authenticate/add 목적에 연결하고 한 번만 검증한다. 새 옵션 발급은 이전 challenge를 대체한다. 잘못된 패스키 증명은 그 브라우저의 challenge를 소비하며 다른 요청을 바꾸지 않는다. 처리 중 설정 fingerprint가 달라진 요청은 거부한다.

## OCR 관리 웹 연결

OCR은 선택 설정 `ocrReturnUrl`과 `clientId: ocr`를 사용한다. accounts RP의 패스키와 고정 HTTPS callback, PKCE, client별 configuration fingerprint로 OCR 서버에 로그인 결과를 전달한다. OCR 요청은 `returnUrl`을 보내지 않으며 Desktop의 요청별 `returnUrl`과 기존 세션 계약에 영향을 주지 않는다. 추가 경계는 [OCR 자료실](ocr-workspace.md)을 따르며 사용자 merge 후 다른 작업에 적용한다.

## 휴대폰 로그인

휴대폰 패스키는 브라우저 패스키 창의 `다른 기기 사용` hybrid QR로 처리한다. DFragon 화면에는 휴대폰 버튼, QR, 확인 번호가 없고 패스키 응답 검증은 서버가 한다. 휴대폰의 기존 패스키는 별도 계정 이관 없이 같은 RP에서 사용한다.

2026-10-10 사용자 결정에 따라 DFragon 자체 휴대폰 QR 로그인과 패스키 관리 QR을 제거했다. `GET /auth/login/phone`, QR 생성, 상태 조회, claim, 직접 로그인 전환, 취소와 phone action, phone cookie를 더 이상 제공하지 않는다. 로그인 페이지는 `패스키로 로그인`, `새 계정 만들기`만 표시하고 회원가입 페이지는 `패스키로 회원가입` 하나만 표시한다. 휴대폰 버튼, QR 화면, 확인 번호, 남은 시간과 닫기 버튼은 제거했다. 2026-09-26 Penpot 리뷰에서 정한 자체 휴대폰 화면 동작은 폐기했다.

## 예비 패스키 관리

패스키 관리의 고정 경로는 `/auth/passkeys/manage`다. 2026-09-18 사용자 요청으로 Desktop 계정 메뉴를 제거하며 메인 UI에는 관리 진입 버튼을 두지 않는다. Desktop의 `managePasskeys`는 이 고정 경로를 시스템 브라우저로 열며(2026-10-10 결정, 구현 전) 관리 API의 경계는 유지한다. 관리할 계정의 패스키로 다시 인증해야 목록, 추가, 삭제가 가능하다. Renderer가 임의 URL, 회원 ID, credential을 main에 전달하지 않는다.

관리 요청은 생성부터 600초 동안만 유효하며 별도의 앱 session을 발급하지 않는다. 인증한 회원과 credential ID에 묶고 모든 동작에서 해당 키의 존재를 재확인한다. 현재 RP의 키만 표시하고 계정당 현재 RP의 키를 최대 20개까지 추가할 수 있다. 마지막 현재 RP 패스키 삭제는 거부하며, 다른 RP의 키는 예비 키로 세지 않는다. 현재 관리 인증에 사용한 키를 삭제하면 그 관리 권한도 종료한다. 다른 창에서 해당 키를 삭제한 경우 기존 관리 권한도 사용할 수 없다.

패스키 삭제는 이미 발급된 Desktop session을 종료하지 않고, 기기, 패스키 제공자에 저장된 credential도 원격 삭제하지 않는다. 화면에서 이를 안내한다. 분실 대응의 전체 기기 session 폐기는 이 변경의 기능이 아니다. 모든 패스키를 잃으면 계정을 복구할 수 있음을 암시하지 않는다.

## 저장, 잠금, 정리

`users`는 UUID, nickname, created_at을 저장한다. `auth_passkeys`는 credential ID, RP ID, user FK, 공개키, counter, transports, device type, backup flag, 등록/최근 사용 시각을 저장한다. 개인키, 지문, 얼굴, PIN은 수집하지 않는다. 공개키도 계정에 연결된 데이터이므로 로그나 공개 응답에 내보내지 않는다.

`auth_login_requests`는 login/manage 목적, 설정 fingerprint, Desktop 로그인의 요청별 loopback 복귀 주소, 만료, 상태, 앱 proof hash, browser binding hash, WebAuthn challenge와 목적, 등록 예정 회원, 검증 회원, credential ID, code hash와 deadline을 저장한다. `RemovePhoneQrLogin` forward migration은 자체 휴대폰 QR의 ticket hash, phone binding hash, 확인 번호 column과 phone 상태를 제거한다. 활성 QR 요청은 proof와 회원 연결을 지우고 실패로 종료하며 진행 중 직접 로그인, 관리 요청과 기존 회원, 패스키, session, refresh는 보존한다. 완료 상태에서는 proof, 회원 연결 정보를 null 처리한다. 전체 만료, 완료 요청은 기존 cleanup으로 삭제한다. 만료는 접근 시 즉시 거부하지만 물리 삭제 완료 시각과는 구분한다.

잠금은 request → user → credential 순서다. 마지막 키 개수 검사와 추가/삭제는 user 잠금으로 직렬화한다. 모든 관련 잠금과 서명 검증 뒤 fresh DB 시각으로 만료를 재확인한다. 로그인 세션 발급 시 기존 user → session → refresh 순서를 이어 사용한다.

요청 제한은 API process마다 60초 창에서 클라이언트별 120회, 전체 1,200회다. 생성, 인증 진입, 관리 시작, 브라우저 mutation, exchange, refresh, logout과 닉네임 변경에 적용하며 클라이언트 제한 거절은 전체 quota를 소비하지 않는다. `GET /me`는 같은 전체 1,200회 예산만 소비하고 클라이언트별 120회 예산을 검사하거나 소비하지 않는다. OCR 서버의 이미지별 활성 세션 확인이 같은 발신 IP를 사용하므로 이미지 조회가 로그인, refresh, logout의 클라이언트 예산을 소진하지 않게 한다. `/me`의 실패, 무효 토큰 요청도 전체 예산을 소비하며 JWT 검증과 매 요청의 DB 활성 세션 확인은 유지한다. 전체 예산이 소진되면 `/me`를 포함한 모든 제한 대상 요청을 거절하며, 1,200회 이상의 빠른 데이터셋 조회를 보장하지 않는다. IPv4-mapped IPv6는 IPv4로 정규화하고 IPv6는 동일 /64 대역의 한도를 공유한다. 기존 단일 신뢰 proxy 설정이 있으면 해당 경계의 client IP를 사용하며 그 외에는 전달 header를 신뢰하지 않는다.

같은 HTTP 앱의 로그인, 세션, 계정 service는 전체 최대 32개만 동시에 실행한다. 초과 요청은 DB 작업 시작 전에 정제 429와 `Retry-After`로 거절하고 대기 queue를 만들지 않는다. 연결 종료만으로 실행 중인 DB 작업의 슬롯을 반환하지 않으며 실제 service 완료, 실패 때 반환한다. 요청 횟수는 실패해도 환불하지 않는다. 다중 instance 전체 제한, 1인 1계정, 분산 공격 방지를 보장하지 않는다. 이 보안 수정 요청의 구현, 검증과 같은 PR에서 채택하고 사용자 merge 후 다른 작업에도 적용한다.

## Migration과 검증 범위

기존 migration은 이력으로 보존한다. 새 schema에서 생성한 forward migration으로 이전 외부 인증 field를 제거하고 패스키 table을 만든다. 변경 transaction은 대상 table 쓰기를 먼저 잠근 뒤 users, 로그인 요청이 비어있는지 검사한다. 데이터가 있으면 up/down 모두 거부하며 자동 삭제, 자동 이관하지 않는다. 운영 DB에는 이 작업에서 migration을 실행하지 않는다.

실제 WebAuthn 가상 인증기를 사용하는 브라우저/DB 검증, 단일 소비, 만료, 잘못된 서명/계정, 삭제된 키, 예비 키, 세션 회귀를 검사한다. 가상 인증기 성공을 실제 브라우저 hybrid QR, Bluetooth, 운영 HTTPS, packaged Desktop loopback 복귀 검증으로 확대하지 않는다.

## accounts 단일 인증 origin과 이전 종료

인증 HTTP, UI, 회원, session의 소유자는 `apps/accounts`다. API의 domain PostgreSQL과 별도
컨테이너, 볼륨, 접근 계정을 사용한다. API는 인증 DB와 JWT 개인키를 받지 않는다.
설정의 `apiOrigin`은 accounts origin이며 등록, 로그인, 예비 키 관리는 같은 RP만 사용한다.
Desktop main은 설정된 accounts origin의 로그인 launch URL과 관리 경로만 시스템 브라우저로 연다.

2026-09-28 사용자의 전체 계정 이전 완료 확인과 종료 요청에 따라 다음 계약을 적용한다.
이전 API origin의 인증 UI, handoff, 일회용 이전 ticket, 이전 설정과 proxy 경로를 제거한다.
이미 적용한 migration은 이력으로 남기고 forward migration으로 임시 이전 table을 제거한다.
기존 키의 RP ID를 바꾸어 새 키로 취급하지 않는다.

운영 정리는 인증 쓰기를 멈춘 뒤 모든 계정에 accounts RP 키가 있는지 확인해야 한다.
accounts의 이전 RP 키만 삭제하며 회원 UUID, 현재 RP 키, session, refresh는 보존한다.
중지된 source의 모든 회원이 accounts에 존재하고 현재 RP 키를 보유한 것을 확인한 뒤에만
source의 인증 table을 제거한다. Domain data와 migration history는 삭제하지 않는다.
기기, 패스키 제공자에 저장된 이전 키는 서버가 원격 삭제할 수 없다.

제품의 삭제 전제는 [인증 DB 계약](auth-database.md#별도-accounts-db와-이전-종료)을 유지한다.
실행, 복구 절차는 [인프라 책임](../reference/api-start-development.md#서버-이미지)이며 제품 변경 승인이 운영 실행을 대신하지 않는다.
