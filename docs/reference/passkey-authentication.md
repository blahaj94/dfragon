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

Desktop public 설정의 providers는 `["passkey"]`다. 로그인은 시스템 브라우저에서 진행하고 앱 복귀 code를 기존 protocol ingress·S256으로 교환한다. `패스키 관리` 버튼은 같은 인증 origin의 관리 화면을 열고 패스키 재인증을 요청한다.

API build는 TypeScript 서버와 `browser/passkeys.ts`를 bundle한다. Browser script를 CDN에서 불러오지 않는다. 서버·브라우저는 SimpleWebAuthn 13 계열을 사용하며 새 14 계열의 실험적 Web Crypto 초기화 경고에 의존하지 않는다.

- `pnpm --filter @ldb/api test`: API build, 단위·HTTP·runtime startup 검사.
- `pnpm --filter @ldb/api test:database`: 격리 Docker PostgreSQL, schema·migration·가상 WebAuthn 브라우저·refresh·계정 회귀. Playwright Chromium이 설치되어 있어야 한다.
- `pnpm --filter @ldb/desktop run --sequential '/^(test|lint|build)$/'`: 앱 상태·IPC·화면 회귀와 build.

운영 배포와 실제 휴대폰 QR 검증은 별도다. Bluetooth 없는 기기나 지원하지 않는 브라우저에 자체 QR 우회 경로를 제공하지 않는다.

## Windows 실기기 확인

2026-09-17, 패스키 전환이 반영된 `1c97fc36`의 Windows 10 x64 개발 패키지와 신뢰한
로컬 HTTPS·격리 PostgreSQL에서 다음 흐름을 확인했다.

- 휴대폰 QR로 첫 패스키 가입, 앱 복귀와 로그인 완료.
- 현재 기기 로그아웃 후 같은 패스키로 재로그인. 서버에서 회원 수가 유지되고 이전 세션이
  로그아웃 처리되며 새 세션만 활성화된 것을 확인했다.
- 예비 패스키 추가·삭제. 삭제 뒤 패스키 한 개와 기존 앱 세션이 남는 것을 확인했다.

운영 도메인·운영 DB 전환과 배포 패키지 업데이트는 별도다. 이 결과는 모든 브라우저·OS의
QR 지원을 보장하지 않는다. 앱 재시작 복원과 마지막 패스키 삭제 거부는 이 수동 확인에
포함하지 않았다.
