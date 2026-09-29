<img src="assets/brand/dfragon.png" width="96" height="96" alt="DFRAGON" />

# DFRAGON

공사중

## 서버 이미지

[Product Images](.github/workflows/product-images.yml)는 PR에서 `api`, `ocr`, `accounts`의
이미지를 빌드만 합니다. 기존 Code Quality는 앱 테스트·정적 검사를 담당하며,
main push의 Code Quality가 성공하면 그 실행의 `head_sha`를 그대로 빌드·발행합니다.
후속 실행 때의 최신 main을 다시 선택하지 않습니다.

이미지는 `ghcr.io/blahaj94/dfragon/{api,ocr,accounts}:<40자리 commit SHA>`로 발행하고
OCI `source`·`revision` label에 저장소와 commit을 기록합니다. 대상 플랫폼은 `linux/amd64` 하나입니다.
테스트 실패는 Code Quality, 이미지 빌드 실패는 `Build image`, 인증·발행·digest 확인
실패는 각각 `Authenticate to GHCR`·`Publish the built image`·`Verify the registry digest`에서 확인합니다.
세 이미지 빌드가 모두 성공해야 발행 job이 시작됩니다.

인프라에서는 성공한 발행 실행의 summary 또는 `image-handoff-api`, `image-handoff-ocr`,
`image-handoff-accounts` artifact 안의 JSON을 사용합니다. 각 파일은 다음 형식이며
`image`는 registry에서 조회·확인한 digest reference입니다. 세 파일의 `sourceCommit`이
같은 실행을 선택합니다. Tag는 조회 편의용이고 배포 입력은 `image@sha256:digest`입니다.

```json
{
  "service": "api",
  "image": "ghcr.io/blahaj94/dfragon/api@sha256:<registry-digest>",
  "sourceCommit": "<40-character-commit-sha>"
}
```

빌드 job은 `contents: read`, 발행 job은 `packages: write`만 사용합니다.
발행 job은 같은 실행의 이미지 archive를 받아 source·플랫폼을 확인하고 push하며,
앱 코드를 checkout하거나 실행하지 않습니다. 운영 secret·SSH·Tailscale 접근은 없습니다.
GHCR의 공개 범위·접근 정책은 workflow가 변경하지 않습니다. 인프라의 pull 인증은
기존 package 접근 정책에 맞춰 별도로 준비해야 합니다.

제품은 테스트·빌드·이미지 발행과 Dockerfile·앱 실행 진입점·schema/migration/cleanup 구현을 소유합니다.
이미지 선택·Compose·SSH·서버 권한·배포·백업·복구 절차의 원본은
[인프라 저장소](https://github.com/blahaj94/dfragon-infra)입니다.
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
- `/run/secrets/db_password`를 읽을 수 있게 mount한다. 기존 entrypoint가 이를
  `DB_PASSWORD`로 전달하므로 환경변수만 제공해서는 실행되지 않는다.
- `NEOPLE_API_KEY` 또는 `/run/secrets/neople_api_key`가 필수다. 파일이 있으면 그 값이 우선한다.
  `SEARCH_TRUST_PROXY`는 생략하거나 기존 단일 proxy 구성에서만 `single-hop`을 사용한다.
- `GET /health`의 200·`{"status":"ok"}`는 HTTP 시작 확인이다. 요청마다 DB·Neople 연결을
  재검사하는 readiness는 아니며, 검색 성공 검증과 구분한다.

이미지의 기본 CMD는 `node --import reflect-metadata dist/main.js`다. 시작 시 migration을
자동 실행하지 않는다. Migration은 같은 이미지의 CMD를 다음으로 바꿔 명시 실행한다.
기존 entrypoint와 DB 설정·DB secret mount를 유지하고 해당 DB의 migrator 역할을 제공한다.
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
- `/run/secrets/db_password`를 읽을 수 있게 mount한다. 기존 entrypoint가 `DB_PASSWORD`로
  전달하므로 환경변수만 제공해서는 실행되지 않는다.
- `AUTH_CONFIG_FILE`은 mount한 인증 JSON의 절대 경로다. `accessJwt`·`passkey`와 기존
  issuer/audience/key set·RP 설정을 제공하며 OCR 로그인에는 `passkey.ocrReturnUrl`이 필요하다.
  형식은 [패스키 실행 안내](docs/reference/passkey-authentication.md)를 따른다.
  `AUTH_TRUST_PROXY`는 생략하거나 기존 단일 proxy 구성에서만 `single-hop`을 사용한다.
- 인증 헤더 없는 `GET /me`의 401은 기존 배포에서 사용하는 HTTP 시작 확인이다.
  DB·인증 연동을 매번 확인하는 전용 readiness endpoint는 아니다.

기본 CMD는 `node --import reflect-metadata dist/main.js`이며 시작 시 migration을 자동 실행하지
않는다. 다음 명령은 같은 이미지의 CMD를 대체하며 entrypoint와 DB 입력·secret mount를 유지한다.
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
[삭제 전제](docs/rules/auth-database.md#별도-accounts-db와-이전-종료)를 유지하며,
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
