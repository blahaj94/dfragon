# accounts 배포와 기존 인증 이전

`apps/accounts`는 `/auth/**`, `/me`, `/me/nickname`과 인증 UI를 소유한다. 공개 주소와 새 RP ID는
`https://accounts.dfragon.com`·`accounts.dfragon.com`이다. API는 캐릭터·모험단 API와 `/health`만 제공한다.
같은 서버에서 Compose project `dfragon-accounts`, PostgreSQL container `accounts-database`,
DB `dfragon_accounts`, 기본 volume `dfragon_accounts_database`를 별도로 사용한다.
역할도 `dfragon_accounts`(인증 DML)와 `dfragon_accounts_migrator`(schema)로 분리한다.
API runtime에는 accounts DB 네트워크·비밀번호·JWT 개인키를 제공하지 않는다. 같은 서버의 물리 장애는 공유한다.

사용자가 승인한 범위는 기존 계정·패스키 보존, 새 RP로 단계적 이전, 짧은 인증 점검과 앱 업데이트 필수다.
이 문서는 검토·merge 후 운영자가 실행할 절차이며, 로컬 검증이 운영 이전 완료를 의미하지 않는다.

## 먼저 준비할 입력

운영자는 현재 release, 실제 source RP ID, 인증 DB 이름·역할·volume, 백업과 복원 수단을 확인한다.
문서상 기존 RP는 `api.dfragon.com`이다. 실행 중 설정이 다르면 그 값과 origin에 맞춰 계획을 수정한다.
기존 `ReplaceOAuthWithPasskeys`를 운영 DB에서 재실행하거나 기존 패스키 계정을 비우지 않는다.

`/etc/dfragon/accounts.env`에는 다음 비밀이 아닌 선택을 둔다. 현재 API/OCR 환경 파일은 각각 유지한다.

```dotenv
DFRAGON_IMAGE_TAG=<reviewed-release-commit>
DFRAGON_SECRETS_DIR=/etc/dfragon/accounts-secrets
DFRAGON_ACCOUNTS_PORT=3200
DFRAGON_ACCOUNTS_DATABASE_VOLUME_NAME=dfragon_accounts_database
```

Checkout 밖의 root `0700` 디렉터리에 `postgres_password`, `dfragon_accounts_migrator_password`,
`dfragon_accounts_password`, `auth_config.json`을 준비한다. Password는 기존 API DB와 다른 값이다.
Compose file secret의 컨테이너 UID 999/1000 접근을 위해 파일 `0444`, 부모 `0700`을 사용하며
Docker 관리자도 읽을 수 있다. Secret을 명령 인자·history·dump·Git·로그에 넣지 않는다.
`auth_config.json`의 `accessJwt`는 기존 issuer/audience/key set을 보존하고 `passkey`는 다음으로 설정한다.

```json
{
  "apiOrigin": "https://accounts.dfragon.com",
  "rpId": "accounts.dfragon.com",
  "rpName": "DFRAGON",
  "returnUrl": "dfragon://auth/callback",
  "legacyOrigin": "https://api.dfragon.com",
  "ocrReturnUrl": "https://ocr.dfragon.com/auth/callback"
}
```

이 예제는 `passkey` 객체만 보여준다. `legacyOrigin`은 이전을 제공할 때만 설정한다.
`apiOrigin`이라는 기존 설정 필드 이름은 이제 **accounts 인증 origin**을 뜻한다.
`AUTH_TRUST_PROXY=single-hop`은 Caddy 한 단계를 신뢰하며 직접 외부 port를 열지 않는다.

## 빈 accounts DB 준비

Repository root에서 아래 공통 인자로 실행한다. 운영 password나 key를 출력하지 않는다.

```sh
docker compose --env-file /etc/dfragon/accounts.env -f deploy/accounts/compose.yaml config --quiet
docker compose --env-file /etc/dfragon/accounts.env -f deploy/accounts/compose.yaml build accounts
docker compose --env-file /etc/dfragon/accounts.env -f deploy/accounts/compose.yaml up -d --wait accounts-database
docker compose --env-file /etc/dfragon/accounts.env -f deploy/accounts/compose.yaml --profile maintenance run --rm migrate
docker compose --env-file /etc/dfragon/accounts.env -f deploy/accounts/compose.yaml exec -T accounts-database psql -X -U postgres -d dfragon_accounts -f /opt/dfragon/grant-accounts.sql
```

이 네 개 auth migration은 **빈 accounts DB**에 적용한다. `AddAccountsPasskeyMigration`의 RP column과
handoff table을 먼저 만든 뒤 데이터를 복사한다. 기존 API DB의 history·domain schema는 그대로 둔다.
새 API의 migration 목록은 domain 네 개만 포함하므로 기존 history의 auth 항목을 삭제하지 않는다.
API에도 domain 권한만 부여하는 최신 `deploy/api/grant-api.sql`을 사용한다.

## 인증 점검과 단일 복사

1. 새 API/accounts 이미지와 업데이트된 Desktop 설치본을 미리 준비하고 DB 백업을 확인한다.
   Caddy 인증 경로·OCR 인증 요청을 점검 상태로 둔다. 기존 cleanup timer를 멈추고 실행 중인 cleanup 종료를 기다린다.
   기존 API와 OCR을 정상 중지한다. 기존 DB는 계속 실행한다. 다른 수동 인증 writer도 없어야 한다.
2. source DB 관리자 연결로 `freeze-source.sql`을 실행한다. 예: 기존 API Compose의 `database`에
   `psql -X -U postgres -d dfragon < deploy/accounts/freeze-source.sql`을 전달한다.
   source runtime의 인증 table 권한을 회수하며, 활성 API 연결·상속 권한이 있으면 거절한다.
   이후 source auth table을 다시 쓰는 구버전 runtime/cleanup을 실행하지 않는다.
3. 임시 `import_source.json`을 accounts secret 디렉터리에 준비한다. 필드는 문자열 `DB_HOST`, `DB_PORT`,
   `DB_NAME`, `DB_USERNAME`, `DB_PASSWORD` 다섯 개다. source API DB의 현재 migrator 접속을 사용한다.
   기본 network에서 host는 `database`, target은 `accounts-database`다. 실제 source network 이름을 확인한다.
   임시 파일은 importer만 mount하고 runtime에는 전달하지 않는다.
4. source의 실제 RP ID를 비밀이 아닌 `AUTH_IMPORT_LEGACY_RP_ID`로 지정하고 한 번 실행한다.

```sh
AUTH_IMPORT_LEGACY_RP_ID=api.dfragon.com docker compose --env-file /etc/dfragon/accounts.env \
  -f deploy/accounts/compose.yaml -f deploy/accounts/import.compose.yaml --profile maintenance run --rm import-auth
```

Importer는 source table 쓰기 잠금과 target 단일 transaction으로 UUID·닉네임·패스키·counter·세션과
**소비된 refresh hash를 포함한 전체 이력**을 복사한다. 진행 중 로그인 요청은 이전하지 않는다.
기존 패스키에는 확인한 source RP ID를 붙인다. Target이 비어 있지 않거나 source가 이미 새 schema면 거절한다.
성공 출력은 table별 건수뿐이다. 오류 시 target이 rollback되지만 COMMIT 응답 유실은 결과 불명일 수 있으므로
인증을 멈춘 상태에서 양쪽 건수·내용·제약을 확인한다. 자동 삭제·자동 재시도를 하지 않는다.

5. 양쪽 UUID·credential·counter·세션·모든 refresh 행이 일치하고 source가 그대로인지 운영자 전용 연결로 확인한다.
   raw 결과는 보고서·PR·로그에 기록하지 않는다. 임시 importer container·source network 연결과 secret 파일을 정리한다.
6. 새 API와 accounts를 시작한다. API `/health`는 200, API `/me`는 404, accounts `/me`는 미인증 401이어야 한다.
   최신 [Caddy 예제](Caddyfile.example)의 새 도메인과 기존 RP용 제한 경로를 적용한다.
   Host를 유지하고 access log에 ticket·code URL을 남기지 않는다. TLS/DNS와 Caddy config 검증 후 reload한다.
7. OCR의 `OCR_AUTH_ORIGIN=https://accounts.dfragon.com`만 전환하고 `OCR_OWNER_ID`는 같은 UUID를 유지한다.
   Desktop 배포는 검색 origin과 별도 `DFRAGON_DISTRIBUTION_ACCOUNTS_ORIGIN`을 사용한다.
   기존 설치본은 업데이트해야 하며 origin에 묶인 기존 로컬 로그인은 새 주소에서 한 번 다시 로그인한다.
8. 기존 키 로그인 → 새 키 추가 또는 나중에 이전 → 동일 계정 로그인, 새 RP 재로그인, 예비 키 관리,
   휴대폰 QR 승인과 취소, OCR 소유자 로그인을 실제 배포에서 확인한다. 그 후 인증 점검을 해제한다.

## RP 이전과 되돌리기

기존 credential의 RP ID는 수정할 수 없다. 기존 주소에서 기존 키로 본인 확인한 뒤, 일회용 60초 ticket으로
처음 accounts 인증을 시작한 cookie에 돌아와 **같은 UUID**에 새 키를 추가한다. 요청 전체 TTL은 600초다.
기존 키도 남으며 사용자는 이전을 미루고 기존 키로 로그인할 수 있다. 휴대폰에서는 이후 PC 로그인 명시 승인이 필요하다.
새 키를 만들지 않은 사용자가 남은 동안 legacy origin·TLS·제한 proxy 경로를 유지한다. 자동 종료 날짜는 두지 않는다.

Target에 쓰기가 시작되기 전 실패했다면 accounts를 중지하고 source 데이터 보존을 확인한 뒤,
이전 release의 auth 권한·설정·proxy·OCR을 복구할 수 있다. **Target에서 인증 쓰기가 시작된 후에는 source가 오래된 사본**이다.
그 사본으로 자동 rollback하지 않는다. 새 RP credential을 구버전 schema로 되돌릴 수 없으므로
accounts와 두 RP를 지원하는 이전 호환 image를 사용하거나 별도 데이터 복구 계획을 먼저 검토한다.
Source auth table의 실제 삭제와 백업 정리는 보존·복구 판단 후 운영자가 별도 실행한다.

## Cleanup과 자동배포 전환

Cleanup command와 동일 이름의 일일 timer는 이제 accounts DB만 사용한다. 이전 timer와 동시 실행하지 않는다.
`/opt/dfragon-accounts-current`를 검증한 release checkout으로 연결하고 `dfragon-auth-cleanup.service`·timer를
설치한다. 기존 `/etc/systemd/system/dfragon-auth-cleanup.service.d/deployment.conf`가 있다면 accounts 경로·project·
`/etc/dfragon/accounts.env`로 함께 바꾼다. 수동 cleanup 성공 후 daemon-reload와 timer 활성화를 한다.

기존 Linux 자동배포는 accounts가 없는 state 또는 schema/topology 차이를 거절한다. 최초 분리는 자동배포에 맡기지 않는다.
운영 검증 후 새 `deploy.py`를 기존 root-owned helper에 설치하고, `state.json`의 api/accounts/ocr 각각에 실제 실행 중
revision·source를 기록해 현재 세 서비스 기준을 세운다. 과거 `previous.json`을 분리 전 자동 rollback에 사용하지 않는다.
새 설치만 `install.py`를 사용한다. 이후 일반 배포는 accounts cleanup을 기다리고 accounts image를 교체한다.

검증 명령: `pnpm --filter @dfragon/accounts test`, `pnpm --filter @dfragon/accounts test:database`,
`bash apps/accounts/test-support/container-deployment.sh`, `python3 -m unittest discover -s deploy/linux/tests -v`.
운영 DB 복사·DNS/TLS 변경·실제 OS 패스키 제공자 검증은 별도의 운영 확인이다.
