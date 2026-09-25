# GitHub Actions → Tailscale → Linux SSH 배포

`main` push의 **Code Quality 성공 후** [Deploy Linux](../../.github/workflows/deploy-linux.yml)가 실행됩니다. GitHub-hosted runner는 OIDC로 Tailscale에 잠시 연결하고, 별도 SSH 키로 `deploy <commit>`을 요청합니다. PR·fork 작업은 운영 SSH에 연결하지 않습니다. 공개 SSH 포트나 운영 서버의 self-hosted runner는 필요하지 않습니다.

서버는 고정 저장소의 현재 main과 해당 commit의 성공한 Code Quality push 실행을 다시 확인합니다. 실행 중인 API·OCR release와 빌드 입력을 각각 비교하고 바뀐 서비스만 빌드합니다. 공용 UI·lockfile 변경은 두 서비스에 영향을 줄 수 있습니다. 빌드를 모두 마친 뒤 `compose up --no-build --no-deps`로 API와 OCR만 교체하고 HTTP readiness를 확인합니다. API 교체 시 cleanup timer를 잠시 멈추고 실행 중인 cleanup 종료를 기다립니다.

API 이미지는 빌드 단계에서 기존 `pnpm --filter @dfragon/api test`를 통과해야 생성됩니다. 이 명령은 production build와 API 회귀 테스트를 포함하며 운영 DB 통합 테스트를 실행하지 않습니다. API 빌드 입력이 같으면 서버가 빌드 자체를 생략하므로 OCR만 변경했을 때 API 테스트를 반복하지 않습니다.

OCR 교체는 메모리 로그인 세션을 종료하므로 브라우저에서 다시 로그인해야 합니다. 업로드 중인 요청에는 잠시 실패가 발생할 수 있습니다. API·OCR 데이터 경로, 인증 설정·패스키, DB container·volume, Caddy 설정은 보존합니다. 일반적인 기동 실패에는 이전 이미지를 확인한 뒤 현재 데이터를 그대로 연결해 복귀합니다. DB snapshot을 자동 복원하지 않습니다.

## 처음 설치

Ubuntu 24.04, Python 3.12, Docker Compose, Git, OpenSSH와 연결된 Tailscale이 필요합니다. 기존 서비스가 `dfragon-api:<40자 SHA>`와 `dfragon-ocr:<40자 SHA>`로 실행되고 있어야 합니다. 기존 API의 `deploy/api/.env` 및 `/etc/dfragon/ocr.env`를 보존하며 API 환경 파일만 `/etc/dfragon/api.env`로 복사합니다.

검토한 checkout에서 **배포용으로 새로 만든 Ed25519 공개 키**로 설치합니다. 개인 관리용 SSH 키를 CI에 재사용하지 않습니다.

```sh
sudo python3 deploy/linux/install.py /path/to/deployment-key.pub
```

설치기는 root 소유 helper·SSH 제한을 만들고 `dfragon-deploy` 계정에는 그 helper의 sudo 실행만 허용합니다. 계정은 Docker 그룹에 들어가지 않으며 SSH 키에는 `restrict`와 강제 명령을 설정합니다. shell·SFTP·포트포워딩·임의 sudo를 제공하지 않습니다. API cleanup은 마지막 성공한 API source와 `/etc/dfragon/api.env`를 사용하도록 systemd drop-in을 설치합니다. 설치 자체는 앱 container를 재시작하지 않습니다.

이미 설치된 경로·계정이 있으면 덮어쓰지 않고 멈춥니다. 초기 설치가 중간에 실패해도 다시 무조건 실행하지 말고 남은 경로를 확인합니다. helper 코드 변경은 새 코드를 검토한 뒤 운영자가 root 소유 파일을 명시적으로 갱신합니다. 배포 요청이 helper나 sudo 권한을 자동 갱신하지 않습니다.

Tailscale은 연결 경로로만 사용하고 서버의 **Tailscale SSH는 끕니다**. 기존 OpenSSH가 강제 명령과 키 제한을 적용해야 하므로 설치기는 Tailscale SSH가 켜져 있으면 거절합니다. 기존 관리자는 자신의 SSH 키를 그대로 사용합니다.

## Tailscale 최소 권한

- `tag:dfragon-ci`의 소유자는 관리자만 지정합니다.
- 이 태그에서 운영 서버의 `tcp:22`만 허용합니다. API·OCR·DB port와 다른 장치에는 허용하지 않습니다.
- 전체 장치 간 허용 규칙의 `src: ["*"]`는 CI 태그에도 적용됩니다. 개인 장치 간 기존 연결을 유지하려면 사용자 장치를 가리키는 `autogroup:member`로 범위를 한정하고, 기존 tagged 장치가 있다면 필요한 규칙을 별도로 보존합니다.
- 정책 테스트에 서버 SSH 허용 및 다른 port·장치 거절을 넣습니다.

[공식 OIDC 안내](https://tailscale.com/docs/features/workload-identity-federation)를 따라 trust credential을 만듭니다.

| 설정                        | 값                                                                    |
| --------------------------- | --------------------------------------------------------------------- |
| Issuer                      | `https://token.actions.githubusercontent.com`                         |
| Subject                     | 아래에서 조회한 subject prefix + `:ref:refs/heads/main`               |
| Custom claim `workflow_ref` | `blahaj94/dfragon/.github/workflows/deploy-linux.yml@refs/heads/main` |
| Scope                       | `auth_keys` write, `tag:dfragon-ci`로 제한                            |
| Audience                    | Tailscale이 생성한 값                                                 |

Subject prefix는 `gh api repos/blahaj94/dfragon/actions/oidc/customization/sub --jq .sub_claim_prefix`로 조회합니다. GitHub의 [immutable subject](https://docs.github.com/en/actions/reference/security/oidc#immutable-subject-claims) 설정과 저장소 rename에 따라 owner·repository ID가 포함될 수 있으므로 저장소 이름만으로 추측하지 않습니다. Token 원문을 로그에 출력할 필요는 없습니다.

OIDC는 Tailscale 장기 client secret 없이 CI 임시 장치를 등록합니다. [공식 GitHub Action](https://tailscale.com/docs/integrations/github/github-action)은 job 종료 때 임시 장치를 정리합니다. SSH 배포 키는 별도로 보호해야 합니다.

GitHub repository Actions secrets:

| Secret                        | 값                                                                  |
| ----------------------------- | ------------------------------------------------------------------- |
| `DFRAGON_TAILSCALE_CLIENT_ID` | 위 OIDC client ID                                                   |
| `DFRAGON_TAILSCALE_AUDIENCE`  | 위 audience                                                         |
| `DFRAGON_DEPLOY_HOST`         | 운영 서버의 Tailscale 주소                                          |
| `DFRAGON_DEPLOY_SSH_KEY`      | 배포 전용 개인 키                                                   |
| `DFRAGON_DEPLOY_KNOWN_HOSTS`  | 확인된 host key를 `dfragon-production` 별칭에 연결한 known_hosts 행 |

Host key는 기존 신뢰한 관리자 SSH 연결에서 확인합니다. CI에서 무조건 `ssh-keyscan` 결과를 신뢰하거나 `StrictHostKeyChecking=no`를 사용하지 않습니다. 값은 로그·커밋·PR·문서에 붙여 넣지 않습니다.

## 실패·조회·재실행

서버의 `/var/lib/dfragon-deploy/state.json`은 서비스별 마지막 성공 source·revision을, `status.json`은 최근 요청의 단계·결과를 담습니다. `previous.json`에는 마지막 교체 직전 상태를 보관합니다. 비밀값이나 DB 내용은 넣지 않으며 파일은 root 전용입니다. 배포 키로 `status`만 요청하면 revision과 정제된 결과를 확인할 수 있습니다.

서버 실행은 `systemd-run`으로 분리하므로 Actions 취소나 SSH 단절만으로 배포 process를 종료하지 않습니다. GitHub concurrency와 서버 파일 잠금이 중복 배포를 막습니다. 완료를 확인하지 못한 SSH 실행을 성공으로 표시하지 말고 먼저 `status`를 확인합니다. main이 빌드 중 바뀌면 오래된 요청은 교체 전에 중단하고 최신 main의 CI 성공을 기다립니다. 재시도는 해당 main의 성공한 Code Quality에서 시작된 Deploy Linux job을 다시 실행합니다.

다음 변경은 자동 배포하지 않습니다.

- API의 database 코드·migration·grant·DB 초기화·이름 이전 SQL
- OCR의 SQLite store 구현
- Compose 구성과 API cleanup unit

이 경우 `verify-compatibility`에서 멈춥니다. 운영자가 데이터 영향과 새 구성을 검토하고 해당 서비스의 명시적 migration·배포·검증을 마친 뒤 기준 상태를 실제 실행 버전으로 갱신해야 합니다. 임의로 비교만 통과시키거나 새 빈 volume을 기존 데이터 대신 사용하지 않습니다.

프로세스 강제 종료·호스트 장애까지 자동 복구한다고 보장하지 않습니다. 상태와 실제 container가 다르면 자동 재시도는 거절하며 운영자가 환경 파일·실행 이미지·cleanup 경로를 확인해야 합니다. 이전 image·release는 자동 삭제하지 않습니다. 디스크 여유가 5 GiB보다 작으면 빌드를 시작하지 않습니다.

## 수동 롤백과 데이터 백업

일반 배포는 schema와 container 구성이 같을 때만 실행하므로 이전 service image로 복귀할 수 있습니다. root가 `previous.json`의 source·revision을 확인하고 해당 서비스의 `/etc/dfragon/<service>.env`에서 `DFRAGON_IMAGE_TAG`만 바꾼 뒤, 그 source의 Compose로 해당 서비스만 `up -d --no-build --no-deps <service>` 합니다. API 복귀 시 `/opt/dfragon-api-current`도 이전 API source로 맞추고 readiness 성공 후 `state.json`을 실제 상태와 일치시킵니다. 서로 다른 서비스의 환경 파일을 섞지 않습니다.

이 기능은 백업·DB 복원 기능을 새로 제공하지 않습니다. OCR 백업·복원은 [OCR 배포 안내](../ocr/README.md#저장종료백업), API의 데이터·migration·롤백 제한은 [API 배포 안내](../api/README.md#업데이트와-종료)를 따릅니다. 현재 DB를 유지하며 오래된 인증 DB snapshot을 공개하지 않습니다.

## 관련 검증

```sh
python3 -m unittest discover -s deploy/linux/tests -v
sh -n deploy/linux/ssh-command.sh
```

비밀 설정 보존, 변경 서비스 판정, CI 없는 요청 거절, schema·Compose 변경 차단, readiness 실패 시 해당 service만 복귀하는 경계를 검증합니다. 실제 Tailscale OIDC·SSH·systemd·운영 교체 성공은 별도의 배포 실행으로 확인합니다.
