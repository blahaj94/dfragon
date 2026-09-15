---
type: rule
status: active
enforcement: approval-required
scope: apps/api account activity
last-reviewed: 2026-09-05
rationale: 인증·입력·quota 거절과 활동 기록 및 DB 장애의 순서를 함께 정의한다.
evidence: "PR #48 사용자 승인: https://github.com/blahaj94/ldb/pull/48#issuecomment-5551469519 ; 설계 근거: Issue #39 Proposal Revision 2 https://github.com/blahaj94/ldb/issues/39#issuecomment-5551313691"
exceptions: 내부 admission 대기만 승인됐으며 quota 재시도 대기열은 금지하고 사용자 구현 금지 조건을 유지한다.
review-after: 최초 DB latency·취소·동시성 integration validation 시
---

# Authentication Activity Contract

계정 기능의 인증·활동 계약은 PR #48의 승인 이력을 유지한다. JWT/시간은 [auth-session.md](auth-session.md), 계정 API/입력은 [auth-api.md](auth-api.md), 잠금/정리는 [auth-database.md](auth-database.md)를 따른다. 아래 공개 검색 변경은 계정 인증 완화나 실제 DB 검증 완료를 뜻하지 않는다.

## 공개 검색의 분리

2026-09-15 로그인 선택 요구에 따라 `GET /characters`는 JWT·session DB·활동 갱신을 사용하지 않는다. 이전 PR #48의 검색 admission·잔여 JWT·검색 DB 실패 정책은 [공개 검색 계약](character-search.md#공개-검색과-호출-제한)으로 대체한다. 로그인한 상태의 검색도 계정 활동을 연장하지 않는다. 이전 구현과 검증 이력은 기존 PR에 보존한다.

## 계정 API 활동과 기능 단계

탈퇴 preparing 이후 계정 기능의 lifecycle 재확인·차단은 [승인된 탈퇴 contract](auth-withdrawal-proposal.md)를 따른다. 아래 계정 admission/기능 2단계·인정한 활동 보존은 유지하며, 탈퇴 extension의 구현·경합 검증은 별도다.

`GET /me`, `PATCH /me/nickname`을 계정 기능 활동으로 인정하는 분류가 승인됐다. JWT → 입력 → 해당 endpoint에 향후 승인된 제한 → user/session lock → 활성·미만료 확인 → 활동 commit → 기능 처리 순서다. Nickname 횟수/cooldown 제한은 없고 검색 quota를 공유하지 않는다.

최초 admission의 인증/입력 거절은 활동 0이다. 이후 기능 실패에도 인정한 활동을 유지하므로 nickname update 실패와 함께 activity commit을 임의 rollback하지 않는다. 계정 조회/nickname mutation 기능 단계는 다시 user/session 유효성을 잠금 안에서 확인해 logout/삭제 뒤 조회·변경을 막는다.

두 번째 확인에서 경합으로 401이면 **인정 후 기능 단계 거절**이다. 이미 commit한 활동은 유지하고 조회 결과/nickname mutation은 0이다. 삭제의 cascade 결과는 존중한다. 최초 거절의 활동 0과 혼동하지 않는다. JWT는 최초 admission에서 판정하고 기능 단계 시간 경과만으로 인정한 활동을 되돌리지 않는다.

Health/refresh/logout/login 상태 확인은 기존 session 활동이 아니다. 계정/인증 기능의 DB 장애는 auth용 503이며 검색 DB 장애의 500과 구분한다.

## 검증 경계

공개 검색은 credential 없이 입력·quota·upstream 경로를 검증한다. 계정 endpoint는 기존 인증·활동 commit·logout/삭제 경합의 검증을 유지한다. 검색 정책 변경을 계정 인증 완화나 DB 검증 완료로 해석하지 않는다.
