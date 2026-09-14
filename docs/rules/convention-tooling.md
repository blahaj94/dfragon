---
type: rule
status: active
scope: repository handwritten source, tests, scripts and tooling
last-reviewed: 2026-09-14
---

# Convention 도구 적용

기계적인 표기·정적 검사는 현재 ESLint·Prettier·Oxlint 설정과 native command에 맡긴다. 이름·책임·평가 순서·오류·cleanup·문자열 값은 [convention.md](../../convention.md)에 따라 담당자가 판단한다. 도구 실행만을 위한 별도 역할이나 packet은 필요 없다.

## 설정과 소유권

Root의 `eslint.config.mjs`, `.prettierrc.json`, `.prettierignore`를 공유한다. 실제 version·command·범위는 [Repository Map](../reference/repository-map.md#공통-정적-검사와-정렬)과 package/config가 설명한다. 공통 설정의 이전 승인 근거는 [PR #163](https://github.com/blahaj94/ldb/pull/163), [PR #165](https://github.com/blahaj94/ldb/pull/165)에 남아 있다.

- `lint`·`format:check`는 비수정 검사, `lint:fix`·`format`은 현재 설정 범위의 수정이다. Formatter를 ESLint plugin 안에서 중복 실행하지 않는다.
- Prettier 적용 범위의 줄바꿈·들여쓰기·따옴표·세미콜론·trailing comma는 도구 출력을 따른다. 예전 수동 체인 배치나 백틱 위치로 되돌리지 않는다.
- `singleQuote: true`, `semi: false`, `printWidth: 100`, `trailingComma: none`, `embeddedLanguageFormatting: off`의 공통 기준을 유지한다. 문자열 내부 source·값·개행·공백은 별도로 보존한다.
- ESLint의 환경별 검사와 `curly: ["error", "all"]`, 마지막 `eslint-config-prettier`의 역할을 유지한다. 현재 설정에 없는 naming/custom rule·plugin을 암묵적으로 도입하지 않는다.
- Root TypeScript는 parser·lint용이다. App compiler/runtime을 이 설정 정리로 교체하지 않는다. Web/UI의 기존 보조 Oxlint를 검증 없이 제거하거나 다른 검사로 대체하지 않는다.
- Generated/vendor·OCR·고정 SEED source·provenance·lockfile·license/notice의 소유 규칙과 기존 ignore를 유지한다. `build`라는 경로 이름만으로 직접 관리 generator source를 제외하지 않는다. Broad 자동수정으로 무관한 파일을 바꾸지 않는다.

## 검증과 CI

관련 파일에 필요한 fixer·formatter를 적용하고 diff의 의미와 비수정 검사를 확인한다. 최초 설정이나 충돌 조정에서 수렴 여부가 불확실할 때만 재확인하며 매 실행마다 반복하지 않는다. 동작이나 공통 설정 영향은 [Testing](testing.md)에 따라 필요한 범위를 검사한다.

기존 Code Quality CI의 root ESLint·Prettier와 Web/UI 보조 Oxlint를 유지한다. 같은 검사를 workspace별로 중복할 의무는 없으며 실패를 glob·ignore·disable이나 기대값 약화로 숨기지 않는다. 도구 성공을 제품 계약이나 전체 컨벤션 이행 완료로 확대하지 않는다.
