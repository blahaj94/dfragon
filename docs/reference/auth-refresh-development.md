---
type: reference
scope: apps/accounts refresh/logout HTTP and transaction core
last-reviewed: 2026-09-08
---

# Refresh HTTP와 현재 session logout 개발

`apps/accounts/src/auth/refresh/index.ts`의 `rotateRefresh({ dataSource, issueAccessJwt }, rawToken)`은 이미 발급된 refresh로 rotation하는 내부 진입점이다. `rawToken`만 credential 입력으로 받고 user/session ID를 받지 않는다. 기존 `createAccessJwtIssuer`가 만든 issuer와 기존 DataSource를 주입한다. `apps/accounts/src/auth/login/http.ts`의 `createSessionHttpService`와 기존 `createLoginHttpApp`의 선택적 두 번째 인자가 이 core를 `POST /auth/refresh`와 `POST /auth/logout`에 연결한다. 기본 main도 이 factory를 사용하며 설정, 실행과 통합 검증은 [`api-start-development.md`](api-start-development.md)를 참고한다.

Contract는 `docs/rules/auth-session.md`, `docs/rules/auth-database.md`, `docs/rules/auth-api.md`를 따른다. 공통 `REFRESH_TOKEN`, `AUTH_ERRORS`, `LOGIN.idleSeconds`와 기존 요청 구조 오류 정의를 읽기 재사용한다.

## Transaction과 실패 결과

Core가 `DataSource.transaction('READ COMMITTED', ...)`를 호출하여 transaction, commit, release를 소유한다. 호출자는 transaction manager나 아직 commit되지 않은 결과를 받지 않으며, 이 함수를 다른 transaction callback 안에 합성하지 않는다.

- Canonical base64url의 32 decoded bytes를 strict 검증하고 그 bytes의 SHA-256으로 hash 이력을 찾는다. 잠금 없는 token/session 조회는 잠글 ID의 hint다. 같은 transaction manager의 typed Repository로 user→session→refresh를 잠근 뒤 fresh DB 정수 초를 읽고 존재, 소유, hash, revoked, idle을 다시 검사한다.
- Current이면 새 random bytes와 기존 JWT issuer의 결과를 준비하고 기존 `consumed_at` UPDATE와 새 hash INSERT를 같은 transaction에서 수행한다. `last_active_at`은 쓰지 않는다. 결과는 callback 내부의 `issued` 값으로만 보관하다 commit, release 성공 후 반환한다.
- 유효 session의 consumed token이면 해당 session의 `revoked_at`/`refresh_reuse`를 저장하고 `reuse-revoked` 결과를 반환한다. Transaction 안에서 거절 오류를 throw하지 않으므로 폐기는 commit된다. Core는 commit 확인 후 `AUTHENTICATION_REQUIRED`를 throw한다.
- Signing, entropy 실패는 `AUTH_INTERNAL_ERROR`다. DB 쓰기 실패, random unique 충돌은 `AUTH_UNAVAILABLE`이며 이전 소비까지 rollback한다. 오류는 원문 SQL, parameters, cause 없이 정제한다.
- Commit 결과가 불명이면 `AUTH_UNAVAILABLE`로 실패하며 준비한 token을 반환하거나 같은 원문으로 자동 retry하지 않는다. 실제 DB에 rotation/reuse 폐기가 남았는지는 추정하지 않는다. 이미 commit된 rotation의 응답이 유실된 경우 원래 token 재제출은 reuse 폐기를 일으킬 수 있다.

직접 입력의 canonical 형식 실패는 `INVALID_AUTH_REQUEST`(400), 미발급/없는 소유 row/소유 불일치/종료/만료/확인된 재사용은 `AUTHENTICATION_REQUIRED`(401)다. `RefreshFailure`의 code, status, 고정 message는 HTTP 계층이 기존 정제 응답에 연결한다. Token 결과는 `tokenType`, `accessToken`, `accessTokenExpiresAt`, `refreshToken`, `sessionExpiresAt`이고 두 시각은 UTC ISO 8601이다.

HTTP 경계는 승인된 JSON pre-parser와 정확한 `{refreshToken}` shape를 검증하고 위 core를 await한다. Refresh의 명시적 `RefreshFailure` 400/401/500/503을 보존하며 commit, release 확인 뒤에만 200 token body를 보낸다. 모든 응답은 no-store이고 추가 Access JWT나 임의 user/session 선택 인자를 받지 않는다.

## Logout transaction

`apps/accounts/src/auth/logout/index.ts`의 `logoutSession(dataSource, rawToken)`은 refresh core의 canonical 32-byte decode, re-encode, hash 검증을 재사용한다. 형식이 잘못된 credential은 DB 접근 전 `400 INVALID_AUTH_REQUEST`, canonical이지만 미발급인 hash는 `204`다.

Logout은 하나의 READ COMMITTED transaction에서 잠금 없는 token/session hint를 읽고 user→session→refresh 순서로 잠근다. 잠금 뒤 존재, 소유, hash를 다시 확인하며 이미 revoked, 정확한 idle deadline 이상, 삭제, unknown이면 추가 상태 변경 없이 완료한다. Current/consumed token의 활성 session만 fresh DB 정수 초로 `revoked_at`과 `logout` reason을 저장한다. `last_active_at`, refresh 발급, 소비 이력과 다른 session은 쓰지 않는다.

Transaction의 commit, release 완료 뒤에만 body 없는 204를 보낸다. DB 오류와 실제 commit 또는 rollback 뒤 acknowledgement를 잃은 fault injection은 모두 `503 AUTH_UNAVAILABLE`이며 성공 204를 보내거나 자동 retry하지 않는다. 물리 network 단절 검증은 아니다.

## 검증 근거

`apps/accounts/test/refresh.test.ts`는 canonical/decoded hash, 잠금과 fresh time 순서, commit 전 결과 미반환, 폐기 commit 뒤 거절, stale hint, 소유 불일치, 정확 idle 경계, JWT cap, 정제 실패와 단일 시도를 검증한다. Test fixture는 `apps/accounts/test/refresh.fixtures.ts`에 분리했다.

실제 DB 검증은 `apps/accounts/test-support/database-integration.mjs`의 기존 Docker 수명주기, Migration, fixture 기반에 아래 전용 helper를 연결한다. 기존 `login-test-control.mjs`의 QueryRunner instrumentation, DB clock, bounded barrier를 읽기 재사용한다.

| Helper | 검증 범위 |
| --- | --- |
| `refresh-rotation.mjs` | decoded hash 저장, 실제 issuer/verifier의 JWT sub/sid/iat/exp, 소비/새 hash와 단일 current row, commit 이후 반환. 정확 deadline 전 1초의 JWT cap, equality/초과 거절, 만료 consumed 이력의 폐기 쓰기 없음. 최근 활동이 있는 오래된 session의 refresh 허용, 전체 이력 보존, 가장 오래된 consumed 재사용 탐지와 다른 기기, 다른 user snapshot 보존 |
| `refresh-concurrency.mjs` | `pg_blocking_pids()`로 user/session/refresh 각각 실제 잠금 대기를 확인하고 DB clock이 idle 경계를 지난 뒤 해제하여 발급 거절. 같은 R0의 실제 동시 대기에서 1성공/1reuse 거절, 늦은 hint 뒤 R1/R2 무효. Logout 선행/후행, hint 뒤 user/session 삭제, 활동의 새 deadline 선commit |
| `refresh-failures.mjs` | signing, entropy, INSERT CHECK 실패, hash PK 충돌의 rollback. UPDATE 뒤 INSERT 오류와 원래 current 유지. Rotation/reuse 각각 실제 commit/rollback한 뒤 acknowledgement 오류 주입에서 결과 미반환, 자동 retry 없음 |
| `session-http-integration.mjs` | HTTP→PostgreSQL의 정상 refresh, current/consumed, 반복, unknown, 물리 삭제 logout, 다른 기기와 이력, 활동 보존. 양방향 경합에서 waiter를 관측한 뒤 lock 해제, logout 완료 뒤 늦은 200과 그 token의 최종 무효, commit 전 응답 금지와 acknowledgement 오류, transport/shape no-write |

Commit 결과 불명은 QueryRunner fault injection이며 물리 network 단절 실험과 구분한다.

```bash
pnpm --filter @dfragon/accounts run --sequential '/^(lint|test|typecheck)$/'
pnpm --filter @dfragon/accounts test:database
```

`linux/amd64`, 실제 기기 인증, 계정, Desktop, 운영 배포, proxy/APM, clock, cleanup과 물리 network 단절은 검증 범위가 아니다.

`rotateRefreshForTest`는 random 실패/충돌을 위한 test 전용 주입 경계이며 환경변수나 HTTP 입력으로 노출하지 않는다. Session HTTP factory도 환경변수 test mode를 두지 않으며 실제 DataSource/JWT issuer를 명시적으로 합성한다.
