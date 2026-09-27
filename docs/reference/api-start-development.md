---
type: reference
scope: apps/api and apps/accounts runtime configuration
last-reviewed: 2026-09-28
---

# API와 accounts 로컬 실행

`apps/api`는 공개 캐릭터·모험단 API, `apps/accounts`는 패스키·계정·세션 API와 인증 UI다.
각각 PostgreSQL을 사용하며 운영 DB container·volume·역할도 분리한다. 기본 entry는 설정 검증,
DB 연결, HTTP listen 순서로 시작하며 migration을 자동 실행하지 않는다.

## Swagger와 HTTP

양쪽 `/docs`, `/docs/openapi.json`은 자기 서비스 계약만 제공한다. API `/health`는 200,
API의 `/auth/**`와 `/me`는 404다. Accounts `/me`는 미인증 401이며 access JWT로 계정에 접근한다.
패스키는 인증 화면과 Desktop/OCR의 PKCE 흐름에서 발급한다. Swagger token은 영구 저장하지 않는다.
인증 JSON은 strict parser·16,384-byte 제한을 적용하며 화면의 nonce CSP와 no-store/no-referrer를 유지한다.

## 준비할 입력

| 서비스 | 필수 | 선택 |
| --- | --- | --- |
| API | `PORT`, `DB_HOST`, `DB_PORT`, `DB_USERNAME`, `DB_PASSWORD`, `DB_NAME`, `NEOPLE_API_KEY` | `SEARCH_TRUST_PROXY=single-hop`, local TLS |
| accounts | `PORT`, 별도의 `DB_*`, `AUTH_CONFIG_FILE` | `AUTH_TRUST_PROXY=single-hop`, local TLS |

PORT·DB_PORT는 ASCII 십진 정수 1~65535다. 각 `.env.example`을 앱의 `.env`로 복사하고 실제 secret은
Git 밖에서 관리한다. accounts 설정 JSON은 `accessJwt`와 `passkey`이며 [패스키 설정](passkey-authentication.md)을 따른다.
API에는 인증 JSON과 JWT 개인키를 제공하지 않는다. Proxy 설정은 단일 신뢰 proxy를 사용할 때만 켠다.

## 로컬 개발 명령

API는 `https://localhost:3443`, accounts는 `https://localhost:3444`를 사용한다. 각 PostgreSQL도
다른 container·loopback port와 DB/역할로 준비한다. 예제는 API DB port 54329, accounts DB port 54330이다.
운영 DB·credential을 개발에 사용하지 않는다.

```sh
pnpm --filter @dfragon/api db:migrate:local
pnpm --filter @dfragon/accounts db:migrate:local
pnpm --filter @dfragon/api dev
pnpm --filter @dfragon/accounts dev
pnpm --filter @dfragon/desktop dev
```

서버별 `LOCAL_HTTPS_CERT_FILE`·`LOCAL_HTTPS_KEY_FILE`을 같은 신뢰한 localhost 인증서의 절대 경로로 설정한다.
API는 `API_ORIGIN=https://localhost:3443`, accounts의 JSON은 `apiOrigin=https://localhost:3444`,
RP ID `localhost`, returnUrl `dfragon.dev://auth/callback`을 사용한다. 두 origin은 port가 달라도
hostname이 같아서 로컬에서는 같은 RP다. 실제 도메인 이전 검증은 `test:database`의 별도 hostname 가상 인증기로 수행한다.
TLS 파일의 key 일치·localhost/port 입력을 listen 전에 확인하며 client의 실제 신뢰 체인 검증을 끄지 않는다.

Desktop 개발 build에는 두 주소가 각각 포함된다. 설치형 배포는 `DFRAGON_DISTRIBUTION_API_ORIGIN`과
별도 `DFRAGON_DISTRIBUTION_ACCOUNTS_ORIGIN`을 사용한다. Shell 기반 구성의 검색은 `DFRAGON_API_ORIGIN`,
인증은 기존 이름인 `DFRAGON_AUTH_API_ORIGIN`으로 구분하며 legacy 이동 허용은 `DFRAGON_AUTH_LEGACY_ORIGIN`이다.
별도 Node client의 개발 CA는 실행 전 `NODE_EXTRA_CA_CERTS`에 공개 CA certificate를 지정한다.
Desktop은 OS 인증서 신뢰를 사용하며 인증서 오류를 무시하지 않는다.

## 시작·종료와 검증

각 앱의 `build` 후 `start`로 compiled ESM entry를 실행할 수도 있다. 설정·DB 초기화·listen 실패는
`API failed to start` 또는 `Accounts failed to start`와 nonzero exit만 남긴다. Secret·파일 경로·stack을 기록하지 않는다.
정상 종료와 부분 초기화 실패에서 앱과 소유 DB를 정리하며 SIGKILL·host 장애는 즉시 cleanup을 보장하지 않는다.

`pnpm --filter @dfragon/api test`는 domain HTTP·설정과 build를, `test:database`는 domain schema·cache·검색을 검증한다.
accounts의 같은 명령은 인증 HTTP·key·session·설정과 build, 별도 PostgreSQL·migration·복사·두 RP 브라우저·QR을 검증한다.
DB suite에는 Docker와 Playwright Chromium이 필요하다. 운영 실행은 [API 배포](../../deploy/api/README.md)와
[accounts/기존 인증 이전](../../deploy/accounts/README.md)을 따른다. 로컬 성공은 실제 DNS/TLS·기기 패스키 검증을 대신하지 않는다.
