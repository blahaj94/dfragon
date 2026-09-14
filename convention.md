---
type: rule
status: active
scope: repository handwritten source, tests, scripts and tooling
last-reviewed: 2026-09-14
---

# Project Convention

## 적용 범위와 권한

직접 작성하는 제품 코드·테스트·scripts·tooling에 적용한다. 요청과 관련된 변경에서 가독성을 개선하며, 기존 표현이 다르다는 이유로 전수 교정이나 별도 이행 프로젝트를 시작하지 않는다. Generated/vendor 산출물은 직접 고치지 않고 소유한 source·template을 따른다.

제품의 architecture·domain·security·API 계약과 하위 `AGENTS.md`의 구체 경계를 유지한다. 가독성 수정에 제품 동작 변경을 숨기지 않는다. 작업·권한은 [개발 흐름](docs/rules/agent-workflow.md), 검증은 [Testing](docs/rules/testing.md)을 따른다.

## 이름과 책임

입력 확인, 주요 처리, 외부 호출, 상태 변경과 결과 반환을 따라 읽을 수 있게 작성한다. 단계가 바뀌면 빈 줄과 의미 있는 이름을 사용하되 작업에 없는 단계를 만들지 않는다. Test도 준비·실행·검증의 흐름을 드러낸다.

- 이름은 대상과 역할, 실제 보장 수준을 설명한다. 시간은 생성 시점과 재검사 시점을 구분한다. 짧은 범위의 명확한 `row`, `result`, `now`는 그대로 쓸 수 있다.
- 조건의 의미가 표현만으로 분명하면 비교식·boolean 반환·검색 callback을 직접 쓸 수 있다. 이름이 판단을 설명하거나 복합 조건의 이해에 도움이 될 때 boolean을 둔다. 모든 비교의 변수화나 최종 합성 변수를 의무화하지 않는다.
- `is`, `has`, `can`, `should`는 true의 실제 의미를 드러내야 한다. 명명한 개별 검사가 앞선 조건의 실패까지 포함하면서 그 검사 자체의 결과인 것처럼 보이지 않게 한다. 실제 업무 의미가 있는 합성은 허용한다.
- Helper는 실제 책임이나 경계를 드러낼 때 분리한다. 호출을 전달할 뿐인 wrapper, 함수 길이만 줄이는 이동, 불필요한 layer·class·DTO는 만들지 않는다. 함수·파일·PR 크기가 이해와 검토를 방해하면 의미 있는 책임으로 나눈다. 줄 수 할당량은 없다.
- 여러 입력의 역할이나 순서가 불명확하면 이름 있는 객체 인자를 고려한다. 명확한 단일 인자와 외부 API·callback signature는 유지한다.
- 문자열 생성이나 method chain이 응집되고 읽기 쉬우면 그대로 사용한다. 복잡한 분기·변환의 책임을 드러내는 분리는 하되, 여러 줄이라는 이유만으로 변수·함수를 만들지 않는다.

## 값과 평가 의미

Nullish 존재와 boolean·빈 값·유효 범위를 구분한다. JavaScript/TypeScript의 `value == null`·`value != null`은 null과 undefined를 함께 검사한다. 일반 비교와 둘 중 하나만 구분하는 계약은 strict 비교를 쓴다. Nonboolean truthiness를 존재 검사로 오인하지 않으며 `0`, 빈 문자열, `false`, `NaN`을 처리하던 기존 의미를 확인한다.

```ts
function hasNonEmptyText(value: string | null | undefined): boolean {
  return value != null && value.length > 0
}
```

이 예시는 문자열 존재와 내용을 함께 검사하며, 뒤의 property 접근을 앞의 존재 검사가 보호한다. 빈 문자열 허용 여부는 해당 제품 계약을 따른다.

- 단락 평가와 type·존재 guard를 보존한다. 이름을 붙이기 위해 원래 실행되지 않던 property 접근이나 호출을 미리 실행하지 않는다. Type narrowing을 복구하려고 근거 없는 assertion을 추가하지 않는다.
- Getter·Proxy·coercion, 상태를 가진 정규식, 시계·난수·I/O·lock·취소·async의 평가 시점·횟수·순서와 오류 우선순위를 보존한다. `readonly`나 짧은 비교식이라는 이유로 순수성을 추정하지 않는다.
- 독립 순수 검사는 결과·오류·관찰 가능한 상태·업무 비용 제한이 변하지 않는 근거가 있을 때만 평가를 분리할 수 있다. 불확실하면 기존 단락 평가를 유지한다.
- 반복과 재시도는 동적 length, 마지막 false 검사, continue·증분·await의 순서를 유지한다. Fresh time이나 변경된 상태의 재검사를 처음 계산한 값으로 고정하지 않는다. 형식을 맞추기 위해 순회 방식을 교체하거나 병렬화하지 않는다.
- 민감 값과 Promise 참조의 수명, cleanup·rollback·release, commit 이후 결과 전달과 객체 identity를 보존한다. 문자열 안의 실행 source·공백·개행도 값이므로 단순 정렬로 바꾸지 않는다.

## 오류와 신뢰 경계

실패를 판단한 위치에서 module의 명시적 오류 의미를 정한다. 기존 로그인 오류는 `LoginFailure`와 해당 catalog를 사용하고 다른 module에 로그인 오류나 공통 Error framework를 강제하지 않는다. TypeError는 type 계약 위반에 사용하며 권한·만료·상태 실패를 일괄 변환하지 않는다.

이미 분류된 오류는 보존하고 외부 library·DB·provider·IPC 오류는 소유 경계에서 기존 정책으로 정제한다. 예상한 외부 실패와 내부 버그를 임의로 합치지 않는다. Error return/throw나 선택 인자에 commit·rollback 정책을 숨기지 않는다. 여러 검사에서 같은 오류를 쓸 수 있으며 검사마다 새 Error class를 만들 필요는 없다.

정적 오류 catalog는 runtime 정의 한 곳에서 TypeScript의 구체 타입을 파생한다. `as const`·`satisfies`는 compile-time 검사이며 runtime validation·객체 동결을 대신하지 않는다. Catalog key의 중복·덮어쓰기와 `stack`·`cause`의 기존 정제 계약을 보존한다.

Renderer·외부 입력은 해당 신뢰 경계에서 runtime 검증한다. TypeScript 타입이나 mock 통과로 이를 대체하지 않는다. 오류 가독성을 이유로 원문 error·token·credential·URL·identity를 응답이나 log에 추가 노출하지 않는다.

## 도구와 리뷰

표기는 기존 formatter/linter에 맡기고 이름·책임·평가·오류·cleanup은 담당자가 판단한다. [도구 적용 기준](docs/rules/convention-tooling.md)의 설정·생성물 경계를 따른다. 주석은 코드 번역보다 잠금 뒤 재검사, commit 이후 반환 등 필요한 이유와 보존 조건을 설명한다.

자체 검토에서는 변경의 실제 동작과 계약, 이해하기 어려운 책임, 오류·상태·cleanup의 손실을 확인한다. 표현 취향만으로 반복 교정을 요구하지 않는다. 테스트 assertion과 경합 관측을 약화하지 않는다. [코드 재사용](docs/rules/code-reuse.md)의 기존 구현·표준 API·적합한 패키지를 우선한다.
