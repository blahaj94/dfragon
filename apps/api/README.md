# 던삐삐 API

`apps/api`는 공개 캐릭터 API입니다. DB를 쓰지 않으며 Neople API에서 조회한 캐릭터는 API 메모리에 1시간, 공용 아이템 정보는 24시간 캐시합니다.
여러 노드로 띄울 수 있지만 캐시는 노드마다 따로 둡니다. 기본 entry는 설정 검증, HTTP listen 순서로 시작합니다.
검색, 상세, 오늘의 등급의 제품 계약은 [문서 안내](../../docs/README.md)에서 찾습니다.

## Swagger와 HTTP

`/docs`, `/docs/openapi.json`은 API 계약만 제공합니다. `/health`는 200, `/auth/**`와 `/me`는 404입니다.

## 준비할 입력

| 필수 | 선택 |
| --- | --- |
| `PORT`, Neople key | `SEARCH_TRUST_PROXY=single-hop`, local TLS |

PORT는 ASCII 십진 정수 1~65535입니다. `.env.example`을 앱의 `.env`로 복사하고 실제 secret은 Git 밖에서 관리합니다.
Proxy 설정은 단일 신뢰 proxy를 사용할 때만 켭니다.

Neople key는 시작할 때 `NEOPLE_API_KEY` 또는 `NEOPLE_API_KEY_FILE`의 절대 경로에서 읽습니다. GitHub나 특정 secret manager가
필요하지 않으며 self-host 운영자가 준비한 환경변수, 읽기 전용 파일을 사용할 수 있습니다.

두 입력을 함께 지정하면 빈 값이어도 거절합니다. 빈 값, 상대 경로, 읽을 수 없는 파일은
시작 전에 값, 경로 없이 실패합니다. 파일은 UTF-8로 읽고 끝의 LF만 제거하며, 직접 입력은 그대로 사용합니다.
비밀값은 이미지 빌드 인자나 Dockerfile의 `ENV`로 넣지 않습니다. 값 교체 후에는 앱을 다시 시작합니다.

## 로컬 개발 명령

API는 `https://localhost:3443`을 사용합니다. 운영 credential을 개발에 사용하지 않습니다.

```sh
pnpm --filter @dfragon/api dev
pnpm --filter @dfragon/desktop dev
```

`LOCAL_HTTPS_CERT_FILE`, `LOCAL_HTTPS_KEY_FILE`을 신뢰한 localhost 인증서의 절대 경로로 설정하고
`API_ORIGIN=https://localhost:3443`을 지정합니다. TLS 파일의 key 일치, localhost/port 입력을 listen 전에 확인하며
client의 실제 신뢰 체인 검증을 끄지 않습니다. 설치형 배포는 `DFRAGON_DISTRIBUTION_API_ORIGIN`,
Shell 기반 구성의 검색은 `DFRAGON_API_ORIGIN`을 사용합니다.
별도 Node client의 개발 CA는 실행 전 `NODE_EXTRA_CA_CERTS`에 공개 CA certificate를 지정합니다.
Desktop은 OS 인증서 신뢰를 사용하며 인증서 오류를 무시하지 않습니다.

## 시작, 종료와 검증

실제 캐릭터의 스킬 계수, 쿨타임을 별도 설치한 비공개 패키지로 확인하는 선택 명령은
[스킬 패키지 검증](#비공개-스킬-패키지-검증)을 참고합니다. 서버를 시작하지 않습니다.

`build` 후 `start`로 compiled ESM entry를 실행할 수도 있습니다. 설정, listen 실패는
`API failed to start`와 nonzero exit만 남깁니다. Secret, 파일 경로, stack을 기록하지 않습니다.

`pnpm --filter @dfragon/api test`는 HTTP, 설정과 build를 검증합니다. 이미지 입력과 운영 책임은 [서버 이미지](#서버-이미지)를 따릅니다.
로컬 성공은 실제 DNS/TLS 검증을 대신하지 않습니다.

## 접근 로그

API는 요청마다 stdout에 JSON 한 줄을 남깁니다(`apps/api/src/access-log.ts`).
필드는 `time`, `service`, `method`, route template, `status`, 오류 `code`, 5xx의 정제한 `errorChain`, `durationMs`, `correlationId`, 연결이 먼저 끊긴 요청의 `aborted`입니다.
URL, query, header, body, 오류 message와 캐릭터 ID, 이름은 남기지 않습니다.

`GET /characters/:serverId/:characterId`와 `POST /characters/:serverId/:characterId/refresh`에는 Neople을 기다린 단계별 시간을 `neopleMs`에 정수 ms로 붙입니다.
`basic`은 기본정보, `sections`는 나머지 섹션 10개의 병렬 조회, `catalog`는 공용 아이템 조회입니다.
실패한 요청은 성공한 단계까지만 남습니다.
같은 캐릭터의 겹친 요청은 기본정보와 섹션 조회를 공유하므로 그 조회를 기다린 요청들에 같은 `basic`, `sections` 값이 붙고, 진행 중인 조회에 합류한 요청에는 `neopleShared: true`가 붙습니다.
캐릭터 캐시가 맞았지만 [저장한 응답 본문](../../docs/rules/character-details.md#응답-본문-재사용)이 없는 요청은 Neople을 기다리지 않으므로 `basic`, `sections` 없이 `catalog`만 남습니다.
저장한 응답 본문을 그대로 보낸 요청은 Neople도 공용 아이템도 기다리지 않으므로 `neopleMs` 없이 `responseCached: true`가 붙습니다.
`responseCached`는 상세 GET과 강제 갱신에만 붙고, 저장한 본문 없이 새로 만든 응답에는 붙지 않습니다.
강제 갱신은 캐시를 건너뛰므로 새로 받았거나 합류한 조회의 `basic`, `sections`가 붙습니다.
`catalog`는 그 요청이 공용 아이템 정보를 기다린 시간입니다.
공용 아이템은 24시간 캐시하므로 모든 아이템이 캐시에 있으면 거의 0이고, 다른 요청이 이미 조회 중인 아이템은 그 조회를 함께 기다립니다.

```json
{"time":"2026-10-29T00:00:00.000Z","service":"api","method":"GET","route":"/characters/:serverId/:characterId","status":200,"durationMs":512,"neopleMs":{"basic":88,"sections":231,"catalog":176},"correlationId":"<uuid>"}
{"time":"2026-10-29T00:00:05.000Z","service":"api","method":"GET","route":"/characters/:serverId/:characterId","status":200,"durationMs":4,"neopleMs":{"catalog":1},"correlationId":"<uuid>"}
{"time":"2026-10-29T00:00:09.000Z","service":"api","method":"GET","route":"/characters/:serverId/:characterId","status":200,"durationMs":0,"responseCached":true,"correlationId":"<uuid>"}
```

## 서버 이미지

[Product Images](../../.github/workflows/product-images.yml)는 서버 이미지 입력이 바뀌었을 때만 API 이미지를 빌드합니다.
`apps/api/**`, `packages/lib/**`, `packages/licenses/**`와 root package, lockfile, workspace 설정,
이미지 workflow, 선택 도구, 커밋 정보 생성기(`scripts/server-build-info.mjs`) 변경이 해당합니다.
그 안의 `*.md` 문서는 이미지에 들어가지 않으므로 입력으로 보지 않습니다.
지운 accounts, OCR 이미지는 더 빌드하지 않습니다.
서버 이미지 입력이 없는 문서, Desktop 전용 변경은 이미지 빌드, 발행을 건너뜁니다.
PR 제목 scope가 `(build)`가 아닌 PR과 그 main push도 이미지를 빌드, 발행하지 않으며, 그 변경은 다음
`(build)` main push가 함께 발행합니다. 규칙은 [build-scope 안내](../../scripts/README.md#build-scope)에 있습니다.

Product Images는 main push에서만 실행하며 테스트 통과를 확인하지 않습니다. 테스트는 로컬의 `pnpm verify`가 맡습니다.
main push 전체의 `before`부터 push한 commit까지 비교해 이미지를 선택하고 같은 commit으로
빌드, 발행합니다. 후속 실행 때의 최신 main을 다시 선택하지 않습니다.
main에서는 마지막으로 Product Images 전체가 성공한 실행의 source commit 이후 변경도
포함합니다. 앞선 빌드, 발행의 취소나 실패로 발행되지 않은 변경은 다음 성공 실행에서
반영합니다. 이전 성공 목록이 없거나 90일 보관 기한이 지났으면 API 이미지를 빌드합니다.
지우기 전의 목록에 남은 `ocr`, `accounts`는 이전 성공 목록에서만 무시합니다.
선택 목록이 없거나 source commit이 다르면 실패하며 임의로 빌드를 생략하지 않습니다.

이미지는 `ghcr.io/blahaj94/dfragon/api:<40자리 commit SHA>`로 발행하고
OCI `source`, `revision` label에 저장소와 commit을 기록합니다. 대상 플랫폼은 `linux/amd64` 하나입니다.
같은 제품 commit을 `SOURCE_COMMIT` 빌드 인자로 전달해 이미지 내부 `/app/build-info.json`에도
고정합니다. 빌드와 발행 전에 컨테이너를 시작하지 않고 파일을 추출해 서비스명과 commit을
대조합니다. 이미지의 label, 내부 버전 정보와 인계 artifact가 같은 소스를 가리켜야 합니다.
이미지 빌드 실패는 `Build image`, 인증, 발행, digest 확인
실패는 각각 `Authenticate to GHCR`, `Publish the built image`, `Verify the registry digest`에서 확인합니다.
Provenance 기록 실패는 `Attest the published image provenance`에서 확인합니다.
선택한 이미지 빌드가 모두 성공해야 같은 목록의 발행 job이 시작됩니다.

인프라에서는 성공한 발행 실행의 summary 또는 `image-handoff-api` artifact 안의 JSON을 사용합니다.
파일은 다음 형식이며 `image`는 registry에서 조회, 확인한 digest reference입니다.
Tag는 조회 편의용이고 배포 입력은 `image@sha256:digest`입니다.

```json
{
  "service": "api",
  "image": "ghcr.io/blahaj94/dfragon/api@sha256:<registry-digest>",
  "sourceCommit": "<40-character-commit-sha>"
}
```

발행 job은 push한 digest에 build provenance attestation을 기록하고 GHCR에도 함께 올립니다.
Attestation이 실패하면 handoff artifact를 올리지 않고 발행 실행도 실패합니다. 출처는
`gh attestation verify oci://ghcr.io/blahaj94/dfragon/<service>@sha256:<digest> -R blahaj94/dfragon`으로
확인하며 해당 이미지의 GHCR 조회 권한이 필요합니다.

선택 job은 `contents: read`와 원본, 이전 성공 실행의 목록을 읽기 위한 `actions: read`,
빌드 job은 `contents: read`, 발행 job은 `packages: write`와 provenance 서명용 `id-token: write`,
`attestations: write`만 사용합니다.
발행 job은 같은 실행의 이미지 archive를 받아 source, 플랫폼을 확인하고 push하며,
앱 코드를 checkout하거나 실행하지 않습니다. 운영 secret, SSH, Tailscale 접근은 없습니다.
GHCR의 공개 범위, 접근 정책은 workflow가 변경하지 않습니다. 인프라의 pull 인증은
기존 package 접근 정책에 맞춰 별도로 준비해야 합니다.

제품은 테스트, 빌드, 이미지 발행과 Dockerfile, 앱 실행 진입점을 소유합니다.
이미지 선택, 비밀값 관리와 전달, Compose, SSH, 서버 권한, 배포 절차의 원본은
[인프라 운영 안내](https://github.com/blahaj94/dfragon-infra/blob/main/deploy/linux/README.md)입니다.
제품 main merge는 운영 배포를 실행하지 않으며 Product Images는 인프라 checkout, 운영 credential에 의존하지 않습니다.

Dockerfile과 전용 ignore 파일은 `apps/api/`에 있습니다. 빌드 context는 제품 저장소 root이며
`docker-entrypoint.sh`도 앱 옆에서 관리합니다. 의존성 설치에는 registry 토큰이나 BuildKit secret이 필요하지 않습니다. 로컬 빌드는 다음과 같습니다.

```sh
docker build --platform linux/amd64 --build-arg SOURCE_COMMIT="$(git rev-parse HEAD)" -f apps/api/Dockerfile -t dfragon-api:local .
```

커밋 정보는 커밋한 checkout을 기준으로 넣습니다. 빌드 인자를 생략한 로컬 이미지는 `commit: null`로
정보 없음을 명시합니다. 잘못된 SHA는 빌드에 실패하며, GitHub가 발행하는 이미지는 정확한 SHA가
없으면 검증을 통과하지 못합니다. 비밀값은 빌드 인자로 전달하지 않습니다.

### 실행 중인 서버의 버전 조회

API는 로그인 없이 `GET /version`으로 다음 정보를 제공합니다.

```json
{
  "service": "api",
  "commit": "<40-character-commit-sha>"
}
```

응답에는 서비스명과 이미지에 고정된 제품 commit만 포함하며 `Cache-Control: no-store`를 사용합니다.
시작 시 런타임 환경변수나 최신 GitHub main에서 commit을 덮어쓰지 않습니다. 이전 이미지로
복귀하면 그 이미지에 내장된 commit이 반환됩니다. 파일이 없는 로컬 실행이나 손상된 정보는
`commit: null`로 표시하고, 이 기능이 없는 이전 서버는 `/version`을 제공하지 않을 수 있습니다.
기존 health 응답 형식은 유지합니다.

## 이미지 실행 계약

아래는 제품 이미지가 요구하는 입력과 명령입니다. 서버 자원 준비, 실행 순서와 복구 판단은 인프라 절차를 따릅니다.

`apps/api/Dockerfile`로 만들며 UID/GID `1000:1000`의 `node` 사용자로 실행합니다. 아래는 이미지 자체의 입력입니다.

- `PORT`(현재 3000)를 반드시 지정합니다. `EXPOSE 3000`은 `PORT`의 기본값을 설정하지 않습니다.
- Neople key는 위 직접 입력 또는 `_FILE` 입력을 사용합니다. 둘 다 생략한 경우에만
  entrypoint가 `/run/secrets/neople_api_key`를 기본 파일로 선택합니다. Neople key는 필수입니다.
  `SEARCH_TRUST_PROXY`는 생략하거나 기존 단일 proxy 구성에서만 `single-hop`을 사용합니다.
- `GET /health`의 200과 `{"status":"ok"}`는 HTTP 시작 확인입니다. 요청마다 Neople 연결을
  재검사하는 readiness는 아니며, 검색 성공 검증과 구분합니다.

이미지의 기본 CMD는 `node --import reflect-metadata dist/main.js`입니다. Migration, cleanup CLI는 없습니다.
이미지 빌드에는 운영 설정, secret, 실데이터를 제공하지 않습니다.

이미지 실행 계약은 로컬에 있는 이미지로 `node apps/api/test-support/container-deployment.mjs dfragon-api:local`을 실행해
확인합니다. UID, 읽기 전용 파일시스템, Neople key의 ENV, FILE, 기본 파일 입력, 잘못된 입력의 거절과 정상 종료를 봅니다.

## 비공개 스킬 패키지 검증

`apps/api`의 `verify:skills`는 GitHub Packages에 게시된 `@blahaj94/dfragon-skills`를
별도 설치 디렉터리에서 읽고, 실제 캐릭터의 스킬 계수, 쿨타임을 계산하는 선택 실행 명령입니다.
현재 `weapon_master`만 지원하며 규칙의 직업, 전직 ID와 캐릭터의 직업, 전직 ID를 정확히 비교합니다.
각성 단계의 호환 관계를 직업 이름으로 추정하지 않습니다.

### 설치와 실행

패키지 읽기 권한이 있는 인증을 별도 npm 설정에서 준비한 뒤, workspace 밖의 절대 경로에
검증할 버전을 설치합니다. 인증값과 실제 캐릭터 정보는 저장소, 문서, PR에 기록하지 않습니다.
GitHub Packages 인증 설정은 [공식 안내](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-npm-registry)를 따릅니다.
별도 npm 설정에서는 `@blahaj94:registry=https://npm.pkg.github.com`으로 scope만 지정하고,
`ajv` 등 일반 의존성이 설치되도록 기본 registry는 npmjs로 유지합니다.

```sh
npm install --prefix /absolute/path/to/skill-package --save-exact \
  @blahaj94/dfragon-skills@0.1.0

NEOPLE_API_KEY_FILE=/absolute/path/to/neople-key \
  pnpm --filter @dfragon/api verify:skills \
  --server siroco --character '<캐릭터명>' --profile weapon_master \
  --package-directory /absolute/path/to/skill-package
```

`--package-directory`는 패키지 소스 경로가 아니라 `npm install --prefix`로 사용한 디렉터리입니다.
Node 26과 기존 workspace 의존성이 필요합니다. 명령은 먼저 API를 빌드하며, 이미 빌드했다면
`pnpm --filter @dfragon/api exec node --import reflect-metadata test-support/verify-skill-calculation.mjs`에 같은 인자를
전달할 수 있습니다. `NEOPLE_API_KEY` 직접 입력도 지원하나 `_FILE`과 동시에 지정하면 실패합니다.
PORT, DB 설정, HTTP 서버, DB 연결은 사용하지 않습니다.

정규 dependency와 lockfile에 비공개 패키지를 추가하지 않습니다. GitHub Actions의 배포 workflow와 Docker build에는
패키지 권한이나 secret이 필요하지 않으며, 일반 `test`에는 합성 입력을 사용하는 회귀 검사만 포함됩니다.

### 입력과 결과의 의미

- 기존 Neople 검색, 11개 상세, 스킬 카탈로그 adapter를 재사용합니다. 검색, 상세는 HTTP client 기본 timeout을 따르고,
  스킬 상세도 ky의 HTTP client 기본 timeout을 따릅니다. 필요한 모든 스킬 상세를 한 번에 동시에
  조회하며 실패를 재시도하지 않습니다. DB에 저장하지 않습니다.
- active, passive의 API 레벨을 `selectedLevel`로 전달합니다. 무기의 극의 등 패시브 효과는
  패키지가 순서대로 적용하며 결과의 `effectiveLevel`을 함께 표시합니다.
- evolution의 type은 `vp`, enhancement의 type은 `up`에 전달합니다. 미지원 선택, 범위 밖 레벨,
  필수 목록 누락은 실패합니다. 프로필 밖 일반 스킬은 `excluded`에 명시합니다.
- 모드는 API 자료로 추정하지 않고 패키지의 무기별 기본 모드를 사용합니다. 스킬 체인 선택은
  반영하지 않으며 이 한계를 결과에 표시합니다.
- JSON 요약에는 패키지 버전, 캐릭터 확인값, 계산, 보류, 비공격, 미습득, 제외 개수와 습득 스킬별
  계수, 쿨타임, 경고를 담습니다. 보류는 0으로 바꾸지 않습니다. 실패는 고정 코드, 문구와 종료 코드 1이며
  API 원문, key, URL, stack을 출력하지 않습니다.

이 검증은 실제 API 입력을 패키지에 연결하는 범위입니다. 장비, 스탯, 대상 방어를 합산한 데미지,
최적 모드, 인게임 실측과의 일치를 보장하지 않습니다. 캐릭터 상세와 여러 스킬 API 호출이 같은 순간의
snapshot이라는 보장도 없습니다.
장비의 스킬 레벨, 스탯, 추가 쿨타임 감소, 특수 무기 보정은 별도로 입력하지 않으며,
API가 보고한 스킬 레벨과 장착 무기 종류를 사용합니다. 특수 무기 분류, 보정은 현재 패키지의
공개 계산 입력에서 지정할 수 없습니다.

합성 입력 변환, 실패, 동시성 검사는 API `test`에 포함됩니다. 이미 빌드된 상태에서는 다음 명령으로
해당 범위만 확인할 수 있습니다.

```sh
node --test apps/api/test-support/skill-calculation.test.mjs
```

### 저장된 입력과 실측의 오프라인 비교

`verify-skill-measurement.mjs`는 저장된 스킬 상세로 다시 계산하고, 기준 스킬 한 개의 실측으로
공통 배율을 구해 다른 스킬의 실측과 비교합니다. Neople 호출, credential, DB를 사용하지 않습니다.
API build 후 다음 명령을 사용합니다. 세 경로는 모두 절대 경로입니다.

```sh
pnpm --filter @dfragon/api exec node --import reflect-metadata \
  test-support/verify-skill-measurement.mjs \
  --package-directory /absolute/path/to/skill-package \
  --snapshot /absolute/path/to/snapshot.json \
  --observations /absolute/path/to/observations.json
```

Snapshot은 `details.character`의 `jobId`, `jobGrowId`, `details.equipment.equipment`,
`details.skillStyle.style`, `details.status.status`와 `catalog`를 갖습니다. `catalog`에는 패키지가
요구하는 모든 스킬의 `{key: {kind: "skill", jobId, skillId}, payload}`가 있어야 합니다.
캐릭터 이름, ID는 필요하지 않습니다. Snapshot과 실측 원문은 저장소 밖에서 보관합니다.

아래 관측 예시는 **합성 값**입니다. 실제 입력에는 패키지의 정확한 스킬 ID와 확인한 값을 사용합니다.
두 측정의 `contextId`와 `targetLevel`은 공통 `context`와 일치해야 하며, 서로 다른 대상 레벨에서
측정한 결과를 섞으면 실패합니다. 장비, 버프, 도핑, 치명타, 전체 명중 조건의 동일성은 사용자가
확인해 `conditions`에 적습니다. 이 입력만으로 환경이 같았다는 사실을 자동 검증하지 않습니다.
`context.id`, `conditions`, `source`는 로컬 결과에 표시되므로 개인정보, 비밀값, 개인 파일 경로를 넣지 않습니다.

```json
{
  "context": {
    "id": "synthetic-session",
    "target": { "kind": "sandbag", "level": 110 },
    "conditions": ["동일한 합성 장비", "전체 명중", "도핑 없음"],
    "status": [{ "name": "힘", "value": 2000 }]
  },
  "levelOverrides": [
    { "skillId": "reference-id", "level": 2, "source": "합성 인게임 관측" },
    { "skillId": "comparison-id", "level": 3, "source": "합성 인게임 관측" },
    { "skillId": "passive-id", "level": 8, "source": "합성 장비 레벨 보정" }
  ],
  "reference": {
    "skillId": "reference-id", "level": 2,
    "contextId": "synthetic-session", "targetLevel": 110,
    "damage": 100, "multiplier": { "value": 1, "source": "추가 보정 없음" }
  },
  "comparison": {
    "skillId": "comparison-id", "level": 3,
    "contextId": "synthetic-session", "targetLevel": 110,
    "damage": 330, "multiplier": { "value": 1.5, "source": "합성 장비의 해당 스킬 증가" }
  }
}
```

`reference.level`, `comparison.level`은 인게임 표시 레벨이며 패키지 결과의 `effectiveLevel`과
비교합니다. `levelOverrides[].level`은 패키지에 전달할 **selectedLevel**입니다. 다른 패시브가
가산하는 레벨은 중복 입력하지 않고 출처에 환산 근거를 적습니다. 결과에는 API 원래 레벨,
입력한 레벨, 패키지가 계산한 최종 레벨과 출처를 함께 표시합니다. `context.status`의 이름은
snapshot 상태명과 정확히 일치해야 하며, 원래 상태값과 관측값을 나란히 표시할 뿐 산식에 재곱하지 않습니다.

계산은 `보정값 = 기준 실측 / (기준 effectiveCoefficient × 기준 개별 배율)`,
`비교 예측 = 비교 effectiveCoefficient × 비교 개별 배율 × 보정값` 순서입니다.
비교 스킬 실측은 오차 계산에만 사용합니다. 오차율은 `(예측 − 실측) / 실측 × 100`이며,
음수는 예측이 실측보다 작다는 뜻입니다. `panelMultiplier`는 이미 계수에 포함되어 다시 곱하지 않습니다.
칭호 등 스킬별 추가 배율은 `multiplier`로 한 번 적용하며, 패키지에 이미 포함된 증가를 중복 입력하면 안 됩니다.

이 방법은 동일 환경의 공통 배율을 실측으로 흡수합니다. 절대 데미지 공식, 전체 장비 효과, 대상 방어를
재현한 검증이 아닙니다. 현재 맹룡 개화의 추가 회오리와 모델 타수의 대응은 확인되지 않았고,
감전 피해는 별도로 포함하지 않습니다. 패키지의 연구 모델, 보류 경고를 유지합니다.

기존 입력 변환과 오프라인 비교 회귀 검사는 다음 명령으로 확인합니다.

```sh
node --test apps/api/test-support/skill-calculation.test.mjs \
  apps/api/test-support/skill-measurement.test.mjs
```
