---
type: reference
scope: apps/api default entry and deployment configuration
last-reviewed: 2026-09-08
---

# 기본 API 설정과 실행

`pnpm --filter @ldb/api start`는 `apps/api/dist/main.js`에서 Google 로그인·refresh/logout·계정·인증 검색을 한 앱으로 시작한다. 기존 factory와 transaction을 사용하며 필수 설정을 검증한 뒤 DB를 초기화하고 마지막에 listen한다. 실제 provider 등록·credential과 운영 ingress/TLS·배포 검증은 별도로 준비해야 한다.

Ubuntu 서버에서 Docker Compose와 호스트 Caddy를 사용하는 배포 명령·권한·secret 입력은
[단일 서버 API 배포](../../deploy/api/README.md)를 따른다.

`/` 등 미등록 경로는 요청 URL이나 예외 원문을 포함하지 않는 고정 404 JSON을 반환한다. 등록된 service가 던진 예외는 기존 인증·계정·검색의 정제 오류 처리에 남으며 미등록 route의 404와 구분한다.

## 준비할 입력

| 환경변수 | 입력 |
| --- | --- |
| `PORT` | ASCII 십진 정수 `1`~`65535` |
| `DB_HOST`, `DB_PORT`, `DB_USERNAME`, `DB_PASSWORD`, `DB_NAME` | 기존 DB reader의 개별 연결 값. `DB_PORT`도 십진 정수 `1`~`65535`이며 나머지는 비어 있지 않아야 한다. |
| `NEOPLE_API_KEY` | 비어 있지 않은 검색 API key |
| `AUTH_CONFIG_FILE` | 배포가 준비한 UTF-8 JSON secret 파일의 절대 경로 |
| `LOCAL_HTTPS_CERT_FILE`, `LOCAL_HTTPS_KEY_FILE` | 선택적인 localhost HTTPS용 PEM certificate와 private key의 절대 경로. 함께 지정해야 한다. |

파일의 정확한 schema와 key 교체·과거 version 보존 기준은 [승인된 배포 설정 입력](../rules/auth-runtime.md)을 따른다. 최상위는 `accessJwt`, `providerPkce`, `registry`, `google` 네 object다. PEM은 JSON 문자열에, PKCE key는 canonical base64url 43자에 담는다. Google endpoint는 registry의 version을 참조하고 secret은 `(version, reference)`가 정확히 일치해야 한다.

운영 담당이 파일을 repository와 image 밖에 준비하고 API 실행 주체와 필요한 배포 관리자만 읽도록 관리한다. 기본 경로·inline JSON 환경변수·환경변수명으로 secret reference 해석·자동 key 생성은 없다. 현재 기본 entry는 Google 등록만 받으며 Discord gate는 유지한다. 실제 값은 문서·shell history·log에 기록하지 않는다.

## 시작과 교체

### 같은 컴퓨터에서 Desktop과 API 연결

API와 Desktop을 같은 Windows 컴퓨터에서 실행하면 API 주소에 `https://localhost:<PORT>`를 사용할 수 있다. `LOCAL_HTTPS_CERT_FILE`과 `LOCAL_HTTPS_KEY_FILE`을 함께 지정하면 기본 Nest 앱이 `127.0.0.1`에서 HTTPS로만 listen한다. 두 변수가 모두 없으면 기존 listener 동작을 유지한다. 로컬 HTTPS 모드는 외부 IP에 공개하는 배포 설정이 아니다.

프록시가 외부 HTTPS를 처리하고 Nest API에는 내부 HTTP로 전달하는 구성을 검토할 때는 두 `LOCAL_HTTPS_*` 변수를 모두 생략한다. 이때 `PORT`는 내부 HTTP listener의 port이고 `registry.apiOrigin`·Desktop API origin·provider callback은 외부에서 접근하는 HTTPS 주소를 유지한다. 내부 port와 외부 HTTPS port가 같을 필요는 없으며 localhost origin/port 일치 검사는 로컬 HTTPS 모드에서만 적용된다.

기존 HTTP 경로는 `app.listen(PORT)`로 host를 제한하지 않는다. 따라서 이 설정 자체가 내부 통신의 격리나 안전성을 보장하지 않으며, HTTP port의 외부 접근 차단은 배포의 bind·container port 공개·방화벽 등에서 확인해야 한다. 프록시의 전달 동작과 실제 배포 검증은 별도이며, 로컬 HTTPS 추가가 운영 ingress 계약을 확정하지 않는다. Desktop·브라우저가 직접 사용하는 제품 API의 HTTPS 계약도 유지한다.

개발 certificate는 실행 담당자가 repository 밖에 준비한다. 예를 들어 [mkcert](https://github.com/FiloSottile/mkcert)의 `-install`로 개발 CA를 신뢰 저장소에 설치한 뒤 `-cert-file`·`-key-file`로 저장 위치를 지정하고 `localhost 127.0.0.1` certificate를 발급할 수 있다. Private key와 CA private key를 공유하거나 commit하지 않는다. 발급·신뢰 설치는 API 시작이 자동 수행하지 않는다.

PowerShell에서 실제 파일 경로와 선택한 port를 지정한다. 다음 경로는 placeholder이며 먼저 나머지 DB·검색·인증 입력도 준비해야 한다.

```powershell
$env:PORT = '3443'
$env:LOCAL_HTTPS_CERT_FILE = 'C:\path\outside-repository\localhost.pem'
$env:LOCAL_HTTPS_KEY_FILE = 'C:\path\outside-repository\localhost-key.pem'
```

`AUTH_CONFIG_FILE`의 `registry.apiOrigin`과 Desktop의 `LDB_AUTH_API_ORIGIN`은 같은 canonical origin이어야 한다. 위 port이면 `https://localhost:3443`, Google 등록과 snapshot의 callback은 `https://localhost:3443/auth/callback/google`이다. `https://127.0.0.1:3443`도 허용하지만 origin과 callback을 섞지 않는다. 실제 provider 등록값을 이 예제에 맞춰 임의로 바꾸지 않는다.

Desktop의 로그인·인증 검색은 Electron의 Chromium network stack을 사용한다. 실행 OS에서 개발 CA를 신뢰하도록 설치한 뒤 실제 앱의 HTTPS 연결을 확인한다. API 전용 메모리 session은 renderer의 cookie/cache와 분리되며 인증서 오류를 무시하는 handler는 추가하지 않는다.

별도 Node 기반 검증 client에서 개발 CA가 신뢰되지 않으면 **실행 전에** `NODE_EXTRA_CA_CERTS`에 해당 CA의 public certificate인 `rootCA.pem` 절대 경로를 지정한다. Private key 파일을 지정하거나 TLS 검증을 끄지 않는다. 제품 package는 Node options fuse를 끄므로 이 환경변수를 Desktop 인증서 설정으로 사용하지 않는다. [Electron 39.8.10 환경변수 문서](https://raw.githubusercontent.com/electron/electron/v39.8.10/docs/api/environment-variables.md)의 제한을 따른다. 설치형 앱의 실제 신뢰, Google 인증, OS protocol 복귀와 저장소 검증은 각각 별도 확인 대상이다.

TLS 파일 누락·잘못된 PEM·key 불일치와 local origin/port 불일치는 DB 초기화 전에 고정 실패 메시지로 끝난다. Certificate의 유효기간·hostname·신뢰 체인은 실제 client의 TLS 검증으로 확인한다. API의 설정 검증이나 `/`의 404 응답만으로 Google 로그인과 Desktop 복귀 성공을 판단하지 않는다.

개발용 Windows 설치 파일은 [Desktop localhost 개발 패키지](desktop-auth-core.md#windows-localhost-개발-패키지)에서 빌드한다. 서버와 앱을 같은 컴퓨터에서 실행하고 Desktop return target을 `ldb.dev://auth/callback`으로 맞춘다. 설치 패키지에는 이 API origin이 포함되므로 브라우저 복귀를 위해 시스템 환경변수를 추가할 필요는 없다. Windows 저장소는 실제 native 권한·IO 검사 결과에 따라 동작하며, 광범위한 사전 검증을 로그인 차단 조건으로 두지 않는다.

### 실행과 종료

검토한 배포 입력을 process 환경에 주입하고 이미 승인된 Migration이 적용된 DB를 준비한다. 새 DB나 pending Migration에는 배포 담당이 `pnpm --filter @ldb/api db:migrate:up`을 한 번 명시 실행한다. API 시작은 Migration을 실행하거나 schema를 자동 변경하지 않는다.

Repository root에서 실행한다.

```bash
pnpm --filter @ldb/api build
pnpm --filter @ldb/api start
```

설정 누락·잘못된 JSON·key/registry/secret 연결 오류는 DB 연결과 listen 전에 실패한다. 초기화·listen 실패도 exit code 1이며 `API failed to start`만 출력한다. 오류의 원문·stack·파일 경로·설정값은 출력하지 않는다. 이 검증은 실제 Google/Neople credential의 유효성을 외부 서비스에서 확인하는 절차가 아니다.

파일은 시작 때 한 번만 읽는다. 설정을 바꿀 때는 필요한 과거 registry·secret·decrypt/verify key를 유지한 일관된 새 파일을 준비한 뒤 재시작한다. 진행 중 요청을 새 active version으로 대체하지 않으며, 지원하지 않는 과거 version은 기존 실패 경로를 따른다.

정상 실행 중 `SIGINT`/`SIGTERM`에서는 앱의 검색 취소와 종료가 끝난 뒤 소유 DB 연결을 닫는다. 시작 중 첫 신호에는 1000ms 정리 유예를 한 번만 설정하며 반복 신호로 연장하지 않는다. 초기화가 먼저 끝나면 listen을 건너뛰고, listen이 진행 중이면 해당 작업이 끝난 뒤 정리한다. 앱·DB 정리가 끝나면 유예 timer를 제거한다.

기한이 지나도 시작이나 정리가 끝나지 않으면 `API failed to start`를 출력하고 process를 종료 코드 1로 끝낸다. 이 fallback은 비동기 정리 성공이 아니라 process와 연결 중 socket의 종료다. TypeORM/pg 내부 pool에 접근하거나 운영 DB 연결 timeout을 바꾸지 않는다. 초기화 완료 표시 이전에 확보한 연결도 기존 실패 정리 대상이며 앱 종료 실패가 DB 정리를 막지 않는다. `SIGKILL`·host 장애의 즉시 정리는 보장하지 않는다.

## 구현과 검증 위치

| File | 책임 |
| --- | --- |
| `apps/api/src/main.ts` | 환경 전달, listen과 signal, 고정 실패 출력 |
| `apps/api/src/runtime/authentication-input.ts` | JSON의 정확한 object/field/type과 PKCE 문자열 해석 |
| `apps/api/src/runtime/configuration.ts` | 파일 1회 읽기, 기존 factory 검증과 version/secret 연결 |
| `apps/api/src/runtime/application.ts` | 기존 login/session/account/search 합성, 앱·DB의 수명 |
| `apps/api/src/auth/login/http.ts` | 기존 HTTP factory와 부분 앱 설정 실패의 정리 |
| `apps/api/test-support/runtime-startup.test.mjs` | 실제 build entry의 설정 거절·시작·실패·signal 종료 |
| `apps/api/test-support/runtime-local-https.test.mjs` | local TLS 입력 거절과 DB 초기화 전 정제 실패 |
| `apps/api/test-support/runtime-handshake.test.mjs` | 응답 없는 실제 loopback TCP handshake의 신호 종료, 반복 신호와 정상 정리 뒤 timer 제거 |
| `apps/api/test-support/runtime-http-integration.mjs` | 기존 Docker harness의 실제 DB·기본 entry·전체 HTTP 흐름 |

`runtime-preload.mjs`는 테스트 child의 `--import`에만 지정한다. 기존 synthetic Google/JWKS와 Neople loopback fixture에 transport를 대응시키고 부분 초기화 실패를 주입한다. 제품 source는 이 module과 테스트 환경변수를 읽지 않는다. 실제 credential·`NODE_OPTIONS`를 child에 상속하지 않는다.

```bash
pnpm --filter @ldb/api run --sequential '/^(lint|test|typecheck)$/'
pnpm --filter @ldb/api test:database
```

기본 entry만 반복 확인할 때는 `pnpm --filter @ldb/api test:database --runtime-only`를 사용한다. 기존 Docker 생성·image 검증·readiness·명시 Migration·정리를 그대로 사용하며 전체 DB matrix를 대체하지 않는다.

Worker의 2026-09-08 검증에서 startup 설정·실패·signal 검증과 focused DB/HTTP 검증이 통과했다. 실제 흐름은 pending Google 요청 → 재시작·active version 변경 → 과거 version의 callback/exchange → 계정 조회·수정 → 검색 → refresh/logout → 계정 거절·잔여 JWT 검색 → DB lock 대기 검색의 종료 취소다. Fresh DB의 schema 불변과 부분 연결·Nest 생성/설정·listen 실패의 backend 소멸도 확인했다.

시작 신호 검증의 TCP peer는 PostgreSQL 엔진이 아니다. 실제 pg startup bytes를 읽고 응답하지 않은 상태에서 child의 nonzero 종료·API 미listen·상대 socket 종료를 fixture 정리 전에 관측한다. 신호와 함께 초기화를 완료시키는 fake와 구분하며, 별도 fake 검증은 정상 정리 뒤 다른 handle이 남아 있어도 종료 timer가 실행되지 않는지 확인한다.

환경은 Node `v24.19.0`, pnpm `11.23.0`, Docker server `29.7.2`, native `linux/arm64/v8`, PostgreSQL `18.6 (Debian 18.6-1.pgdg13+2)`다. 실제 provider/credential, `linux/amd64`, Desktop·공개 배포·proxy/APM·운영 복원은 이 검증에 포함하지 않았다. 최종 전체 API/DB 검증과 독립 review evidence는 구현 PR에서 exact head와 연결한다.
