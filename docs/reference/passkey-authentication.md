---
type: reference
scope: accounts and Desktop passkey runtime
last-reviewed: 2026-10-10
---

# 패스키 실행 안내

동작과 제약은 [패스키 인증](../rules/auth-passkeys.md)을 따른다. 서버는 `AUTH_CONFIG_FILE`의 JSON을 시작할 때 한 번 읽는다. Access JWT 설정과 함께 다음 public 패스키 설정을 사용한다.

```json
{
  "passkey": {
    "apiOrigin": "https://accounts.dfragon.com",
    "rpId": "accounts.dfragon.com",
    "rpName": "DFragon",
    "returnUrl": "http://127.0.0.1:<port>/auth/callback"
  }
}
```

예제는 public 설정 부분만 보여준다. `returnUrl`의 `<port>`는 Desktop이 로그인마다 여는 loopback 수신기의 임시 포트라 실행마다 다르며, 서버는 포트만 가변인 이 형식과 정확히 일치하는 요청의 `returnUrl`만 받는다(2026-10-10 결정, 구현 전까지는 `dfragon://auth/callback`). 실제 파일에는 기존 `accessJwt` 객체도 있어야 하며 signing key를 저장소나 로그에 넣지 않는다. 개발은 신뢰한 local TLS의 `https://localhost:3444`, RP ID `localhost`, 같은 형식의 복귀 `http://127.0.0.1:<port>/auth/callback`(포트는 실행마다 다름)을 사용한다. `LOCAL_HTTPS_CERT_FILE`, `LOCAL_HTTPS_KEY_FILE`은 기존 방식이다. 실제 인증 domain은 배포 전에 확정해야 한다.

JWT 개인키는 기존 `accessJwt.signingKey.privateKeyPem` 또는 `AUTH_JWT_PRIVATE_KEY`,
`AUTH_JWT_PRIVATE_KEY_FILE` 중 하나로 제공한다. 외부 입력을 쓰면 JSON의 signingKey에는 `kid`만
남긴다. 두 외부 입력이나 JSON 개인키를 중복 지정하면 시작 전에 거절한다. 나머지 issuer, audience,
verificationKeys, passkey 설정과 키 일치 검증은 유지한다. 입력, 재시작 조건은
[서버 실행 안내](api-start-development.md#준비할-입력) 한 곳에서 확인한다.

Desktop public 설정의 providers는 `["passkey"]`다. 2026-10-10 결정(구현 전)으로 로그인은 시스템 기본 브라우저에서 진행하고, main이 127.0.0.1 임시 포트에 여는 loopback 수신기가 받은 앱 복귀 code를 기존 coordinator, S256으로 교환한다. 격리 Electron BrowserWindow와 OS protocol ingress는 로그인 계약에서 제외하며 제거는 구현 PR에서 한다. 같은 인증 origin의 `/auth/passkeys/manage`는 시스템 브라우저에서 열고 패스키 재인증을 요청한다. Desktop 계정 메뉴를 제거했으므로 현재 앱에는 관리 화면 진입 버튼이 없다.

accounts build는 TypeScript 서버와 `browser/passkeys.tsx`를 bundle한다. Browser script를 CDN에서 불러오지 않는다. 서버, 브라우저는 SimpleWebAuthn 13 계열을 사용하며 새 14 계열의 실험적 Web Crypto 초기화 경고에 의존하지 않는다.

- `pnpm --filter @dfragon/accounts test`: API build, 단위, HTTP, runtime startup 검사.
- `pnpm --filter @dfragon/accounts test:database`: 격리 Docker PostgreSQL, schema, migration, 가상 WebAuthn 브라우저, refresh, 계정 회귀. Playwright Chromium이 설치되어 있어야 한다.
- `pnpm --filter @dfragon/desktop run --sequential '/^(test|lint|build)$/'`: 앱 상태, IPC, 화면 회귀와 build.

운영 배포와 실제 브라우저 hybrid QR 검증은 별도다. 휴대폰 로그인은 시스템 브라우저의 패스키 창이 제공하는 hybrid QR로 처리하며, DFragon 자체 로그인 QR과 관리 QR은 제거했다. 시스템 브라우저 흐름의 실제 Windows+iPhone 검증은 구현 PR에서 따로 기록한다.

## OCR 관리 웹의 선택 연결

기존 `passkey` 설정에 `ocrReturnUrl: "https://ocr.dfragon.com/auth/callback"`을 추가하면 accounts RP의 패스키로 OCR에 로그인할 수 있다. 설정을 추가하지 않은 accounts는 OCR 요청을 거절한다. 기존 앱 returnUrl과 RP ID는 변경하지 않으며 DB migration은 필요 없다. OCR server가 PKCE proof와 token을 보유하고 허용 계정만 관리 세션을 받는다. 실제 배포 순서는 [인프라 운영 절차](api-start-development.md#서버-이미지)를 따른다.

## accounts 분리

현재 코드의 인증 서비스는 `apps/accounts`이며 검색은 `apps/api`에 남는다.
accounts 단일 RP, 이전 인증 데이터 삭제 전제는 [인증 DB 계약](../rules/auth-database.md#별도-accounts-db와-이전-종료),
실행 입력과 운영 책임은 [제품 안내](api-start-development.md#서버-이미지)를 따른다.
아래 Windows 기록은 이전 revision의 확인 이력이며 현재 accounts 배포나 이전 경로 종료 검증을 뜻하지 않는다.

## Windows 실기기 확인

2026-09-17, 패스키 전환이 반영된 `1c97fc36`의 Windows 10 x64 개발 패키지와 신뢰한
로컬 HTTPS, 격리 PostgreSQL에서 다음 흐름을 확인했다.

- 휴대폰 QR로 첫 패스키 가입, 앱 복귀와 로그인 완료.
- 현재 기기 로그아웃 후 같은 패스키로 재로그인. 서버에서 회원 수가 유지되고 이전 세션이
  로그아웃 처리되며 새 세션만 활성화된 것을 확인했다.
- 예비 패스키 추가, 삭제. 삭제 뒤 패스키 한 개와 기존 앱 세션이 남는 것을 확인했다.
- 로그인 상태에서 앱 창을 닫고 재실행한 뒤 별도 패스키 인증 없이 계정 화면으로 복원.
  서버에서 같은 활성 세션의 refresh가 교체된 것을 확인했다.

이 개발 환경 결과는 아래 운영 도메인, 운영 DB, 배포 패키지 확인과 구분한다. 모든 브라우저, OS의
QR 지원을 보장하지 않는다. 마지막 패스키 삭제 거부는 기존 자동 검증 범위이며 이 수동
확인에는 포함하지 않았다.

## Windows 운영 설치본 확인

[Issue #415](https://github.com/blahaj94/ldb/issues/415)의 확인 대상은 `94e5d0fd`의
Windows 10 x64 사용자별 NSIS 설치본이다. 공개 API origin은 `https://api.dfragon.com`,
RP ID는 `api.dfragon.com`, 당시 앱 identity/profile은 `ldb`, 복귀 주소는
`ldb://auth/callback`이었다. localhost 개발 패스키와 운영 패스키는 별개다.

2026-09-17 운영자의 배포 완료 기록에서 기존 OAuth 테스트 계정의 명시적 삭제 승인,
잠금 아래 대상 데이터 확인, 삭제 후 빈 인증 테이블 조건을 만족한 패스키 migration,
권한 부여, 검색, 캐릭터 데이터 건수 보존과 같은 revision의 API 반영을 확인했다.
운영 DB와 root 전용 release/image, 인증 설정을 이번 작업에서 직접 재조회한 것은 아니다.
이전 배포 스크립트를 재실행하거나 현재 패스키 계정에 빈 테이블 조건을 다시 요구하지 않는다.

직접 조회로 다음 범위를 확인했다.

- Windows 설치된 `app.asar`와 해당 release 빌드 산출물의 SHA-256 일치,
  설치 파일 checksum 일치, 당시 `ldb://` handler가 운영 설치 앱을 가리킴.
- 공개 HTTPS 패스키 관리 화면, JS, CSS의 HTTP 200, 미인증 `/me`의 401,
  잘못된 `/characters` 검색 입력의 400.
- Caddy의 단일 loopback API 연결과 `X-Forwarded-For` 덮어쓰기, Caddy, 일일 인증 정리
  timer의 active 상태. API의 `SEARCH_TRUST_PROXY=single-hop`은 배포 구성과 기존 적용
  기록을 근거로 하며, 실행 컨테이너 환경을 이번에 직접 조회하지 않았다.

사용자가 같은 운영 설치본과 Chrome, iPhone QR 경로에서 다음 실제 화면 동작을 확인했다.

- 운영 도메인에서 새 패스키 가입, 로그인 후 설치 앱 복귀.
- 로그인 상태로 X 종료 후 재실행하면 패스키 재인증 없이 계정 화면 복원.
- 현재 기기 로그아웃, 로그인 취소 후 다시 로그인 성공.
- 예비 패스키 추가, 삭제 후 기존 키 유지, 마지막 키 삭제 불가 표시, 보호.
- 로그아웃 상태에서 직접 검색, 게임 캡처, OCR 사용 가능.

정상 종료, 복원과 로그아웃 성공은 사용자 화면 확인이며 운영 DB의 session/refresh 집계를
별도로 조회한 결과가 아니다. 서버 로그아웃 실패, 로컬 정리 실패를 주입하지 않았고,
이 결과를 물리 정전 내구성이나 다른 OS, 브라우저, 기기의 성공으로 확대하지 않는다.

## DFragon QR과 전용 창

현재 흐름 요약(2026-10-10 결정, 구현 전): Desktop 메인의 `로그인`은 loopback 수신기를 연 뒤 시스템 기본 브라우저에서 accounts 로그인 페이지를 연다. 페이지에는 `패스키로 로그인`, `새 계정 만들기`만 있고 휴대폰은 브라우저 패스키 창의 hybrid QR로 처리한다. 인증 완료 페이지는 `인증 완료`를 보여 주고 `http://127.0.0.1:<port>/auth/callback?code=<code>`로 바로 이동하며, 앱은 `로그인 완료`, `이 탭을 닫아도 됩니다.` 페이지를 응답하고 code를 교환한다. 진행 중에는 메인 상단 바의 같은 버튼이 `취소`가 된다. 계약은 [Desktop 인증](../rules/desktop-auth.md), [lifecycle](../rules/desktop-auth-lifecycle.md), [platform](../rules/desktop-auth-platform.md)을 따른다.

accounts의 `browser/passkeys.tsx`는 로그인에서 `패스키로 로그인`, `새 계정 만들기`, 회원가입에서 `패스키로 회원가입`만 표시한다. 기존 계정과 별개 계정이 생긴다는 안내, 패스키 분실과 예비 키 안내는 유지한다. 패스키 생성을 취소하면 같은 화면에서 재시도할 수 있다. WebAuthn 미지원 브라우저에는 지원 브라우저에서 열도록 안내한다. 관리 화면은 `/auth/passkeys/manage`에서 패스키 재인증 후 목록, 추가, 삭제를 제공한다.

자체 QR 생성, 확인 번호, 남은 시간, 상태 조회, claim과 휴대폰 승인 화면, 관리 QR은 제거했다. `RemovePhoneQrLogin1791590400000` forward migration은 활성 QR 요청을 실패로 종료하고 QR column과 상태를 제거한다. 회원, 패스키, session, refresh와 진행 중 직접 로그인, 관리 요청은 보존한다. `AddPhoneQrLogin1789601588410` 등 기존 적용 migration은 변경하지 않는다. 새 accounts는 QR column을 읽거나 쓰지 않아 이전 schema에서도 동작하지만, 이전 accounts는 column이 지워지면 로그인 요청을 처리하지 못한다. 따라서 배포는 새 accounts 이미지로 교체한 뒤 이 migration을 적용한다.

자동 검증은 제거된 경로와 action의 거절, 직접 패스키 가입, 재로그인, 관리 재인증과 삭제 경계를 확인한다. `test-support/phone-qr-retirement.mjs`는 이전 schema의 활성 QR 요청 종료, 직접 로그인과 기존 인증 데이터 보존, 최신 schema 대조와 빈 disposable DB rollback을 검사한다. DB와 WebAuthn 통합 검증은 `test:database`로 실행하며 가상 인증기를 실제 iPhone 또는 packaged Windows 성공으로 표시하지 않는다.

패스키 화면의 문구, 구조와 화면 상태, 이벤트는 React 컴포넌트인 `apps/accounts/browser/passkeys.tsx`, 배치 스타일은 같은 폴더의 `passkeys.style.ts`의 StyleX 정의에서 수정한다. Compiler는 [앱 공통 StyleX](app-styling.md) 설정을 사용한다. 버튼은 기존 SEED recipe를 사용한다. `passkeys.html`은 React mount 지점과 요청별 data attribute만 담는 실행용 틀이다. 별도 프런트엔드 서버 없이 기존 API가 빌드된 JS, CSS를 제공한다. 서버 `page.ts`는 요청별 값의 HTML escape와 CSP nonce 주입만 담당한다. `browser/build.mjs`가 HTML을 배포 디렉터리로 복사하고 설치된 React, StyleX 패키지의 라이선스 원문을 JS 번들에 포함한다.

아래는 2026-10-10 결정으로 폐기된 Desktop 전용 인증 창의 이력이며 현재 계약이 아니다. 제거는 구현 PR에서 한다.

Desktop 메인의 `로그인`은 중간 계정 모달 없이 전용 인증 창을 바로 연다. 로그인 진행 중에는 버튼 재클릭을 막으며, 취소는 인증 창의 닫기로 처리한다. 기존 계정 모달과 로그인 후 계정 메뉴는 제거했다.

Desktop의 `auth/browser-window.ts`는 Node/preload 없는 메모리 session과 origin 제한을 적용한다.
