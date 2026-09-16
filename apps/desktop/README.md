# LDB Desktop

던전앤파이터 캐릭터를 직접 검색하거나 게임 화면의 닉네임을 PaddleOCR로 읽어 검색하는 Windows 앱입니다. 검색·캡처·OCR은 로그인 없이 사용할 수 있습니다.

## 설치와 사용

1. 배포받은 `LDB-<버전>-x64-setup.exe`를 실행합니다. 현재 Windows 사용자용으로 `ldb` 폴더에 설치하며 개발 앱 `LDB Development`와 별도로 사용할 수 있습니다.
2. 시작 메뉴나 바탕화면의 **LDB**를 실행합니다. 사용자가 Node.js·DB·OCR 모델을 별도로 설치하거나 API 환경변수를 설정할 필요는 없습니다. 검색에는 인터넷과 배포 API 연결이 필요합니다.
3. 닉네임을 입력해 직접 검색하거나, 게임을 **1920×1080 테두리 없는 창 모드·게임 UI 배율 50%**로 맞춘 뒤 앱에서 해당 게임 창을 선택하고 캡처를 시작합니다.
   게임을 나중에 실행했거나 창이 목록에 없으면 게임을 최소화하지 않은 상태에서 **창 목록 새로고침**을 누릅니다.
4. OCR이 틀린 슬롯은 닉네임을 직접 수정해 검색합니다. 수정 중에는 OCR이 입력과 결과를 덮어쓰지 않습니다. **OCR 다시 사용**으로 자동 검색에 복귀합니다.
5. 캡처를 중지하면 슬롯 결과가 정리됩니다. 종료할 때는 캡처를 중지하고 창의 X를 누릅니다.

작은 한글 닉네임 오인식은 [Issue #463](https://github.com/blahaj94/ldb/issues/463)에 남아 있습니다. UI 배율 100%·폰트 변경은 지원 범위가 아닙니다. 검색이 실패하면 인터넷·배포 API 상태를 확인하고 다시 시도합니다. 로그인 문제는 비로그인 검색·캡처의 선행 조건이 아닙니다.

자동 업데이트는 제공하지 않습니다. 이후 버전은 앱을 종료하고 새 설치 파일로 설치합니다. 기본 빌드는 코드 서명이 구성되지 않았으며 Windows에서 확인되지 않은 게시자로 표시될 수 있습니다. 배포자가 전달한 파일인지 확인해야 합니다.

## Windows 배포 빌드

Node.js 24와 저장소의 pnpm을 준비한 Windows x64에서 저장소 루트 기준으로 실행합니다.

```powershell
pnpm install --frozen-lockfile
# 실제 배포 서버의 HTTPS origin으로 교체합니다. 아래 주소는 예시입니다.
$env:LDB_DISTRIBUTION_API_ORIGIN = 'https://api.example.test'
pnpm --filter @ldb/desktop build:win
```

설치 파일은 `apps/desktop/dist/LDB-<버전>-x64-setup.exe`에 생성됩니다. 명령은 node/web typecheck, OCR 자산 검증·복사, main/preload/renderer 빌드, NSIS 패키징을 포함합니다. API 주소가 없거나 HTTP·localhost·경로/쿼리가 포함된 값이면 실패합니다. 예시 주소로 패키징에 성공해도 실제 배포·검색 검증이 된 것이 아닙니다.

설치본 main에는 공개 API origin과 `build/distribution-auth.json`의 identity·복귀 주소·환경·provider만 포함합니다. 실행 PC의 개발용 `LDB_AUTH_*` 환경변수에 의존하지 않습니다. 서버 credential·Neople API key·DB 암호·인증 key·개인 certificate는 설치 파일에 넣지 않습니다. 패키징 대상은 `out`, `resources`, 앱 metadata와 production dependency이며 서버 설정 파일을 이 경로에 복사하지 않습니다.

| 항목 | 배포 앱 | 기존 개발 앱 |
| --- | --- | --- |
| 이름·실행 파일 | LDB / `ldb.exe` | LDB Development / `ldb-dev.exe` |
| app identity·appData 아래 profile | `ldb` | `ldb.dev` |
| 인증 환경 | `production` | `development` |
| 복귀 주소 | `ldb://auth/callback` | `ldb.dev://auth/callback` |
| API | 빌드 시 지정한 HTTPS origin | `https://localhost:3443` |
| 설치 | 사용자별 one-click NSIS, `ldb` 폴더 | 기존 one-click NSIS 경로 유지 |

NSIS는 기존 protocol 소유권 검사·사용자별 등록·자기 등록만 제거하는 처리를 공유합니다. 다른 앱이 해당 scheme을 소유하면 설치를 중단합니다. 패스키 로그인에는 API의 HTTPS origin·RP ID와 앱 복귀 주소 설정이 맞아야 합니다. [패스키 설정](../../docs/reference/passkey-authentication.md)을 참고합니다.

### 서버 준비와 설치본 확인

다른 PC가 접근할 수 있는 HTTPS API와 PostgreSQL DB가 필요합니다. 미니 PC에서 기존 API를 운영할 수 있으며 실제 서버·OS·외부 연결·HTTPS 주소·공개 범위를 정한 뒤 [API 설정](../../docs/reference/api-start-development.md)에 연결합니다. localhost 개발 API나 예시 업데이트 주소를 배포 서버로 취급하지 않습니다.

실제 배포 origin으로 빌드한 설치 앱에서 **비로그인 직접 검색 → 지정한 게임 창 캡처 → OCR → 결과**를 확인합니다. 닉네임 수정 유지·OCR 복귀·중지 후 정리도 같은 흐름에서 확인합니다. 빌드·unit test·합성 데이터 UI 확인은 이 실제 확인을 대신하지 않습니다. 서버가 준비되기 전에는 배포 API 연결과 실제 설치본 흐름은 미검증입니다.

## 기존 개발 빌드

```sh
pnpm --filter @ldb/desktop dev
pnpm --filter @ldb/desktop build:win:development
```

개발 설치본은 `dist/development`에 생성됩니다. 기존 localhost HTTPS·`ldb.dev` 등록값은 [개발 패키지 안내](../../docs/reference/desktop-auth-core.md#windows-localhost-개발-패키지)를 따릅니다. macOS·Linux용 기존 명령은 Windows MVP 배포 지원이나 검증 완료를 뜻하지 않습니다.
