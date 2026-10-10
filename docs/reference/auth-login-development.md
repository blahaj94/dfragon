---
type: reference
scope: apps/accounts passkey login implementation
last-reviewed: 2026-10-10
---

# 로그인 구현 안내

설정, 실행, 검증 명령은 [패스키 실행 안내](passkey-authentication.md), 제품 계약은 [패스키 인증](../rules/auth-passkeys.md)을 따른다.

| 위치 | 책임 |
| --- | --- |
| `apps/accounts/src/auth/login/service.ts` | 요청 생성, 브라우저 binding, WebAuthn 옵션/검증, 패스키 관리 |
| `apps/accounts/src/auth/login/configuration.ts` | HTTPS origin, RP ID, 고정 OCR 복귀 주소 검증과 fingerprint |
| `apps/accounts/src/auth/login/input.ts` | Desktop 로그인 요청의 loopback `returnUrl`과 strict 입력 검증 |
| `apps/accounts/browser/return-target.ts` | 인증 완료 후 이동할 code-only 복귀 URL 검증 |
| `apps/accounts/src/auth/login/exchange.ts` | S256, code, 키 소유 확인 뒤 session/JWT 발급과 code 소비 |
| `apps/accounts/src/access-log.ts` | 요청마다 stdout에 쓰는 JSON 접근 로그와 `X-Correlation-Id` 응답 header |
| `apps/accounts/src/error-chain.ts` | 5xx 접근 로그에 남길 오류 chain 정제와 응답용 failure의 base class `SanitizedFailure` |
| `apps/accounts/src/auth/login/http.ts`, `json-parser.ts` | Nest HTTP, 요청 제한, 정제 오류, strict JSON 경계 |
| `apps/accounts/src/auth/login/page.ts`, `apps/accounts/browser/passkeys.tsx` | 같은 origin에서 제공하는 브라우저 화면, SimpleWebAuthn 연결 |
| `apps/accounts/src/auth/identity-session.ts` | 기존 user lock 아래 독립 session과 최초 refresh 생성 |
| `apps/accounts/test-support/passkey-integration.mjs` | HTTPS, 실제 가상 WebAuthn 인증기, PostgreSQL 통합 검증 |

API, accounts, OCR 서버는 요청마다 JSON 한 줄의 접근 로그를 stdout에 쓴다. Field는 `time`, `service`, `method`, `route`, `status`, 정제 오류 `code`, 5xx 응답의 `errorChain`, `durationMs`, `correlationId`, `aborted`로 한정하며 값이 없는 `code`, `errorChain`, `aborted`는 생략한다. `route`는 매칭된 route template이며, route 매칭 전에 끝난 요청은 `<unmatched>`로 남는다. 이 중 accounts의 요청 제한, JSON parser와 OCR 인증 middleware가 거절한 요청은 정제 `code`로 구분한다. 없는 경로의 404는 API와 accounts에서 `code` 없이 status로만 구분하고, OCR은 `NOT_FOUND` code를 남긴다. 응답 header를 보내기 전에 연결이 끊긴 요청은 `status` 없이 `aborted: true`를 남기고, header를 보낸 뒤 응답을 끝내지 못한 요청은 `status`와 `aborted: true`를 함께 남긴다. `correlationId`는 서버가 만든 UUID이며 같은 값을 `X-Correlation-Id` 응답 header로 돌려주고, 클라이언트가 보낸 값은 쓰지 않는다. 원문 URL, query, header, body와 오류 object, message는 [log 규칙](../rules/auth-api.md#응답과-log-sink)에 따라 남기지 않는다. stdout pipe가 닫히는 등 로그 쓰기가 실패하면 그 줄만 버리고 요청 처리는 계속한다. 각 앱의 `src/access-log.ts`가 형식과 stdout 쓰기를, HTTP 합성 코드가 middleware 등록을 맡는다. 정제 `code`는 각 앱의 전역 오류 filter와 accounts의 `jsonError`가 응답에 쓴 값만 넘긴다.

`errorChain`은 5xx 응답의 원인을 바깥쪽 오류부터 최대 5개까지 담은 배열이다. 항목마다 오류 class `name`, SQLSTATE나 Node system error 같은 식별자 형식의 `code`, message를 뺀 `frames`(최대 5줄)만 있다. 예를 들어 상세 조회 저장소의 DB 연결이 끊기면 다음처럼 남는다. Frame은 실제 파일 위치이며 여기서는 줄였다.

```json
{"route":"/characters/:serverId/:characterId","status":500,"code":"INTERNAL_SERVER_ERROR","errorChain":[{"name":"CharacterDetailFailure","frames":["characterDetailFailure (file:///app/dist/characters/details/errors.js:67:12)"]},{"name":"QueryFailedError","code":"57P01","frames":["PostgresQueryRunner.query (/app/node_modules/typeorm/driver/postgres/PostgresQueryRunner.js:...)"]}]}
```

각 앱의 전역 오류 filter가 받은 오류로 chain을 만든다. 서비스가 DB, Neople, 인증 서버 오류를 응답용 failure로 바꿀 때는 표준 Error처럼 `new AccountFailure(ACCOUNT_ERRORS.UNAVAILABLE, { cause: error })`로 원인을 넘긴다. 응답용 failure는 `src/error-chain.ts`의 `SanitizedFailure`를 상속하며, 생성자가 원래 오류를 그 자리에서 정제해 `sanitizedCause`에만 둔다. 원래 오류 object는 보관하지 않으므로 응답용 failure의 `cause`는 비어 있고, failure를 그대로 출력해도 SQL이나 요청 값이 나오지 않는다. 시간 초과나 요청 종료처럼 서버가 직접 끊은 경우는 원인을 잇지 않는다. 라이브러리가 붙인 `cause`(예: fetch 오류의 socket 오류)는 따라가서 같은 방식으로 정제한다. Stack을 만든 뒤 name이나 message가 바뀌어 message와 frame의 경계를 확인할 수 없으면 `frames`를 생략하고, getter가 예외를 던지는 등 정제할 수 없으면 그 원인을 생략한다. Accounts의 응답용 failure는 원래부터 stack을 비워 두므로 `frames` 없이 이름과 `code`만 남는다.

기본 entry는 초기화한 DB, 검증한 패스키 설정, 기존 JWT issuer/verifier를 factory에 전달한다. Session, account, 검색 factory와 자원 수명은 유지한다. 계정 생성은 최초 등록의 WebAuthn 검증 뒤 수행하며 앱 exchange가 기존 회원을 다시 생성하지 않는다.

Desktop 로그인 요청은 검증한 `returnUrl`을 요청 행의 `return_url`에 저장한다. 패스키 인증 완료 페이지는 그 주소에 code 하나만 붙여 자동 이동하며, 같은 주소를 여는 `앱으로 돌아가기` 버튼도 제공한다. 서버 설정의 `passkey.returnUrl`은 사용하지 않는다. OCR은 기존 고정 HTTPS callback을 사용한다.

합성 브라우저/DB 검증은 가입, 동일 계정 로그인, 관리 재인증, 예비 키, 마지막 키 보호, 키 삭제와 미교환 code, 서명/계정/origin 오류, 단일 소비, 만료, 요청별 loopback 자동 복귀와 제거된 자체 QR 경로의 거절을 확인한다. 실제 브라우저 패스키 창의 hybrid QR, Bluetooth, 운영 TLS와 설치 앱의 loopback 복귀 검증과는 구분한다.
