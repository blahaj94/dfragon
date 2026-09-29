---
type: reference
scope: server runtime configuration and product images
last-reviewed: 2026-09-30
---

# 서버 실행과 이미지

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
| API | `PORT`, `DB_HOST`, `DB_PORT`, `DB_USERNAME`, `DB_NAME`, DB 비밀번호, Neople key | `SEARCH_TRUST_PROXY=single-hop`, local TLS |
| accounts | `PORT`, 별도의 `DB_*`, DB 비밀번호, `AUTH_CONFIG_FILE` | 외부 JWT 개인키, `AUTH_TRUST_PROXY=single-hop`, local TLS |

PORT·DB_PORT는 ASCII 십진 정수 1~65535다. 각 `.env.example`을 앱의 `.env`로 복사하고 실제 secret은
Git 밖에서 관리한다. accounts 설정 JSON은 `accessJwt`와 `passkey`이며 [패스키 설정](passkey-authentication.md)을 따른다.
API에는 인증 JSON과 JWT 개인키를 제공하지 않는다. Proxy 설정은 단일 신뢰 proxy를 사용할 때만 켠다.

비밀값은 시작할 때 아래 환경변수나 `_FILE`의 절대 경로에서 읽는다. GitHub나 특정 secret manager가
필요하지 않으며 self-host 운영자가 준비한 환경변수·읽기 전용 파일을 사용할 수 있다.

| 비밀값 | 직접 입력 | 파일 입력 |
| --- | --- | --- |
| 각 앱의 DB 비밀번호 | `DB_PASSWORD` | `DB_PASSWORD_FILE` |
| API Neople key | `NEOPLE_API_KEY` | `NEOPLE_API_KEY_FILE` |
| accounts JWT 개인키 | `AUTH_JWT_PRIVATE_KEY` | `AUTH_JWT_PRIVATE_KEY_FILE` |

한 값의 두 입력을 함께 지정하면 빈 값이어도 거절한다. 빈 값·상대 경로·읽을 수 없는 파일은
시작 전에 값·경로 없이 실패한다. 파일은 UTF-8로 읽고 끝의 LF만 제거하며, 직접 입력은 그대로 사용한다.
JWT 외부 입력을 쓰면 인증 JSON의 `accessJwt.signingKey`에는
`kid`만 두고 `privateKeyPem`을 생략한다. 외부 입력이 없으면 기존 JSON의 `privateKeyPem`을 사용한다.
Issuer·audience·verificationKeys·passkey 설정과 기존 키 검증은 그대로다.

비밀값은 이미지 빌드 인자나 Dockerfile의 `ENV`로 넣지 않는다. 값 교체 후에는 앱을 다시 시작한다.
DB 비밀번호 입력을 바꾸는 것만으로 DB 역할의 비밀번호가 변경되지는 않는다.

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
인증은 기존 이름인 `DFRAGON_AUTH_API_ORIGIN`으로 구분한다. 인증 창은 해당 origin만 허용한다.
별도 Node client의 개발 CA는 실행 전 `NODE_EXTRA_CA_CERTS`에 공개 CA certificate를 지정한다.
Desktop은 OS 인증서 신뢰를 사용하며 인증서 오류를 무시하지 않는다.

## 시작·종료와 검증

각 앱의 `build` 후 `start`로 compiled ESM entry를 실행할 수도 있다. 설정·DB 초기화·listen 실패는
`API failed to start` 또는 `Accounts failed to start`와 nonzero exit만 남긴다. Secret·파일 경로·stack을 기록하지 않는다.
정상 종료와 부분 초기화 실패에서 앱과 소유 DB를 정리하며 SIGKILL·host 장애는 즉시 cleanup을 보장하지 않는다.

`pnpm --filter @dfragon/api test`는 domain HTTP·설정과 build를, `test:database`는 domain schema·cache·검색을 검증한다.
accounts의 같은 명령은 인증 HTTP·key·session·설정과 build, 별도 PostgreSQL·migration·이전 RP 정리·현재 RP 브라우저·QR을 검증한다.
DB suite에는 Docker와 Playwright Chromium이 필요하다. 이미지 입력과 운영 책임은 [제품 안내](#서버-이미지)를 따른다. 로컬 성공은 실제 DNS/TLS·기기 패스키 검증을 대신하지 않는다.

## 서버 이미지

[Product Images](../../.github/workflows/product-images.yml)는 변경된 서비스의 이미지만 선택합니다.
`apps/api/**`, `apps/ocr/**`, `apps/accounts/**`만 바뀌면 각각 해당 이미지만 빌드하며,
여러 서비스가 바뀌면 그 서비스들을 함께 빌드합니다. `packages/ui/**`는 accounts·OCR,
`packages/lib/**`·`packages/licenses/**`·`patches/**`와 root package·lockfile·workspace 설정은
세 이미지에 영향을 줍니다. 이미지 workflow·선택 도구 변경도 세 이미지를 검사합니다.
서버 이미지 입력이 없는 문서·Desktop·Web 전용 변경은 이미지 빌드·발행을 건너뜁니다.

PR은 base와 빌드할 merge commit을 비교해 선택한 이미지를 빌드만 합니다.
기존 Code Quality는 앱 테스트·정적 검사를 계속 담당하며, main push 전체의 `before`부터
`head_sha`까지 비교한 선택 목록을 `product-image-plan` artifact로 전달합니다.
Product Images는 성공한 해당 실행의 목록과 source commit을 확인해 같은 `head_sha`로
빌드·발행합니다. 후속 실행 때의 최신 main을 다시 선택하지 않습니다.
main에서는 마지막으로 Product Images 전체가 성공한 실행의 source commit 이후 변경도
포함합니다. 앞선 CI·빌드·발행의 취소나 실패로 발행되지 않은 변경은 다음 성공 실행에서
반영합니다. 이전 성공 목록이 없거나 90일 보관 기한이 지났으면 세 이미지를 모두 빌드합니다.
선택 목록이 없거나 source commit이 다르면 실패하며 임의로 빌드를 생략하지 않습니다.

이미지는 `ghcr.io/blahaj94/dfragon/{api,ocr,accounts}:<40자리 commit SHA>`로 발행하고
OCI `source`·`revision` label에 저장소와 commit을 기록합니다. 대상 플랫폼은 `linux/amd64` 하나입니다.
테스트 실패는 Code Quality, 이미지 빌드 실패는 `Build image`, 인증·발행·digest 확인
실패는 각각 `Authenticate to GHCR`·`Publish the built image`·`Verify the registry digest`에서 확인합니다.
선택한 이미지 빌드가 모두 성공해야 같은 목록의 발행 job이 시작됩니다.

인프라에서는 성공한 발행 실행의 summary 또는 `image-handoff-api`, `image-handoff-ocr`,
`image-handoff-accounts` artifact 안의 JSON을 사용합니다. 각 파일은 다음 형식이며
`image`는 registry에서 조회·확인한 digest reference입니다. 해당 실행에서 선택된 서비스만
handoff를 생성하며 그 파일들은 같은 `sourceCommit`을 가집니다. 변경되지 않은 서비스는
이전 성공한 발행의 digest reference를 유지하므로 서비스별 source commit이 다를 수 있습니다.
Tag는 조회 편의용이고 배포 입력은 `image@sha256:digest`입니다.

```json
{
  "service": "api",
  "image": "ghcr.io/blahaj94/dfragon/api@sha256:<registry-digest>",
  "sourceCommit": "<40-character-commit-sha>"
}
```

선택 job은 `contents: read`와 원본·이전 성공 실행의 목록을 읽기 위한 `actions: read`,
빌드 job은 `contents: read`, 발행 job은 `packages: write`만 사용합니다.
발행 job은 같은 실행의 이미지 archive를 받아 source·플랫폼을 확인하고 push하며,
앱 코드를 checkout하거나 실행하지 않습니다. 운영 secret·SSH·Tailscale 접근은 없습니다.
GHCR의 공개 범위·접근 정책은 workflow가 변경하지 않습니다. 인프라의 pull 인증은
기존 package 접근 정책에 맞춰 별도로 준비해야 합니다.

제품은 테스트·빌드·이미지 발행과 Dockerfile·앱 실행 진입점·schema/migration/cleanup 구현을 소유합니다.
이미지 선택·비밀값 관리와 전달·Compose·SSH·서버 권한·배포·백업·복구 절차의 원본은
[인프라 운영 안내](https://github.com/blahaj94/dfragon-infra/blob/main/deploy/linux/README.md)입니다.
제품 main merge는 운영 배포를 실행하지 않으며 제품 CI는 인프라 checkout·운영 credential에 의존하지 않습니다.

Dockerfile과 전용 ignore 파일은 `apps/<service>/`에 있습니다. 빌드 context는 제품 저장소 root이며
API/accounts의 `docker-entrypoint.sh`도 해당 앱 옆에서 관리합니다. 로컬 빌드는 다음과 같습니다.

```sh
docker build --platform linux/amd64 -f apps/api/Dockerfile -t dfragon-api:local .
docker build --platform linux/amd64 -f apps/accounts/Dockerfile -t dfragon-accounts:local .
docker build --platform linux/amd64 -f apps/ocr/Dockerfile -t dfragon-ocr:local .
```

## 이미지 실행 계약

아래는 제품 이미지가 요구하는 입력과 명령입니다. 서버 자원 준비·실행 순서와 복구 판단은 인프라 절차를 따릅니다.

### API

`apps/api/Dockerfile`로 만들며
UID/GID `1000:1000`의 `node` 사용자로 실행한다. 아래는 이미지 자체의 입력이다.

- `PORT`(현재 3000), `DB_HOST`, `DB_PORT`, `DB_USERNAME`, `DB_NAME`을 반드시 지정한다.
  `EXPOSE 3000`은 `PORT`의 기본값을 설정하지 않는다.
- DB 비밀번호와 Neople key는 위 직접 입력 또는 `_FILE` 입력을 사용한다. 둘 다 생략한 경우에만
  entrypoint가 각각 `/run/secrets/db_password`, `/run/secrets/neople_api_key`를 기본 파일로 선택한다.
  따라서 기존 mount 방식과 파일 없는 환경변수 입력을 모두 지원한다.
  Neople key는 필수다.
  `SEARCH_TRUST_PROXY`는 생략하거나 기존 단일 proxy 구성에서만 `single-hop`을 사용한다.
- `GET /health`의 200·`{"status":"ok"}`는 HTTP 시작 확인이다. 요청마다 DB·Neople 연결을
  재검사하는 readiness는 아니며, 검색 성공 검증과 구분한다.

이미지의 기본 CMD는 `node --import reflect-metadata dist/main.js`다. 시작 시 migration을
자동 실행하지 않는다. Migration은 같은 이미지의 CMD를 다음으로 바꿔 명시 실행한다.
기존 entrypoint와 DB 설정·비밀번호 입력을 유지하고 해당 DB의 migrator 역할을 제공한다.
CLI에는 `PORT`·Neople key가 필요하지 않으며 runtime 이미지 안에서 pnpm build를 실행하지 않는다.

```sh
node --import reflect-metadata dist/database/cli.js up
node --import reflect-metadata dist/database/cli.js show
```

`down`도 CLI가 지원하지만 자동 rollback 명령으로 사용하지 않는다. API에는 cleanup CLI가 없다.
이미지 빌드에는 운영 설정·secret·실데이터를 제공하지 않는다.

### accounts

`apps/accounts/Dockerfile`로 만들며
UID/GID `1000:1000`의 `node` 사용자로 실행한다.

- `PORT`(컨테이너 내부 3000), `DB_HOST`, `DB_PORT`, `DB_USERNAME`, `DB_NAME`이 필수다.
  `EXPOSE 3000`은 `PORT` 기본값이 아니다. 호스트 port 선택과 구분한다.
- DB 비밀번호는 `DB_PASSWORD` 또는 `DB_PASSWORD_FILE`로 제공한다. 둘 다 생략한 경우에만
  entrypoint가 `/run/secrets/db_password`를 기본 파일로 선택한다.
- `AUTH_CONFIG_FILE`은 mount한 인증 JSON의 절대 경로다. `accessJwt`·`passkey`와 기존
  issuer/audience/key set·RP 설정을 제공하며 OCR 로그인에는 `passkey.ocrReturnUrl`이 필요하다.
  JWT 개인키는 JSON 또는 위 외부 입력 중 하나로 제공한다. 형식은 [패스키 실행 안내](passkey-authentication.md)를 따른다.
  `AUTH_TRUST_PROXY`는 생략하거나 기존 단일 proxy 구성에서만 `single-hop`을 사용한다.
- 인증 헤더 없는 `GET /me`의 401은 기존 배포에서 사용하는 HTTP 시작 확인이다.
  DB·인증 연동을 매번 확인하는 전용 readiness endpoint는 아니다.

기본 CMD는 `node --import reflect-metadata dist/main.js`이며 시작 시 migration을 자동 실행하지
않는다. 다음 명령은 같은 이미지의 CMD를 대체하며 entrypoint와 DB 입력을 유지한다.
Migration에는 accounts DB의 migrator 역할, cleanup에는 기존 accounts runtime 역할을 제공한다.
CLI에는 `PORT`·인증 JSON이 필요하지 않으며 runtime 이미지에서 pnpm build를 실행하지 않는다.

```sh
node --import reflect-metadata dist/database/cli.js up
node --import reflect-metadata dist/database/cli.js show
node --import reflect-metadata dist/auth/cleanup/cli.js
```

Migration `down`은 지원하지만 자동 rollback으로 사용하지 않는다. Cleanup은 기존 보관·삭제
정책을 실행하므로 스케줄과 실행 선택은 인프라가 담당한다. 운영 secret·실데이터는 빌드 입력이 아니다.

이전 인증 데이터 정리의 제품 SQL은 `apps/accounts/database/retire-api-auth.sql`과
`retire-api-passkeys.sql`에 보존합니다. 현재 RP 키와 source 회원 대조 등
[삭제 전제](../rules/auth-database.md#별도-accounts-db와-이전-종료)를 유지하며,
이미지의 공개 migration CLI로 제공되는 명령은 아닙니다. 실행·복구 선택은 인프라 책임입니다.

### OCR

`apps/ocr/Dockerfile`로 만듭니다.
기본 CMD는 `node dist/src/main.js`, 실행 사용자는 `node`(UID/GID `1000:1000`)이며,
이미지 기본값은 `OCR_HOST=0.0.0.0`, `PORT=3100`, `OCR_DATA_DIR=/data`입니다.

- `OCR_ORIGIN`, `OCR_AUTH_ORIGIN`에는 정확한 HTTPS origin, `OCR_OWNER_ID`에는 기존 지정 계정의
  UUID가 필요합니다. 인증 서버의 `passkey.ocrReturnUrl`도 OCR callback과 일치해야 합니다.
- `/data`에는 실행 사용자가 쓸 수 있는 영속 저장소를 mount합니다. `OCR_DATA_DIR`을 바꿀 때는
  절대 경로를 사용합니다. `ocr.sqlite`에 원본·메타데이터·모델 파일을 저장하며 기존 SQLite 구성을 유지합니다.
- `OCR_MAX_BYTES` 기본은 1 GiB, 최소는 16 MiB입니다. 저장 상한에 도달해도 기존 자료를 자동 삭제하지 않습니다.
- `GET /health`의 200·`{"ok":true}`는 HTTP 시작 확인이며 인증 서버 연결이나 DB 상태를 매번 검사하지 않습니다.
- 별도 migration/cleanup CLI는 없습니다. 시작 시 기존 `OcrStore`가 `CREATE TABLE IF NOT EXISTS`로
  테이블을 준비합니다. 기존 자료의 변환·복구·보관은 운영 담당자가 선택하며 앱 시작이 이를 대신하지 않습니다.

이미지 빌드에는 운영 설정·인증정보·실데이터를 전달하지 않습니다.
