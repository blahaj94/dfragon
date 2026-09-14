---
type: rule
status: active
scope: authentication operations recovery verification and failure response
last-reviewed: 2026-09-15
---

# 인증 운영 복원·검증 기준

## 적용 범위

[인증 운영 구성](auth-operations-proposal.md)의 선택한 기능과 변경 위험에 맞춰 검증한다. 아래 복원 조건은 백업에서 복원한 auth DB를 공개하려 할 때 적용하며 로그인·일반 기능의 출시 조건이 아니다. 이전 [PR #132](https://github.com/blahaj94/ldb/pull/132)의 전체 장애 matrix는 이력으로 보존하고 매 변경의 필수 검사로 사용하지 않는다. 문서 검토나 mock 통과를 실제 운영·복원 성공으로 표시하지 않는다.

## 복원 순서와 재개 조건

[탈퇴 계약의 복원 순서](../rules/auth-withdrawal-proposal.md#삭제를-보존하는-복원-기준과-순서)를 따른다. 다음 결과는 공개 복원에서 생략하지 않으며, 선택한 구현의 기존 검증과 한 번의 격리 복원 시나리오로 함께 확인할 수 있다.

1. 공개·우회 ingress와 이전 process·writer를 중지한다. 이전 transaction 종료와 현재 writer generation을 확인하고 삭제 journal을 최종 대조한다.
2. 나이 7일 미만의 알려진 origin·lineage 사본을 격리 DB에 복원한다. 최신 삭제 journal과 복원 범위 밖 checkpoint의 연속성·rollback 방지 근거를 확인한다.
3. 완료 표식이 없는 확정 intent도 포함해 해당 old UUID·개인 데이터 FK를 삭제하고 재가입한 새 UUID는 보존한다. Journal 누락이나 판정 불명은 실패다.
4. 이전 session·refresh·OAuth·receipt·fence 자격을 폐기하고 전 verifier의 옛 JWT key를 제거한다. 새 key·lineage를 적용하며 provider revoke는 재실행하지 않는다.
5. 삭제 데이터 부재, 옛 자격 거절, 새 요청의 정상 동작을 확인한다. 마지막 journal 대조 뒤 신규 login admission을 600초 닫고 그 사이 변경이 없음을 확인한 뒤에만 cutover한다.

최신성·삭제·자격 폐기·시간을 확인하지 못하면 유지보수 상태를 유지하고 옛 snapshot으로 자동 복귀하지 않는다. 복원 기능이 미구현이면 실제 복구 가능성을 주장하지 않으며, 장애 중 임의로 이 조건을 축소해 DB를 공개하지 않는다.

## 필요한 검증 선택

| 변경·제공 기능 | 확인할 결과 |
| --- | --- |
| 일반 배포·설정·Migration | 선택한 환경의 시작·종료·권한과 해당 Migration 및 기능 흐름 |
| 탈퇴 확정·삭제·재개 | 중요한 commit/응답 유실 경계에서 동일 intent 재개, 이전 writer 거절, 삭제 대상·자격·보관 의미 유지 |
| 백업 생성·정리 | 암호화·origin·나이·사본 목록과 만료·실패본 정리, 유효한 다른 사본 보존 |
| 공개 복원 최초 제공 또는 의미 변경 | 위 순서의 격리 복원, 삭제 전 사본에서도 탈퇴 회원 부활·옛 자격 사용 없음, 근거 누락 시 공개 거절 |
| Journal·checkpoint·writer 경계 변경 | 바뀐 경계의 누락·stale writer·rollback 판정과 불명 상태의 복원 거절 |
| 삭제·compaction·key 폐기 변경 | 대상과 관련 사본의 보관 계약 충족, 미확인 결과를 완료로 표시하지 않음 |

한 수정에 모든 행·모든 crash 위치·모든 장비 조합을 실행하지 않는다. DB commit과 오류 처리로 검증할 수 있는 동작에 물리 정전 실험을 추가하지 않는다. 새로운 보장, 재현된 실패나 관련 경계 변화가 있을 때만 추가 사례를 고른다. 검증하지 않은 환경과 중요한 한계를 [Testing](../rules/testing.md)에 따라 보고한다.

## 장애 대응과 기록

확정된 탈퇴를 취소하거나 삭제 계정을 재활성화하지 않는다. Journal·checkpoint 손실과 최신성 불명은 공개 복원 중단 사유다. 실제 DELETE·매체·key 폐기 실패는 D4의 최소 격리와 지연 안내, 24시간 초과 대응 및 복구 후 우선 삭제를 따른다. 기록이나 검사 결과를 성공으로 바꾸어 재개하지 않는다.

운영자 한 명이 순서를 수행할 수 있다. 역할별 승인 댓글·새 Issue·인계 packet은 요구하지 않는다. 실제 실행 권한과 최소 자격 분리, 소유 자원 정리는 유지한다. 결과에는 선택 환경·revision, 수행한 시나리오·결과, 공개 복원 가능 여부와 남은 한계만 필요한 만큼 기록한다. Credential·개인식별 값과 raw log는 남기지 않는다.

이 문서만 변경할 때는 의미·연결·diff를 확인하며 app build나 실제 DB·backup·restore 실행을 요구하지 않는다. 보장이나 복원 의미 변경의 독립 검토는 [개발 흐름](../rules/agent-workflow.md#리뷰와-전달)의 실제 위험 기준을 따른다.
