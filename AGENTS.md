# DFRAGON Agent Instructions

사용자가 실제로 쓸 기능을 빠르게 제공하고 배포 후 반응을 확인하는 것을 우선한다. 명확한 사용자 요청에서 시작해 탐색, 구현, 관련 테스트와 문서, PR까지 완성한다. 기본 흐름은 **요청 확인 → 구현 → 영향 범위 검증 → 결과/PR 전달 → 사용자 merge**다. 출시를 늦추는 선행 작업과 검증의 범위는 [개발 흐름](docs/rules/agent-workflow.md#출시-우선순위)을 따른다.

- 현재 checkout, 기준 commit, 미commit 변경과 관련 진행 작업을 확인한다. 안전한 작업 브랜치를 사용하고, 병렬 편집이나 미완료 변경의 격리가 필요하면 worktree를 쓴다. main 직접 commit·push와 AI merge는 금지한다.
- 일상 개발 절차의 원본은 [개발 흐름](docs/rules/agent-workflow.md)이다. Issue, 사전 댓글, 역할 배정, 모델 분류는 착수 조건이 아니다.
- 현재 요청과 변경 대상에서 맥락을 좁힌다. 필요한 하위 `AGENTS.md`와 [주제별 제품 계약](docs/README.md)을 실제로 읽는다. 같은 revision에서 읽은 본문은 재독하지 않고, 관련 변경이나 불확실성이 있을 때만 확장한다.
- 명령은 [scripts 안내](scripts/README.md), workspace 현황은 [Repository Map](docs/reference/repository-map.md)에서 찾는다. 검증은 [Testing](docs/rules/testing.md)에 따라 실제 영향과 위험에 맞게 선택한다.
- 코드의 이름·책임·평가 순서·오류·cleanup·신뢰 경계는 [convention.md](convention.md)를 따른다. 관련 없는 전수 교정이나 새 관리 시스템을 만들지 않는다.
- 요청 안의 되돌릴 수 있는 구현 선택은 담당자가 결정한다. 중요한 제품 선택이나 기존 승인·금지와의 충돌만 질문하고, 영향받지 않는 작업은 계속한다.
- Rule은 동작·제약을, code·config·test는 현재 구현을 정의한다. Reference의 현황 오류는 고치되 제품 계약 충돌을 임의로 해소하지 않는다. 사용자가 허용한 Rule 변경은 채택 범위를 명시한 PR에서 구현·검증하며, 다른 작업에는 사용자 merge 후 적용한다.
- 다른 담당자의 변경·실행 중인 job·기존 실패와 승인 기록을 보존한다. 절차 개편은 제품 완료나 미확정 OS·provider·DB·운영·복구 검증의 통과를 뜻하지 않는다.
- Secret, token, credential, 개인정보는 공개·비공개 여부와 무관하게 code·commit·Issue·PR·log·문서에 기록하지 않는다. 개인 경로, 내부 대화·실행 ID와 raw log도 공개 기록에 넣지 않는다. 결과는 [작성 기준](docs/rules/writing.md)에 따라 필요한 사실과 한계를 짧게 전달한다.
