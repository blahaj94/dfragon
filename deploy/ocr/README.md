# OCR 서버 배포

원본 PNG·메타데이터는 별도 Linux 서버의 `/data/ocr.sqlite`에 보관합니다. 기존 DFRAGON API의 계정·패스키를 재사용하며 OCR 서버에 인증 DB나 서명 키를 복제하지 않습니다. 운영 배포·DNS 변경·실제 계정 선택은 별도 실행 단계입니다.

## 기존 인증 API 연결

기존 API를 이 변경이 포함된 버전으로 배포하고 `AUTH_CONFIG_FILE`의 `passkey` 객체에 아래 **공개 설정 한 항목**을 추가합니다. 기존 RP ID·apiOrigin·앱 returnUrl·키는 유지합니다.

```json
"ocrReturnUrl": "https://ocr.dfragon.com/auth/callback"
```

설정을 읽기 위해 기존 API를 재시작합니다. 새 DB migration은 없습니다. 등록된 기존 패스키로 인증하며 `ocr` 요청만 위 고정 HTTPS 주소로 돌아옵니다. 설정이 없으면 OCR 로그인은 거절하고 기존 Desktop 로그인은 유지합니다.

`OCR_OWNER_ID`에는 관리할 **기존 계정 UUID**를 지정합니다. 닉네임이 아니며, 첫 로그인 사용자를 자동 관리자로 삼지 않습니다. 이 값은 기존 계정 조회 결과에서 운영자가 확인하여 배포 환경에만 넣습니다. 공개 문서·PR·로그에 실제 값을 기록하지 않습니다.

## OCR 실행

서버에 기존 Docker Compose를 사용합니다. 체크아웃 밖에 실제 배포 값의 환경 파일을 만들고 소유자만 읽을 수 있게 합니다. 다음 환경을 설정합니다.

| 값 | 용도 |
| --- | --- |
| `DFRAGON_IMAGE_TAG` | 빌드한 commit/release 태그 |
| `OCR_ORIGIN` | `https://ocr.dfragon.com` |
| `OCR_AUTH_ORIGIN` | 기존 패스키 API origin, 예: `https://api.dfragon.com` |
| `OCR_OWNER_ID` | 허용할 기존 계정 UUID |
| `OCR_DATA_DIRECTORY` | 체크아웃 밖의 절대 영속 디렉터리 |
| `OCR_MAX_BYTES` | 원본 PNG 합계 상한. 기본 1 GiB |
| `OCR_PORT` | loopback 포트. 기본 3100 |

영속 디렉터리를 먼저 만들고 컨테이너 UID/GID `1000:1000`이 쓸 수 있게 권한을 부여합니다. 다른 앱 데이터 경로를 사용하지 않습니다.

```sh
docker compose --env-file /path/to/ocr.env -f deploy/ocr/compose.yaml build
docker compose --env-file /path/to/ocr.env -f deploy/ocr/compose.yaml up -d
```

DNS가 서버를 가리키도록 설정한 뒤 기존 HTTPS reverse proxy에 [Caddy 예시](Caddyfile.example)를 추가합니다. 이미지/API에 캐시를 적용하지 않으며 callback URL이나 쿠키가 남는 access logging을 켜지 않습니다. 공개 포트는 HTTPS proxy가 소유하고 OCR 포트는 loopback에만 바인딩합니다. `OCR_ORIGIN`과 callback origin은 정확히 일치해야 합니다.

## 저장·종료·백업

원본은 캡처 ID당 한 번만 저장하고 크롭 PNG는 좌표에서 요청 시 생성합니다. SQLite transaction이 원본과 모든 샘플 메타데이터를 함께 commit합니다. 같은 ID·같은 내용의 재전송은 기존 결과를 반환합니다. 다른 내용이면 409입니다. 이미지 데이터와 정답에 실제 데이터를 사용하므로 SQLite 파일도 공개하지 않습니다.

용량 상한은 **원본 PNG bytes 합계**이며 DB 메타데이터·journal·다운로드 bytes를 포함하지 않습니다. 디스크에는 추가 여유 공간이 필요합니다. 상한 초과는 507, 제외는 공간 회수가 아닌 학습 제외 표시입니다. 자동 삭제·보존 기한·물리 삭제 API는 없습니다.

가장 단순한 백업은 OCR 컨테이너를 정상 중지한 뒤 `ocr.sqlite`를 안전한 위치에 복사하고 다시 시작하는 것입니다. 쓰는 중인 DB 파일만 임의로 복사하지 않습니다. 복원도 서버를 중지하고 파일·소유권을 복원합니다. 이미지/정답과 접근 권한이 포함된 자료이므로 Git에 넣지 않습니다.

로그인 세션은 OCR process 메모리에만 있고 최대 8시간이며 프로세스 재시작 시 다시 로그인합니다. 패스키·기존 계정은 유지됩니다. 토큰은 브라우저 localStorage에 저장하지 않습니다. 정상 로그아웃·종료는 기존 인증 API의 해당 세션 종료를 요청하고, 인증 API에 연결할 수 없으면 OCR 접근부터 제거합니다. 피시방에서는 사용 후 로그아웃합니다. 배포 후 실제 휴대폰 패스키·HTTPS 복귀·로그아웃과 영속 볼륨 재시작을 확인해야 합니다.
