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

Windows 배포용 설치형 setup.exe는 파일 속성의 VersionInfo 언어를 한국어(대한민국, LCID `0x0412`)로 기록합니다. 이 값은 EXE 메타데이터에 적용하며 앱 UI와 라이선스 원문은 기존 구성을 유지합니다.

### 포터블 exe와 GitHub Releases

같은 환경에서 `pnpm --filter @dfragon/desktop build:win:portable`을 실행하면 `apps/desktop/dist/DFRAGON-<버전>-x64-portable.exe`가 생성됩니다. Windows x64에서 이 파일을 내려받아 실행하며 Node.js·별도 설치 프로그램·관리자 권한은 필요하지 않습니다. OCR 모델과 실행 라이브러리도 포함합니다. 실행할 때 임시 폴더에 앱을 풀기 때문에 첫 실행에 시간이 걸릴 수 있습니다.

포터블은 설치 없이 실행하는 배포 형식입니다. 설정과 로그인 정보는 exe 옆이 아닌 기존 사용자 profile `appData/dfragon`에 저장되며 설치형과 공유합니다. 다른 PC로 exe를 복사해도 로그인 정보는 이동하지 않습니다. 바로가기와 OS 로그인 복귀 protocol은 등록하지 않으며 앱 내부 인증 창을 사용합니다. 자동 업데이트와 코드 서명은 기존 배포본과 같습니다.

[Windows Portable workflow](../../.github/workflows/desktop-release.yml)는 Release를 게시하면 해당 태그의 소스로 빌드하여 포터블 exe를 Release의 Assets에 첨부합니다.

1. 저장소 **Settings → Secrets and variables → Actions → Variables**에 `DFRAGON_DISTRIBUTION_API_ORIGIN`을 실제 배포 API의 HTTPS origin으로 설정합니다. 공개 연결 주소만 입력하며 서버 credential은 넣지 않습니다.
2. 배포할 변경을 merge하고 해당 commit에 `v<버전>` 태그로 Release를 게시합니다. 예를 들어 첫 릴리스는 `v0.0.1`, 사전 릴리스는 `v0.0.1-beta.1`처럼 지정합니다. 태그의 버전을 실행 파일의 앱 metadata와 파일명에 사용하므로 `apps/desktop/package.json`의 기본 버전과 같을 필요는 없습니다.
3. workflow가 성공하면 **Releases → Assets → `DFRAGON-<버전>-x64-portable.exe`**를 내려받습니다. `Source code` 압축 파일은 실행 파일이 아닙니다.

기존 Release에 첨부하려면 **Actions → Windows Portable → Run workflow**에서 기존 `tag`를 입력합니다. `api_origin`은 저장소 변수 대신 사용할 공개 API 주소이며 비우면 변수를 사용합니다. 같은 이름의 첨부 파일이 이미 있으면 덮어쓰지 않고 실패합니다. 배포 API 설정 누락이나 `v<버전>` 형식이 아닌 태그도 빌드를 중단합니다. 로컬 `build:win:portable` 명령은 `package.json`의 기본 버전을 사용합니다.

관련 PR에서도 Windows 포터블 패키징을 확인하고 Actions artifact를 7일간 보관합니다. PR 빌드는 예시 API 주소를 사용하므로 실제 서비스용 배포 파일이 아닙니다. 패키징 성공과 실제 Windows에서의 앱 실행·API·패스키 동작 확인은 구분합니다.

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

설치한 앱의 **설정 → 개발자 모드 → 켜기 → 개발 도구 열기**에서 사용합니다. 로컬 크롭·정답 기능은 로그인 없이 사용할 수 있으며 기본값은 꺼짐입니다. 로그인 상태에서 수집하면 OCR 자료실에도 전송합니다. 활성 상태는 다시 실행해도 유지됩니다. 작업 공간을 열면 일반 파티 캡처는 중지됩니다.

### 이미지 수집

1. Windows에서 던파를 창 모드 또는 전체 창 모드로 실행하고 파티 결성 화면에서 HP·MP가 가득 찬 파티 프레임을 표시합니다. 잔량이 줄어든 프레임의 검출은 지원 범위 밖입니다. 지원 client 크기는 1067×600~1920×1080입니다. 실행 중인 게임 창의 실제 영역과 화면의 파티 프레임을 읽으므로 설정 파일이나 UI 크기를 직접 입력할 필요가 없습니다.
2. **이미지 수집** 탭에서 네 닉네임 위치의 원본 크롭을 확인합니다. 미리보기는 1초마다 갱신되고 파일을 저장하지 않습니다. 번호는 화면 위치이며 1번이 항상 본인이라는 뜻은 아닙니다.
3. 저장할 위치의 체크박스를 선택합니다. 모두 기본 선택되며 수집하지 않을 위치는 해제할 수 있습니다. 빈 위치는 체크 여부와 관계없이 자동으로 건너뛰며, 선택한 위치 중 감지된 크롭만 저장합니다. 체크를 해제한 위치도 미리보기는 유지됩니다.
4. 게임을 전경에 두고 **Print Screen**을 누르면 그 순간의 선택된 크롭만 미작성 상태로 저장합니다. 선택이 없거나 게임·파티 프레임을 확인하지 못하면 저장하지 않습니다. 정답 입력 탭이나 일반 화면으로 이동하거나 개발자 모드를 끄면 단축키 등록을 해제합니다.

던파가 관리자 권한으로 실행 중이면 DFRAGON도 관리자 권한으로 실행해야 Print Screen을 받을 수 있습니다. 앱은 권한 차이를 확인해 재실행 안내를 표시하며 자동으로 권한을 올리지 않습니다. Windows에서는 수집 탭이 열린 동안 네이티브 키보드 훅으로 게임 전경의 Print Screen만 처리합니다. 다른 앱이 전경이면 키 입력을 그대로 전달하며 전역 단축키를 독점 등록하지 않습니다.

### 파티원창 크롭

**파티원창 크롭** 탭은 이동 가능한 **파티참가인원 팝업**을 수집합니다. 게임에서 이 창을 열면 전체 창 미리보기의 주황색 닉네임 경계와 1~4번 원본 크롭을 1초 간격으로 확인할 수 있습니다. 기존 이미지 수집과 같은 client 해상도 범위를 지원하고, 위치·UI 배율을 자동 검출합니다.

참가자가 있는 행의 저장 포함 여부를 선택하고, 게임을 전경에 둔 채 **Print Screen**을 누릅니다. 그 순간 새 프레임에서 선택된 닉네임만 원본 크기로 저장합니다. 빈 행·자물쇠는 제외하며 3번만 남아도 3번 번호를 유지합니다. 빈 행의 체크박스는 잠기고 이전 선택은 참가자가 돌아오면 복원됩니다. 이미지 수집과 선택 상태는 별도로 유지합니다. 팝업 미검출·가림·모호한 검출에서는 이전 크롭을 비우고 저장하지 않습니다. 저장 결과와 실패 안내는 작업 공간에서 확인하고 **정답 입력으로** 이동할 수 있습니다. 일부만 저장된 경우 성공 개수와 실패를 함께 표시합니다.

기준 헤더는 게임 UI의 네 열 제목·배경·구분선만 포함하며 참가자 정보는 포함하지 않습니다. 공통 함수와 관측 범위는 [파티참가인원 검출 조사](../../docs/reference/desktop-party-participants.md), 자산 출처는 [Desktop 고지](../../packages/licenses/notices/desktop/NOTICE.md)를 따릅니다. 이 작업의 macOS Electron UI·합성/제공 이미지 검증은 Windows 실제 GDI·단축키·DPI·설치본 동작 확인을 대신하지 않습니다.

### 정답 입력과 평가

게임을 마친 뒤 **정답 입력** 탭에서 미입력·완료·제외 이미지들을 확인합니다. 썸네일을 선택해 원본을 확대하고 이미지마다 정답을 직접 입력합니다. 빈 입력은 저장할 수 없으며 저장에 성공한 뒤 다음 이미지로 이동합니다. 건너뛰기는 정답을 변경하지 않습니다. 학습에 적합하지 않은 이미지는 삭제하지 않고 제외했다가 복원할 수 있습니다. 이미지나 탭을 바꾸어도 작업 공간 안의 미저장 입력은 유지됩니다. 저장 실패 시 입력은 사라지지 않습니다.

수집은 자동 OCR 평가를 실행하지 않습니다. 기존 PP-OCRv5 한국어 모델 평가는 별도로 실행합니다. **제품 전처리**는 실제 닉네임 OCR과 같은 반전 회색조를 적용하고, **원본 입력**은 이를 생략합니다. 모델 내부의 48px 높이 조정은 동일합니다. 원문과 제품용 닉네임 정리 결과를 따로 표시합니다. 채점은 저장된 정답과 모델 원문의 완전 일치율, Unicode code point 기준 문자 오류율(CER)이며 공백과 대소문자를 유지합니다. 미작성·실패·미평가 이미지는 점수에서 제외합니다. 기존 데이터의 빈 문자열 정답은 미작성과 구분하며 완전 일치율에 포함합니다. 정답 문자 합계가 0이면 CER은 표시하지 않습니다. 신뢰도와 추론 시간은 정확도와 별개이며 모델 로딩·이미지 읽기 시간은 추론 시간에 포함하지 않습니다.

이미지와 라벨은 앱 `userData/developer-mode/samples/`의 PNG·JSON에 로컬 저장합니다. 모드를 꺼도 데이터는 보존되며, 모델 학습은 실행하지 않습니다.

앱에 로그인한 상태에서 HUD·파티원창 탭의 Print Screen으로 저장하면 **게임 원본 PNG와 선택한 크롭 좌표**도 `https://ocr.dfragon.com`에 전송합니다. 자료실의 기존 허용 계정만 업로드할 수 있습니다. 정답은 자료실에서 별도로 입력하며 로컬 정답·OCR 예측은 전송하지 않습니다. 주기적 미리보기나 일반 실시간 OCR은 전송하지 않습니다. 전송 중에는 다음 수집을 기다리며 실패해도 로컬 크롭은 유지합니다. 실패한 자료를 자동으로 다시 보내거나 로그인 후 이전 자료를 올리는 큐는 없습니다. 로그아웃·화면 이탈은 진행 중 요청을 취소하지만 이미 서버에 저장된 자료를 삭제하지 않습니다.

원본 프레임은 main 메모리에만 있고 로컬에는 명시적으로 저장한 크롭 PNG만 만듭니다. 필터나 리사이즈를 저장 원본에 적용하지 않습니다. 평가 결과는 작업 공간을 닫으면 지워지며 다시 평가할 수 있습니다. PNG 입력 제한은 최대 16MiB, 한 변 8192px·총 3300만 픽셀입니다. OCR은 닉네임 한 줄용 모델이므로 극단적으로 가로가 긴 이미지(48px 높이 환산 시 너비 4096px 초과)는 평가 실패로 표시합니다.

프레임 장식에 따른 위치 차이는 각 HP·MP와 경계를 독립 검출해 처리합니다. 고정 간격으로 미검출 위치를 채우지 않습니다. 실제 FHD 표본의 12개 프레임과 Windows 최소 해상도에서 크롭을 확인했으며, 최대 길이 닉네임과 모든 장식·배율 조합까지 검증한 것은 아닙니다. [파티 geometry 조사](../../docs/reference/desktop-party-geometry.md)에 실측 범위와 남은 확인을 기록합니다. Cropper의 기존 프로필·전체화면 ROI 선택창·기존 데이터 폴더 가져오기와 모델 학습은 포함하지 않습니다. Windows 실제 캡처·DPI·단축키 검증과 macOS의 UI·저장·OCR 검증을 구분합니다.
