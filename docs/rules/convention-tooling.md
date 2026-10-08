---
type: rule
status: active
scope: repository handwritten source, tests, scripts and tooling
last-reviewed: 2026-10-08
---

# Convention 도구 적용

이 문서는 저장소의 ESLint·Prettier·Oxlint 설정, 생성물 소유권과 CI 계약을 정의한다. 실행 명령과 현재 적용 범위는 package/config 및 아래 Reference에서 확인한다.

## 설정과 소유권

Root의 `eslint.config.mjs`, `.prettierrc.json`, `.prettierignore`를 공유한다. 실제 version·command·범위는 [Repository Map](../reference/repository-map.md#공통-정적-검사와-정렬)과 package/config가 설명한다. 공통 설정의 이전 승인 근거는 [PR #163](https://github.com/blahaj94/ldb/pull/163), [PR #165](https://github.com/blahaj94/ldb/pull/165)에 남아 있다.

- `lint`·`format:check`는 비수정 검사, `lint:fix`·`format`은 현재 설정 범위의 수정이다. Formatter를 ESLint plugin 안에서 중복 실행하지 않는다.
- Prettier 적용 범위의 줄바꿈·들여쓰기·따옴표·세미콜론·trailing comma는 도구 출력을 따른다. 예전 수동 체인 배치나 백틱 위치로 되돌리지 않는다.
- JavaScript/TypeScript의 `return` 문이 블록의 첫 문장이면 앞에 빈 줄을 두지 않는다. 앞에 다른 문장이 있으면 `return` 바로 앞에 빈 줄 한 줄을 둔다. `.prettierrc.json`의 로컬 `scripts/prettier-return-spacing.mjs` 플러그인이 기존 ESTree 프린터에 필요한 줄바꿈만 추가하며, `format`·`format:check`와 공통 설정을 읽는 에디터에 같은 정책을 적용한다. 주석과 반환식·ASI는 기존 프린터가 처리하며 문자열 내부 값은 바꾸지 않는다.
- 같은 문장 목록에서 블록 형태의 `if` 문이 연속되면 두 문 사이에 빈 줄 한 줄을 둔다. 같은 플러그인이 두 블록 사이만 처리하며 `else`·`else if` 연결과 블록이 없는 `if`의 기존 배치는 유지한다.
- `singleQuote: true`, `semi: false`, `printWidth: 100`, `trailingComma: none`, `embeddedLanguageFormatting: off`의 공통 기준을 유지한다. 문자열 내부 source·값·개행·공백은 별도로 보존한다.
- JavaScript/TypeScript의 `return` 식에서 삼항 연산자와 `??`로 값을 고르지 않고 `if` 등 명시적 분기로 반환한다. 반환 객체 리터럴의 속성값에 조건식, 논리식을 직접 쓰지 않고 먼저 의미 있는 지역 변수에 할당한다. 중첩 삼항은 사용하지 않는다. Root ESLint의 `no-restricted-syntax`, `no-nested-ternary`가 모든 handwritten source에 적용한다. `return a || b` 같은 불리언 판정식 반환과 변수 할당의 단일 삼항은 허용한다.
- 직접 관리하는 JavaScript/TypeScript 제품 코드와 빌드, 관리 도구의 정규식 리터럴은 사용처에 직접 쓰지 않고, 검사 목적과 도메인 의미가 드러나는 `const` 상수의 초기값으로 선언한다. 사용하는 로직 가까이에 두며 모듈 상단, `export const`, 함수 안 `const`를 모두 허용한다. 같은 패턴도 책임과 변경 이유가 같을 때만 합친다. `new RegExp(문자열)`의 패턴 문자열은 이번 검사 범위에서 제외한다.
- 정규식의 플래그와 상태에 따른 동작을 보존한다. `g`, `y` 정규식의 `.test()`, `.exec()` 등 상태 의존 사용은 호출 간 `lastIndex`를 공유하지 않도록 함수 안 `const`로 유지한다. 모듈 상수 추출은 문자열 치환 등 기존 상태 동작을 보존하는 사용에서만 허용한다. 플래그나 호출 방식을 바꾸려면 동작이 같다는 근거가 필요하다.
- 정규식 규칙은 `*.test.*`, `*.spec.*`, `*.fixture.*`, `test/`, `tests/`, `__tests__/`, `fixture/`, `fixtures/`, `testing/`, `test-support/`의 테스트 코드에 적용하지 않는다. Desktop의 `scripts/*fixture*`, `scripts/credential-store-native`와 launcher, `scripts/search-server-integration/`, UI의 `scripts/test-consumer-resolution.mjs`도 테스트 전용 실행 코드로 제외한다. `generated/`, `vendor/`, `*.generated.*`와 기존 전역 ignore 대상도 제외하며, 테스트의 `assert.match(value, /.../)`는 허용한다. 직접 관리하는 `build/` 도구와 Vite, Vitest 설정은 검사한다. 이 제외는 정규식 selector에만 적용하고 기존 `return` 식 selector와 중첩 삼항 규칙의 범위는 유지한다.
- ESLint의 환경별 검사와 `curly: ["error", "all"]`, 마지막 `eslint-config-prettier`의 역할을 유지한다. 현재 설정에 없는 naming/custom rule·plugin을 암묵적으로 도입하지 않는다.
- Root TypeScript는 parser·lint용이다. App compiler/runtime을 이 설정 정리로 교체하지 않는다. Web/UI의 기존 보조 Oxlint를 검증 없이 제거하거나 다른 검사로 대체하지 않는다.
- Generated/vendor·OCR·고정 SEED source·provenance·lockfile·license/notice의 소유 규칙과 기존 ignore를 유지한다. `build`라는 경로 이름만으로 직접 관리 generator source를 제외하지 않는다. Broad 자동수정으로 무관한 파일을 바꾸지 않는다.

## 검증과 CI

관련 파일에 필요한 fixer·formatter를 적용하고 diff의 의미와 비수정 검사를 확인한다. 최초 설정이나 충돌 조정에서 수렴 여부가 불확실할 때만 재확인하며 매 실행마다 반복하지 않는다. 동작이나 공통 설정이 바뀌면 영향받는 소비자를 확인한다. 현재 명령은 [scripts 안내](../../scripts/README.md#native-validation)에서 찾는다.

`scripts/test/eslint-regex-literal.test.mjs`는 정규식 리터럴의 거부, 허용 사례와 테스트, 생성물 제외 범위를 검증한다. 기존 return 규칙은 제품 코드와 테스트 코드 모두에서 계속 검증한다. 두 검사는 `pnpm test:tooling`에 포함된다.

`scripts/test/eslint-return-expression.test.mjs`는 `pnpm test:tooling`에서 위 `return` 식 규칙의 거부, 허용 사례를 검증한다. `pnpm test:format-policy`는 블록 첫 `return`의 빈 줄 제거와 이후 `return`의 빈 줄 유지, 연속된 블록 `if` 사이 빈 줄·`else if` 연결·directive·빈 문장·주석·분기·switch·ASI·확장자별 설정과 CLI의 포맷 및 검사 수렴을 검증한다. 공통 프린터 정책을 변경할 때 같은 검사를 실행한다.

기존 Code Quality CI의 root ESLint·Prettier와 Web/UI 보조 Oxlint를 유지한다. 같은 검사를 workspace별로 중복할 의무는 없으며 실패를 glob·ignore·disable이나 기대값 약화로 숨기지 않는다. 도구 성공을 제품 계약이나 전체 컨벤션 이행 완료로 확대하지 않는다.
