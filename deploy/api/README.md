# 단일 Ubuntu 서버의 API 배포

Docker Engine과 Compose로 API·PostgreSQL을 실행하고, 호스트의 Caddy가 HTTPS를 처리한다.
현재 대상은 Ubuntu 24.04의 `linux/amd64`다. Node 24와 PostgreSQL 18의 image digest를
고정하고 기존 pnpm lockfile·compiled ESM build·명시 Migration·cleanup을 사용한다.

## 연결과 권한

- Caddy → `127.0.0.1:3000` → API. 공유기에는 Caddy의 TCP 80·443만 DFRAGON용으로 전달한다.
- DB에는 공개 port가 없고 외부 통신이 없는 Compose network에서 API·유지보수 작업만 연결한다.
- API는 UID/GID 1000, 읽기 전용 root filesystem, 추가 Linux 권한 없음으로 실행한다.
  Docker socket이나 호스트의 개인 디렉터리를 mount하지 않는다.
- DB도 `postgres` 사용자로 실행한다. API의 `dfragon_api` 계정에는 인증·캐릭터 테이블의 DML만
  부여한다. `dfragon_migrator`가 schema를 소유하며 API는 Migration history에도 접근하지 못한다.
- 데이터베이스는 `dfragon`, 역할은 `dfragon_api`·`dfragon_migrator`, 기본 named volume은
  `dfragon_database`다. 이전 이름으로 설치한 서버는 아래의 명시적 이전을 마친 뒤 시작한다.
  설정 이름만 바꿔 새 빈 DB를 운영 데이터로 사용하지 않는다.
- CPU·메모리·process·log 크기를 제한하고 DB 데이터는 named volume에 보관한다.
  볼륨은 백업이 아니다. 백업 공개 복원은 제공하지 않는다.
- API는 Neople에 접속할 outbound network를 사용한다. 이 설정은 **집 LAN으로의
  outbound 접근을 차단하거나 회선 DDoS를 방어하지 않는다**. 컨테이너는 host kernel을 공유한다.

Docker의 공개 port가 UFW를 우회할 수 있으므로 API의 loopback bind를 유지한다.
Host Docker 관리 권한은 사실상 root 권한이므로 컨테이너나 외부 네트워크에 제공하지 않는다.
[Docker networking](https://docs.docker.com/engine/network/packet-filtering-firewalls/#docker-and-ufw)

## 서버 입력

아래 예시의 checkout 위치는 `/opt/dfragon`다. 운영자는 사용할 release commit을 checkout한다.
기존 checkout·DB·secret을 덮어쓰거나 개발 DB를 운영으로 복원하지 않는다.

`deploy/api/.env`에는 비밀값 없이 다음 선택만 기록한다. 이 파일은 Git에서 제외한다.

```dotenv
DFRAGON_IMAGE_TAG=<release-commit>
DFRAGON_SECRETS_DIR=/etc/dfragon/secrets
DFRAGON_API_PORT=3000
```

`DFRAGON_SECRETS_DIR`는 checkout 밖의 절대 경로다. 호스트에서는 root 소유 디렉터리를 `0700`으로
보호하고, 아래 파일은 `0444`로 준비한다. Compose의 file secret은 bind mount이므로 YAML의
`uid/gid/mode`에 의존하지 않는다. 이 조합은 호스트의 일반 사용자에게 디렉터리 접근을 막으면서
선택된 컨테이너의 UID 999/1000이 각자 mount된 파일을 읽게 한다. Docker 관리자도 secret을 읽을 수 있다.
기존 설치는 아래 이전 절차에서 비밀값을 바꾸지 않고 새 파일 이름·경로로 옮긴다.

| 파일                    | 내용과 소비자                                                                           |
| ----------------------- | --------------------------------------------------------------------------------------- |
| `postgres_password`     | DB 관리자용으로 생성한 독립 password. DB에만 mount                                      |
| `dfragon_migrator_password` | Migration용으로 생성한 독립 password. DB 초기화와 migrate에만 mount                     |
| `dfragon_api_password`      | API용으로 생성한 독립 password. DB 초기화·API·cleanup에 mount                           |
| `neople_api_key`        | 실제 Neople API key. API에만 mount                                                      |
| `auth_config.json`      | 기존 [인증 JSON 계약](../../docs/rules/auth-runtime.md)에 맞는 서버 설정. API에만 mount |

Password/key 파일은 한 줄이며 끝의 줄바꿈은 entrypoint에서 제거한다. 비밀값을 명령 인자·
shell history·로그에 적지 않는다. API entrypoint는 secret을 기존 `DB_PASSWORD`,
`NEOPLE_API_KEY` 입력으로 전달하고, 인증 파일은 `AUTH_CONFIG_FILE`로 읽는다.
이미지에는 source/test·서버 설정·비밀값이 포함되지 않는다.

인증 JSON의 `passkey.apiOrigin`은 공개 HTTPS API origin, `rpId`는 그 hostname,
`returnUrl`은 배포 앱의 `dfragon://auth/callback`이다. JWT key 교체 계약을 유지하고,
[패스키 설정](../../docs/reference/passkey-authentication.md)에 따라 도메인을 확정한다.
`LOCAL_HTTPS_*`는 설정하지 않는다. 사용자의 로그인은 직접 검색·캡처·OCR의 선행 조건이 아니다.

## 기존 설치의 DB·역할·볼륨 이전

이 절차는 기존 운영 이름을 DFRAGON으로 이전하는 명시적 관리 작업이다. 일반 API 시작이나
TypeORM app migration에 포함하지 않는다. 기존 schema·계정·패스키·세션·캐릭터 데이터는 유지한다.

1. 현재 release·image·Compose project·실제 DB volume·secret 경로를 확인하고 새 이미지를 먼저 빌드한다.
   `/opt/dfragon`과 `/etc/dfragon/secrets`를 준비한다. 기존 API·migration 비밀번호는 값 변경 없이
   `dfragon_api_password`·`dfragon_migrator_password` 파일로 옮긴다. RP ID·apiOrigin·JWT key도 유지한다.
   Desktop 복귀 주소는 `dfragon://auth/callback`으로 전환한다.
2. 공개 API ingress와 이전 cleanup timer를 중지한다. 실행 중인 cleanup 완료를 기다리고 이전 API·DB를
   정상 중지한다. 이전 writer가 남거나 비표준 tablespace가 있으면 자동 이전하지 않는다.
3. 새 `dfragon_database` volume을 만들고, 중지한 원본 volume을 읽기 전용으로 mount해 PostgreSQL
   cluster 전체를 복사한다. 같은 고정 PostgreSQL 18 image·PGDATA 경로·숫자 UID/GID·권한을 유지하고
   복사 내용과 원본의 일치를 확인한다. 빈 새 volume에서 init script를 실행해 데이터를 새로 만들지 않는다.
4. 새 volume만 연결한 격리 PostgreSQL을 외부 network·공개 port 없이 실행한다. `postgres` DB에
   관리자로 연결해 [migrate-legacy.sql](migrate-legacy.sql)을 한 번 실행한다. 이 SQL은 DB·필수 역할과
   존재하는 읽기 전용 viewer 역할의 이름을 transaction으로 바꾸며 역할 OID·소유권·ACL을 보존한다.
   새 이름 충돌·접속 중인 원본 DB·알 수 없는 이전 역할·MD5/null login password는 거절한다.
   SCRAM 비밀번호는 재발급하지 않는다. [PostgreSQL ALTER ROLE](https://www.postgresql.org/docs/18/sql-alterrole.html)
5. 격리 DB를 정상 종료하고 새 Compose로 DB·API를 시작한다. 데이터·권한·기존 계정과 패스키,
   실제 password 연결을 확인한 뒤에만 HTTPS를 다시 연다. 운영 `.env`는 `DFRAGON_*` 이름을 쓰며
   `DFRAGON_DATABASE_VOLUME_NAME`을 지정한다면 이전이 완료된 새 volume을 가리켜야 한다.
6. 이전 Compose container·network와 이전 timer를 정리한다. 원본 volume은 이전 검증이 끝날 때까지
   유지하고, 전환 후에는 오래된 인증 snapshot으로 보관·재공개하지 않는다. 새 데이터에 쓰기가 시작되면
   이전 사본을 사용한 자동 복귀는 금지한다. 이전용 임시 사본은 소유권을 확인하고 정리한다.

이전 작업 자체는 app schema migration을 추가하지 않는다. 이름 변경 후 DBeaver 등 관리 클라이언트는
새 DB 이름 `dfragon`과 해당 역할 이름으로 연결해야 한다. 비밀번호를 표시하거나 일괄 재설정하지 않는다.
새 cleanup timer를 활성화하기 전에 이전 timer가 비활성인지 확인한다.

## 처음 실행

이미지 build 단계는 API와 공용 UI의 workspace manifest를 먼저 복사해 의존성을 설치한다.
인증 browser bundle에는 `packages/ui/src/typo.tsx`와 `foundation.css`를 사용하며,
Dockerfile의 복사 목록과 `Dockerfile.dockerignore`의 허용 목록을 함께 유지한다.
UI의 개발 의존성인 licenses package는 workspace 해석을 위해 manifest만 포함한다.
최종 runtime 단계에는 기존처럼 API 산출물과 production 의존성만 복사한다.

아래 명령은 서버에서 Docker를 관리할 수 있는 운영자가 `deploy/api`에서 실행한다.
빈 DB volume에서만 cluster와 두 역할을 초기화한다. App table은 init script가 만들지 않는다.

```sh
docker compose config --quiet
docker compose build api
docker compose up -d --wait --wait-timeout 120 database
docker compose --profile maintenance run --rm migrate
docker compose exec -T database psql --no-psqlrc -U postgres -d dfragon -f /opt/dfragon/grant-api.sql
docker compose up -d api
```

DB healthcheck는 Migration 계정의 실제 TCP/password 연결로 `SELECT 1`을 실행한다.
Migration은 기존 CLI의 단일 명시 실행이며 API 시작이나 재시작이 schema를 바꾸지 않는다.
Migration 다음에 권한 부여가 성공해야 API를 시작한다. 기존 설치에서도 새 테이블 migration 후 `grant-api.sql`을 다시 실행한다. 이 파일은 캐릭터 테이블의 DML과 아이템·스킬·세트 캐시의 SELECT·INSERT·UPDATE 권한을 포함한다. 초기화 실패나 기존 volume에 대해
secret 파일만 바꿔 재실행하면 역할/password가 재설정된다고 가정하지 않는다.
운영 password 변경은 DB의 `\password`와 해당 secret 교체·소비자 재시작을 함께 진행한다.

API의 로컬 HTTP 응답을 확인한 뒤 Caddy의 해당 site를 다음처럼 연결한다.
실제 도메인을 사용하고 다른 site 설정은 보존한다.

```caddyfile
api.example.com {
    reverse_proxy 127.0.0.1:3000 {
        header_up X-Forwarded-For {remote_host}
    }
}
```

Compose의 `SEARCH_TRUST_PROXY=single-hop`은 Express가 Caddy가 전달한 가장 오른쪽
`X-Forwarded-For` 주소로 사용자별 검색 한도를 구분하게 한다. Caddy는 이 헤더를 실제 연결한
클라이언트 주소로 덮어쓴다. 기본 API 실행은 이 설정 없이 직접 peer IP를 사용하며 전달 헤더를 무시한다.

이 모드는 **외부 요청이 호스트 Caddy 한 곳만 거치는 현재 배포**에 한정한다. Hop 수는 Caddy의
신원을 인증하지 않는다. 호스트나 같은 Docker network에서 API로 직접 접근할 수 있는 관리 주체는
신뢰 범위에 포함된다. API port를 외부에 공개하거나 다른 프록시·우회 경로를 추가할 때 이 설정을
그대로 사용하지 않는다. 같은 외부 NAT 주소의 사용자는 여전히 한도를 공유한다.
[Express proxy 설정](https://expressjs.com/en/guide/behind-proxies/),
[Caddy 전달 헤더](https://caddyserver.com/docs/caddyfile/directives/reverse_proxy#defaults)

`caddy validate` 성공 후 reload한다. Caddy access log는 켜지 않으며, 인증·검색 입력을
별도 proxy/APM log에 기록하지 않는다. `/`의 고정 404는 listener 확인일 뿐 검색 성공이 아니다.
공개 HTTPS API를 연결한 Windows 설치 앱의 비로그인 검색·게임 캡처·OCR·결과는 별도로 확인한다.

기존 [인증 데이터 정리](../../docs/reference/auth-cleanup-development.md)를 하루 한 번 실행한다.
먼저 수동 cleanup 성공을 확인한 뒤, 실제 checkout 위치에 맞는 service/timer를 설치한다.

```sh
docker compose --profile maintenance run --rm cleanup
sudo install -m 644 dfragon-auth-cleanup.service dfragon-auth-cleanup.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now dfragon-auth-cleanup.timer
```

실패는 service 상태로 확인하고 원인을 해결한 뒤 기존 cleanup을 다시 실행한다. Timer 설치만으로
실제 정리 성공이나 백업·물리 삭제·복원을 검증했다고 표시하지 않는다.

## 업데이트와 종료

새 release를 checkout하고 `DFRAGON_IMAGE_TAG`를 새 commit으로 바꿔 build한다. Schema 변경이 있다면
해당 Migration의 데이터 영향·호환성을 먼저 확인하고 위 명시 Migration과 권한 부여를 실행한다.
`docker compose up -d api`가 API를 교체한다. Secret 변경도 재시작 후 반영된다.

이름 변경 전 API image로 되돌릴 때도 현재 DFRAGON DB를 유지한다. 해당 image가 환경변수의
새 DB·역할과 같은 schema를 지원하는지 확인하고, 현재 Compose에 이전 API image를 지정한다.
인증 설정은 그 image와 설치 앱이 지원하는 복귀 주소로 맞춘다. OCR callback을 지원하지 않는 이전
API로 복귀한다면 OCR을 중지하고 해당 proxy route를 제거한다. 이미 쓰기가 시작된 운영 DB를 이전
volume 사본으로 교체하지 않는다. DB 자체를 이전 이름으로 되돌리는 작업은 현재 데이터를 대상으로
별도 유지보수 절차가 필요하며 자동 snapshot 복원을 제공하지 않는다.

`docker compose stop`은 데이터를 유지하며 종료한다. `docker compose down`도 named volume을
남긴다. **운영에서 `down --volumes`, 임의 volume 삭제, global prune을 실행하지 않는다.** 위 명시적
이전에서 대체 데이터 검증이 완료된 원본 volume만 소유권을 확인해 정리한다. 이전 API
image로 되돌리는 것은 새 schema와 호환될 때만 가능하고 자동 DB rollback은 제공하지 않는다.

## 배포 설정 검증

```sh
bash apps/api/test-support/container-deployment.sh
```

Repository root 기준이다. Docker·Bash·Python 3가 필요하다. 기존 runtime fixture를 재사용하며
실제 credential을 사용하지 않는다. 매번 고유 Compose project와 임시 secret·DB volume을 만들고
명시 Migration·DML/DDL 경계·읽기 전용 API·HTTP·cleanup·종료·DB 재생성 후 데이터 유지를 확인한다.
이전 이름을 가진 DB·역할에서 관리 SQL을 실행해 OID·SCRAM password·데이터·소유권·제한된 ACL
보존과 중복 실행 거절도 확인한다. 초기화 shell script는 실행 권한을 명시해 mount 환경에 따른
source/exec 판정 차이를 피한다.
종료 시 이 실행의 container/network/volume과 임시 secret만 정리한다. 생성한 image는 build 재사용을
위해 남는다. 강제 host 종료 뒤의 정리는 보장하지 않는다. 이 검증은 실제 provider·Windows 게임
흐름이나 집 LAN 격리 검증을 대신하지 않는다.
