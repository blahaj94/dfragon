# DFragon Desktop

던전앤파이터 캐릭터를 직접 검색하거나 게임 화면의 닉네임을 PaddleOCR로 읽어 검색하는 Windows 앱입니다. 검색, 캡처와 OCR은 로그인 없이 사용합니다. 던파 창이 하나면 자동 캡처하고 각 카드 중앙에 OCR부터 조회 완료까지 진행 상태를 표시합니다. OCR 첫 번째 이름만 검색하며 외형을 확인하지 못하면 최고 명성 후보를 대체 표시합니다. 서버와 닉네임은 항상 수정할 수 있고 별도 상세 창에서 기본 정보를 비교할 수 있습니다. 장비 카드 확장과 실제 Windows 검증은 별도입니다.

## 테스트 버전 자료 수집

개발 실행과 버전명이 `alpha`인 패키지는 OCR 검색 회차마다 검출된 슬롯을 한 번 수집합니다. **Alt+Print Screen**은 현재 캡처에서 새 원본과 검출된 파티원 슬롯을 확인창 없이 수집합니다. **Alt+R**, **Alt+Print Screen**은 던파 또는 DFragon이 활성 창일 때만 처리합니다. 중지된 캡처나 가려져 읽을 수 없는 화면은 수집하지 않습니다.

원본 PNG, 닉네임 좌표와 얼굴을 포함한 전체 슬롯 좌표를 `ocr.dfragon.com`의 테스트 수집 경로로 보냅니다. OCR 예측은 미검수 메타데이터이며 정답을 자동 입력하지 않습니다. 안정화 반복과 수동 서버, 닉네임 조회는 업로드를 늘리지 않습니다. 전송은 백그라운드에서 처리하며 실패나 대기열 초과가 캐릭터 조회를 막지 않습니다. 자동 재전송은 하지 않습니다.

로그인은 필요 없지만 서버의 **`OCR_TEST_UPLOAD_ENABLED=true`** 설정이 필요합니다. 기본값은 꺼짐이며 기존 자료 조회와 수정에는 계속 소유자 인증이 필요합니다. 안정 버전은 테스트 수집을 켜지 않습니다. [서버 한도와 데이터 계약](../ocr/README.md)을 확인한 뒤 서버를 먼저 배포하고 설정을 활성화합니다. 코드 변경만으로 운영 설정이나 자료를 변경하지 않습니다.

## 실행 중 오류 확인

앱에서 **Ctrl+Shift+I**를 누르면 Electron 기본 DevTools가 열립니다. **Console**의 `[DFragon ...]` 항목에서 캡처, OCR, 검색, 업로드, 새 버전 확인과 화면 오류의 정제된 코드를 확인합니다. 최근 200개 기록을 현재 프로세스 메모리에만 유지하며 같은 오류가 연속되면 중복을 줄입니다. 앱을 종료하면 없어지고 파일로 저장하지 않습니다.

원문 오류, 닉네임, 토큰, 이미지, 외부 응답과 개인 경로는 이 진단 기록에 넣지 않습니다. 따라서 상세 stack 대신 실패 영역과 고정 코드를 확인하는 용도입니다. 앱이 종료되는 치명적 오류의 기록은 다음 실행으로 복구하지 않습니다.

‘닉네임을 읽지 못했습니다’ 원인을 확인할 수 있도록, OCR 첫 후보를 검색에 쓰지 못한 슬롯은 같은 Console에 `[DFragon ...] 슬롯 n의 OCR 첫 후보를 검색에 쓰지 못했습니다. 이유: …, 원문: "…"` 한 줄을 표시합니다. 이유는 후보 없음, 빈 문자열, 최대 길이 초과, 잘못된 Unicode 중 하나입니다. 원문은 앞뒤 공백이 보이도록 JSON 문자열로 표시하고, 후보가 없으면 `없음`으로 표시합니다. 이 줄은 화면 프로세스의 Console에만 남고 위 진단 기록, 파일, 업로드에는 넣지 않습니다.

## 피아노 사운드 패키지

Desktop renderer에서 `@blahaj94/piano-sound@0.1.0`을 사용할 수 있습니다. Web Audio 기반의 피아노 배경음과 이벤트 사운드를 제공하며, 재생 UI와 자동 재생은 연결하지 않습니다. 코드는 [비공개 piano-sound 저장소](https://github.com/blahaj94/piano-sound), 배포 파일은 GitHub Packages에서 관리합니다.

전체 workspace 설치에도 이 비공개 패키지를 읽을 권한이 필요합니다. 패키지 접근 권한과 `read:packages` 범위를 가진 GitHub classic PAT를 `NODE_AUTH_TOKEN` 환경변수로 제공하고, 아래 인증 템플릿을 사용자 npm 설정에 한 번 등록합니다. 실제 토큰은 저장소나 명령문에 적지 않습니다.

```sh
npm config set '//npm.pkg.github.com/:_authToken' '${NODE_AUTH_TOKEN}' --location=user
pnpm install --frozen-lockfile
```

루트 `.npmrc`는 `@blahaj94` 패키지만 GitHub Packages로 보냅니다. pnpm 11은 저장소 `.npmrc`의 인증 환경변수 치환을 허용하지 않으므로 인증 템플릿은 사용자 설정에 둡니다. PowerShell에서도 위 명령의 작은따옴표를 유지하고 환경변수는 해당 셸의 보안 입력 방식으로 설정합니다.

Code Quality와 Desktop CI는 설치 단계에만 `PIANO_SOUND_PACKAGES_TOKEN` secret을 전달합니다. 저장소 **Settings → Secrets and variables → Actions**에서 패키지 읽기 권한이 있는 `read:packages` classic PAT를 해당 이름으로 등록해야 합니다. Dependabot이 만든 PR의 workflow는 Actions secret 대신 Dependabot secret을 받으므로 같은 PAT를 **Settings → Secrets and variables → Dependabot**에도 같은 이름으로 등록합니다. Secret이 전달되지 않는 외부 fork PR은 전체 설치를 할 수 없습니다. 인증 실패를 성공으로 처리하거나 검사를 생략하지 않습니다. 서버 이미지의 인증 전달은 [BuildKit secret 안내](../../docs/reference/api-start-development.md#서버-이미지)를 따릅니다.

패키지의 **Manage Actions access**에 공개 저장소 `blahaj94/dfragon`을 추가하면 외부 fork도 패키지를 다운로드할 수 있습니다. 비공개 다운로드 범위를 유지하기 위해 기본 `GITHUB_TOKEN`으로 대체하거나 공개 저장소에 패키지 접근을 허용하지 않습니다. GitHub의 [패키지 Actions 접근 안내](https://docs.github.com/en/packages/learn-github-packages/configuring-a-packages-access-control-and-visibility#ensuring-workflow-access-to-your-package)를 참고합니다.

Vite 전용 entry는 패키지에 포함된 MP3 18개를 로컬 빌드 자산으로 내보냅니다. CDN이나 CSP 변경 없이 다음처럼 사용하며, Electron main이나 preload에서는 import하지 않습니다.

```ts
import { PianoEngine, loadSamples } from '@blahaj94/piano-sound'
import { sampleUrls } from '@blahaj94/piano-sound/vite'

// 시작 버튼의 클릭 핸들러에서 호출하고 반환값을 보관합니다.
async function startPiano() {
  const context = new AudioContext()
  try {
    await context.resume()
    const samples = await loadSamples(context, sampleUrls)
    const piano = new PianoEngine(context, samples)
    piano.start()

    return { context, piano }
  } catch (error) {
    await context.close()
    throw error
  }
}
```

시작과 정리 명령을 한 번에 실행하면 소리를 듣기 전에 멈춥니다. 이벤트 음은 `piano.bounce()`, 정지 버튼은 `piano.stop()`, 다시 시작은 `await context.resume()` 후 `piano.start()`에 연결합니다. 화면을 떠날 때만 `piano.dispose()` 후 `await context.close()`를 호출합니다.

브라우저에서 바로 들어보려면 piano-sound 저장소에서 `npm ci`, `npm run example`을 실행한 뒤 생성된 `examples/piano.html`을 엽니다. 이 파일은 엔진과 음원을 포함하므로 `file://`와 오프라인에서 동작합니다. Vite 앱의 원본 HTML을 직접 여는 방식은 모듈 해석과 파일 접근 제한 때문에 실행되지 않습니다.

샘플 로딩 중 화면을 떠나는 경우 `loadSamples`의 `signal`에 `AbortSignal`을 전달하고 취소합니다. 로딩 실패 시에도 생성한 context를 닫는 책임은 호출자에게 있습니다. 음원은 Alexander Holm의 Salamander Grand Piano이며 CC BY 3.0 고지와 원문을 패키지에 포함합니다. Desktop의 기존 라이선스 수집기가 패키지의 `LICENSE`, `NOTICE`, `LICENSES`를 읽어 배포 고지와 설정 화면에 포함합니다.

## 설정과 라이선스 사용고지

새 카드 화면의 우측 상단 설정 버튼에서 **라이선스 사용고지**를 엽니다. 구성 요소 이름이나 라이선스로 검색하고 항목을 선택하면 저작권, NOTICE, LICENSE 원문 전체를 읽을 수 있습니다. 원문은 `@dfragon/licenses`에서 빌드한 데이터로 앱에 포함되어 오프라인에서도 열립니다. 원문을 확보하지 못한 항목의 **원문 확인 필요** 표시는 유지합니다.

목록으로 돌아가기, 닫기와 Escape를 지원합니다. 설정을 열거나 닫아도 진행 중인 캡처는 유지됩니다. 좁은 창에서는 메뉴가 위쪽으로 이동하고 목록, 긴 원문은 본문 안에서 스크롤됩니다.

### 버전 정보

**설정 → 버전 정보**에서 설치한 앱의 버전, 커밋 hash와 API, accounts, OCR 서버의 커밋 hash를
각각 확인합니다. 앱 버전은 실제 설치 패키지에서 읽고, 앱의 commit은 Electron 빌드 시 checkout한
소스에 고정합니다. 미커밋 변경을 포함한 로컬 빌드는 함께 표시합니다. Release 태그를 빌드할 때도
workflow 실행 시점의 최신 main 대신 실제 checkout한 commit을 기록합니다.

서버 정보는 앱에 설정된 각 서버의 `/version` 응답입니다. **새로고침**하면 현재 실행 중인
서버 정보를 새로 조회합니다. 한 서버 조회에 실패해도 나머지 정보는 표시합니다. 버전 조회를
지원하지 않는 이전 서버와 연결 실패를 구분하고, 커밋 정보가 없는 개발 빌드는 정보 없음으로
표시합니다. 전체 hash를 확인할 수 있으며 앱과 서버는 서로 다른 commit일 수 있습니다.

서버 commit의 빌드, 복귀 동작은 [서버 버전 조회](../../docs/reference/api-start-development.md#실행-중인-서버의-버전-조회)를 따릅니다.
이 정보는 현재 버전을 확인하기 위한 것이며, 앱 자동 업데이트나 서버 배포를 실행하지 않습니다.

## 기존 배포본 설치와 사용

1. 배포받은 `DFragon-<버전>-x64-setup.exe`를 실행합니다. 현재 Windows 사용자용으로 `dfragon` 폴더에 설치하며 개발 앱 `DFragon Development`와 별도로 사용할 수 있습니다.
2. 시작 메뉴나 바탕화면의 **DFragon**을 실행하고 Windows 관리자 권한 요청을 승인합니다. Portable도 같은 권한을 요구합니다. Node.js, DB와 OCR 모델을 별도로 설치할 필요는 없으며 검색에는 인터넷과 배포 API 연결이 필요합니다.
3. 닉네임을 입력해 직접 검색하거나 게임을 **창 모드 또는 테두리 없는 창 모드**로 맞추고 HP, MP가 가득 찬 파티 프레임을 표시합니다. 앱 시작 시 던파 창이 하나면 자동으로 캡처합니다. 게임을 나중에 실행해도 기본 15초 간격으로 감지합니다. 후보가 여러 개면 직접 선택하며 **창 목록 새로고침**으로 즉시 확인할 수 있습니다.
4. 한 번 조회한 결과는 파티원이 바뀌어도 유지합니다. **Alt+R**로 전체 파티를 처음부터 다시 인식합니다. 서버와 닉네임은 언제든 수정하고 **Enter 또는 서버 변경**으로 해당 슬롯만 조회합니다. 외형 비교로 확인하지 못한 후보는 최고 명성 대체 표시라는 안내가 붙습니다.
5. 캡처를 중지하면 슬롯 결과가 정리됩니다. 종료할 때는 캡처를 중지하고 창의 X를 누릅니다.

앱 identity와 로그인 복귀 주소를 DFragon 이름으로 전환했습니다. 기존 `ldb`, `ldb.dev` profile은 새 앱으로 가져오지 않으며 자동 삭제하지도 않습니다. DFragon은 새 profile을 만들고 다시 로그인이 필요합니다. 로그인 복귀를 사용하려면 서버 `returnUrl`도 배포용 `dfragon://auth/callback` 또는 개발용 `dfragon.dev://auth/callback`과 맞춰야 합니다.

작은 한글 닉네임 오인식은 [Issue #463](https://github.com/blahaj94/ldb/issues/463)에 남아 있습니다. 해상도와 UI 배율을 고정하지 않고 HP, MP 프레임의 위치와 배율을 매번 검출합니다. 잔량이 줄어든 전투 화면과 폰트 변경은 검증하지 않았습니다. 검색이 실패하면 인터넷, 배포 API 상태를 확인하고 다시 시도합니다. 로그인 문제는 비로그인 검색, 캡처의 선행 조건이 아닙니다.

배포 앱은 시작할 때와 이후 6시간마다 GitHub Release 목록을 확인하고, 현재보다 높은 버전이 있으면 카드 화면 위에 새 버전과 **Release 열기** 버튼을 보입니다. 정식 버전은 정식, beta는 beta와 정식, alpha는 alpha, beta, 정식 가운데 가장 높은 버전 하나를 알립니다. alpha에서 beta나 정식으로 옮기면 OCR 자료 수집이 꺼진다는 안내를 함께 보입니다. **닫기**를 누르면 앱을 다시 시작할 때까지 같은 버전을 다시 알리지 않습니다. 확인할 때 github.com에 IP와 User-Agent가 전달되며 언어 설정, cookie, 로그인 정보 같은 그 밖의 정보는 보내지 않습니다. 확인에 실패하면 화면에 표시하지 않고 진단 기록에 `UPDATE_CHECK_FAILED`를 남깁니다. test, development 채널과 소스 실행은 확인하지 않습니다. 기준은 [Desktop 새 버전 알림](../../docs/rules/desktop-update-proposal.md#1단계-새-버전-알림)에 있습니다.

자동 업데이트는 제공하지 않습니다. 이후 버전은 앱을 종료하고 새 설치 파일로 설치합니다. 기본 빌드는 코드 서명이 구성되지 않았으며 Windows에서 확인되지 않은 게시자로 표시될 수 있습니다. 배포자가 전달한 파일인지 확인해야 합니다.

## Windows 배포 빌드

현재 소스를 빌드하면 카드의 서버, 닉네임 수정과 기본 정보 상세 창이 포함됩니다. 초기 윤곽 기준으로 자동 식별하며 API의 candidates와 appearance endpoint 배포가 필요합니다. 장비 카드 연결은 후속입니다.

Node.js 24와 저장소의 pnpm을 준비한 Windows x64에서 저장소 루트 기준으로 실행합니다.

```powershell
pnpm install --frozen-lockfile
# 실제 배포 서버의 HTTPS origin으로 교체합니다. 아래 주소는 예시입니다.
$env:DFRAGON_DISTRIBUTION_API_ORIGIN = 'https://api.example.test'
pnpm --filter @dfragon/desktop build:win
```

설치 파일은 `apps/desktop/dist/DFragon-<버전>-x64-setup.exe`에 생성됩니다. 명령은 node/web typecheck, OCR 자산 검증, 복사, main/preload/renderer 빌드, NSIS 패키징을 포함합니다. API 주소가 없거나 HTTP, localhost, 경로/쿼리가 포함된 값이면 실패합니다. 예시 주소로 패키징에 성공해도 실제 배포, 검색 검증이 된 것이 아닙니다.

Windows 배포용 설치형 setup.exe는 파일 속성의 VersionInfo 언어를 한국어(대한민국, LCID `0x0412`)로 기록합니다. 이 값은 EXE 메타데이터에 적용하며 앱 UI와 라이선스 원문은 기존 구성을 유지합니다.

### 포터블 exe와 GitHub Releases

같은 환경에서 `pnpm --filter @dfragon/desktop build:win:portable`을 실행하면 `apps/desktop/dist/DFragon-<버전>-x64-portable.exe`가 생성됩니다. Windows x64에서 이 파일을 내려받아 실행하며 Node.js나 별도 설치 프로그램은 필요하지 않습니다. 설치형처럼 실행할 때 Windows 관리자 권한을 요청합니다. OCR 모델과 실행 라이브러리도 포함합니다. 실행할 때 임시 폴더에 앱을 풀기 때문에 첫 실행에 시간이 걸릴 수 있습니다.

포터블은 설치 없이 실행하는 배포 형식입니다. 설정과 로그인 정보는 exe 옆이 아닌 기존 사용자 profile `appData/dfragon`에 저장되며 설치형과 공유합니다. 다른 PC로 exe를 복사해도 로그인 정보는 이동하지 않습니다. 바로가기와 OS 로그인 복귀 protocol은 등록하지 않으며 앱 내부 인증 창을 사용합니다. 자동 업데이트와 코드 서명은 기존 배포본과 같습니다.

[Windows Portable workflow](../../.github/workflows/desktop-release.yml)는 Release를 게시하면 해당 태그의 소스로 빌드하여 포터블 exe와 SHA-256 checksum 파일을 Release의 Assets에 첨부하고, exe의 build provenance attestation을 기록합니다.

1. 저장소 **Settings → Environments → production**의 Environment variables에 `DFRAGON_DISTRIBUTION_API_ORIGIN`을 실제 배포 API의 HTTPS origin으로 설정합니다. production 환경은 main branch와 `v*` tag에서 시작한 실행만 쓸 수 있습니다. 공개 연결 주소만 입력하며 서버 credential은 넣지 않습니다.
2. 배포할 변경을 merge하고 해당 commit에 `v<버전>` 태그로 Release를 게시합니다. 예를 들어 첫 릴리스는 `v0.0.1`, 사전 릴리스는 `v0.0.1-beta.1`처럼 지정합니다. 태그의 버전을 실행 파일의 앱 metadata와 파일명에 사용하므로 `apps/desktop/package.json`의 기본 버전과 같을 필요는 없습니다. 태그가 가리키는 commit은 main에 포함되고 그 commit의 main push Code Quality가 성공해야 하며, 아니면 빌드 전에 실패합니다. 연속 merge로 Code Quality가 취소된 commit이면 그 실행을 다시 실행해 성공시킨 뒤 진행합니다. `v*` tag는 저장소 관리자만 만들 수 있고, 만든 뒤에는 저장소 ruleset `protected-release-tags`가 tag를 옮기거나 지우는 것을 막습니다. 잘못 만든 tag는 **Settings → Rules → Rulesets**에서 `protected-release-tags`를 잠시 비활성화하고 지운 뒤 다시 활성화합니다.
3. workflow가 성공하면 **Releases → Assets → `DFragon-<버전>-x64-portable.exe`**를 내려받습니다. 같은 이름 뒤에 `.sha256`이 붙은 파일에 exe의 SHA-256 값이 있습니다. `Source code` 압축 파일은 실행 파일이 아닙니다.

내려받은 exe는 PowerShell의 `Get-FileHash <파일> -Algorithm SHA256` 결과를 `.sha256` 파일의 값과 비교해 손상 여부를 확인합니다. 이 저장소의 Windows Portable workflow가 빌드한 파일인지는 GitHub CLI의 `gh attestation verify <파일> -R blahaj94/dfragon`으로 확인합니다. Checksum과 attestation은 코드 서명을 대신하지 않습니다.

기존 Release에 첨부하려면 **Actions → Windows Portable → Run workflow**에서 기존 `tag`를 입력합니다. `api_origin`은 production 환경 변수 대신 사용할 공개 API 주소이며 비우면 환경 변수를 사용합니다. 이 실행도 main branch나 `v*` tag에서 시작한 경우에만 production 환경을 쓸 수 있습니다. Release 게시와 같은 main, Code Quality 확인을 적용합니다. 같은 이름의 exe나 checksum 첨부 파일이 이미 있으면 덮어쓰지 않고 실패합니다. 배포 API 설정 누락이나 `v<버전>` 형식이 아닌 태그도 빌드를 중단합니다. 로컬 `build:win:portable` 명령은 `package.json`의 기본 버전을 사용합니다.

관련 PR에서는 [Windows Test Build workflow](../../.github/workflows/desktop-test-build.yml)가 test 채널로 포터블 exe를 빌드해 checksum과 함께 Actions artifact `windows-x64-portable-test`로 7일간 보관합니다. test 채널은 이름 DFragon Test, 실행 파일 `dfragon-test.exe`, 버전 `0.0.0-test.<실행 번호>`이며, 로그인 없이 실제 API로 검색, 캡처, OCR을 확인하는 용도입니다. API는 **Settings → Environments → test**의 변수 `DFRAGON_TEST_API_ORIGIN`이 있으면 그 값, 비우면 `https://api.dfragon.com`입니다. test 환경은 PR 실행마다 deployment 기록을 남기지 않습니다. 설치한 DFragon과 profile이 겹치지 않고, `-alpha` 버전이 아니므로 OCR 수집은 꺼집니다. 패키징 시간을 줄이기 위해 7z 압축 수준을 낮추므로 exe가 Release 첨부 파일보다 크며, attestation은 기록하지 않습니다. **Actions → Windows Test Build → Run workflow**에서 branch를 고르면 PR 없이도 같은 빌드를 만듭니다. Windows PC의 PowerShell에서 GitHub에 로그인한 GitHub CLI로 내려받습니다. 실행 ID와 아래 명령은 workflow 실행 요약에 있습니다. 명령 프롬프트(cmd)에서는 `$HOME`이 펼쳐지지 않아 현재 폴더 아래에 `$HOME` 폴더가 생기므로, `-D`에 실제 폴더 경로를 적습니다.

```powershell
gh run download <실행 ID> --repo blahaj94/dfragon -n windows-x64-portable-test -D "$HOME\Downloads\dfragon-test-<실행 ID>"
```

명령은 성공해도 아무것도 출력하지 않습니다. `-D`로 지정한 폴더가 없으면 만들고 그 안에 `DFragon-Test-<버전>-x64-portable.exe`와 `.sha256` 파일을 풉니다. `-D`를 빼면 현재 폴더에 풀리므로, 관리자 권한 PowerShell처럼 시작 위치가 `C:\Windows\System32`인 셸에서는 파일이 그곳에 생깁니다. 같은 이름의 파일이 이미 있으면 덮어쓰지 않고 `file exists`로 실패하므로 실행마다 새 폴더를 씁니다. 손상 여부는 Release와 같은 방법으로 `Get-FileHash` 결과를 `.sha256` 파일의 값과 비교합니다.

패키징 성공과 실제 Windows에서의 앱 실행, API, 패스키 동작 확인은 구분합니다.

설치본 main에는 공개 API origin과 `build/channels.json`의 distribution 항목에 있는 identity, 복귀 주소, 환경, provider만 포함합니다. 실행 PC의 개발용 `DFRAGON_AUTH_*` 환경변수에 의존하지 않습니다. 서버 credential, Neople API key, DB 암호, 인증 key, 개인 certificate는 설치 파일에 넣지 않습니다. 패키징 대상은 `out`, `resources`, 앱 metadata와 production dependency이며 서버 설정 파일을 이 경로에 복사하지 않습니다. `onnxruntime-web`은 renderer가 번들하고 WASM은 `out`에 복사한 OCR 자산에서 읽으므로 설치된 패키지는 패키징에서 제외합니다.

| 채널           | 용도                                          | `build/channels.json` 항목 | 만드는 경로                                   |
| -------------- | --------------------------------------------- | -------------------------- | --------------------------------------------- |
| `distribution` | 사용자에게 배포하는 설치형, 포터블             | `distribution`             | `build:win`, `build:win:portable`, Release 첨부 |
| `development`  | 로컬 API, accounts를 바라보는 개발 설치본      | `development`              | `build:win:development`                       |
| `test`         | PR 실기 테스트용 포터블, 로그인 없음           | `test`                     | Windows Test Build artifact, `build:win:test:portable` |

각 채널의 앱 이름, 실행 파일, identity, 로그인 설정, API와 accounts origin 값은 이 표가 아니라 `build/channels.json`의 해당 항목에서 읽습니다. 값을 바꿀 때는 [Desktop Authentication Platform](../../docs/rules/desktop-auth-platform.md)의 승인 tuple과 `build/channels.test.ts`의 고정값을 함께 고칩니다.

배포 앱, 개발 앱, PR용 test 채널의 공개 값은 `build/channels.json`에 채널별로 모아 둡니다. 앱 이름, 실행 파일 이름, package 이름, 출력 폴더, NSIS include, identity, 로그인 설정(환경, 복귀 주소, provider)과 API, accounts origin의 출처가 여기에 있으며 `build/channels.ts`가 빌드 시 형식과 공개 origin 조건을 검증합니다. 로그인 설정이 없는 채널은 로그인 없이 실행하고 Electron 기본 profile 경로를 씁니다. 빌드가 이 파일에서 채널 하나의 identity와 origin을 main bundle에 넣고, packaging 설정은 `build/electron-builder-config.ts`가 이 파일로 만듭니다. 기본 진입 파일 `electron-builder.ts`는 `DFRAGON_CHANNEL` 환경변수로 채널을 고르고 비우면 배포 채널이며, `electron-builder.development.ts`와 `electron-builder.test-channel.ts`는 각각 개발, test 채널로 고정되어 Windows PowerShell에서 환경변수 없이 쓸 수 있습니다. `scripts/desktop-package-fuses.test.mjs`와 `build/electron-builder-config.test.ts`가 electron-builder가 읽는 설정과 이 파일의 일치를 검사합니다. Secret, credential은 이 파일에 넣지 않습니다.

NSIS는 기존 protocol 소유권 검사, 사용자별 등록, 자기 등록만 제거하는 처리를 공유합니다. 다른 앱이 해당 scheme을 소유하면 설치를 중단합니다. 패스키 로그인에는 API의 HTTPS origin, RP ID와 앱 복귀 주소 설정이 맞아야 합니다. [패스키 설정](../../docs/reference/passkey-authentication.md)을 참고합니다.

### 서버 준비와 설치본 확인

다른 PC가 접근할 수 있는 HTTPS API와 PostgreSQL DB가 필요합니다. 미니 PC에서 기존 API를 운영할 수 있으며 실제 서버, OS, 외부 연결, HTTPS 주소, 공개 범위를 정한 뒤 [API 설정](../../docs/reference/api-start-development.md)에 연결합니다. localhost 개발 API나 예시 업데이트 주소를 배포 서버로 취급하지 않습니다.

실제 배포 origin으로 빌드한 설치 앱에서 **비로그인 직접 검색 → 지정한 게임 창 캡처 → OCR → 결과**를 확인합니다. 닉네임 수정 유지, OCR 복귀, 중지 후 정리도 같은 흐름에서 확인합니다. 빌드, unit test, 합성 데이터 UI 확인은 이 실제 확인을 대신하지 않습니다. 서버가 준비되기 전에는 배포 API 연결과 실제 설치본 흐름은 미검증입니다.

## 카드 화면 개발

인증을 포함해 개발할 때는 `apps/desktop/.env.example`을 같은 폴더의 `.env`로 복사하고 별도 개발 profile의 절대 경로를 채웁니다. 템플릿의 검색 API `DFRAGON_API_ORIGIN`은 로컬 API, 로그인용 `DFRAGON_AUTH_API_ORIGIN`은 로컬 accounts를 가리키며, identity `dfragon.local`은 설치한 개발 앱 `dfragon.dev`와 profile, 단일 인스턴스 lock이 겹치지 않게 합니다. 실제 `.env`는 Git에서 제외됩니다. API는 [로컬 개발 명령](../../docs/reference/api-start-development.md#로컬-개발-명령)으로 먼저 실행합니다.

```sh
# 최초 한 번 복사하고 실제 개발 설정으로 수정합니다.
cp apps/desktop/.env.example apps/desktop/.env
pnpm --filter @dfragon/desktop dev
```

`dev`, `dev:app`은 Electron 실행 파일이 없으면 먼저 내려받고, Node의 `--env-file-if-exists=.env`로 앱 폴더의 설정을 읽은 뒤 기존 Electron 개발 실행을 시작합니다. `.env`가 없어도 카드 화면을 실행할 수 있으며, 이미 설정된 process 환경변수가 우선합니다. 인증 설정을 바꾸면 개발 명령을 종료하고 다시 실행합니다. 배포, 패키징의 인증 설정 방식은 바뀌지 않습니다.

`pnpm --filter @dfragon/desktop dev`는 실제 앱 진입점의 새 카드 화면을 열고 소스 수정을 즉시 반영합니다. `dev:app`도 같은 화면을 엽니다. 샘플 데이터 없이 빈 슬롯 네 개로 시작하며 카메라 버튼에서 창을 선택하면 개발자 모드와 같은 Windows GDI 모듈로 캡처와 OCR 이름 표시를 시작합니다. 다른 창에 가려진 픽셀은 인식에서 제외합니다. 창 전체가 가려졌거나 최소화되면 이전 인식값을 비우고 기다리며, 게임을 앞으로 가져오면 자동으로 이어갑니다. 최소화된 창의 백그라운드 캡처는 지원하지 않습니다. OCR 식별 상태와 선택된 캐릭터의 기본 정보를 슬롯별로 표시하며, 얼굴 영역을 검출하지 못하면 대기하며, API 외형 정보와 쇼룸 Stay 이미지를 윤곽으로 비교합니다. 외형 복원이 불확실하면 해당 슬롯의 자동 식별을 보류합니다. 연결중 팝업으로 가려져 검출되지 않은 슬롯은 검색에서 제외하고 이전 결과를 비우며, 정상 영역이 돌아오면 다시 안정화를 기다립니다. 모달을 닫거나 로그인 상태가 바뀌어도 캡처는 유지되며 별도 중지 버튼으로 정리합니다. 식별된 슬롯의 상세 버튼은 아래 기본 정보 창을 엽니다. 이름 수정과 장비 면 연결은 후속입니다. 합성 데이터의 자동 식별 상태, 네 면 비교와 상세 전환은 `pnpm --filter @dfragon/desktop dev:preview`로 확인합니다. 상태와 빌드 미리보기는 [디자인 이관 안내](../../docs/reference/desktop-mvp-design-handoff.md#renderer-미리보기)를 참고합니다.

캐릭터 상세는 서로 다른 서버와 캐릭터 ID마다 별도 창을 엽니다. 같은 캐릭터를 다시 선택하면 기존 창을 복원하고 앞으로 가져오며, 처음 열 때의 정보를 유지합니다. 캡처 중지나 슬롯 변경은 이미 열린 창의 내용을 바꾸지 않습니다. 닫고 다시 열면 현재 선택에 보관된 정보를 표시하며 추가 API 조회는 하지 않습니다. 메인 창이 실제로 닫히면 상세 창도 모두 닫습니다.

현재 상세 창에는 이미지, 이름, 서버, 모험단, 직업, 전직, 레벨, 명성과 마지막 조회 시각, 정보 유효 시각을 표시합니다. 누락된 값은 `정보 없음`으로 표시하고 장비 점수나 마법부여 등급을 추정하지 않습니다. 창은 전용 읽기 bridge로 보관된 기본 정보만 받으며 장비 카드와 자동 갱신은 제공하지 않습니다. [상세 창 구현과 수명](../../docs/reference/desktop-character-search.md#캐릭터별-상세-창)에서 연결 경계와 검증 범위를 확인할 수 있습니다.

우측 상단 **로그인**을 누르면 전용 인증 창을 엽니다. 진행 중에는 로그인 버튼을 비활성화해 중복 요청을 막고, 로그인 후에는 버튼을 숨깁니다. 현재 카드 화면에는 별도 계정 다이얼로그, 닉네임, 패스키 관리, 로그아웃 메뉴를 표시하지 않습니다. 전용 인증 창을 닫으면 진행 중인 시도를 취소합니다.

앱 시작 시 기존 main의 세션 복원 결과를 로그인 버튼에 반영합니다. 인증 연결 실패 상태에서 **로그인**을 누르면 연결을 다시 확인하고, 복원 일시 정지, 저장소 차단 상태에서는 기존 복구 명령을 보냅니다. 이때도 카드 화면과 테마 전환은 유지합니다. `dev`의 인증은 기존 [인증 실행 설정](../../docs/reference/desktop-auth-core.md#module-경계)을 사용합니다. UI 연결만으로 API, 실제 패스키, OS 저장소가 구성되지는 않습니다.

`pnpm --filter @dfragon/desktop auth:fixture:build` 후 `pnpm --filter @dfragon/desktop auth:fixture:smoke`는 새 카드 화면과 실제 coordinator, main/preload IPC의 로그인, 취소, renderer reload, 저장 완료 후 상태 반영, 로그아웃을 검증합니다. HTTP, 인증 창, 저장소는 합성 효과이며 실제 브라우저, 패스키 인증이나 앱 프로세스 재시작 후 저장소 복원 성공을 뜻하지 않습니다.

## Windows PC에서 소스로 실행

게임이 도는 Windows PC에 저장소를 받아 소스로 실행하면 빌드, 업로드, 다운로드 왕복 없이 수정을 바로 확인할 수 있습니다. 개발 실행도 캡처는 같은 Windows GDI 모듈, OCR과 검색은 같은 코드로 동작합니다. 패키징에서만 생기는 동작(asar, fuses, 관리자 권한 manifest, 포터블 압축 해제)은 아래 포터블 빌드나 PR의 Windows Test Build로 확인합니다.

1. Node.js 24와 저장소의 pnpm, Git, GitHub CLI를 준비하고 저장소를 받은 뒤 [파인튜닝 OCR 모델](#파인튜닝-ocr-모델로-빌드하기) 절의 submodule 명령을 한 번 실행합니다.
2. [피아노 사운드 패키지](#피아노-사운드-패키지) 절의 안내대로 사용자 npm 설정에 인증 템플릿을 한 번 등록하고, 비공개 package 읽기 토큰은 `NODE_AUTH_TOKEN` 환경변수로 넣은 뒤 `pnpm install --frozen-lockfile`을 실행합니다. 실제 토큰은 명령문이나 저장소에 적지 않고 PowerShell의 보안 입력으로 받습니다.
3. 검색만 실제 API로 확인하려면 `apps/desktop/.env`에 `DFRAGON_API_ORIGIN=<배포 API origin>` 한 줄만 둡니다. 로그인까지 보려면 [카드 화면 개발](#카드-화면-개발) 절의 `.env` 설정을 따릅니다. 개발 실행은 패키지가 아니므로 [테스트 버전 자료 수집](#테스트-버전-자료-수집)이 켜집니다.
4. `pnpm --filter @dfragon/desktop dev`를 실행하고 게임 창을 띄웁니다. 던파가 관리자 권한으로 실행 중이면 이 명령도 관리자 권한 PowerShell에서 실행합니다. 권한이 낮으면 게임 창이 활성일 때 Alt+R, Alt+Print Screen 단축키를 받지 못하고, 개발자 모드의 Print Screen 수집은 관리자 권한 필요로 거절됩니다. 패키지는 실행할 때 관리자 권한을 요청하도록 빌드되므로 이 차이가 없습니다. 소스를 고치면 renderer는 즉시, main은 다시 시작할 때 반영됩니다.

Mac에서 편집하려면 Windows PC에 OpenSSH 서버를 켜고 편집기의 원격 SSH 접속으로 같은 checkout을 열거나, branch를 push한 뒤 Windows PC에서 pull합니다. 두 PC가 같은 checkout을 동시에 고치지 않도록 한쪽에서만 편집합니다.

CI를 기다리지 않고 포터블을 만들려면 같은 PC에서 `pnpm --filter @dfragon/desktop build:win:test:portable`을 실행합니다. `apps/desktop/dist/test/DFragon-Test-<버전>-x64-portable.exe`가 생기며 버전은 `package.json`의 기본 버전, 채널은 PR 빌드와 같은 test 채널입니다. 개발 설치본은 `build:win:development`, 배포본은 [Windows 배포 빌드](#windows-배포-빌드) 절을 따릅니다.

## 파인튜닝 OCR 모델로 빌드하기

파인튜닝 모델은 공개 저장소 [dfragon-ocr-models](https://github.com/blahaj94/dfragon-ocr-models)의 루트 `model.onnx`, `characters.txt` 한 쌍으로 관리합니다. 부모 저장소는 `apps/desktop/models/finetuned` submodule에서 특정 커밋을 고정합니다. 모델 저장소에 파일을 올리는 것만으로 기존 빌드의 모델이 바뀌지는 않습니다.

처음 checkout할 때 실행합니다. Code Quality, Windows Test Build와 Windows Portable CI도 고정된 submodule 커밋을 가져옵니다.

```sh
git submodule update --init --recursive apps/desktop/models/finetuned
```

실제 모델을 업로드한 뒤 부모의 작업 브랜치에서 해당 커밋으로 갱신합니다. 빌드 중 최신 브랜치를 자동으로 가져오지 않습니다.

```sh
git -C apps/desktop/models/finetuned fetch origin
git -C apps/desktop/models/finetuned checkout <모델을-포함한-커밋-SHA>
```

[`ocr-model.config.mjs`](ocr-model.config.mjs)에는 `bundledOcrModel`, `fineTunedOcrModel` 두 설정이 있습니다. 실제 모델과 사전이 준비되면 마지막 줄 하나를 다음처럼 바꿉니다.

```js
export default fineTunedOcrModel
```

`fineTunedOcrModel`은 `models/finetuned/model.onnx`, `models/finetuned/characters.txt`를 사용합니다. 경로는 `apps/desktop` 기준이며 다른 로컬 모델을 사용하려면 해당 설정의 이름과 경로를 수정할 수 있습니다. 현재 scaffold에는 실제 모델이 없으므로 기본 선택은 `bundledOcrModel`입니다. 기본 vendor 파일과 고정 체크섬은 수정하지 않습니다.

```sh
# 파일과 모델 호환성만 먼저 확인
pnpm --filter @dfragon/desktop prepare:ocr-assets

# 선택한 모델을 포함해 앱 빌드
pnpm --filter @dfragon/desktop build

# 검증한 submodule 커밋과 모델 선택을 함께 PR에 포함
git add apps/desktop/models/finetuned apps/desktop/ocr-model.config.mjs
```

`dev`, `build:development`, `build:distribution`과 Windows 패키징도 같은 설정을 사용합니다. 모델이나 설정을 바꾸면 개발 프로세스를 다시 시작하거나 다시 빌드합니다. 일반 캡처와 개발자 평가에 같은 모델이 적용되며, 앱 화면에서 바꾸거나 서버에서 내려받는 기능은 아닙니다. submodule을 초기화하지 않았거나 선택한 커밋에 모델 파일이 없으면 빌드를 실패시키고 기본 모델로 대체하지 않습니다. 기본 모델로 돌아가려면 마지막 줄을 `export default bundledOcrModel`로 되돌립니다.

현재 PP-OCRv5 인식 경로와 호환되는 단일 ONNX 파일을 사용합니다. 가중치가 별도 external data 파일로 분리된 모델과 Paddle 학습 체크포인트는 이 설정에 직접 넣을 수 없습니다. 앱 입력은 float32 BGR `[1, 3, 48, 320]`, `[-1, 1]` 정규화입니다. 가변 너비 모델도 앱에서는 너비 320으로 실행합니다. 첫 출력은 float32 CTC `[1, steps, classes]`여야 합니다. 닉네임 크롭에 Otsu 반전 이진화를 적용하므로 해당 입력으로 학습, 평가한 모델을 사용합니다.

사전은 UTF-8, BOM 없이 한 줄에 한 문자이며 중복, 빈 행, 공백 문자를 넣지 않습니다. CRLF와 마지막 개행 한 개는 허용합니다. 학습할 때 사용한 사전 순서를 그대로 유지해야 합니다. CTC blank는 0번, 공백은 마지막 클래스로 앱이 추가하므로 출력 클래스 수는 사전 문자 수 + 2입니다. 문자 확장 모델은 확장된 ONNX와 사전을 함께 지정합니다.

준비 단계는 앱과 같은 [ONNX Runtime WASM의 추론 API](https://onnxruntime.ai/docs/api/js/interfaces/InferenceSession.html)로 `[1, 3, 48, 320]` 입력을 실행해 출력 형식과 사전 클래스 수를 검사합니다. 출력은 유한한 0~1의 softmax 확률이고 시점별 클래스 확률 합이 1이어야 하며, 합계 오차는 0.001까지 허용합니다. 런타임 디코더도 같은 조건을 검사하고 허용된 합계 오차만 보정합니다. logits에 softmax를 다시 적용하지 않습니다. 파일 누락이나 호환성 오류는 빌드 실패로 처리하며 기본 모델로 대체하지 않습니다. 이 검사가 실패하면 기존 public OCR 산출물을 지우지 않습니다. 인식 정확도와 같은 문자 수를 가진 사전의 순서 일치는 자동으로 보장하지 못하므로, 개발자 평가에서 실제 정답 이미지로 확인합니다.

`decodeCtcCandidates(data, steps, characters, candidateCount = 2)`는 네 번째 인자로 받은 개수까지 `{ rank, modelScore, nickname }`을 최종 모델 점수 내림차순으로 반환하며 `rank`는 1부터 시작합니다. 인자를 생략하면 최대 2개, `5`를 넘기면 최대 5개를 반환합니다. 개수는 양의 안전한 정수여야 하며 실제 후보가 부족하면 있는 만큼 반환합니다. 탐색 폭은 기본 32개이고, 더 많은 후보를 요청하면 그 개수로 늘어 계산량도 증가합니다. 후보 탐색은 제한된 prefix beam search이므로 전체 가능한 문자열의 정확한 상위 후보를 보장하지 않습니다. 남은 후보 각각은 그 문자열을 만드는 모든 CTC 경로의 확률을 합산해 다시 채점하며, `modelScore`는 이 합의 100배입니다. 실제 정답률이나 후보 사이의 상대 비율이 아니며, 반환한 후보 점수의 합을 100으로 맞추지 않습니다. `decodeCtc`는 같은 후보 목록의 첫 닉네임 문자열을 반환합니다. [디코딩 방식과 응답 호환성](../../docs/reference/desktop-character-search.md#ctc-후보와-모델-점수)을 참고합니다.

생성된 `src/frontend/public/ocr/provenance.json`에는 선택한 모델 이름과 실제 배포 파일의 SHA-256을 기록합니다. 사용자 모델을 기본 upstream revision으로 표시하거나 로컬 경로를 산출물에 넣지 않습니다. 기존 PaddleOCR와 ONNX Runtime 라이선스 고지는 유지합니다.

## 테스트 범위와 실행

`App*.test.tsx`는 현재 카드 화면의 로그인, 캡처, 개발 도구 연결을 확인합니다. `App.capture-controls.test.tsx`는 구버전 `PartyCapture` 조합의 버튼 연결 테스트이며, `integration/search-bridge.test.tsx`, `capture-search.test.tsx`, `logout-relogin.integration.test.tsx`는 `fixture/legacy/LegacyApp.tsx`의 검색 흐름을 검증합니다. 이 테스트의 검색 성공은 현재 카드 화면에 검색 결과가 연결됐다는 뜻이 아닙니다.

관련 Vitest 파일부터 실행한 뒤 변경 영향에 따라 Desktop 전체 검사를 선택합니다.

```sh
pnpm --filter @dfragon/desktop exec vitest run src/frontend/src/App.capture-modal.test.tsx
pnpm --filter @dfragon/desktop test
pnpm --filter @dfragon/desktop lint
pnpm --filter @dfragon/desktop format:check
pnpm --filter @dfragon/desktop build
```

`build`에는 node/web typecheck가 포함됩니다. Electron은 설치 단계에서 실행 파일을 내려받지 않으므로 `test`, `dev`, `start`가 먼저 `install-electron`으로 Electron runtime을 준비하며, 이미 받은 runtime은 다시 내려받지 않습니다. 의존성을 새로 설치한 뒤 `exec vitest run`으로 파일을 직접 실행하거나 VS Code 디버그 설정을 쓰려면 CI처럼 `pnpm --filter @dfragon/desktop exec install-electron`을 한 번 실행합니다. 인증 bridge를 실제 Electron에서 확인하려면 `auth:fixture:build` 후 `auth:fixture:smoke`를 사용합니다. Launcher 단위 테스트의 process, signal은 합성이며 실제 child 종료 확인과 구분합니다.

Desktop 관련 PR과 main push에서는 [Desktop Windows workflow](../../.github/workflows/desktop-windows.yml)가 Windows runner 두 대에서 `test`의 테스트 파일을 절반씩 나눠 실행하고, `test:windows-native`는 첫 번째 runner에서만 실행합니다. Runner의 실행 권한과 관측 범위는 [Windows synthetic native fixture](../../docs/reference/desktop-credential-store.md#windows-synthetic-native-fixture)를 따릅니다.

Vitest의 HTTP, credential 저장소, media, OCR worker mock과 합성 Electron fixture는 실제 Windows 캡처, DPI, 단축키, 패스키, OS credential 저장소의 검증을 대신하지 않습니다. Windows native/security, crash 도구의 기존 플랫폼, 격리 조건을 유지하며 VM 종료, 복원 등 파괴적 장애 실험은 별도 허용 범위에서만 실행합니다.

## 개발 빌드

```sh
pnpm --filter @dfragon/desktop dev:app
pnpm --filter @dfragon/desktop build:win:development
```

개발 설치본도 새 카드 화면을 사용하며 `dist/development`에 생성됩니다. 구버전 화면 조합은 `src/frontend/src/fixture/legacy/LegacyApp.tsx`에 격리하여 기존 검색, 인증, 캡처 회귀 테스트에서만 사용합니다. 기존 localhost HTTPS, `dfragon.dev` 등록값은 [개발 패키지 안내](../../docs/reference/desktop-auth-core.md#windows-localhost-개발-패키지)를 따릅니다. macOS, Linux용 기존 명령은 Windows MVP 배포 지원이나 검증 완료를 뜻하지 않습니다.

## 개발자 모드

설치한 앱의 **설정 → 개발자 모드 → 켜기 → 개발 도구 열기**에서 사용합니다. 로컬 크롭, 정답 기능은 로그인 없이 사용할 수 있으며 기본값은 꺼짐입니다. 로그인 상태에서 수집하면 OCR 자료실에도 전송합니다. 활성 상태는 다시 실행해도 유지됩니다. 작업 공간을 열면 일반 파티 캡처는 중지됩니다.

### 이미지 수집

1. Windows에서 던파를 창 모드 또는 전체 창 모드로 실행하고 파티 결성 화면에서 HP, MP가 가득 찬 파티 프레임을 표시합니다. 잔량이 줄어든 프레임의 검출은 지원 범위 밖입니다. 특정 client 해상도로 제한하지 않습니다. 메모리 보호를 위해 한 변 8192px, 총 33,000,000픽셀 이하의 영상을 처리합니다. 실행 중인 게임 창의 실제 영역과 화면의 파티 프레임을 읽으므로 설정 파일이나 UI 크기를 직접 입력할 필요가 없습니다.
2. **이미지 수집** 탭에서 네 닉네임 위치가 OCR 모델에 들어가는 모습을 확인합니다. 미리보기는 일반 캡처와 같은 이진화, 리사이즈, 가운데 정렬을 거친 320×48 모델 입력이며, 저장 파일은 원본 크롭 그대로입니다. 미리보기는 기본 0.5초마다 갱신되고 파일을 저장하지 않습니다. **캡처 주기**에서 0.25초, 0.5초, 0.75초, 1초를 선택할 수 있으며, 작업 공간 안에서 세 수집 탭이 같은 주기를 사용합니다. 번호는 화면 위치이며 1번이 항상 본인이라는 뜻은 아닙니다.
3. 저장할 위치의 체크박스를 선택합니다. 모두 기본 선택되며 수집하지 않을 위치는 해제할 수 있습니다. 빈 위치는 체크 여부와 관계없이 자동으로 건너뛰며, 선택한 위치 중 감지된 크롭만 저장합니다. 체크를 해제한 위치도 미리보기는 유지됩니다.
4. 게임을 전경에 두고 **Print Screen**을 누르면 그 순간의 선택된 크롭만 미작성 상태로 저장합니다. 선택이 없거나 게임, 파티 프레임을 확인하지 못하면 저장하지 않습니다. 정답 입력 탭이나 일반 화면으로 이동하거나 개발자 모드를 끄면 단축키 등록을 해제합니다.

Print Screen을 누르면 세 수집 탭 상단의 상태 영역에서 **캡처 중 → 로컬 저장 중 → 서버 업로드 중 → 서버 업로드 완료**를 확인할 수 있습니다. 진행 중에는 회전 표시와 경과 시간, 완료 시에는 확인 아이콘을 보여줍니다. 캡처 번호와 시작 시각으로 새 키 입력이 처리됐는지 구분할 수 있습니다. 5초 이상 걸리면 지연 안내를 표시하며 처리 중의 추가 키 입력은 저장하지 않습니다. 실패, 전송 제외는 별도로 표시하고, 로컬 저장만 끝난 상태를 서버 업로드 완료로 표시하지 않습니다.

Windows 배포 앱은 실행할 때 관리자 권한을 요청합니다. 개발 실행처럼 승격되지 않은 상태에서는 기존 권한 차이 안내를 유지하며 실행 중 자동 재시작하지 않습니다. Windows에서는 수집 탭이 열린 동안 네이티브 키보드 훅으로 게임 전경의 Print Screen만 처리합니다. 다른 앱이 전경이면 키 입력을 그대로 전달하며 전역 단축키를 독점 등록하지 않습니다.

### 파티원창 크롭

**파티원창 크롭** 탭은 이동 가능한 **파티참가인원 팝업**을 수집합니다. 게임에서 이 창을 열면 전체 창 미리보기의 빨간색 닉네임 경계와 1~4번 원본 크롭을 선택한 캡처 주기로 확인할 수 있습니다. 이미지 수집과 같은 client 크기 보호 한도를 적용하며, 위치, UI 배율을 자동 검출합니다.

참가자가 있는 행의 저장 포함 여부를 선택하고, 게임을 전경에 둔 채 **Print Screen**을 누릅니다. 그 순간 새 프레임에서 선택된 닉네임만 원본 크기로 저장합니다. 빈 행, 자물쇠는 제외하며 3번만 남아도 3번 번호를 유지합니다. 빈 행의 체크박스는 잠기고 이전 선택은 참가자가 돌아오면 복원됩니다. 이미지 수집과 선택 상태는 별도로 유지합니다. 팝업 미검출, 가림, 모호한 검출에서는 이전 크롭을 비우고 저장하지 않습니다. 저장 결과와 실패 안내는 작업 공간에서 확인하고 **정답 입력으로** 이동할 수 있습니다. 일부만 저장된 경우 성공 개수와 실패를 함께 표시합니다.

기준 헤더는 게임 UI의 네 열 제목, 배경, 구분선만 포함하며 참가자 정보는 포함하지 않습니다. 공통 함수와 관측 범위는 [파티참가인원 검출 조사](../../docs/reference/desktop-party-participants.md), 자산 출처는 [Desktop 고지](../../packages/licenses/notices/desktop/NOTICE.md)를 따릅니다. 이 작업의 macOS Electron UI, 합성/제공 이미지 검증은 Windows 실제 GDI, 단축키, DPI, 설치본 동작 확인을 대신하지 않습니다.

### 공대원창 크롭

**공대원창 크롭** 탭은 같은 모양의 **12행 공대 상세 창**을 수집합니다. 게임에서 창을 열면 전체 팝업과 닉네임 경계, 1~12번 원본 크롭을 선택한 캡처 주기로 보여줍니다. 실제 client 영역과 공통 검출 함수에서 창 위치, UI 배율을 자동으로 읽으며, client 크기 보호 한도는 기존 수집과 같습니다.

모든 행이 기본 선택되며 빈 행은 저장에서 제외하고 체크박스를 비활성화합니다. 참가자가 나가면 아래 행이 위로 당겨지므로 번호와 저장 선택은 현재 화면의 위치를 뜻합니다. 같은 캐릭터를 계속 추적하지 않습니다. 빈 행이 되기 전 선택은 유지하며 HUD, 파티원창, 공대원창의 선택은 서로 독립적입니다. **Print Screen**으로 새 프레임의 선택된 닉네임만 저장하고 기존 **정답 입력**에서 라벨과 OCR 평가를 이어갑니다. 검출 실패, 가림, 모호한 후보에서는 이전 미리보기를 비우고 저장하지 않습니다.

12행 창에 12명보다 적게 참가한 상태를 지원합니다. 별도 8인 레이드 레이아웃은 지원하지 않습니다. R/Y/G, 싱글과 장비 점수는 원본 팝업 안에 보이는 정보이며 별도 입력, 저장, 평가 항목으로 연결하지 않습니다. 기준 헤더에는 열 제목, 배경, 구분선만 포함합니다. [공대원창 검출 안내](../../docs/reference/desktop-raid-participants.md)에서 제공 이미지, 합성 배율, Windows 실제 검증의 범위를 확인할 수 있습니다.

### 정답 입력과 평가

회색 변환과 이진화는 [모델 저장소의 입력 조건](https://github.com/blahaj94/dfragon-ocr-models/blob/8119fccc132b46eb76a1565c0f981bc2a820bba1/README.md#입력-전처리와-기존-평가-조건) 중 추가 크롭 없는 Otsu 이진화 조건을 따릅니다. 이후의 가로 중앙 정렬은 현재 제품과 개발자 평가에 함께 적용하며 외부 학습 앱의 입력과 같다고 가정하지 않습니다. 회색 변환과 Otsu 출력은 OpenCV 4.12의 RGBA 변환 기준 사례와 대조했습니다. 이미지 디코딩과 리사이즈는 기존 브라우저 Canvas를 사용하므로 OpenCV PNG 디코더와 픽셀 단위로 완전히 같다는 보장은 아닙니다.

게임을 마친 뒤 **정답 입력** 탭에서 미입력, 완료, 제외 이미지들을 확인합니다. 썸네일을 선택해 원본을 확대하고 이미지마다 정답을 직접 입력합니다. 빈 입력은 저장할 수 없으며 저장에 성공한 뒤 다음 이미지로 이동합니다. 저장 응답을 기다리는 동안 다른 썸네일이나 필터를 선택하면 새 선택을 유지하며 자동으로 이동하지 않습니다. 건너뛰기는 정답을 변경하지 않습니다. 학습에 적합하지 않은 이미지는 삭제하지 않고 제외했다가 복원할 수 있습니다. 이미지나 탭을 바꾸어도 작업 공간 안의 미저장 입력은 유지됩니다. 저장 실패 시 입력은 사라지지 않습니다.

수집은 자동 OCR 평가를 실행하지 않습니다. 기존 PP-OCRv5 한국어 모델 평가는 별도로 실행합니다. **제품 전처리**는 실제 닉네임 OCR과 같은 BT.601 회색 변환과 Otsu 반전 이진화를 적용하고, **원본 입력**은 이 단계를 생략합니다. 두 옵션 모두 worker에서 높이 48px, 너비 `min(320, ceil(48 × 원본너비 / 원본높이))`로 리사이즈해 `[1, 3, 48, 320]` 입력을 만듭니다. 제품 전처리는 실제 글자 경계를 입력의 가로 중앙에 놓고 남는 좌우는 이진화한 배경과 같은 흰색(정규화 값 1)으로 채웁니다. 가장자리에 붙은 얇은 프레임 성분과 긴 선은 경계 계산에서 제외하지만 작은 구두점, 글자 크기와 세로 위치는 유지합니다. 원본 입력은 기존 왼쪽 정렬과 오른쪽 0 패딩을 유지합니다. 넓은 이미지는 전체 폭을 320px로 줄이며 블러와 상하 행 제거는 하지 않습니다. 원문과 제품용 닉네임 정리 결과를 따로 표시합니다. 채점은 저장된 정답과 모델 원문의 완전 일치율, Unicode code point 기준 문자 오류율(CER)이며 공백과 대소문자를 유지합니다. 미작성, 실패, 미평가 이미지는 점수에서 제외합니다. 이미지 읽기 실패는 해당 표본만 실패로 표시하지만, OCR worker 종료나 시간 초과는 실행 전체를 중단하고 남은 표본은 미평가로 둡니다. 새 평가를 실행하면 새 worker로 다시 시작합니다. 기존 데이터의 빈 문자열 정답은 미작성과 구분하며 완전 일치율에 포함합니다. 정답 문자 합계가 0이면 CER은 표시하지 않습니다.

개별 결과의 **모델 점수**는 1위 후보의 `modelScore`입니다. 모델 점수와 추론 시간은 실제 정답률과 별개이며, 모델 로딩과 이미지 읽기 시간은 추론 시간에 포함하지 않습니다. 기존 worker 응답의 `{ text, confidence }` 형식은 유지하되 `confidence` 필드에 1위 모델 점수를 전달합니다.

이미지와 라벨은 앱 `userData/developer-mode/samples/`의 PNG, JSON에 로컬 저장합니다. 모드를 꺼도 데이터는 보존되며, 모델 학습은 실행하지 않습니다.

앱에 로그인한 상태에서 HUD, 파티원창, 공대원창 탭의 Print Screen으로 저장하면 **게임 원본 PNG와 선택한 크롭 좌표**도 `https://ocr.dfragon.com`에 전송합니다. 자료실의 기존 허용 계정만 업로드할 수 있습니다. 정답은 자료실에서 별도로 입력하며 로컬 정답, OCR 예측은 전송하지 않습니다. 개발자 수집의 주기적 미리보기는 전송하지 않습니다. 일반 화면의 alpha 테스트 수집은 위의 별도 비로그인 경로를 사용합니다. 전송 중에는 다음 수집을 기다리며 실패해도 로컬 크롭은 유지합니다. 실패한 자료를 자동으로 다시 보내거나 로그인 후 이전 자료를 올리는 큐는 없습니다. 로그아웃, 화면 이탈은 진행 중 요청을 취소하지만 이미 서버에 저장된 자료를 삭제하지 않습니다. 공대원창 전송, 조회에는 `raid` 수집 종류를 지원하는 OCR 서버가 필요합니다.

원본 프레임은 main 메모리에만 있고 로컬에는 명시적으로 저장한 크롭 PNG만 만듭니다. 필터나 리사이즈를 저장 원본에 적용하지 않습니다. 평가 결과는 작업 공간을 닫으면 지워지며 다시 평가할 수 있습니다. PNG 입력 제한은 최대 16MiB, 한 변 8192px, 총 3300만 픽셀입니다. OCR 입력 텐서는 항상 48×320으로 제한합니다. 극단적으로 가로가 긴 이미지도 폭을 줄여 처리하지만, 글자가 작아져 정확도가 낮아질 수 있습니다.

프레임 장식에 따른 위치 차이는 각 HP, MP와 경계를 독립 검출해 처리합니다. 고정 간격으로 미검출 위치를 채우지 않습니다. 실제 FHD 표본의 12개 프레임과 Windows 최소 해상도에서 크롭을 확인했으며, 최대 길이 닉네임과 모든 장식, 배율 조합까지 검증한 것은 아닙니다. [파티 geometry 조사](../../docs/reference/desktop-party-geometry.md)에 실측 범위와 남은 확인을 기록합니다. Cropper의 기존 프로필, 전체화면 ROI 선택창, 기존 데이터 폴더 가져오기와 모델 학습은 포함하지 않습니다. Windows 실제 캡처, DPI, 단축키 검증과 macOS의 UI, 저장, OCR 검증을 구분합니다.

정답 입력 탭의 **OCR 자료실**을 선택하면 앱에 로그인한 자료실 소유자 계정으로 `ocr.dfragon.com`의 정답과 크롭을 조회합니다. 서버 정답, 제외 여부는 읽기 전용이며, 자료실 웹에서 수정 후 **자료실 다시 불러오기**를 누르면 반영됩니다. 로컬 자료로 돌아와도 작성 중인 정답 초안은 유지됩니다.

자료실 목록은 한 번에 50개씩 표시하며 이전, 다음 페이지로 이동합니다. 필터, 분할 변경이나 다시 불러오기는 첫 페이지부터 보여줍니다. 평가 대상은 표시 중인 페이지에 한정하지 않습니다.

평가 분할을 전체, test, val, train, 미배정 중 선택한 뒤 **정답 완료 자료 평가** 또는 **선택 이미지 평가**를 실행합니다. 자료실의 개별, 묶음 평가는 정답이 있고 제외하지 않은 자료만 사용하며 기존 원문 일치율, 문자 오류율과 전처리 비교를 제공합니다. 메타데이터는 조회 시점의 스냅샷이고 이미지는 필요할 때 읽습니다. 서버 정답, 이미지는 앱 디스크에 복제하지 않습니다. 현재 조회 한도는 10,000개, 메타데이터 8MiB, 이미지당 16MiB, 요청당 15초이며 한도를 넘는 목록을 일부 성공으로 표시하지 않습니다. 사용하려면 Desktop 조회 API가 포함된 OCR 서버와 앱 버전이 모두 필요합니다.
