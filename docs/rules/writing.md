---
type: rule
status: active
scope: repository prose, UI copy, comments, and the dfragon-design handoff repository
last-reviewed: 2026-10-09
---

# 표기와 문체

제품 이름의 표기와 사용자에게 보이는 문구의 문체를 정한다. 제품 저장소와 디자인 인계 저장소 [dfragon-design](https://github.com/blahaj94/dfragon-design)이 같은 기준을 따른다. 기준을 바꿀 때는 이 문서와 `scripts/check-writing.mjs`를 함께 고치고, 디자인 저장소의 검사도 같은 규칙으로 맞춘다.

## 제품 이름

- 산문, UI 문구, 주석, 창 제목, 설치 파일과 바로 가기의 표시 이름에서 제품 이름은 `DFragon`으로 쓴다. `DFRAGON`, `Dfragon`은 쓰지 않는다.
- 식별자는 바꾸지 않는다. `DFRAGON_` 접두어의 환경 변수와 빌드 상수, `@dfragon/*` 패키지, `dfragon` 실행 파일, profile, protocol 이름, `dfragon.com` 도메인, `DFRAGON-MODIFICATIONS.txt` 같은 파일 이름은 그대로 둔다. 검사는 앞뒤에 `_`, `-`, 영숫자가 붙은 표기를 식별자로 보고 건너뛴다.
- 코드에서 제품 이름이 단독으로 서거나 영문 제목에 들어갈 때는 `@dfragon/lib`의 `PRODUCT_NAME`을 쓴다. HTML `<title>`처럼 import할 수 없는 곳과 `DFragon을`처럼 한국어 조사가 붙는 문장은 문자열로 쓴다.
- Penpot 보드 안의 로고 글자와 외부 저장소 이름은 이 규칙의 대상이 아니다.

## 사용자 문구의 문체

- 화면, 대화상자, 오류 메시지, 알림처럼 사용자에게 보이는 한국어 문구는 합니다체로 쓴다. 서술은 `~합니다`, `~입니다`, 요청은 `~하세요`, `~해 주세요`, 확인 질문은 `~하시겠습니까?`를 쓴다.
- `~해요`, `~이에요`, `~할게요`, `~할까요`, `~죠` 같은 해요체 어미는 쓰지 않는다. 검사는 문자열과 문서를 가리지 않고 한글 뒤에 와서 문장 끝이나 구두점으로 이어지는 이 어미를 찾는다.
- 문서 문체는 저장소별 기존 기준을 유지한다. 제품 저장소의 Rule과 Reference는 한다체, 앱 README와 디자인 인계 저장소의 문서는 합니다체다.
- 사용자가 직접 쓰는 콘텐츠의 예시 데이터는 문체 규칙의 대상이 아니다. 디자인 저장소의 `design/fixtures/`가 여기에 해당한다.

## 나열 기호

- 산문, 문구, 주석에서 항목을 나열할 때는 가운뎃점 대신 쉼표와 공백을 쓴다. 예: `측정 조건, 스킬, 데미지`.
- 창 제목이나 상태 표시에서 양쪽에 공백을 둔 ` · ` 구분자는 나열이 아니므로 허용한다. 예: `DFragon · host`, `처리 중 · 3초 경과`. 검사는 양쪽에 공백이 없는 가운뎃점만 위반으로 본다.

## 검사

`scripts/check-writing.mjs`가 Git이 추적하는 텍스트 파일에서 위 표기와 어미를 찾아 `경로:줄: 규칙: 내용`으로 출력하고, 위반이 있으면 실패한다. 이 문서와 검사 스크립트, 그 테스트는 금지 표기를 예시로 담으므로 검사에서 제외하고, `packages/lib/src/cp949-characters.ts`와 `apps/desktop/assets/ocr/korean-dict.txt`는 가운뎃점이 문자 표와 사전의 데이터라 제외한다. 사용법은 [scripts 안내](../../scripts/README.md#check-writing)에 있다. Code Quality의 Static checks가 `pnpm check:writing`을 실행하며, 디자인 저장소는 같은 정규식을 `git grep`으로 실행하는 workflow를 둔다.
