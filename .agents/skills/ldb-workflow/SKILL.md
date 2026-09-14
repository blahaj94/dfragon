---
name: ldb-workflow
description: LDB 개발 요청의 관련 제품 계약과 작업·검증 명령을 찾는다.
---

# LDB Workflow

[개발 흐름](../../../docs/rules/agent-workflow.md)을 기준으로 요청에서 구현·검증·PR까지 진행한다. 필요한 제품 계약은 [문서 안내](../../../docs/README.md), 실제 명령은 [scripts 안내](../../../scripts/README.md#native-validation)와 [Repository Map](../../../docs/reference/repository-map.md)에서 찾는다.

일반 작업은 안전한 Git 브랜치에서 시작한다. Issue 기반 branch·worktree 준비가 필요할 때만 [start-task](../../../scripts/README.md#start-task)를 선택한다. 이 도구는 기존 진행 작업의 base나 branch를 대신하지 않으며 제품별 실행 권한을 부여하지 않는다.
