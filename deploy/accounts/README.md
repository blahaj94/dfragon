# accounts 배포와 이전 패스키 경로 종료

`apps/accounts`는 `/auth/**`, `/me`, `/me/nickname`과 인증 UI를 소유한다. 공개 주소와 RP ID는
`https://accounts.dfragon.com`·`accounts.dfragon.com` 하나다. API는 캐릭터·모험단 API와 `/health`만 제공한다.
같은 서버에서 Compose project `dfragon-accounts`, PostgreSQL container `accounts-database`,
DB `dfragon_accounts`, 기본 volume `dfragon_accounts_database`를 별도로 사용한다.
역할도 `dfragon_accounts`(인증 DML)와 `dfragon_accounts_migrator`(schema)로 분리한다.
API runtime에는 accounts DB 네트워크·비밀번호·JWT 개인키를 제공하지 않는다. 같은 서버의 물리 장애는 공유한다.

전체 계정의 accounts RP 이전 완료에 따라 이전 API 주소의 로그인·RP 이전 UI·handoff·proxy를 제거한다.
이 문서는 사용자 merge 후 운영자가 실행할 절차다. 코드 검증과 실제 운영 적용은 구분한다.

## 이미지 실행 계약

[제품 CI 이미지](../../README.md#서버-이미지)는 기존 `deploy/accounts/Dockerfile`로 만들며
UID/GID `1000:1000`의 `node` 사용자로 실행한다.

- `PORT`(컨테이너 내부 3000), `DB_HOST`, `DB_PORT`, `DB_USERNAME`, `DB_NAME`이 필수다.
  `EXPOSE 3000`은 `PORT` 기본값이 아니다. 기존 host port 3200과 구분한다.
- `/run/secrets/db_password`를 읽을 수 있게 mount한다. 기존 entrypoint가 `DB_PASSWORD`로
  전달하므로 환경변수만 제공해서는 실행되지 않는다.
- `AUTH_CONFIG_FILE`은 mount한 인증 JSON의 절대 경로다. `accessJwt`·`passkey`와 기존
  issuer/audience/key set·RP 설정을 제공하며 OCR 로그인에는 `passkey.ocrReturnUrl`이 필요하다.
  형식은 [패스키 실행 안내](../../docs/reference/passkey-authentication.md)를 따른다.
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

## 설정

`/etc/dfragon/accounts.env`에는 다음 비밀이 아닌 선택을 둔다. API/OCR 환경 파일은 각각 유지한다.

```dotenv
DFRAGON_IMAGE_TAG=<reviewed-release-commit>
DFRAGON_SECRETS_DIR=/etc/dfragon/accounts-secrets
DFRAGON_ACCOUNTS_PORT=3200
DFRAGON_ACCOUNTS_DATABASE_VOLUME_NAME=dfragon_accounts_database
```

Checkout 밖의 root `0700` 디렉터리에 `postgres_password`, `dfragon_accounts_migrator_password`,
`dfragon_accounts_password`, `auth_config.json`을 준비한다. Password는 API DB와 다른 값이다.
Compose file secret의 컨테이너 UID 999/1000 접근을 위해 파일 `0444`, 부모 `0700`을 사용하며
Docker 관리자도 읽을 수 있다. Secret을 명령 인자·history·dump·Git·로그에 넣지 않는다.
`auth_config.json`의 `accessJwt`는 기존 issuer/audience/key set을 보존하고 `passkey`는 다음으로 설정한다.

```json
{
  "apiOrigin": "https://accounts.dfragon.com",
  "rpId": "accounts.dfragon.com",
  "rpName": "DFRAGON",
  "returnUrl": "dfragon://auth/callback",
  "ocrReturnUrl": "https://ocr.dfragon.com/auth/callback"
}
```

이 예제는 `passkey` 객체만 보여준다. `apiOrigin`은 accounts 인증 origin이다.
이전 설정의 `legacyOrigin` 항목은 새 process 시작 전에 제거해야 한다. Unknown field가 남으면 시작을 거절한다.
`AUTH_TRUST_PROXY=single-hop`은 Caddy 한 단계를 신뢰하며 직접 외부 port를 열지 않는다.

## 새 설치

Repository root에서 실행한다. 기존 운영 DB의 이전 경로 종료는 아래 순서를 별도로 따른다.

```sh
docker compose --env-file /etc/dfragon/accounts.env -f deploy/accounts/compose.yaml config --quiet
docker compose --env-file /etc/dfragon/accounts.env -f deploy/accounts/compose.yaml build accounts
docker compose --env-file /etc/dfragon/accounts.env -f deploy/accounts/compose.yaml up -d --wait accounts-database
docker compose --env-file /etc/dfragon/accounts.env -f deploy/accounts/compose.yaml --profile maintenance run --rm migrate
docker compose --env-file /etc/dfragon/accounts.env -f deploy/accounts/compose.yaml exec -T accounts-database psql -X -U postgres -d dfragon_accounts < deploy/accounts/grant-accounts.sql
```

빈 DB에는 전체 migration을 적용한다. 기존 DB에는 pending forward migration만 실행한다.
과거 `ReplaceOAuthWithPasskeys`나 데이터 복사를 운영 계정에 재실행하지 않는다.
Grant는 현재 검토한 파일을 stdin으로 전달한다. 실행 중인 DB container의 bind mount가 이전 release를
가리킬 수 있으므로 container 안의 오래된 grant 파일을 다시 실행하지 않는다.

## 이전 경로 종료 순서

1. 사용자 merge와 CI 성공을 확인한 release의 accounts image와 Desktop 배포물을 준비한다.
   계정·현재 키·session·refresh를 보존하는 accounts DB 백업과 복구 수단을 확인한다.
   백업은 기존 [인증 운영 보관 규칙](../../docs/architecture/auth-operations-proposal.md)을 따른다.
   암호화 사본과 복호화 키를 분리하고 승인된 최대 7일 이내 만료를 유지한다. 기존 사본의 기한을 연장하지 않는다.
2. Caddy의 accounts 인증을 점검 상태로 둔다. Cleanup timer를 멈추고 실행 중인 cleanup 종료를 기다린다.
   accounts와 OCR을 정상 중지하고 다른 인증 writer도 없음을 확인한다. 두 PostgreSQL은 유지한다.
   Domain API는 인증 table 접근 권한이 없는 상태여야 한다.
3. 운영자 연결로 **accounts의 모든 회원이 accounts RP 키를 하나 이상 보유**하는지 확인한다.
   Source 정리를 할 경우 **중지된 API DB의 모든 회원 UUID가 accounts에 있고 현재 RP 키를 보유**하는지도
   두 DB를 대조한다. 실제 UUID·키·session·refresh 내용은 출력·로그·문서에 남기지 않는다.
   하나라도 누락되면 전체 종료 절차를 중단하고 원인을 확인한다.
4. `auth_config.json`에서 `legacyOrigin`만 제거한다. 다른 JWT·passkey 설정은 보존한다.
   아래 SQL은 쓰기 잠금 아래 현재 RP 키 보유를 다시 확인한 뒤 **api.dfragon.com의 키만** 삭제한다.
   회원 UUID·accounts 키·session·refresh는 바꾸지 않는다. SQL 실패 시 전체 transaction이 rollback된다.

```sh
docker compose --env-file /etc/dfragon/accounts.env -f deploy/accounts/compose.yaml exec -T accounts-database psql -X -U postgres -d dfragon_accounts < deploy/accounts/retire-api-passkeys.sql
docker compose --env-file /etc/dfragon/accounts.env -f deploy/accounts/compose.yaml --profile maintenance run --rm migrate
docker compose --env-file /etc/dfragon/accounts.env -f deploy/accounts/compose.yaml exec -T accounts-database psql -X -U postgres -d dfragon_accounts < deploy/accounts/grant-accounts.sql
```

5. `RetirePasskeyHandoffs`가 임시 이전 table을 제거했는지 확인한다. 회원 UUID·현재 키·session·refresh가
   점검 직전과 같은지 대조한다. 로그인 중이던 transient 요청은 새로 시작한다.
6. [Caddy 예제](Caddyfile.example)처럼 API의 인증 proxy 예외를 제거하고 domain API로만 연결한다.
   accounts는 loopback accounts port로 연결한다. 기존 OCR block·업로드 제한과 `X-Forwarded-For`
   덮어쓰기는 유지한다. URL ticket·code를 남기는 access log를 켜지 않는다. Validate 후 reload한다.
7. 새 accounts image를 시작하고 `/me` 미인증 401, API `/health` 200·`/me` 404를 확인한다.
   `/auth/login/legacy`·`/auth/login/migrate`는 accounts와 API 양쪽에서 404여야 한다.
   현재 RP 로그인·예비 키 관리·휴대폰 QR·OCR 소유자 로그인을 확인한다.
   OCR은 `OCR_AUTH_ORIGIN=https://accounts.dfragon.com`과 같은 `OCR_OWNER_ID`를 유지한다.
8. Source 삭제는 3번 대조가 성공하고 accounts 보존·기동 확인까지 끝난 뒤에만 수행한다.
   아래 파일 자체는 **다른 DB의 이전 완료를 증명하지 않는다**. 대조를 생략한 단독 실행은 금지한다.

```sh
docker compose --env-file /etc/dfragon/api.env -f deploy/api/compose.yaml exec -T database psql -X -U postgres -d dfragon < deploy/accounts/retire-api-auth.sql
```

Source SQL은 DB 이름·이전 schema·runtime 권한 회수를 확인하고 인증 table 다섯 개만 제거한다.
`CASCADE`를 사용하지 않아 예상 밖 domain FK가 있으면 전체 transaction을 거절한다.
Domain data와 TypeORM migration history를 보존한다. API의 권한 갱신이 필요하면 현재 검토한
`deploy/api/grant-api.sql`을 stdin으로 전달한다.

9. Accounts 인증 쓰기를 다시 열기 전에 root-owned 배포 helper와 `state.json`의 실제 source·revision,
   `previous.json`의 복귀 기준을 현재 세 서비스와 맞춘다. `/opt/dfragon-accounts-current`와 cleanup
   systemd drop-in을 현재 release·accounts project·`/etc/dfragon/accounts.env`에 맞춘다.
   Cleanup 정상 실행 후 timer를 활성화하고 OCR·인증 점검을 해제한다.

## 복구와 검증 경계

Schema·설정·Caddy 변경은 Linux 자동배포가 처리하지 않는다. 호환성 검사가 거절한 배포를 강제로
우회하지 않고 위 명시적 전환 후 helper/state를 맞춘다. 삭제 후에는 이전 image만 실행하거나
오래된 API 인증 사본을 복원하는 방식으로 되돌리지 않는다. 새 schema와 단일 RP를 지원하는 image를
사용한다. Data 복원이 필요하면 accounts 쓰기를 멈추고 현재 데이터와 백업을 기준으로 별도 검토한다.
Migration down은 삭제된 이전 요청이나 패스키를 복원하지 않는다.

기기·패스키 제공자에 저장된 이전 주소의 키는 원격 삭제할 수 없다. 서버의 인증 경로·공개키 사본만 제거한다.
Desktop은 검색 origin과 별도 accounts origin을 사용하며 인증 창에서 다른 origin의 이동·요청을 거절한다.
기존 accounts용 설치본은 현재 RP 로그인에 사용할 수 있고 새 설치본에서는 이전 origin 허용도 제거된다.

검증 명령: `pnpm --filter @dfragon/accounts test`, `pnpm --filter @dfragon/accounts test:database`,
`bash apps/accounts/test-support/container-deployment.sh`, `python3 -m unittest discover -s deploy/linux/tests -v`.
운영 DB 정리·프록시 변경·실제 OS 패스키 제공자 확인은 별도 운영 실행이다.
