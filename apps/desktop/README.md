# DFRAGON Desktop

던전앤파이터 캐릭터를 직접 검색하거나 게임 화면의 닉네임을 PaddleOCR로 읽어 검색하는 Windows 앱입니다. 검색·캡처·OCR은 로그인 없이 사용하는 기능입니다. 현재 소스의 기본 화면은 새 카드 UI이며 빈 슬롯 네 개, 테마 전환과 계정 로그인을 제공합니다. 검색·캡처·OCR·캐릭터 상세는 새 화면에 아직 연결되지 않았으며 입력·캡처는 비활성 상태입니다.

## 설정과 라이선스 사용고지

새 카드 화면의 우측 상단 설정 버튼에서 **라이선스 사용고지**를 엽니다. 구성 요소 이름이나 라이선스로 검색하고 항목을 선택하면 저작권·NOTICE·LICENSE 원문 전체를 읽을 수 있습니다. 원문은 `@dfragon/licenses`에서 빌드한 데이터로 앱에 포함되어 오프라인에서도 열립니다. 원문을 확보하지 못한 항목의 **원문 확인 필요** 표시는 유지합니다.

목록으로 돌아가기, 닫기와 Escape를 지원합니다. 설정을 열거나 닫아도 진행 중인 캡처는 유지됩니다. 좁은 창에서는 메뉴가 위쪽으로 이동하고 목록·긴 원문은 본문 안에서 스크롤됩니다.

## 기존 배포본 설치와 사용

1. 배포받은 `DFRAGON-<버전>-x64-setup.exe`를 실행합니다. 현재 Windows 사용자용으로 `dfragon` 폴더에 설치하며 개발 앱 `DFRAGON Development`와 별도로 사용할 수 있습니다.
2. 시작 메뉴나 바탕화면의 **DFRAGON**을 실행합니다. 사용자가 Node.js·DB·OCR 모델을 별도로 설치하거나 API 환경변수를 설정할 필요는 없습니다. 검색에는 인터넷과 배포 API 연결이 필요합니다.
3. 닉네임을 입력해 직접 검색하거나, 게임을 **1920×1080 테두리 없는 창 모드·게임 UI 배율 50%**로 맞춘 뒤 앱에서 해당 게임 창을 선택하고 캡처를 시작합니다.
   게임을 나중에 실행했거나 창이 목록에 없으면 게임을 최소화하지 않은 상태에서 **창 목록 새로고침**을 누릅니다.
4. OCR이 틀린 슬롯은 닉네임을 직접 수정해 검색합니다. 수정 중에는 OCR이 입력과 결과를 덮어쓰지 않습니다. **OCR 다시 사용**으로 자동 검색에 복귀합니다.
5. 캡처를 중지하면 슬롯 결과가 정리됩니다. 종료할 때는 캡처를 중지하고 창의 X를 누릅니다.

앱 identity와 로그인 복귀 주소를 DFRAGON 이름으로 전환했습니다. 기존 `ldb`·`ldb.dev` profile은 새 앱으로 가져오지 않으며 자동 삭제하지도 않습니다. DFRAGON은 새 profile을 만들고 다시 로그인이 필요합니다. 로그인 복귀를 사용하려면 서버 `returnUrl`도 배포용 `dfragon://auth/callback` 또는 개발용 `dfragon.dev://auth/callback`과 맞춰야 합니다.

작은 한글 닉네임 오인식은 [Issue #463](https://github.com/blahaj94/ldb/issues/463)에 남아 있습니다. UI 배율 100%·폰트 변경은 지원 범위가 아닙니다. 검색이 실패하면 인터넷·배포 API 상태를 확인하고 다시 시도합니다. 로그인 문제는 비로그인 검색·캡처의 선행 조건이 아닙니다.

자동 업데이트는 제공하지 않습니다. 이후 버전은 앱을 종료하고 새 설치 파일로 설치합니다. 기본 빌드는 코드 서명이 구성되지 않았으며 Windows에서 확인되지 않은 게시자로 표시될 수 있습니다. 배포자가 전달한 파일인지 확인해야 합니다.

## Windows 배포 빌드

현재 소스를 빌드하면 새 카드 화면이 포함됩니다. 아래 기존 배포본의 검색·캡처 흐름은 새 화면에 아직 연결되지 않았습니다.

Node.js 24와 저장소의 pnpm을 준비한 Windows x64에서 저장소 루트 기준으로 실행합니다.

```powershell
pnpm install --frozen-lockfile
# 실제 배포 서버의 HTTPS origin으로 교체합니다. 아래 주소는 예시입니다.
$env:DFRAGON_DISTRIBUTION_API_ORIGIN = 'https://api.example.test'
pnpm --filter @dfragon/desktop build:win
```

설치 파일은 `apps/desktop/dist/DFRAGON-<버전>-x64-setup.exe`에 생성됩니다. 명령은 node/web typecheck, OCR 자산 검증·복사, main/preload/renderer 빌드, NSIS 패키징을 포함합니다. API 주소가 없거나 HTTP·localhost·경로/쿼리가 포함된 값이면 실패합니다. 예시 주소로 패키징에 성공해도 실제 배포·검색 검증이 된 것이 아닙니다.

설치본 main에는 공개 API origin과 `build/distribution-auth.json`의 identity·복귀 주소·환경·provider만 포함합니다. 실행 PC의 개발용 `DFRAGON_AUTH_*` 환경변수에 의존하지 않습니다. 서버 credential·Neople API key·DB 암호·인증 key·개인 certificate는 설치 파일에 넣지 않습니다. 패키징 대상은 `out`, `resources`, 앱 metadata와 production dependency이며 서버 설정 파일을 이 경로에 복사하지 않습니다.

| 항목 | 배포 앱 | 기존 개발 앱 |
| --- | --- | --- |
| 이름·실행 파일 | DFRAGON / `dfragon.exe` | DFRAGON Development / `dfragon-dev.exe` |
| app identity·appData 아래 profile | `dfragon` | `dfragon.dev` |
| 인증 환경 | `production` | `development` |
| 복귀 주소 | `dfragon://auth/callback` | `dfragon.dev://auth/callback` |
| API | 빌드 시 지정한 HTTPS origin | `https://localhost:3443` |
| 설치 | 사용자별 one-click NSIS, `dfragon` 폴더 | 기존 one-click NSIS 경로 유지 |

NSIS는 기존 protocol 소유권 검사·사용자별 등록·자기 등록만 제거하는 처리를 공유합니다. 다른 앱이 해당 scheme을 소유하면 설치를 중단합니다. 패스키 로그인에는 API의 HTTPS origin·RP ID와 앱 복귀 주소 설정이 맞아야 합니다. [패스키 설정](../../docs/reference/passkey-authentication.md)을 참고합니다.

### 서버 준비와 설치본 확인

다른 PC가 접근할 수 있는 HTTPS API와 PostgreSQL DB가 필요합니다. 미니 PC에서 기존 API를 운영할 수 있으며 실제 서버·OS·외부 연결·HTTPS 주소·공개 범위를 정한 뒤 [API 설정](../../docs/reference/api-start-development.md)에 연결합니다. localhost 개발 API나 예시 업데이트 주소를 배포 서버로 취급하지 않습니다.

실제 배포 origin으로 빌드한 설치 앱에서 **비로그인 직접 검색 → 지정한 게임 창 캡처 → OCR → 결과**를 확인합니다. 닉네임 수정 유지·OCR 복귀·중지 후 정리도 같은 흐름에서 확인합니다. 빌드·unit test·합성 데이터 UI 확인은 이 실제 확인을 대신하지 않습니다. 서버가 준비되기 전에는 배포 API 연결과 실제 설치본 흐름은 미검증입니다.

## 카드 화면 개발

인증을 포함해 개발할 때는 `apps/desktop/.env.example`을 같은 폴더의 `.env`로 복사하고 API origin·복귀 주소·별도 개발 profile의 절대 경로를 채웁니다. 실제 `.env`는 Git에서 제외됩니다. API는 [로컬 개발 명령](../../docs/reference/api-start-development.md#로컬-개발-명령)으로 먼저 실행합니다.

```sh
# 최초 한 번 복사하고 실제 개발 설정으로 수정합니다.
cp apps/desktop/.env.example apps/desktop/.env
pnpm --filter @dfragon/desktop dev
```

`dev`·`dev:app`은 Node의 `--env-file-if-exists=.env`로 앱 폴더의 설정을 읽은 뒤 기존 Electron 개발 실행을 시작합니다. `.env`가 없어도 카드 화면을 실행할 수 있으며, 이미 설정된 process 환경변수가 우선합니다. 인증 설정을 바꾸면 개발 명령을 종료하고 다시 실행합니다. 배포·패키징의 인증 설정 방식은 바뀌지 않습니다.

`pnpm --filter @dfragon/desktop dev`는 실제 앱 진입점의 새 카드 화면을 열고 소스 수정을 즉시 반영합니다. `dev:app`도 같은 화면을 엽니다. 샘플 데이터 없이 빈 슬롯 네 개로 시작하며 검색·캡처·OCR·상세 연결은 후속입니다. 합성 데이터의 상태 비교와 상세 전환은 `pnpm --filter @dfragon/desktop dev:preview`로 확인합니다. 상태와 빌드 미리보기는 [디자인 이관 안내](../../docs/reference/desktop-mvp-design-handoff.md#renderer-미리보기)를 참고합니다.

우측 상단 **로그인**에서 계정 창을 열고 **패스키로 계속하기**를 누르면 기존 전용 인증 창으로 이어집니다. 진행 중에는 **로그인 취소**, 실패 후에는 안내에 따른 재시도, 로그인 후 **내 계정**에서는 닉네임·패스키 관리·**이 기기 로그아웃**을 제공합니다. 계정 다이얼로그를 닫는 것은 로그인 취소가 아니며, 다시 열면 현재 진행 상태가 보입니다. 전용 인증 창을 닫거나 **로그인 취소**를 눌러 시도를 끝냅니다.

앱 시작 시 기존 main의 세션 복원 결과를 상단에 반영합니다. 복원·저장소 문제와 인증 연결 실패는 계정 창에서 안내하며 카드 화면과 테마 전환은 유지합니다. `dev`의 인증은 기존 [인증 실행 설정](../../docs/reference/desktop-auth-core.md#module-경계)을 사용합니다. `DFRAGON_AUTH_*` 설정이 없어 인증 IPC가 연결되지 않으면 **로그인 연결 확인**과 연결 재확인 안내가 표시됩니다. 인증 runtime이 보고하는 저장소 문제는 **저장소 확인**에서 다시 시도할 수 있습니다. UI 연결만으로 API·실제 패스키·OS 저장소가 구성되지는 않습니다.

`pnpm --filter @dfragon/desktop auth:fixture:build` 후 `pnpm --filter @dfragon/desktop auth:fixture:smoke`는 새 카드 화면과 실제 coordinator·main/preload IPC의 로그인·취소·renderer reload·저장 완료 후 상태 반영·로그아웃을 검증합니다. HTTP·인증 창·저장소는 합성 효과이며 실제 브라우저·패스키 인증이나 앱 프로세스 재시작 후 저장소 복원 성공을 뜻하지 않습니다.

## 개발 빌드

```sh
pnpm --filter @dfragon/desktop dev:app
pnpm --filter @dfragon/desktop build:win:development
```

개발 설치본도 새 카드 화면을 사용하며 `dist/development`에 생성됩니다. 구버전 화면 조합은 `src/frontend/src/fixture/legacy/LegacyApp.tsx`에 격리하여 기존 검색·인증·캡처 회귀 테스트와 capture fixture에서만 사용합니다. 기존 localhost HTTPS·`dfragon.dev` 등록값은 [개발 패키지 안내](../../docs/reference/desktop-auth-core.md#windows-localhost-개발-패키지)를 따릅니다. macOS·Linux용 기존 명령은 Windows MVP 배포 지원이나 검증 완료를 뜻하지 않습니다.

## 개발자 모드

설치한 앱에서도 **설정 → 개발자 모드 → 켜기 → 개발 도구 열기**로 테스트 이미지·라벨·OCR 평가를 한 화면에서 사용할 수 있습니다. 소스 개발 명령이나 로그인 여부와 독립적인 로컬 기능이며 기본값은 꺼짐입니다. 활성 상태는 다시 실행해도 유지됩니다. 작업 공간을 열면 일반 파티 캡처는 중지됩니다.

1. Windows에서는 **화면 가져오기**로 주 모니터의 한 프레임을 가져오거나, PNG·JPEG·WebP 파일을 엽니다. 화면을 가져오는 동안 앱 창은 잠시 숨겨집니다.
2. 미리보기에서 드래그하거나 X·Y·너비·높이를 입력해 닉네임 한 줄을 지정하고 **크롭 저장**을 누릅니다. 같은 원본에서 여러 영역을 저장할 수 있습니다.
3. 저장된 이미지 옆에 정답을 입력하고 Enter 또는 **정답 저장**을 누릅니다. 빈 정답과 미작성은 구분합니다. 이미지를 바꿔도 저장하지 않은 입력은 작업 공간 안에서 유지됩니다.
4. 진행 중인 평가가 없으면 크롭 저장 후 현재 탑재된 PP-OCRv5 한국어 모델로 자동 평가합니다. 평가 중에 추가한 이미지는 완료 후 선택 또는 전체 평가로 실행합니다. **선택 이미지 평가** 또는 **전체 평가**로 다시 실행하고 진행 중에는 중지할 수 있습니다. 평가 중에도 정답을 작성할 수 있습니다.

**제품 전처리**는 실제 닉네임 OCR과 같은 반전 회색조를 적용하고, **원본 입력**은 이를 생략합니다. 모델 내부의 48px 높이 조정은 동일합니다. 원문과 제품용 닉네임 정리 결과를 따로 표시합니다. 채점은 저장된 정답과 모델 원문의 완전 일치율, Unicode code point 기준 문자 오류율(CER)이며 공백과 대소문자를 유지합니다. 미작성·실패·미평가 이미지는 점수에서 제외하고 건수로 표시합니다. 빈 정답은 완전 일치율에 포함하며 정답 문자 합계가 0이면 CER은 표시하지 않습니다. 신뢰도와 추론 시간은 정확도와 별개이며 모델 로딩·이미지 읽기 시간은 추론 시간에 포함하지 않습니다.

이미지와 라벨은 앱 `userData/developer-mode/samples/`의 PNG·JSON에 로컬 저장합니다. 모드를 꺼도 데이터는 보존되며, 서버 전송이나 모델 학습을 실행하지 않습니다. 수집 원본 프레임은 메모리에만 있고 저장한 크롭에만 PNG 파일을 만듭니다. 평가 결과는 작업 공간을 닫으면 지워지며 다시 평가할 수 있습니다. 입력은 최대 16MiB, 한 변 8192px·총 3300만 픽셀로 제한합니다. OCR은 닉네임 한 줄용 모델이므로 극단적으로 가로가 긴 이미지(48px 높이 환산 시 너비 4096px 초과)는 평가 실패로 표시합니다.

이번 통합은 Cropper의 물리 픽셀 화면 캡처 방식과 수집·라벨링 흐름을 앱 안에 연결한 첫 단계입니다. Cropper의 기존 프로필·전역 단축키·전체화면 ROI 선택창·기존 데이터 폴더 가져오기는 아직 이관하지 않았습니다. 현재 평가는 텍스트 인식 모델을 대상으로 하며 실제 파티 슬롯 감지나 연속 프레임 안정화의 성능을 측정하지 않습니다. Windows 실제 캡처·DPI·설치본 동작은 Windows 대화형 데스크톱에서 별도로 확인해야 합니다.
