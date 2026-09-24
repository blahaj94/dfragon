---
type: rule
status: active
scope: account deletion retention and recovery; passkey withdrawal integration pending
last-reviewed: 2026-09-16
---

# 탈퇴·삭제·복원 Contract

[PR #72의 D1–D5 승인](https://github.com/blahaj94/ldb/pull/72#issuecomment-5557976162)과 당시 검토 결과는 이력으로 보존한다. 패스키 전환에 따라 외부 계정 연결 해제와 외부 identity에 의존한 구현 설명은 폐기한다. 이 문서는 여전히 유효한 삭제 확정·보관·복원 정책을 유지하며, 패스키 탈퇴 API·schema가 이미 구현됐다는 의미가 아니다. 현재 로그인·예비 키 관리는 [패스키 계약](auth-passkeys.md)을 따른다.

## 유지하는 정책과 후속 설계

- D1: 최종 확인과 동일 계정의 새 재인증 뒤 임시 차단한다. 별도 journal의 durable 삭제 intent가 취소 불가 확정점이다. 준비 결과가 불명하면 취소나 완료를 추정하지 않으며 확정 뒤 계정을 active로 복구하지 않는다.
- D2: 외부 연결 해제 단계는 현재 인증에 적용하지 않는다. DFRAGON 회원·공개키 삭제와 기기/패스키 제공자에 남은 키의 삭제는 별개다. 기기의 저장물을 원격 삭제했다고 표시하지 않는다.
- D3: 삭제한 user UUID를 로그인·JWT·refresh·기존 대기 요청으로 재생성하지 않는다. 예전 외부 identity 기반 재가입 600초/fence 1,200초 설계는 패스키에 그대로 옮길 수 없다. 사람을 식별하지 않고 별도 계정을 허용하는 현재 가입 계약에서 이를 대체할 탈퇴·재가입 경합 정책은 후속 제품 설계 대상이다. 이 정리가 대기시간 폐지나 새로운 사람 추적 수단을 승인하지는 않는다.
- D4: 결과 조회 자격은 생성부터 86,400초, 삭제 UUID journal은 완료 확인 후 8일 및 관련 사본 폐기 확인까지다. 새 계정에 과거 결과를 연결하지 않는다. 장애 시 물리 삭제 상한 미보장·최소 잔여 격리·복구 후 우선 삭제 조건을 유지한다.
- D5: 성공 dump 최대 7개와 snapshot 나이 7일 상한을 함께 지킨다. 신뢰 가능한 삭제 journal 없이 복원 공개를 허용하지 않는다. 복원 시 모든 session·refresh·인증 요청·receipt를 폐기하고 JWT key를 교체하며 600초 신규 로그인 중단을 유지한다.

패스키 탈퇴를 구현할 때 withdrawal 전용 purpose의 새 challenge·UV·동일 user 확인, 현재 session·credential 삭제 경합, 상태/receipt API와 마지막 키 상실 시 접근 불가를 함께 설계한다. 로그인 또는 관리 인증을 탈퇴 동의로 재사용하지 않는다. 이번 문서 정리는 그 endpoint나 schema를 채택하거나 구현하지 않는다.

MVP에서는 [인증 운영 구성](../architecture/auth-operations-proposal.md)에 따라 한 운영자·단일 서버와 선택적 공개 복원을 허용한다. D1의 durable intent·이전 writer 차단, D4의 보관·삭제, D5의 사본 기한은 유지한다. 공개 복원을 제공하지 않아도 만든 사본의 보관·폐기 조건은 적용한다. 검증할 수 없는 auth 사본을 복원해 공개하지 않는다.

## 확정·권한·시간 경계

`T`는 잠금 뒤 fresh UTC whole-second이며 모든 TTL은 `T >= expires_at`에 거절한다. 재인증 자격은 생성부터 600초다. 그 안에 준비한 journal 결과는 만료 이후에도 판정하되 새 인증 권한을 연장하지 않는다.

탈퇴 생성은 유효 JWT와 존재·소유·활성·idle 미만료 user/session을 요구한다. 대상 UUID와 session은 서버가 결정한다. 닉네임이나 client가 제출한 계정 ID는 삭제 대상 증명이 아니다. 한 user의 미완결 요청은 최대 하나다. Preparing 진입 직전에도 원 session의 존재·소유·활성·idle 미만료를 관련 잠금 뒤 fresh T로 다시 확인한다. 그 전에 logout이 완료됐다면 준비와 삭제를 거절한다. Preparing 뒤 logout은 이미 검증된 준비의 journal 판정과 확정된 삭제 obligation을 취소하지 않는다.

별도의 32-byte CSPRNG statusToken은 요청 UUID와 함께 main에서 보관하고 서버에는 SHA-256만 저장한다. UUID·JWT·refresh·cookie·새 계정은 이 조회 자격을 대체하지 않는다. URL·renderer·log에 원문을 넣지 않으며 생성+24시간에 접근을 종료한다. 자격은 정제 상태 읽기와 이미 검증된 준비/확정 작업의 판정·재개만 허용한다. 새 인증·삭제 확정·다른 기능 권한으로 확장하지 않는다. Absent/wrong/expired 자격은 동일한 정제 404다.

확정·진행의 원칙은 awaiting_reauth → preparing → durable intent → deleting → completed다. 준비 전 취소·만료는 회원을 유지한다. Preparing에는 대상 계정을 임시 차단하고, 요청을 보낸 journal append의 결과가 불명하면 absence 조회만으로 되돌리지 않는다. 이전 writer를 fence하고 최종 journal을 대조한다. Durable intent가 없다고 확정한 경우만 미확정 실패로 종결한다.

Intent는 `(deletionId, oldUserId, preparedAt)`과 순서를 가진다. ACK 유실은 같은 ID 조회로 판정하고 intent가 authority다. SQL DELETE·필요한 개인 데이터 cascade·결과 commit을 확인한 뒤만 completed를 표시한다. Receipt가 없어도 확정된 삭제 obligation은 완료하며 old UUID 외의 새 계정을 삭제하지 않는다. DB 장애·commit 불명·앱 종료는 성공이나 취소의 근거가 아니다.

패스키 전용 request → user → credential과 기존 user → session → refresh 잠금에 탈퇴를 합성하는 실제 순서는 후속 경합 설계·독립 검토로 확정한다. 기존 외부 identity lock을 이름만 바꿔 재사용하지 않는다. Preparing 뒤 계정 기능·refresh는 차단하며 공개 검색의 비회원 동작은 유지한다.

## 보관과 삭제

아래 기한은 용도 종료/정리 eligibility와 운영 목표다. 장애 중 물리 삭제 성공을 시간 경과만으로 주장하지 않는다. TTL 연장·조사 목적 보존·manual hold를 정상 경로에 두지 않는다. 신뢰할 cleanup/관측/폐기 evidence가 없는 환경은 이 보관 정책의 운영 준비 완료가 아니다.

| 정보 | 목적·최소 보유 | 기한과 삭제 조건 |
| --- | --- | --- |
| 현재 회원 데이터·패스키·sessions·refresh | 확정 전 서비스, 확정 후 old UUID 삭제에 필요한 기존 데이터 | Durable intent 확인 뒤 원자 삭제. 준비부터 24시간 내 완료/미확정 종결 목표. 초과는 incident·서비스 담당 개입, 확정 user의 active 복구 금지. DB 불가 시 지연을 공개하고 성공으로 표시하지 않음. |
| 재인증 proof/원 user·session binding | 한 요청의 동일 계정·목적 확인 | Proof는 attempt 종결/취소/600초 만료 때 null. 확정 뒤 새 인증 불가. User/session binding은 DELETE 완료 때 null; 미완료 intent에 필요한 oldUserId만 분리 보유. |
| Receipt | 요청 ID, credential hash, 정제 상태·최소 시각 | 생성+86,400초에 접근 종료·삭제. 완료 때 새 24시간을 시작하지 않음. 유실/만료/복원 뒤 이전 조회 자격 재발급 없음. 미완료 삭제 obligation에는 credential 불필요. |
| 삭제 journal | oldUserId, deletionId, sequence·accepted/완료 시각만. 복원 부활 차단 | 완료 확인+691,200초 보관. 그때 관련 모든 snapshot이 7일 한계 밖이며 승인 inventory에서 제외·실제 폐기됐음을 확인 후 segment compaction으로 UUID 제거. 미완료 intent는 완료시각을 조작해 만료시키지 않음. 24시간 이상 pending/폐기 실패는 아래 D4 장애 예외로 격리. 안전한 삭제/복원 증명을 회복하기 전 공개 복원 금지. |
| Backup 사본·임시 dump/restore DB·복제본 | 승인된 암호화 recovery 사본. 모든 사본의 inventory/소유자 필수 | 성공본 최대 7개 AND 각 snapshot 시각+604,800초 미만. 실패 dump 즉시 삭제, restore scratch는 검증/실패 종료 때 삭제. Snapshot 나이는 복사/restore/re-backup으로 리셋하지 않음. 새 성공본이 없어도 만료본 사용·보관 연장 없음. |
| Inventory·폐기 evidence | snapshot ID/원 snapshot 시각·lineage·폐기 시각·정제 결과만 | Snapshot 시각+15일에 삭제. Failed dump/restore scratch evidence는 종료+8일. 장애로 폐기 미확인이면 D4 예외에 포함하고 새 snapshot으로 나이를 리셋하지 않음. |
| Checkpoint·writer generation | 현재/직전 sequence·generation·무결성 증거, 개인정보 field 없음 | 현재 값은 서비스 수명 동안 단일 값으로 유지·교체 시 직전 값만 최대 8일 뒤 삭제. 서비스 폐기 때 전부 삭제. UUID를 포함한 옛 segment 사본 보관은 금지. |
| 운영 log | 개인식별 없는 route template·결과 code·duration·집계 | 7일 뒤 삭제. User/deletion/request UUID·receipt·인증 raw 응답은 기록하지 않음. 장애 잔여는 D4 예외에 포함. |

**D4 장애 예외는 승인됐다.** 저장소 접근/폐기·key 파괴가 불가능하면 물리 잔여에는 유한 상한을 보장하지 못한다. 이를 숨긴 24시간/8일 삭제 보장을 약속하는 대신, 확인 가능한 삭제까지 필요한 최소 데이터만 격리하고 접근 권한 TTL은 그대로 종료하며 unsafe 복원/계정 재활성화를 금지하는 정책이다. 24시간 초과부터 책임자가 사용자에게 미완료/지연을 안내하고 매 24시간 incident 상태·복구/폐기 경로를 재검토한다. 복구 시 다른 서비스 재개보다 삭제·compaction을 먼저 실행하고 완료 evidence 뒤 잔여를 없앤다. 조사·사업 목적의 임의 hold는 없다. 이 예외를 수용하지 않는 정책으로 변경하려면 독립 crypto-erasure/매체 파괴로 hard limit을 충족하는 운영 수단을 먼저 설계·승인해야 하며 그 전 해당 정책으로 탈퇴 운영을 출시할 수 없다. 실제 매체 접근 자체가 불가능한 경우에는 그 대안도 검증 없이 삭제 성공으로 표시할 수 없다.


## 삭제를 보존하는 복원 기준과 순서

복원할 사본의 신뢰할 snapshot 시각·lineage, 현재까지 누락 없는 별도 삭제 journal, 외부 checkpoint의 rollback 불가 확인이 필요하다. Journal·최신 checkpoint·inventory는 auth DB restore 범위 밖에 있어야 한다. 단순 checksum이나 같은 dump의 tombstone만으로 최신성을 증명하지 않는다.

1. API ingress·background executor·인증/계정 쓰기와 기존 process를 멈춘다. Writer generation을 바꿔 이전 append를 fence한 뒤 journal을 최종 대조한다. Primary에만 preparing이 있고 intent가 없으면 확정된 탈퇴로 표시하지 않는다.
2. 별도 DB에 나이 7일 미만의 승인 snapshot만 복원한다. Checkpoint 연속성·pending intent·backup lineage를 확인한다. 누락·미등록 사본·clock 불명·journal 손실은 fail closed다.
3. Journal의 모든 관련 oldUserId와 패스키·개인 데이터 FK를 삭제한다. 완료 표시가 없는 intent도 적용하며 새 UUID는 보존한다. Preparing의 확정 부재가 증명되면 원 user를 active로 되돌릴 수 있지만 모든 session은 다음 단계에서 폐기한다. Accepted/deleting인데 intent가 없으면 중단한다.
4. 모든 auth_sessions/refresh·auth_login_requests·withdrawal proof/receipt를 제거한다. 이전 조회 자격을 되살리지 않고 전 회원의 재로그인을 요구한다. 새 ES256 signing key/kid를 준비하고 모든 이전 verification key를 제거한다. 정상 rotation의 900초 overlap은 복원에 적용하지 않는다.
5. Old UUID 부재·참조 무결성·활성 session/refresh/인증 요청/receipt 0·옛 JWT/refresh/code 거절을 검사한다. 삭제 재적용 후 만든 사본만 새 lineage로 승격하며 snapshot 나이를 복원·복사로 초기화하지 않는다.
6. 마지막 journal 대조부터 600초 신규 로그인을 중단한다. 그 사이 새 intent가 생기면 다시 대조한다. 모든 process의 새 key·lineage 확인 뒤 공개하고 실패하면 유지보수를 지속한다. 이전 snapshot 자동 공개는 하지 않는다.

구체 저장 매체·durability ack·권한·동시 장애 범위와 실제 복원 성공은 별도 실행 검증이다. Journal rollback·전체 저장소 손실에서 확인할 수 없는 auth 데이터로 재개하는 예외는 승인하지 않는다.

## 구현·검증 경계

패스키 로그인·예비 키 관리가 탈퇴 구현을 포함하지 않는다. 탈퇴 API·schema·Desktop receipt/조회는 후속이며, 공개 복원 검증은 그 기능을 제공할 때 적용한다. 과거 승인·실패 기록은 [PR #72](https://github.com/blahaj94/ldb/pull/72)에 남기고 현재 동작의 성공 evidence로 재사용하지 않는다.

후속 검증은 같은 계정의 새 재인증·잘못된 purpose/account/proof·TTL과 실제 lock 대기·동시 exchange/키 삭제/refresh·journal ACK 유실·writer fencing·DELETE rollback/commit 불명·receipt 만료·사본과 journal 삭제를 확인한다. Runtime·DB·운영 복원 성공을 문서 검사나 mock으로 대체하지 않는다. 실제 삭제·복원·credential 실행은 맡은 운영 권한 범위에서만 수행한다.
