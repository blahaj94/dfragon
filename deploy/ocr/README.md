# OCR 서버 배포

원본 PNG·메타데이터는 별도 Linux 서버의 `/data/ocr.sqlite`에 보관합니다. DFRAGON accounts의 계정·패스키를 재사용하며 OCR 서버에 인증 DB나 서명 키를 복제하지 않습니다. 운영 배포·DNS 변경·실제 계정 선택은 별도 실행 단계입니다.

초기 배포 후 main의 CI 성공을 자동 반영하는 구성은 [Linux 자동배포](../linux/README.md)를 따릅니다.

## accounts 인증 연결

accounts를 배포하고 `AUTH_CONFIG_FILE`의 `passkey` 객체에 아래 **공개 설정 한 항목**을 추가합니다. 기존 RP ID·apiOrigin·앱 returnUrl·키는 유지합니다.

```json
"ocrReturnUrl": "https://ocr.dfragon.com/auth/callback"
```

설정을 읽기 위해 accounts를 재시작합니다. 새 DB migration은 없습니다. 등록된 기존 패스키로 인증하며 `ocr` 요청만 위 고정 HTTPS 주소로 돌아옵니다. 설정이 없으면 OCR 로그인은 거절하고 기존 Desktop 로그인은 유지합니다.

`OCR_OWNER_ID`에는 관리할 **기존 계정 UUID**를 지정합니다. 닉네임이 아니며, 첫 로그인 사용자를 자동 관리자로 삼지 않습니다. 이 값은 기존 계정 조회 결과에서 운영자가 확인하여 배포 환경에만 넣습니다. 공개 문서·PR·로그에 실제 값을 기록하지 않습니다.

## OCR 실행

서버에 기존 Docker Compose를 사용합니다. 체크아웃 밖에 실제 배포 값의 환경 파일을 만들고 소유자만 읽을 수 있게 합니다. 다음 환경을 설정합니다.

| 값 | 용도 |
| --- | --- |
| `DFRAGON_IMAGE_TAG` | 빌드한 commit/release 태그 |
| `OCR_ORIGIN` | `https://ocr.dfragon.com` |
| `OCR_AUTH_ORIGIN` | `https://accounts.dfragon.com` |
| `OCR_OWNER_ID` | 허용할 기존 계정 UUID |
| `OCR_DATA_DIRECTORY` | 체크아웃 밖의 절대 영속 디렉터리 |
| `OCR_MAX_BYTES` | 원본 PNG와 모델 파일의 합계 상한. 기본 1 GiB |
| `OCR_PORT` | loopback 포트. 기본 3100 |

영속 디렉터리를 먼저 만들고 컨테이너 UID/GID `1000:1000`이 쓸 수 있게 권한을 부여합니다. 다른 앱 데이터 경로를 사용하지 않습니다.

```sh
docker compose --env-file /path/to/ocr.env -f deploy/ocr/compose.yaml build
docker compose --env-file /path/to/ocr.env -f deploy/ocr/compose.yaml up -d
```

DNS가 서버를 가리키도록 설정한 뒤 기존 HTTPS reverse proxy에 [Caddy 예시](Caddyfile.example)를 추가합니다. 이미지/API에 캐시를 적용하지 않으며 callback URL이나 쿠키가 남는 access logging을 켜지 않습니다. 공개 포트는 HTTPS proxy가 소유하고 OCR 포트는 loopback에만 바인딩합니다. `OCR_ORIGIN`과 callback origin은 정확히 일치해야 합니다.

## 저장·종료·백업

원본은 캡처 ID당 한 번만 저장하고 크롭 PNG는 좌표에서 요청 시 생성합니다. SQLite transaction이 원본과 모든 샘플 메타데이터를 함께 commit합니다. 같은 ID·같은 내용의 재전송은 기존 결과를 반환합니다. 다른 내용이면 409입니다. 이미지 데이터와 정답에 실제 데이터를 사용하므로 SQLite 파일도 공개하지 않습니다.

용량 상한은 **원본 PNG와 모델 파일 bytes 합계**이며 DB 메타데이터·journal·다운로드 bytes를 포함하지 않습니다. 디스크에는 추가 여유 공간이 필요합니다. 상한 초과는 507, 제외는 공간 회수가 아닌 학습 제외 표시입니다. 자동 삭제·보존 기한·물리 삭제 API는 없습니다.

## 자동 분할 테이블 전환

[PR #546](https://github.com/blahaj94/dfragon/pull/546)은 `label_unassigned`, `settings` 테이블을 추가합니다. Linux 자동 배포는 SQLite store 변경을 `verify-compatibility`에서 차단하므로 이 변경에는 한 번의 명시적인 운영 전환이 필요합니다. 앱 시작이나 이 전환으로 기존 자료를 배정하거나 자동 추가 규칙을 활성화하지 않습니다. 최초 분할은 관리 화면의 미리보기·명시 적용으로 시작합니다.

사용자 merge와 현재 main의 Code Quality 성공 후, 검토한 checkout의 [`upgrade_ocr_splits.py`](../linux/upgrade_ocr_splits.py)를 운영자가 실행합니다. 기존 자동 배포 helper·SSH 키·sudo 권한은 바꾸지 않습니다. 이 도구는 검토한 변경 전후 `store.ts`의 SHA-256과 동일한 Compose 구성을 확인하며 다른 저장소 변경을 허용하는 우회 옵션은 없습니다. 이미 전환됐거나 이후 store가 바뀌었다면 다시 실행하지 말고 상태를 확인합니다.

```sh
# 현재 main의 성공한 Code Quality에 대응하는 전체 SHA로 바꿉니다.
release_commit=MERGED_MAIN_COMMIT_40_HEX
sudo systemd-run --unit=dfragon-ocr-splits --wait --collect \
  --property=RuntimeMaxSec=35min --property=TimeoutStopSec=120s \
  /usr/bin/python3 -I /path/to/reviewed-checkout/deploy/linux/upgrade_ocr_splits.py "$release_commit"
sudo /usr/local/sbin/dfragon-deploy status
```

실행은 자동 배포와 같은 서버 잠금을 사용합니다. 현재 main·성공한 CI·기록된 이미지와 환경 설정을 확인하고 OCR 이미지만 미리 빌드합니다. 기존 `/data` bind mount와 배포 설정의 경로가 같은지 확인하며 없는 SQLite 파일을 새로 만들지 않습니다. OCR을 정상 중지한 후 `/var/lib/dfragon-deploy/backups/ocr-splits-*/ocr.sqlite`에 root 전용 백업을 남깁니다. 빌드 공간에 5 GiB, 백업 공간에 DB 크기와 추가 5 GiB가 필요합니다.

HTTP를 열지 않는 임시 컨테이너에서 새 이미지의 실제 `OcrStore` 생성자로 두 테이블을 추가합니다. 원래 테이블·인덱스 정의와 모든 행의 해시, SQLite 무결성·외래 키, 추가 테이블의 구조와 빈 상태를 검증합니다. 이후 OCR을 시작해 readiness와 실행 이미지까지 확인한 뒤에만 `state.json`의 OCR 기준을 갱신합니다. API·accounts 기준과 환경 설정·DB·이미지는 유지합니다. 로그인 세션은 재시작으로 종료되므로 다시 로그인합니다.

성공 상태와 OCR revision을 확인한 뒤 **현재 main**의 Deploy Linux 실행을 재시도하면 나머지 변경 서비스의 일반 배포가 진행됩니다. 과거 commit의 실패한 실행을 재시도하지 않습니다. 이 PR의 merge만으로 운영 전환이 실행되거나 기존 Actions 실패가 해소되지는 않습니다.

백업 단계 실패 또는 검증 완료 뒤 기동 실패에는 이전 OCR 이미지로 복귀를 시도하고 현재 DB를 유지합니다. 테이블 초기화·기존 데이터 보존 검사 실패에는 OCR을 중지한 상태로 두며, `restored: false`를 기록합니다. 운영자가 임시 컨테이너의 종료·실행 상태와 보호된 백업을 확인하기 전에는 재시도하거나 DB를 덮어쓰지 않습니다. 백업 자동 복원·삭제는 하지 않으며, 프로세스 강제 종료나 호스트 장애의 자동 복구까지 보장하지 않습니다. 기존 [저장·종료·백업](#저장종료백업)과 Linux의 [실패·조회·재실행](../linux/README.md#실패조회재실행) 절차를 함께 따릅니다.

## 모델 보관 기능 배포

시작 시 같은 OCR SQLite에 `models`, `model_files` 테이블을 추가합니다. 기존 원본·정답·분할을 변경하지 않습니다. 배포 전 정상 중지와 SQLite 백업을 수행하고, 모델 파일도 같은 백업에 포함합니다. 인증 API의 DB 변경이나 GPU 설치는 필요하지 않습니다. 학습은 별도 Windows PC에서 실행합니다.

모델 가중치는 약 106 MiB이므로 기존 모든 경로 24MB 프록시 제한으로는 새 모델 등록이 실패합니다. [Caddy 예시](Caddyfile.example)처럼 정확한 `POST /api/models`, `POST /api/desktop/models` 요청에만 134283264 bytes(128 MiB + multipart 여유 64 KiB)를 허용합니다. 다른 요청은 기존 24MB 제한을 유지합니다. 기존 HTTPS 설정에 병합한 뒤 `caddy validate`로 확인하고 reload합니다. 운영 프록시 변경은 코드 테스트와 별도로 실행해야 합니다.

Node 서버는 모델 업로드를 위해 전체 HTTP 요청 수신 제한을 180초로 적용하며 헤더 수신 제한은 15초입니다. 본문 제한 시간은 모델 API를 포함한 서버 전체에 적용됩니다. 본문 파싱 전 인증과 기존 경로별 크기·동시 업로드 제한을 유지합니다. 별도 프록시의 업로드 제한 시간이 이보다 짧다면 함께 조정해야 합니다. Windows 앱도 모델 등록 요청 전체에 180초 제한을 적용하므로 더 느린 연결은 제한 시간 안에 전송할 수 있는 환경에서 재시도해야 합니다.

배포 후 owner 패스키 로그인 → **학습 모델 → 기본 한국어 PP-OCRv5 모델 추가**로 첫 모델을 등록합니다. 서버가 공식 Paddle 모델 호스트와 GitHub raw에서 고정된 모델 종류의 가중치·사전을 내려받습니다. 외부 URL을 사용자 입력으로 받지 않습니다. 기본 모델 등록 재시도는 같은 ID를 사용하며 다운로드가 진행 중이면 작업을 공유합니다. 이후 Windows 앱에서 모델·데이터 다운로드, 학습·test 평가, 수동 등록을 확인합니다. 새 등록 모델을 다시 조회하고 재시작 후 파일 해시가 유지되는지도 확인합니다.

가장 단순한 백업은 OCR 컨테이너를 정상 중지한 뒤 `ocr.sqlite`를 안전한 위치에 복사하고 다시 시작하는 것입니다. 쓰는 중인 DB 파일만 임의로 복사하지 않습니다. 복원도 서버를 중지하고 파일·소유권을 복원합니다. 이미지/정답과 접근 권한이 포함된 자료이므로 Git에 넣지 않습니다.

로그인 세션은 OCR process 메모리에만 있고 최대 8시간이며 프로세스 재시작 시 다시 로그인합니다. 패스키·기존 계정은 유지됩니다. 토큰은 브라우저 localStorage에 저장하지 않습니다. 정상 로그아웃·종료는 기존 인증 API의 해당 세션 종료를 요청하고, 인증 API에 연결할 수 없으면 OCR 접근부터 제거합니다. 피시방에서는 사용 후 로그아웃합니다. 배포 후 실제 휴대폰 패스키·HTTPS 복귀·로그아웃과 영속 볼륨 재시작을 확인해야 합니다.

`OCR_AUTH_ORIGIN`은 accounts를 사용하고 `OCR_OWNER_ID`는 같은 UUID를 유지한다. [accounts 배포](../accounts/README.md)를 따른다.
