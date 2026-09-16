---
type: reference
scope: API and Desktop passkey runtime
last-reviewed: 2026-09-17
---

# 패스키 실행 안내

동작과 제약은 [패스키 인증](../rules/auth-passkeys.md)을 따른다. 서버는 `AUTH_CONFIG_FILE`의 JSON을 시작할 때 한 번 읽는다. Access JWT 설정과 함께 다음 public 패스키 설정을 사용한다.

```json
{
  "passkey": {
    "apiOrigin": "https://auth.example.com",
    "rpId": "auth.example.com",
    "rpName": "LDB",
    "returnUrl": "ldb://auth/callback"
  }
}
```

예제는 public 설정 부분만 보여준다. 실제 파일에는 기존 `accessJwt` 객체도 있어야 하며 signing key를 저장소나 로그에 넣지 않는다. 개발은 신뢰한 local TLS의 `https://localhost:3443`, RP ID `localhost`, 복귀 `ldb.dev://auth/callback`을 사용한다. `LOCAL_HTTPS_CERT_FILE`, `LOCAL_HTTPS_KEY_FILE`은 기존 방식이다. 실제 인증 domain은 배포 전에 확정해야 한다.

Desktop public 설정의 providers는 `["passkey"]`다. 로그인은 격리 Electron BrowserWindow에서 진행하고 앱 복귀 code를 기존 coordinator·S256으로 교환한다. 내부 창은 callback을 가로채며 기존 OS protocol ingress도 유지한다. `패스키 관리` 버튼은 같은 인증 origin의 관리 화면을 열고 패스키 재인증을 요청한다.

API build는 TypeScript 서버와 `browser/passkeys.ts`를 bundle한다. Browser script를 CDN에서 불러오지 않는다. 서버·브라우저는 SimpleWebAuthn 13 계열을 사용하며 새 14 계열의 실험적 Web Crypto 초기화 경고에 의존하지 않는다.

- `pnpm --filter @ldb/api test`: API build, 단위·HTTP·runtime startup 검사.
- `pnpm --filter @ldb/api test:database`: 격리 Docker PostgreSQL, schema·migration·가상 WebAuthn 브라우저·refresh·계정 회귀. Playwright Chromium이 설치되어 있어야 한다.
- `pnpm --filter @ldb/desktop run --sequential '/^(test|lint|build)$/'`: 앱 상태·IPC·화면 회귀와 build.

운영 배포와 실제 휴대폰 QR 검증은 별도다. LDB QR은 휴대폰의 HTTPS 패스키 인증과 양쪽 승인을 연결하며 Bluetooth 근접 확인을 제공하지 않는다. 새 QR의 실제 Windows+iPhone 검증은 기존 브라우저 hybrid QR 검증과 별도로 기록한다.

## Windows 실기기 확인

2026-09-17, 패스키 전환이 반영된 `1c97fc36`의 Windows 10 x64 개발 패키지와 신뢰한
로컬 HTTPS·격리 PostgreSQL에서 다음 흐름을 확인했다.

- 휴대폰 QR로 첫 패스키 가입, 앱 복귀와 로그인 완료.
- 현재 기기 로그아웃 후 같은 패스키로 재로그인. 서버에서 회원 수가 유지되고 이전 세션이
  로그아웃 처리되며 새 세션만 활성화된 것을 확인했다.
- 예비 패스키 추가·삭제. 삭제 뒤 패스키 한 개와 기존 앱 세션이 남는 것을 확인했다.
- 로그인 상태에서 앱 창을 닫고 재실행한 뒤 별도 패스키 인증 없이 계정 화면으로 복원.
  서버에서 같은 활성 세션의 refresh가 교체된 것을 확인했다.

이 개발 환경 결과는 아래 운영 도메인·운영 DB·배포 패키지 확인과 구분한다. 모든 브라우저·OS의
QR 지원을 보장하지 않는다. 마지막 패스키 삭제 거부는 기존 자동 검증 범위이며 이 수동
확인에는 포함하지 않았다.

## Windows 운영 설치본 확인

[Issue #415](https://github.com/blahaj94/ldb/issues/415)의 확인 대상은 `94e5d0fd`의
Windows 10 x64 사용자별 NSIS 설치본이다. 공개 API origin은 `https://api.dfragon.com`,
RP ID는 `api.dfragon.com`, 앱 identity/profile은 `ldb`, 복귀 주소는
`ldb://auth/callback`이다. localhost 개발 패스키와 운영 패스키는 별개다.

2026-09-17 운영자의 배포 완료 기록에서 기존 OAuth 테스트 계정의 명시적 삭제 승인,
잠금 아래 대상 데이터 확인·삭제 후 빈 인증 테이블 조건을 만족한 패스키 migration,
권한 부여, 검색·캐릭터 데이터 건수 보존과 같은 revision의 API 반영을 확인했다.
운영 DB와 root 전용 release/image·인증 설정을 이번 작업에서 직접 재조회한 것은 아니다.
이전 배포 스크립트를 재실행하거나 현재 패스키 계정에 빈 테이블 조건을 다시 요구하지 않는다.

직접 조회로 다음 범위를 확인했다.

- Windows 설치된 `app.asar`와 해당 release 빌드 산출물의 SHA-256 일치,
  설치 파일 checksum 일치, `ldb://` handler가 운영 설치 앱을 가리킴.
- 공개 HTTPS 패스키 관리 화면·JS·CSS의 HTTP 200, 미인증 `/me`의 401,
  잘못된 `/characters` 검색 입력의 400.
- Caddy의 단일 loopback API 연결과 `X-Forwarded-For` 덮어쓰기, Caddy·일일 인증 정리
  timer의 active 상태. API의 `SEARCH_TRUST_PROXY=single-hop`은 배포 구성과 기존 적용
  기록을 근거로 하며, 실행 컨테이너 환경을 이번에 직접 조회하지 않았다.

사용자가 같은 운영 설치본과 Chrome·iPhone QR 경로에서 다음 실제 화면 동작을 확인했다.

- 운영 도메인에서 새 패스키 가입·로그인 후 설치 앱 복귀.
- 로그인 상태로 X 종료 후 재실행하면 패스키 재인증 없이 계정 화면 복원.
- 현재 기기 로그아웃, 로그인 취소 후 다시 로그인 성공.
- 예비 패스키 추가·삭제 후 기존 키 유지, 마지막 키 삭제 불가 표시·보호.
- 로그아웃 상태에서 직접 검색·게임 캡처·OCR 사용 가능.

정상 종료·복원과 로그아웃 성공은 사용자 화면 확인이며 운영 DB의 session/refresh 집계를
별도로 조회한 결과가 아니다. 서버 로그아웃 실패·로컬 정리 실패를 주입하지 않았고,
이 결과를 물리 정전 내구성이나 다른 OS·브라우저·기기의 성공으로 확대하지 않는다.

## LDB QR과 전용 창

`auth/login/phone.ts`는 PC·휴대폰 cookie를 분리해 QR 재발급·승인·일회용 claim을 처리한다. `browser/passkeys.ts`는 로컬 canvas QR, 5초 상태 조회와 명시 승인 화면을 제공한다. 관리 QR은 고정 관리 URL만 담으며 휴대폰에서 재인증한다. Desktop의 `auth/browser-window.ts`는 Node/preload 없는 메모리 session과 origin 제한을 적용한다.

`AddPhoneQrLogin1789601588410`은 schema diff로 생성한 추가 migration이다. 기존 실사용 계정·패스키·세션을 유지하며 과거 OAuth 데이터 초기화를 다시 실행하지 않는다. 배포는 새 API의 migration 적용 → API 업데이트 → Desktop 업데이트 순서다. 이전 Desktop의 직접 패스키 경로도 유지한다.

자동 검증은 별도 PC/phone 브라우저 문맥과 WebAuthn 가상 인증기를 사용한 가입·재로그인, 양쪽 승인, ticket/claim 재사용 차단, 취소·재발급·만료·삭제 키 거부 및 기존 로그인 회귀다. 가상 인증기를 실제 iPhone 또는 packaged Windows 성공으로 표시하지 않는다.

패스키 화면의 문구·구조는 `apps/api/browser/passkeys.html`, 스타일은 같은 폴더의 `passkeys.css`에서 수정한다. 서버 `page.ts`는 요청별 값의 HTML escape와 CSP nonce 주입만 담당한다. `browser/build.mjs`가 HTML을 배포 디렉터리로 복사하고 설치된 QR 패키지의 라이선스 원문을 JS 번들에 포함한다.
