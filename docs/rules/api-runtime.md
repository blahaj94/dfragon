---
type: rule
status: active
enforcement: approval-required
scope: apps/api
last-reviewed: 2026-10-29
rationale: 검색 구현이 runtime과 검증 도구를 추측해 추가하지 않도록 승인 경계를 정한다.
evidence: "2026-09-05 PR #42 runtime 계약 merge; 2026-10-26 #796 인증, DB 제거; 2026-10-29 #992 메모리 캐시"
review-after: 지원 Node 또는 Nest major 변경 시
---

# API Runtime Contract

이 Rule은 API runtime과 검증 계약을 정의한다. API는 인증과 DB 없이 동작한다([Issue #796](https://github.com/dungeon-and-dragon/dfragon/issues/796)). 구현은 현재 요청 범위에서 [제품 계약 적용 기준](../README.md#document-class)과 [검증 명령](../../scripts/README.md#native-validation)을 따른다. Dependency와 architecture 변경은 공통 변경 승인 기준을 따른다.

## 결정의 상태

| 구분 | 내용 |
| --- | --- |
| 방향 | `apps/api`의 NestJS 중앙 API, DB 저장 없음. 캐릭터, 공용 아이템, 오늘의 등급 조회 결과만 API 메모리에 캐시하며([캐릭터 상세](character-details.md), [오늘의 등급](today-grade.md)), 노드가 늘면 여러 노드가 공유하는 Redis로 옮긴다. |
| 실행 계약 | Node 26, Nest 12, ESM과 TypeScript build, 아래 build, test 방식 |
| 남은 미결정 | 운영 배포, 실제 credential과 domain, 전체 서비스 한도 |

## Runtime과 dependency

API 서버 app은 Node `>=26.11.1 <27`을 호환 floor/major 범위로 두며, 실제 선택은 해당 major의 최신 보안 patch로 한다. 하한은 실제로 검증한 patch다. 서버와 공용 package의 `@types/node`는 26.x로 맞추며, 이 범위는 workspace pnpm의 지원 Node 범위에 들어가야 한다. Desktop main, preload는 Electron이 내장한 Node에서 실행되므로([설치](../../AGENTS.md#설치)) 이 범위를 따르지 않고 `@types/node`도 Electron의 Node major에 맞춘다. API 작업에서 다른 app의 Node/types 버전이나 workspace package manager를 변경하지 않는다. [Node release 상태](https://nodejs.org/en/about/previous-releases), [pnpm 호환 표](https://pnpm.io/installation#compatibility)

Nest runtime과 testing package는 동일한 12.x release로 맞추고, TypeScript compiler는 7.0.x(native `tsc`)를 사용하며, `tsc`로 먼저 컴파일한 뒤 Node로 검증하는 방식과 `emitDecoratorMetadata` 사용은 그대로 유지합니다. Node와 Express의 type은 사용하는 runtime과 맞추며, 직접 사용하는 패키지를 전이 의존성 경로에서 가져오지 않습니다.

## 의존성 관리

API workspace의 직접 의존성 목록은 `apps/api/package.json`에서, API도 사용하는 공통 lint, format 도구의 직접 의존성 목록은 루트 `package.json`에서 관리합니다. 두 manifest의 외부 의존성 버전은 `pnpm-workspace.yaml`의 catalog에서만 정하며, manifest는 `catalog:` 또는 named catalog로 참조합니다([공통 도구 계약](convention-tooling.md#설정과-소유권)). 공통 도구의 적용 설정은 루트 `biome.json`에서 확인합니다. 두 manifest에서 해결된 버전과 전이 의존성은 `pnpm-lock.yaml`에서 확인합니다. 이 문서는 API 패키지 허용, 제외 목록이나 패키지별 버전 재승인 조건을 두지 않습니다.

의존성 선택과 중요한 영향의 판단 경계는 [제품 계약 적용 기준](../README.md#document-class)과 [공용 모듈 경계](../architecture/overview.md#architecture-change)를 따릅니다. 필요한 선택 이유와 검증 결과는 PR 또는 기존 작업 기록에 남깁니다. 이 문서의 runtime, build, test 계약이나 API, 보안 계약을 바꾸면 해당 Rule을 함께 변경하며, API 패키지 목록이나 버전의 변경만으로 이 Rule에 항목을 추가하지 않습니다.

공통 lint, format 도구의 역할, 설정과 버전 변경은 [공통 도구 계약](convention-tooling.md#설정과-소유권)을 따릅니다. 루트 manifest 안내는 현재 선언 위치를 설명하며, 그 계약의 승인 조건을 해제하지 않습니다.

실제 변경에서는 package의 engine과 peer 조건, ESM 및 TypeScript 호환성을 확인하고 영향받는 동작을 검증합니다. Registry metadata만으로 설치, build 성공을 주장하지 않습니다.

HTTP client는 `ky`(Node 내장 `fetch` 위에서 동작), test runner와 assertion은 `node:test`, `node:assert/strict`를 사용합니다. 이 실행 방식은 API에 적용하며 다른 app으로 일반화하지 않습니다. Query와 응답 경계는 [`character-search.md`](character-search.md)를 따릅니다.

## Build와 test 계약

- `apps/api/package.json`의 `type: module`을 유지한다. `tsconfig.json`은 `module`, `moduleResolution: NodeNext`, `target: ES2023`, `strict: true`, `experimentalDecorators: true`, `emitDecoratorMetadata: true`, `noEmitOnError: true`를 사용한다. 실행 시 필요한 class import는 type-only로 지우지 않는다.
- Relative source import에는 build 결과의 `.js` 확장자를 쓴다. Decorator module보다 먼저 `reflect-metadata`가 로드되게 하고, test도 같은 조건으로 실행한다. Runtime alias나 bundler가 필요한 path alias는 추가하지 않는다.
- `tsconfig.build.json`은 `src/**/*.ts`만 `rootDir: src`에서 `outDir: dist`로 emit한다. Entry는 `src/main.ts` → `dist/main.js`다. Test는 production 산출물에 넣지 않는다.
- `tsconfig.test.json`은 같은 compiler 옵션으로 `src/**/*.ts`, `test/**/*.ts`를 `rootDir: .`에서 `outDir: .test-dist`로 emit한다. Test 이름은 `test/**/*.test.ts`, 실행 대상은 `.test-dist/test/**/*.test.js`다. Typecheck는 source와 test를 함께 검사한다.
- 매 build/test compile 전에 해당 output만 `node:fs`의 `rmSync(..., { recursive: true, force: true })`로 정리해 삭제한 test나 source의 stale 산출물을 실행하지 않는다. 두 output은 Git에서 제외한다.
- Test는 native TS stripping이나 esbuild에 decorator 변환을 맡기지 않는다. `tsc` 선컴파일 후 Node를 실행해 production과 동일한 metadata를 검증한다. [TypeScript metadata](https://www.typescriptlang.org/tsconfig/emitDecoratorMetadata.html), [Node TS의 decorator 제한](https://nodejs.org/docs/latest-v26.x/api/typescript.html), [Node test runner](https://nodejs.org/docs/latest-v26.x/api/test.html)

대안인 Vitest는 Desktop과 runner를 공유하지만 Nest의 [공식 Vitest recipe](https://docs.nestjs.com/recipes/swc#vitest)에 필요한 SWC transform, metadata 구성을 추가로 관리해야 한다. 현재 작은 API는 선컴파일과 내장 runner를 사용한다. Nest test container는 [runner와 독립적](https://docs.nestjs.com/fundamentals/testing)이다.

## 실행과 검증 경계

App 생성은 port를 열지 않는 factory로 분리하고, `main.ts`만 설정 읽기, listen, 종료 signal 연결을 담당한다. Test는 factory에 fake 설정/provider를 넣어 `127.0.0.1`의 port `0`에서 실행하고 반드시 `app.close()`한다. 정상 HTTP 검증용 route는 test module 안에 두며 제품용 health/API를 추가하지 않는다.

실행 기반의 최소 **필수** 설정은 `PORT`(십진 정수 1~65535)다. 누락, 빈 값, 잘못된 값은 listen 전에 실패한다. 따라서 runtime-only 단계에서도 실제 필수 설정 누락 실패를 검증한다. Test factory의 loopback port 0 주입은 환경변수 검증과 구분한다. 검색 구성에 필요한 `NEOPLE_API_KEY`는 검색 module을 연결할 때부터 필수이며 누락, 빈 값은 listen 전에 실패한다. Runtime-only app은 아직 연결하지 않은 검색 설정을 요구하지 않는다. 필수 설정 실패는 값이나 stack을 출력하지 않고 검증한다. Fake 설정은 test에서만 주입하며 운영용 인증 우회나 test mode를 추가하지 않는다.

설정 검증은 키의 누락, 빈 값, 공백뿐인 값 검증을 runtime 설정 읽기에 집중한다. listen 전에 검증하고, runtime 조합부가 검색, 상세, 카탈로그 어댑터를 생성한다. 검색과 상세 서비스, HTTP 앱 factory는 raw API 키 없이 준비된 어댑터를 필수 의존성으로 받는다. 서비스 생성 후 매 요청 키를 다시 검사하지 않으며, 서비스 종료와 클라이언트 연결 종료 등 요청마다 달라지는 조건만 실행 단계에서 확인한다. 연결이 이미 끊긴 요청은 공급자를 호출하지 않는다. HTTP 테스트의 fake 어댑터에는 형식상 API 키를 요구하지 않는다. 잘못된 키로 HTTP 앱을 구성한 뒤 400/500 우선순위를 검사하던 내부 factory 테스트는 시작 단계의 설정 실패 검증으로 옮긴다. 정상 runtime의 설정 오류 시 시작 거절과 공개 HTTP 입력, 오류, 호출 한도 계약은 유지한다.

표준 검증 command는 `apps/api/package.json`의 `typecheck`, `lint`, `build`, `test` script이며, root에서 `pnpm --filter @dfragon/api <script>`로 실행한다. `build`는 `dist`를, `test`는 `.test-dist`를 먼저 정리하고 위 tsconfig로 컴파일한 뒤 `node --import reflect-metadata --test`로 실행한다. 변경 범위별 조합은 [검증 명령](../../scripts/README.md#native-validation)을 따른다.

Runtime acceptance에는 test HTTP 응답, metadata가 필요한 constructor DI, app 시작, 종료 후 열린 handle 없음, child process의 build entry 실행과 종료, `PORT` 누락, 빈 값, 잘못된 값에서 nonzero exit, 미listen을 포함한다. 검색 module 연결 후에는 해당 필수 설정 누락도 검증한다. Test의 child process는 허용한 fake environment만 받아 실제 credential을 상속하지 않는다. Build entry 검증에는 `build`가 선행해야 한다.

검색 adapter는 fake transport 또는 loopback upstream으로 검증한다. 외부 domain, 네오플 credential, 인증, DB가 필요하지 않아야 한다. 필요한 실제 운영, provider 권한은 별도로 확인한다. Search query 길이의 외부 규격 미확인은 credential 없는 runtime 검증을 막지 않는다.

Runtime/test 조합의 실행이 실패하면 engine, peer, metadata, ESM 원인을 공개하고, 도구 변경이 필요하면 위 의존성 관리 기준을 따른다.
