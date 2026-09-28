# OCR Agent Instructions

[상위 앱 지침](../AGENTS.md)을 따르며 제품 동작은 [OCR 계약](../../docs/rules/ocr-workspace.md), 실행·API·현재 구현은 [앱 안내](README.md)에서 확인한다.

- `browser`의 React UI는 공통 UI 계약을 적용한다. 요청·상태 연결은 기존 `browser/hooks`, 표시 상수는 `browser/constants.ts`, 조회 키·무효화는 `browser/query.ts`의 책임을 확인하고 같은 위치에 연결한다.
- `browser/App.tsx`에서 사용하는 화면과 hook을 따라 읽고, 서버의 저장·배정·인증 조건은 `src`의 실제 호출 경로에서 확인한다. 브라우저와 서버의 검증 책임을 바꾸지 않는다.
- 변경한 화면의 검증은 README의 `test:ui`, 서버 동작은 관련 `test`를 사용한다. 운영 자료의 재배정·배포는 개발·검증 승인에 포함되지 않는다.
