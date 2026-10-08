---
type: rule
status: active
scope: repository handwritten source, tests, scripts and tooling
last-reviewed: 2026-10-09
---

# Convention 도구 적용

이 문서는 저장소의 Biome, Oxlint 설정과 문장 간격 도구, 생성물 소유권과 CI 계약을 정의한다. 실행 명령과 현재 적용 범위는 package/config 및 아래 Reference에서 확인한다.

## 설정과 소유권

Root의 `biome.json`, `scripts/biome/`의 GritQL lint 플러그인, `scripts/statement-spacing.mjs`를 모든 프로젝트가 공유한다. 실제 version, command, 범위는 [Repository Map](../reference/repository-map.md#공통-정적-검사와-정렬)과 package/config가 설명한다. 이전 ESLint, Prettier 공통 설정의 승인 근거는 [PR #163](https://github.com/blahaj94/ldb/pull/163), [PR #165](https://github.com/blahaj94/ldb/pull/165)에 남아 있다.

- `lint`, `format:check`는 비수정 검사, `lint:fix`, `format`은 현재 설정 범위의 수정이다. `format`은 Biome 포맷 뒤 문장 간격 도구를 실행하고 `format:check`도 같은 순서로 검사한다. Biome assist의 import 정렬과 `biome check`의 일괄 수정은 사용하지 않는다.
- Biome 포맷 범위의 줄바꿈, 들여쓰기, 따옴표, 세미콜론, trailing comma는 도구 출력을 따른다. 예전 수동 체인 배치, 백틱 위치나 이전 Prettier 출력으로 되돌리지 않는다.
- JavaScript/TypeScript의 작은따옴표, 필요한 곳에만 쓰는 세미콜론, 줄 너비 100, trailing comma 없음, 공백 2칸 들여쓰기의 공통 기준을 유지한다. CSS도 작은따옴표를 쓰며 HTML의 void 요소는 self-close한다. 문자열과 템플릿 리터럴 안의 source, 값, 개행, 공백은 정렬하지 않는다.
- Biome가 정렬하지 않는 YAML, Markdown과 SVG 자산은 자동 정렬 대상이 아니다.
- JavaScript/TypeScript의 `return` 문이 블록이나 `case`의 첫 문장이면 앞에 빈 줄을 두지 않는다. 앞에 다른 문장이 있으면 `return` 바로 윗줄을 빈 줄로 두며, 윗줄이 주석이면 주석과 `return` 사이에 둔다. 첫 문장 앞의 빈 줄 제거는 Biome가, 이후 `return` 앞의 빈 줄 추가는 `scripts/statement-spacing.mjs`가 처리한다. 도구는 TypeScript parser로 문장 목록을 읽고 필요한 줄바꿈만 추가하며 주석, 반환식, 문자열 값은 바꾸지 않는다.
- 같은 문장 목록에서 블록 형태의 `if` 문이 연속되면 앞 `if`의 끝과 다음 `if` 사이에 빈 줄 한 줄을 둔다. 빈 줄이 없으면 다음 `if` 줄 바로 위에 추가한다. `else`, `else if` 연결과 블록이 없는 `if`, label에 붙은 문장은 Biome 배치를 유지한다.
- Biome는 formatter plugin을 지원하지 않으므로 에디터의 Biome 포맷은 위 빈 줄을 추가하지 않는다. Root나 workspace의 `format`으로 적용하며 `format:check`가 누락을 실패로 보고한다.
- JavaScript/TypeScript의 `return` 식에서 삼항 연산자와 `??`로 값을 고르지 않고 `if` 등 명시적 분기로 반환한다. 반환 객체 리터럴의 속성값에 조건식, 논리식을 직접 쓰지 않고 먼저 의미 있는 지역 변수에 할당한다. 중첩 삼항은 사용하지 않는다. `scripts/biome/return-expression.grit` 플러그인과 Biome `noNestedTernary`가 모든 handwritten source에 적용한다. `return a || b` 같은 불리언 판정식 반환과 변수 할당의 단일 삼항은 허용한다.
- 직접 관리하는 JavaScript/TypeScript 제품 코드와 빌드, 관리 도구의 정규식 리터럴은 사용처에 직접 쓰지 않고, 검사 목적과 도메인 의미가 드러나는 `const` 상수의 초기값으로 선언한다. 사용하는 로직 가까이에 두며 모듈 상단, `export const`, 함수 안 `const`를 모두 허용한다. 같은 패턴도 책임과 변경 이유가 같을 때만 합친다. `new RegExp(문자열)`의 패턴 문자열은 이번 검사 범위에서 제외한다. `scripts/biome/regex-literal-constant.grit` 플러그인이 검사한다.
- 정규식의 플래그와 상태에 따른 동작을 보존한다. `g`, `y` 정규식의 `.test()`, `.exec()` 등 상태 의존 사용은 호출 간 `lastIndex`를 공유하지 않도록 함수 안 `const`로 유지한다. 모듈 상수 추출은 문자열 치환 등 기존 상태 동작을 보존하는 사용에서만 허용한다. 플래그나 호출 방식을 바꾸려면 동작이 같다는 근거가 필요하다.
- 정규식 규칙은 `*.test.*`, `*.spec.*`, `*.fixture.*`, `test/`, `tests/`, `__tests__/`, `fixture/`, `fixtures/`, `testing/`, `test-support/`의 테스트 코드에 적용하지 않는다. Desktop의 `scripts/*fixture*`, `scripts/credential-store-native`와 launcher, `scripts/search-server-integration/`, UI의 `scripts/test-consumer-resolution.mjs`도 테스트 전용 실행 코드로 제외한다. `generated/`, `vendor/`, `*.generated.*`와 기존 전역 ignore 대상도 제외하며, 테스트의 `assert.match(value, /.../)`는 허용한다. 직접 관리하는 `build/` 도구와 Vite, Vitest 설정은 검사한다. 이 제외는 `biome.json`에서 정규식 플러그인을 붙이는 override에만 적용하고 `return` 식 플러그인과 중첩 삼항 규칙의 범위는 유지한다.
- `biome.json`은 Biome recommended를 쓰지 않고(`preset: none`) 이전 ESLint 구성에 대응하는 규칙만 켠다. `@eslint/js` recommended는 모든 source, typescript-eslint recommended는 TypeScript와 API, Accounts, Desktop의 JavaScript, React 기본 규칙은 Desktop, hooks와 React Compiler 검사는 Desktop TypeScript와 Accounts browser, Fast Refresh export 검사는 테스트를 제외한 Desktop(error), Web(warn)에 둔다. `curly: all`은 `useBlockStatements`로 유지한다. 현재 설정에 없는 naming/custom rule, plugin을 암묵적으로 도입하지 않는다.
- Biome에 대응 규칙이 없거나 기존 코드에서 허용하던 사례까지 거부해 적용하지 않은 ESLint 검사는 다음과 같다. Browser와 Node의 전역 구분, API, Accounts의 `no-unexpected-multiline`, `no-empty`(Biome 규칙은 빈 함수 본문까지 거부), Desktop의 `explicit-function-return-type`(Biome nursery 규칙은 타입이 정해진 객체 메서드까지 거부)과 설명이 있는 `@ts-ignore` 허용, React의 `display-name`, `prop-types`, `no-unescaped-entities` 등이다. 다시 도입하려면 기존 코드 영향과 함께 별도 변경으로 정한다.
- Biome는 정확한 버전으로 고정한다. 버전을 바꾸면 포맷 결과와 nursery 규칙이 달라질 수 있으므로 `pnpm format` 결과 diff와 `pnpm test:tooling`을 함께 확인한다.
- Root TypeScript는 문장 간격 도구의 parser 전용이다. App compiler/runtime을 이 설정 정리로 교체하지 않는다. Web/UI의 기존 보조 Oxlint를 검증 없이 제거하거나 다른 검사로 대체하지 않는다.
- Generated/vendor, OCR, 고정 SEED source, provenance, lockfile, license/notice의 소유 규칙과 기존 ignore를 유지한다. 제외 범위는 `biome.json`의 `files.includes`와 Git ignore 연동이 정하며, 문장 간격 도구도 같은 includes와 Git ignore 기준을 따른다. `build`라는 경로 이름만으로 직접 관리 generator source를 제외하지 않는다. Broad 자동수정으로 무관한 파일을 바꾸지 않는다.

## 검증과 CI

관련 파일에 필요한 fixer, formatter를 적용하고 diff의 의미와 비수정 검사를 확인한다. 최초 설정이나 충돌 조정에서 수렴 여부가 불확실할 때만 재확인하며 매 실행마다 반복하지 않는다. 동작이나 공통 설정이 바뀌면 영향받는 소비자를 확인한다. 현재 명령은 [scripts 안내](../../scripts/README.md#native-validation)에서 찾는다.

`scripts/test/biome-regex-literal.test.mjs`는 정규식 리터럴의 거부, 허용 사례와 테스트, 생성물 제외 범위를 검증한다. 기존 return 규칙은 제품 코드와 테스트 코드 모두에서 계속 검증한다. `scripts/test/biome-return-expression.test.mjs`는 위 `return` 식 규칙과 중첩 삼항의 거부, 허용 사례를 검증한다. 두 검사는 저장소의 `biome.json`과 플러그인을 격리된 임시 디렉터리에 복사해 실제 Biome CLI로 실행하며 `pnpm test:tooling`에 포함된다.

`pnpm test:format-policy`는 Biome 포맷 뒤 문장 간격 도구를 적용한 결과로 블록, `case` 첫 `return`의 빈 줄 제거와 이후 `return`의 빈 줄, 연속된 블록 `if` 사이 빈 줄, `else if` 연결, directive, 빈 문장, 주석, 분기, ASI, 확장자별 결과와 Biome 재검사의 수렴을 검증한다. CLI가 실행 위치와 Biome 제외 경로, Git ignore 대상을 따르는지도 확인한다. 공통 포맷 정책을 바꾸거나 Biome를 갱신할 때 같은 검사를 실행한다.

기존 Code Quality CI의 root Biome lint, format 검사와 Web/UI 보조 Oxlint를 유지한다. 같은 검사를 workspace별로 중복할 의무는 없으며 실패를 glob, ignore, disable이나 기대값 약화로 숨기지 않는다. 도구 성공을 제품 계약이나 전체 컨벤션 이행 완료로 확대하지 않는다.
