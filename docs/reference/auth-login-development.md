---
type: reference
scope: apps/api passkey login implementation
last-reviewed: 2026-09-16
---

# 로그인 구현 안내

설정·실행·검증 명령은 [패스키 실행 안내](passkey-authentication.md), 제품 계약은 [패스키 인증](../rules/auth-passkeys.md)을 따른다.

| 위치 | 책임 |
| --- | --- |
| `apps/api/src/auth/login/service.ts` | 요청 생성·브라우저 binding·WebAuthn 옵션/검증·패스키 관리 |
| `apps/api/src/auth/login/configuration.ts` | HTTPS origin·RP ID·복귀 주소 검증과 fingerprint |
| `apps/api/src/auth/login/exchange.ts` | S256·code·키 소유 확인 뒤 session/JWT 발급과 code 소비 |
| `apps/api/src/auth/login/http.ts`, `json-parser.ts` | Nest HTTP·요청 제한·정제 오류·strict JSON 경계 |
| `apps/api/src/auth/login/page.ts`, `apps/api/browser/passkeys.ts` | 같은 origin에서 제공하는 브라우저 화면·SimpleWebAuthn 연결 |
| `apps/api/src/auth/identity-session.ts` | 기존 user lock 아래 독립 session과 최초 refresh 생성 |
| `apps/api/test-support/passkey-integration.mjs` | HTTPS·실제 가상 WebAuthn 인증기·PostgreSQL 통합 검증 |

기본 entry는 초기화한 DB, 검증한 패스키 설정, 기존 JWT issuer/verifier를 factory에 전달한다. Session·account·검색 factory와 자원 수명은 유지한다. 계정 생성은 최초 등록의 WebAuthn 검증 뒤 수행하며 앱 exchange가 기존 회원을 다시 생성하지 않는다.

합성 브라우저/DB 검증은 가입·동일 계정 로그인·관리 재인증·예비 키·마지막 키 보호·키 삭제와 미교환 code·서명/계정/origin 오류·단일 소비·만료를 확인한다. 실제 휴대폰 QR·Bluetooth·운영 TLS·OS 앱 복귀 검증과는 구분한다.
