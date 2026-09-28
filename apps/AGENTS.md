# App Agent Instructions

Root `AGENTS.md`와 실제 변경 경로의 하위 지침을 함께 따른다. 각 앱의 제품 계약은 [문서 안내](../docs/README.md), 현재 진입점·명령은 해당 앱 README에서 찾는다.

- React/browser UI 변경은 [공통 UI 책임](../docs/rules/design-system.md#react-ui-책임)과 [스타일 계약](../docs/rules/design-system.md#화면별-스타일-조정)을 적용한다. Compiler 연결·현재 예시는 [앱 공통 StyleX](../docs/reference/app-styling.md)에서 확인한다.
- 실제 호출 경로와 같은 역할의 기존 코드를 확인한다. Desktop의 폴더 구조를 다른 앱에 그대로 만들거나, 기존 코드의 규칙 위반을 새 구현의 근거로 삼지 않는다.
- 서버·main·preload 코드는 각 제품의 신뢰 경계를 따른다. UI의 확인 창이나 버튼 비활성화가 서버·IPC의 입력 검증과 실행 조건을 대신하지 않는다.
