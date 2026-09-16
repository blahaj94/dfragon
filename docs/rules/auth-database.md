---
type: rule
status: active
scope: apps/api core authentication database
last-reviewed: 2026-09-16
---

# Authentication Database Contract

회원 식별과 로그인은 [패스키 인증](auth-passkeys.md), 시간·refresh는 [세션](auth-session.md), 활동은 [계정 활동](auth-activity.md), DB 실행은 [runtime](auth-runtime.md)을 따른다. 기존 세션·보관 정책의 승인 이력은 [PR #48](https://github.com/blahaj94/ldb/pull/48#issuecomment-5551469519)에 보존한다. 탈퇴 extension은 [탈퇴·삭제](auth-withdrawal-proposal.md)의 별도 미구현 범위다.

## 공통 schema 규격

UUID는 API의 CSPRNG로 생성한다. 시간은 서버 UTC whole-second다. 원문 token과 개인키는 저장하지 않는다. Nickname unique는 없으며 20 grapheme 검증은 API가 담당한다.

| Table | 저장·제약 |
| --- | --- |
| `users` | `id uuid PK`, nonempty `nickname`, `created_at`. 로그인용 아이디와 외부 계정 식별자 없음. |
| `auth_passkeys` | `id text PK` credential ID, `user_id` FK cascade, `public_key bytea`, `counter`, `transports`, `device_type`, `backed_up`, 등록·최근 사용 시각. 동일 credential을 다른 회원에 재연결하지 않음. |
| `auth_sessions` | UUID PK, user FK cascade, 생성·최종 활동·폐기 시각과 폐기 이유. Revoked pair null 일치·시각 순서, user/활동 index. Absolute expiry·하드웨어 fingerprint 없음. |
| `auth_refresh_tokens` | 32-byte token hash PK, session FK cascade, 발급·소비 시각. `consumed_at IS NULL` partial unique로 session당 미소비 하나, session index. |
| `auth_login_requests` | UUID PK, login/manage 목적, 설정 fingerprint, 상태·생성·만료 시각, 아래 일회용 증명. 회원 생성 전에도 존재하므로 user FK를 강제하지 않음. |

## `auth_login_requests`

Login 요청은 S256 challenge와 일회용 launch hash를 가진다. Manage 요청은 browser binding으로 시작하고 앱 교환 proof는 없다. Browser binding·launch·exchange code hash는 존재할 때 32byte다. WebAuthn challenge는 register/authenticate/add 목적과 등록 예정 user에 결합한다. 검증 회원·credential ID는 관리 권한 또는 앱 교환에만 쓴다.

| 상태 | 제약 |
| --- | --- |
| `created` | Login 전용, launch hash·앱 proof 필요. |
| `browser_started` | Launch 소비 완료, browser binding 필요. 옵션 발급 뒤 challenge·operation 조합 보존. |
| `managing` | Manage 전용, 검증 회원·credential과 browser binding 필요. |
| `exchange_ready` | Login 전용, 검증 회원·credential·앱 proof·code hash·deadline 필요. Code deadline은 전체 TTL 이하. |
| `consumed`, `failed` | Proof·challenge·회원/credential 연결을 null 처리. 소비 상태는 consumed_at 필요. |

SQL CHECK와 request row lock을 함께 사용한다. CHECK만으로 단일 소비를 보장하지 않는다. 현재 시각의 만료를 CHECK나 partial index에 넣지 않는다. 실제 column·named constraint와 상태 조합은 EntitySchema와 생성 migration으로 관리한다.

## Transaction과 잠금 순서

한 transaction manager와 연결만 사용한다. 인증은 **request → user → credential** 순서이며 session 생성 시 **user → session → refresh**로 이어간다. 관리 동작은 user lock으로 키 개수와 추가·삭제를 직렬화한다. Session·cleanup에서 뒤늦게 request를 잠그지 않는다.

잠금 없는 credential 조회는 user를 찾는 hint다. Lock 뒤 소유·존재·상태를 다시 확인하고 fresh DB 시각으로 만료를 검사한다. 서명 검증 후와 앱 code 소비 직전에도 만료를 확인한다. 등록은 user와 credential을 같은 transaction에 insert하며 전역 credential PK 충돌을 upsert로 숨기지 않는다. 동기화된 기존 credential은 같은 user로 로그인하며 새 등록은 별도 계정이다.

## 종료 session과 인증 요청 정리

- Refresh 가능한 활성 session의 모든 발급·소비 hash를 유지한다. 최근 N개, issued_at+30일, rotation 즉시 old row 삭제는 금지한다. 오래 활성인 session의 이력은 계속 늘며 이를 줄이려 absolute lifetime을 추가하지 않는다.
- Revoked_at 이후 또는 정확한 idle deadline 이후 session은 **별도 보관 유예 없이 다음 cleanup에서 session+refresh 전체 삭제**가 승인된 정책이다. 이후 old token은 unknown이며 대상 session이 없으므로 재발급하지 않는다. 늦은 유효 JWT는 residual 검색, 새 session은 다른 UUID다. 조사용 추가 보관은 목적/기한 별도 승인 대상이다.
- Cleanup은 dependency 없는 기존 실행 기반 command로 시작 시 1회+운영 하루 1회가 승인됐다. 실제 실행 시각과 실패 대응은 별도 운영 gate다. 실패하면 삭제가 지연되지만 매 요청 TTL/idle/revoked 거절은 유지한다. 24시간 내 삭제를 보장하지 않는다.
- Cleanup도 session lock 뒤 fresh T로 종료 조건을 재확인한다. 활동이 먼저 deadline 연장을 commit했으면 보존하고 cleanup이 만료를 먼저 판정하면 대기한 활동/refresh가 부활시키지 못한다. Batch SKIP LOCKED는 구현 선택일 수 있으나 종료 재판정을 생략하지 않는다.
- 인증 요청 성공/실패 terminal commit 때 proof/회원 연결를 즉시 null 처리한다. 만료 request는 즉시 거절하고 terminal/만료 row는 다음 성공 cleanup에서 삭제한다.
- **교환 자격 TTL은 물리 보관 상한이 아니다.** Exchange_ready 회원 연결/code proof는 소비 또는 TTL까지만 기능상 필요하지만 만료/crash/DB 장애 뒤 실제 회원 연결/proof가 남을 수 있다. 승인된 시작+하루 1회 주기는 10분 또는 24시간 내 물리 삭제 보장이 아니며 cleanup 실패는 더 지연시킨다. 이 보관 잔여/지연 가능성은 승인된 한계다. 더 짧은 물리 상한은 별도 reliable cleanup·운영 설계가 필요하다. 지연이 만료 후 exchange 자격을 늘리지는 않는다.

## 삭제 경계

User 삭제 시 passkeys와 sessions→refresh cascade는 기본 구조다. JWT sub/sid로 삭제 계정/session을 재생성하거나 다른 새 user에 연결하지 않는다. **User 삭제 후에도 남을 탈퇴 결과 state, pending login과 삭제의 자동 재가입 경합, 백업 복원 후 삭제 회원 방지**는 이 cascade로 해결되지 않는다. 삭제 확정·보관·복원은 [탈퇴 contract](auth-withdrawal-proposal.md)의 유지된 정책을 따른다. 패스키 탈퇴의 최소 schema·재가입 경합은 후속 설계 대상이다. 기본 table/cascade만으로 구현된 것으로 보지 않는다. 현재 요청한 탈퇴 기능에 필요한 Migration·경합을 검증하며 공개 복원 검증은 그 기능을 제공할 때 적용한다. 그 승인 범위 밖 tombstone·복구 유예·장기 개인 식별 보관을 임의 추가하지 않는다.

근거는 #39가 2026-09-05에 검토한 [constraints](https://www.postgresql.org/docs/current/ddl-constraints.html), [partial index](https://www.postgresql.org/docs/current/indexes-partial.html), [INSERT/ON CONFLICT](https://www.postgresql.org/docs/current/sql-insert.html), [row lock/deadlock](https://www.postgresql.org/docs/current/explicit-locking.html)다. Schema/DB 실행 성공 evidence가 아니다.
