# Desktop 검색의 실제 서버 소비 검증

Desktop `createSearchHttp`가 실제 `apps/api/dist/main.js`와 연결되는지 확인한다. API는 DB 없이 시작하며 Neople은 loopback fixture다. `neople-redirect.mjs`를 API child의 `--import`로만 넣어 Neople 요청을 loopback으로 돌린다. 공개 검색은 실제 API를 사용하며 로그인 없이 시작한다. API에는 synthetic Neople key만 전달한다.

Repository root에서 실행한다. 설치된 workspace dependency를 사용하며 Docker는 필요하지 않다.

```bash
pnpm --filter @dfragon/api build
pnpm --filter @dfragon/desktop exec vitest run --config scripts/search-server-integration/vitest.config.ts
pnpm --filter @dfragon/desktop exec biome lint scripts/search-server-integration
pnpm --filter @dfragon/desktop exec tsc --noEmit --ignoreConfig --allowJs --strict --skipLibCheck --esModuleInterop --moduleResolution bundler --module esnext --target es2023 scripts/search-server-integration/search.integration.ts scripts/search-server-integration/vitest.config.ts
node --check apps/desktop/scripts/search-server-integration/runtime.mjs
```

전용 `*.integration.ts`는 일반 Desktop test의 기본 pattern에 포함되지 않는다. `pnpm verify`가 API를 build한 뒤 위 통합 명령을 실행한다. 전용 config는 forks process 하나에서 실행하며 API child는 API 폴더를 cwd로 시작한다. API는 build된 ESM을 실행하므로 Nest decorator를 Vitest에서 다시 변환하지 않는다. Node helper는 syntax, lint와 실제 소비 실행으로, TypeScript test/config와 소비 type은 별도 `tsc`로 확인한다.

검증하는 결과는 기본 query `characterName`만 전송했을 때의 서버 기본값 `all`, 10, `full`, 다섯 field, 순서, 0명성, 음수 소수, 미등록 서버, 누락 명성, 0건, 잘못된 upstream 후보의 전체 실패, 400의 upstream 0회, 같은 peer의 13회 요청이 클라이언트별 한도로 거절되지 않는 것이다. 모든 Desktop 검색 요청에서 Authorization header가 없는지 확인한다.

HTTPS origin 검사는 제품 그대로 유지한다. 검증 fetch만 고정 synthetic HTTPS origin을 소유 loopback API에 대응시키며 다른 origin/path를 거절한다. API child에는 PATH, PORT, synthetic key와 loopback Neople 주소만 전달하고 실제 credential, 사용자 `NODE_OPTIONS`를 상속하지 않는다. Token, 원문 응답, private key를 출력하지 않는다.

종료 시 API SIGTERM의 정상 exit, 접근 로그 외 출력 없음과 검색 접근 로그를 확인하고, finally에서 API와 loopback upstream을 정리한다.

이 결과는 HTTP 클라이언트 경계에 한정된다. 단일 15초 전체 예산, slot, IPC, renderer, 실제 media/OCR, 외부 Neople credential, 운영 TLS, 배포 성공을 대신하지 않는다. 서버 구현과 추가 실행 범위는 [기본 API 설정과 실행](../../../../docs/reference/api-start-development.md), [캐릭터 검색 계약](../../../../docs/rules/character-search.md)을 따른다.
