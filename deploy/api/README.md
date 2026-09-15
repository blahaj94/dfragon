# 단일 Ubuntu 서버의 API 배포

Docker Engine과 Compose로 API·PostgreSQL을 실행하고, 호스트의 Caddy가 HTTPS를 처리한다.
현재 대상은 Ubuntu 24.04의 `linux/amd64`다. Node 24와 PostgreSQL 18의 image digest를
고정하고 기존 pnpm lockfile·compiled ESM build·명시 Migration·cleanup을 사용한다.

## 연결과 권한

- Caddy → `127.0.0.1:3000` → API. 공유기에는 Caddy의 TCP 80·443만 LDB용으로 전달한다.
- DB에는 공개 port가 없고 외부 통신이 없는 Compose network에서 API·유지보수 작업만 연결한다.
- API는 UID/GID 1000, 읽기 전용 root filesystem, 추가 Linux 권한 없음으로 실행한다.
  Docker socket이나 호스트의 개인 디렉터리를 mount하지 않는다.
- DB도 `postgres` 사용자로 실행한다. API의 `ldb_api` 계정에는 네 인증 테이블의 DML만
  부여한다. `ldb_migrator`가 schema를 소유하며 API는 Migration history에도 접근하지 못한다.
- CPU·메모리·process·log 크기를 제한하고 DB 데이터는 named volume에 보관한다.
  볼륨은 백업이 아니다. 백업 공개 복원은 제공하지 않는다.
- API는 Google·Neople에 접속할 outbound network를 사용한다. 이 설정은 **집 LAN으로의
  outbound 접근을 차단하거나 회선 DDoS를 방어하지 않는다**. 컨테이너는 host kernel을 공유한다.

Docker의 공개 port가 UFW를 우회할 수 있으므로 API의 loopback bind를 유지한다.
Host Docker 관리 권한은 사실상 root 권한이므로 컨테이너나 외부 네트워크에 제공하지 않는다.
[Docker networking](https://docs.docker.com/engine/network/packet-filtering-firewalls/#docker-and-ufw)

## 서버 입력

아래 예시의 checkout 위치는 `/opt/ldb`다. 운영자는 사용할 release commit을 checkout한다.
기존 checkout·DB·secret을 덮어쓰거나 개발 DB를 운영으로 복원하지 않는다.

`deploy/api/.env`에는 비밀값 없이 다음 선택만 기록한다. 이 파일은 Git에서 제외한다.

```dotenv
LDB_IMAGE_TAG=<release-commit>
LDB_SECRETS_DIR=/etc/ldb/secrets
LDB_API_PORT=3000
```

`LDB_SECRETS_DIR`는 checkout 밖의 절대 경로다. 호스트에서는 root 소유 디렉터리를 `0700`으로
보호하고, 아래 파일은 `0444`로 준비한다. Compose의 file secret은 bind mount이므로 YAML의
`uid/gid/mode`에 의존하지 않는다. 이 조합은 호스트의 일반 사용자에게 디렉터리 접근을 막으면서
선택된 컨테이너의 UID 999/1000이 각자 mount된 파일을 읽게 한다. Docker 관리자도 secret을 읽을 수 있다.

| 파일                    | 내용과 소비자                                                                           |
| ----------------------- | --------------------------------------------------------------------------------------- |
| `postgres_password`     | DB 관리자용으로 생성한 독립 password. DB에만 mount                                      |
| `ldb_migrator_password` | Migration용으로 생성한 독립 password. DB 초기화와 migrate에만 mount                     |
| `ldb_api_password`      | API용으로 생성한 독립 password. DB 초기화·API·cleanup에 mount                           |
| `neople_api_key`        | 실제 Neople API key. API에만 mount                                                      |
| `auth_config.json`      | 기존 [인증 JSON 계약](../../docs/rules/auth-runtime.md)에 맞는 서버 설정. API에만 mount |

Password/key 파일은 한 줄이며 끝의 줄바꿈은 entrypoint에서 제거한다. 비밀값을 명령 인자·
shell history·로그에 적지 않는다. API entrypoint는 secret을 기존 `DB_PASSWORD`,
`NEOPLE_API_KEY` 입력으로 전달하고, 인증 파일은 `AUTH_CONFIG_FILE`로 읽는다.
이미지에는 source/test·서버 설정·비밀값이 포함되지 않는다.

인증 JSON의 `registry.apiOrigin`은 공개 HTTPS API origin, Google callback은 같은 origin의
`/auth/callback/google`, Desktop return target은 배포 앱의 `ldb://auth/callback`이다.
실제 Google 등록과 credential을 준비하고 기존 snapshot·key 교체 계약을 유지한다.
`LOCAL_HTTPS_*`는 설정하지 않는다. 사용자의 로그인은 직접 검색·캡처·OCR의 선행 조건이 아니다.

## 처음 실행

아래 명령은 서버에서 Docker를 관리할 수 있는 운영자가 `deploy/api`에서 실행한다.
빈 DB volume에서만 cluster와 두 역할을 초기화한다. App table은 init script가 만들지 않는다.

```sh
docker compose config --quiet
docker compose build api
docker compose up -d --wait --wait-timeout 120 database
docker compose --profile maintenance run --rm migrate
docker compose exec -T database psql --no-psqlrc -U postgres -d ldb -f /opt/ldb/grant-api.sql
docker compose up -d api
```

DB healthcheck는 Migration 계정의 실제 TCP/password 연결로 `SELECT 1`을 실행한다.
Migration은 기존 CLI의 단일 명시 실행이며 API 시작이나 재시작이 schema를 바꾸지 않는다.
Migration 다음에 권한 부여가 성공해야 API를 시작한다. 초기화 실패나 기존 volume에 대해
secret 파일만 바꿔 재실행하면 역할/password가 재설정된다고 가정하지 않는다.
운영 password 변경은 DB의 `\password`와 해당 secret 교체·소비자 재시작을 함께 진행한다.

API의 로컬 HTTP 응답을 확인한 뒤 Caddy의 해당 site를 다음처럼 연결한다.
실제 도메인을 사용하고 다른 site 설정은 보존한다.

```caddyfile
api.example.com {
    reverse_proxy 127.0.0.1:3000
}
```

`caddy validate` 성공 후 reload한다. Caddy access log는 켜지 않으며, 인증·검색 입력을
별도 proxy/APM log에 기록하지 않는다. `/`의 고정 404는 listener 확인일 뿐 검색 성공이 아니다.
공개 HTTPS API를 연결한 Windows 설치 앱의 비로그인 검색·게임 캡처·OCR·결과는 별도로 확인한다.

기존 [인증 데이터 정리](../../docs/reference/auth-cleanup-development.md)를 하루 한 번 실행한다.
먼저 수동 cleanup 성공을 확인한 뒤, 실제 checkout 위치에 맞는 service/timer를 설치한다.

```sh
docker compose --profile maintenance run --rm cleanup
sudo install -m 644 ldb-auth-cleanup.service ldb-auth-cleanup.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now ldb-auth-cleanup.timer
```

실패는 service 상태로 확인하고 원인을 해결한 뒤 기존 cleanup을 다시 실행한다. Timer 설치만으로
실제 정리 성공이나 백업·물리 삭제·복원을 검증했다고 표시하지 않는다.

## 업데이트와 종료

새 release를 checkout하고 `LDB_IMAGE_TAG`를 새 commit으로 바꿔 build한다. Schema 변경이 있다면
해당 Migration의 데이터 영향·호환성을 먼저 확인하고 위 명시 Migration과 권한 부여를 실행한다.
`docker compose up -d api`가 API를 교체한다. Secret 변경도 재시작 후 반영된다.

`docker compose stop`은 데이터를 유지하며 종료한다. `docker compose down`도 named volume을
남긴다. **운영에서 `down --volumes`, volume 삭제, global prune을 실행하지 않는다.** 이전 API
image로 되돌리는 것은 새 schema와 호환될 때만 가능하고 자동 DB rollback은 제공하지 않는다.

## 배포 설정 검증

```sh
bash apps/api/test-support/container-deployment.sh
```

Repository root 기준이다. Docker·Bash·Python 3가 필요하다. 기존 runtime fixture를 재사용하며
실제 credential을 사용하지 않는다. 매번 고유 Compose project와 임시 secret·DB volume을 만들고
명시 Migration·DML/DDL 경계·읽기 전용 API·HTTP·cleanup·종료·DB 재생성 후 데이터 유지를 확인한다.
종료 시 이 실행의 container/network/volume과 임시 secret만 정리한다. 생성한 image는 build 재사용을
위해 남는다. 강제 host 종료 뒤의 정리는 보장하지 않는다. 이 검증은 실제 provider·Windows 게임
흐름이나 집 LAN 격리 검증을 대신하지 않는다.
