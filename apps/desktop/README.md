# DFragon Desktop

던전앤파이터 캐릭터를 직접 검색하거나 게임 화면의 닉네임을 PaddleOCR로 읽어 검색하는 Windows 앱입니다. 로그인 없이 사용합니다. 던파 창이 하나면 자동으로 등록하고, **Alt+R**을 누를 때마다 한 프레임으로 네 파티 슬롯을 인식하고 검색합니다. 각 카드 중앙에 OCR부터 조회 완료까지 진행 상태를 표시합니다. OCR 첫 번째 이름만 검색하며 외형을 확인하지 못하면 최고 명성 후보를 대체 표시합니다. 서버와 닉네임은 항상 수정할 수 있고, 카드는 모험단, 길드, 이름, 직업, 명성과 장비 점수를 보입니다. 창은 파티 화면에서 1280×163, 공대 화면에서 1280×300으로 작게 열리고 화면을 바꿀 때 높이가 바뀝니다.

## 실행 중 오류 확인

앱에서 **Ctrl+Shift+I**를 누르면 Electron 기본 DevTools가 열립니다. **Console**의 `[DFragon ...]` 항목에서 캡처, OCR, 검색, 새 버전 확인과 화면 오류의 정제된 코드를 확인합니다. 최근 200개 기록을 현재 프로세스 메모리에만 유지하며 같은 오류가 연속되면 중복을 줄입니다. 앱을 종료하면 없어지고 파일로 저장하지 않습니다.

원문 오류, 닉네임, 토큰, 이미지, 외부 응답과 개인 경로는 이 진단 기록에 넣지 않습니다. 따라서 상세 stack 대신 실패 영역과 고정 코드를 확인하는 용도입니다. 앱이 종료되는 치명적 오류의 기록은 다음 실행으로 복구하지 않습니다.

‘닉네임을 읽지 못했습니다’ 원인을 확인할 수 있도록, OCR 첫 후보를 검색에 쓰지 못한 슬롯은 같은 Console에 `[DFragon ...] 슬롯 n의 OCR 첫 후보를 검색에 쓰지 못했습니다. 이유: …, 원문: "…"` 한 줄을 표시합니다. 이유는 후보 없음, 빈 문자열, 최대 길이 초과, 잘못된 Unicode 중 하나입니다. 원문은 앞뒤 공백이 보이도록 JSON 문자열로 표시하고, 후보가 없으면 `없음`으로 표시합니다. 이 줄은 화면 프로세스의 Console에만 남고 위 진단 기록과 파일에는 넣지 않습니다.

## 피아노 사운드 패키지

`@blahaj94/piano-sound`는 쓰는 코드가 없어 의존성에서 뺐습니다. 다시 쓰려면 GitHub Packages처럼 설치에 토큰이 필요한 registry 대신 npmjs 공개 배포나 저장소 안 tarball(`file:`)로 연결합니다. CI와 서버 이미지 빌드는 registry 토큰 없이 설치하며 `scripts/test/token-free-install.test.mjs`가 이를 검사합니다.

## 기존 배포본 설치와 사용

1. 배포받은 `DFragon-<버전>-x64-setup.exe`를 실행합니다. 현재 Windows 사용자용으로 `dfragon` 폴더에 설치하며 개발 앱 `DFragon Development`와 별도로 사용할 수 있습니다.
2. 시작 메뉴나 바탕화면의 **DFragon**을 실행하고 Windows 관리자 권한 요청을 승인합니다. Portable도 같은 권한을 요구합니다. Node.js, DB와 OCR 모델을 별도로 설치할 필요는 없으며 검색에는 인터넷과 배포 API 연결이 필요합니다.
3. 닉네임을 입력해 직접 검색하거나 게임을 **창 모드 또는 테두리 없는 창 모드**로 맞추고 HP, MP가 가득 찬 파티 프레임을 표시합니다. 앱 시작 시 던파 창이 하나면 자동으로 등록합니다. 상단 바의 게임 연결 상태 칩을 눌러 연 화면 캡처 창에서 직접 창을 선택할 때도 등록만 하며 인식은 시작하지 않습니다. 게임을 나중에 실행해도 기본 15초 간격으로 감지합니다. 후보가 여러 개면 직접 선택하며 화면 캡처 창의 **새로고침**으로 즉시 확인할 수 있습니다.
4. 창 등록 뒤 **Alt+R** 또는 상단 바의 캡처 버튼(카메라와 **Alt R**)으로 회차를 시작합니다. 캡처 버튼은 **Alt+R**과 같은 회차를 시작하며 **Alt+R**이 무시되는 동안에는 누를 수 없습니다. 이전 검색, 인식 상태를 비우고 검색을 준비한 뒤 프레임을 한 장만 읽어 네 슬롯을 처리합니다. 진행 중이나 완료 뒤 **Alt+R**을 다시 누르면 처음부터 새 회차를 시작하며 늦은 이전 결과는 반영하지 않습니다. 검색 수명을 시작하는 동안 누른 **Alt+R**은 무시합니다. 상단 바는 진행 중 **인식 중**, 완료 뒤 **인식 완료**, 게임 창이 가려졌거나 파티 프레임이 없어 안내 후 끝나면 **확인 필요**를 표시합니다. 한 번 조회한 결과는 파티원이 바뀌어도 유지하며 재시도와 수동 조회는 새 프레임을 읽지 않습니다. 서버와 닉네임은 언제든 수정하고 **Enter 또는 서버 변경**으로 해당 슬롯만 조회합니다. 외형 비교로 한 명을 확정하지 못하면 카드 위에 후보 창이 뜹니다. 얼굴을 한 번 누르면 그 후보로 미리보고, 다시 누르면 확정합니다. 후보 창을 닫으면 카드에 **후보 N** 칩이 남고 누르면 다시 열립니다.
5. 검색의 **공대** 화면에서는 **Alt+R** 또는 상단 바의 캡처 버튼이 공대 회차를 시작합니다. 게임에서 12행 공대 상세 창을 연 채로 누르면 공대원 이름을 화면 순서대로 1~12번 자리에 넣고 자리마다 조회합니다. 공대 상세 창에는 서버가 없어 같은 이름의 후보 중 명성이 가장 높은 캐릭터를 대체 표시하며, 서버와 이름은 카드에서 고쳐 다시 조회할 수 있습니다. 공대 회차는 파티 카드를 바꾸지 않습니다.
6. 캡처를 중지하면 슬롯 결과가 정리됩니다. 중지한 캡처는 **Alt+R**로 다시 시작하지 않으며, 화면 캡처 창에서 게임 창을 다시 선택한 다음 **Alt+R**을 눌러야 합니다. 창을 변경하면 이전 회차와 검색을 정리하고 새 창만 등록합니다. 캡처가 실패했을 때는 창을 다시 고르지 않고 **Alt+R**로 다시 시작할 수 있습니다. 종료할 때는 캡처를 중지하고 창의 X를 누릅니다.

해상도와 UI 배율을 고정하지 않고 HP, MP 프레임의 위치와 배율을 매번 검출합니다. 잔량이 줄어든 전투 화면과 폰트 변경은 검증하지 않았습니다. 검색이 실패하면 인터넷, 배포 API 상태를 확인하고 다시 시도합니다.

배포 앱은 시작할 때와 이후 6시간마다 GitHub Release 목록을 확인하고, 현재보다 높은 버전이 있으면 상단 바의 게임 연결 상태 칩 왼쪽에 **새 버전 v1.2.0**처럼 칩을 보이고, 칩을 누르면 **Release 열기**와 **닫기** 메뉴가 뜹니다. 정식 버전은 정식, beta는 beta와 정식, alpha는 alpha, beta, 정식 가운데 가장 높은 버전 하나를 알립니다. **닫기**를 누르면 앱을 다시 시작할 때까지 같은 버전을 다시 알리지 않습니다. 확인할 때 github.com에 IP와 User-Agent가 전달되며 언어 설정, cookie 같은 그 밖의 정보는 보내지 않습니다. 확인에 실패하면 화면에 표시하지 않고 진단 기록에 `UPDATE_CHECK_FAILED`를 남깁니다. test, development 채널과 소스 실행은 확인하지 않습니다. 기준은 [Desktop 새 버전 알림](../../docs/rules/desktop-update-proposal.md#1단계-새-버전-알림)에 있습니다.

자동 업데이트는 제공하지 않습니다. 이후 버전은 앱을 종료하고 새 설치 파일로 설치합니다. 기본 빌드는 코드 서명이 구성되지 않았으며 Windows에서 확인되지 않은 게시자로 표시될 수 있습니다. 배포자가 전달한 파일인지 확인해야 합니다.

## Windows 배포 빌드

현재 소스를 빌드하면 카드의 서버, 닉네임 수정이 포함됩니다. 네오플 캐릭터 이미지의 색 비교로 자동 식별하며 API의 candidates endpoint 배포가 필요합니다.

Node.js 26과 저장소의 pnpm을 준비한 Windows x64에서 저장소 루트 기준으로 실행합니다.

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

포터블은 설치 없이 실행하는 배포 형식입니다. Electron profile은 exe 옆이 아닌 기존 사용자 profile `appData/dfragon`을 쓰며 설치형과 공유합니다. 바로가기는 만들지 않습니다. 자동 업데이트와 코드 서명은 기존 배포본과 같습니다.

[Windows Portable workflow](../../.github/workflows/desktop-release.yml)는 Release를 게시하면 해당 태그의 소스로 빌드하여 포터블 exe와 SHA-256 checksum 파일을 Release의 Assets에 첨부하고, exe의 build provenance attestation을 기록합니다.

1. 저장소 **Settings → Environments → production**의 Environment variables에 `DFRAGON_DISTRIBUTION_API_ORIGIN`을 실제 배포 API의 HTTPS origin으로 설정합니다. production 환경은 main branch와 `v*` tag에서 시작한 실행만 쓸 수 있습니다. 공개 연결 주소만 입력하며 서버 credential은 넣지 않습니다.
2. 배포할 변경을 merge하고 해당 commit에 `v<버전>` 태그로 Release를 게시합니다. 예를 들어 첫 릴리스는 `v0.0.1`, 사전 릴리스는 `v0.0.1-beta.1`처럼 지정합니다. 태그의 버전을 실행 파일의 앱 metadata와 파일명에 사용하므로 `apps/desktop/package.json`의 기본 버전과 같을 필요는 없습니다. 태그가 가리키는 commit은 main에 포함되어야 하며, 아니면 빌드 전에 실패합니다. Workflow는 테스트 통과를 확인하지 않으므로 릴리스할 commit은 로컬에서 `pnpm verify`로 확인합니다. `v*` tag는 저장소 관리자만 만들 수 있고, 만든 뒤에는 저장소 ruleset `protected-release-tags`가 tag를 옮기거나 지우는 것을 막습니다. 잘못 만든 tag는 **Settings → Rules → Rulesets**에서 `protected-release-tags`를 잠시 비활성화하고 지운 뒤 다시 활성화합니다.
3. workflow가 성공하면 **Releases → Assets → `DFragon-<버전>-x64-portable.exe`**를 내려받습니다. 같은 이름 뒤에 `.sha256`이 붙은 파일에 exe의 SHA-256 값이 있습니다. `Source code` 압축 파일은 실행 파일이 아닙니다.

내려받은 exe는 PowerShell의 `Get-FileHash <파일> -Algorithm SHA256` 결과를 `.sha256` 파일의 값과 비교해 손상 여부를 확인합니다. 이 저장소의 Windows Portable workflow가 빌드한 파일인지는 GitHub CLI의 `gh attestation verify <파일> -R blahaj94/dfragon`으로 확인합니다. Checksum과 attestation은 코드 서명을 대신하지 않습니다.

기존 Release에 첨부하려면 **Actions → Windows Portable → Run workflow**에서 기존 `tag`를 입력합니다. `api_origin`은 production 환경 변수 대신 사용할 공개 API 주소이며 비우면 환경 변수를 사용합니다. 이 실행도 main branch나 `v*` tag에서 시작한 경우에만 production 환경을 쓸 수 있습니다. Release 게시와 같은 main 포함 확인을 적용합니다. 같은 이름의 exe나 checksum 첨부 파일이 이미 있으면 덮어쓰지 않고 실패합니다. 배포 API 설정 누락이나 `v<버전>` 형식이 아닌 태그도 빌드를 중단합니다. 로컬 `build:win:portable` 명령은 `package.json`의 기본 버전을 사용합니다.

PR 제목 scope가 `(build)`인 관련 PR에서는 [Windows Test Build workflow](../../.github/workflows/desktop-test-build.yml)가 test 채널로 포터블 exe를 빌드해 checksum과 함께 Actions artifact `windows-x64-portable-test`로 7일간 보관합니다. test 채널은 이름 DFragon Test, 실행 파일 `dfragon-test.exe`, 버전 `0.0.0-test.<실행 번호>`이며, 검색, 캡처, OCR을 확인하는 용도입니다. API는 항상 운영 API `https://api.dfragon.com`이며 빌드 변수로 바꾸지 않습니다. test 환경은 PR 실행마다 deployment 기록을 남기지 않습니다. 설치한 DFragon과 profile이 겹치지 않습니다. 패키징 시간을 줄이기 위해 7z 압축 수준을 낮추므로 exe가 Release 첨부 파일보다 크며, attestation은 기록하지 않습니다. **Actions → Windows Test Build → Run workflow**에서 branch를 고르면 PR 없이도 같은 빌드를 만듭니다. Windows PC의 PowerShell에서 GitHub에 로그인한 GitHub CLI로 내려받습니다. 실행 ID와 아래 명령은 workflow 실행 요약에 있습니다. 명령 프롬프트(cmd)에서는 `$HOME`이 펼쳐지지 않아 현재 폴더 아래에 `$HOME` 폴더가 생기므로, `-D`에 실제 폴더 경로를 적습니다.

```powershell
gh run download <실행 ID> --repo blahaj94/dfragon -n windows-x64-portable-test -D "$HOME\Downloads\dfragon-test-<실행 ID>"
```

명령은 성공해도 아무것도 출력하지 않습니다. `-D`로 지정한 폴더가 없으면 만들고 그 안에 `DFragon-Test-<버전>-x64-portable.exe`와 `.sha256` 파일을 풉니다. `-D`를 빼면 현재 폴더에 풀리므로, 관리자 권한 PowerShell처럼 시작 위치가 `C:\Windows\System32`인 셸에서는 파일이 그곳에 생깁니다. 같은 이름의 파일이 이미 있으면 덮어쓰지 않고 `file exists`로 실패하므로 실행마다 새 폴더를 씁니다. 손상 여부는 Release와 같은 방법으로 `Get-FileHash` 결과를 `.sha256` 파일의 값과 비교합니다.

패키징 성공과 실제 Windows에서의 앱 실행, API 동작 확인은 구분합니다.

설치본 main에는 공개 API origin과 `build/channels.json`의 distribution 항목에 있는 identity만 포함합니다. 실행 PC의 개발용 `DFRAGON_API_ORIGIN` 환경변수에 의존하지 않습니다. 서버 credential, Neople API key, 개인 certificate는 설치 파일에 넣지 않습니다. 패키징 대상은 `out`, `resources`, 앱 metadata와 production dependency이며 서버 설정 파일을 이 경로에 복사하지 않습니다. `onnxruntime-web`은 renderer가 번들하고 WASM은 `out`에 복사한 OCR 자산에서 읽으므로 설치된 패키지는 패키징에서 제외합니다.

| 채널           | 용도                                          | `build/channels.json` 항목 | 만드는 경로                                   |
| -------------- | --------------------------------------------- | -------------------------- | --------------------------------------------- |
| `distribution` | 사용자에게 배포하는 설치형, 포터블             | `distribution`             | `build:win`, `build:win:portable`, Release 첨부 |
| `development`  | 로컬 API를 바라보는 개발 설치본               | `development`              | `build:win:development`                       |
| `test`         | PR 실기 테스트용 포터블                       | `test`                     | Windows Test Build artifact, `build:win:test:portable` |

각 채널의 앱 이름, 실행 파일, identity, API origin 값은 이 표가 아니라 `build/channels.json`의 해당 항목에서 읽습니다. 값을 바꿀 때는 `build/channels.test.ts`의 고정값을 함께 고칩니다. identity를 바꾸면 설치된 사용자의 profile 경로가 바뀝니다.

배포 앱, 개발 앱, PR용 test 채널의 공개 값은 `build/channels.json`에 채널별로 모아 둡니다. 앱 이름, 실행 파일 이름, package 이름, 출력 폴더, NSIS include, identity와 API origin의 출처가 여기에 있으며 `build/channels.ts`가 빌드 시 형식과 공개 origin 조건을 검증합니다. 채널 빌드는 `appData/<identity>`를 profile로 쓰고 같은 채널은 한 인스턴스만 띄웁니다. 빌드가 이 파일에서 채널 하나의 identity와 origin을 main bundle에 넣고, packaging 설정은 `build/electron-builder-config.ts`가 이 파일로 만듭니다. 기본 진입 파일 `electron-builder.ts`는 `DFRAGON_CHANNEL` 환경변수로 채널을 고르고 비우면 배포 채널이며, `electron-builder.development.ts`와 `electron-builder.test-channel.ts`는 각각 개발, test 채널로 고정되어 Windows PowerShell에서 환경변수 없이 쓸 수 있습니다. `scripts/desktop-package-fuses.test.mjs`와 `build/electron-builder-config.test.ts`가 electron-builder가 읽는 설정과 이 파일의 일치를 검사합니다. Secret, credential은 이 파일에 넣지 않습니다.

NSIS는 protocol을 등록하지 않으며 다른 앱의 scheme 소유를 이유로 설치를 중단하지 않습니다. 설치와 제거 때 `build/legacy-protocol-cleanup.nsh`가 HKCU의 기존 채널 scheme 키를 확인하고, `shell\open\command`가 정확히 이 앱 실행 파일과 인자를 가리킬 때만 지웁니다. 다른 앱의 키는 보존합니다.

### 배포 API와 설치본 확인

배포 앱은 다른 PC가 접근할 수 있는 HTTPS API를 사용합니다. 운영 API는 `https://api.dfragon.com`이며 test 채널도 항상 이 주소를 씁니다(`build/channels.json`). 서버 설정은 [API 설정](../../docs/reference/api-start-development.md)을 따릅니다. localhost 개발 API나 예시 주소를 배포 서버로 취급하지 않습니다.

실제 배포 origin으로 빌드한 설치 앱에서 **직접 검색 → 지정한 게임 창 캡처 → OCR → 결과**를 확인합니다. 닉네임 수정 유지, OCR 복귀, 중지 후 정리도 같은 흐름에서 확인합니다. 빌드, unit test, 합성 데이터 UI 확인은 이 실제 확인을 대신하지 않습니다.

## 카드 화면 개발

검색까지 개발할 때는 `apps/desktop/.env.example`을 같은 폴더의 `.env`로 복사합니다. 템플릿의 검색 API `DFRAGON_API_ORIGIN`은 로컬 API를 가리킵니다. 실제 `.env`는 Git에서 제외됩니다. API는 [로컬 개발 명령](../../docs/reference/api-start-development.md#로컬-개발-명령)으로 먼저 실행합니다.

```sh
# 최초 한 번 복사하고 실제 개발 설정으로 수정합니다.
cp apps/desktop/.env.example apps/desktop/.env
pnpm --filter @dfragon/desktop dev
```

`dev`는 Electron 실행 파일이 없으면 먼저 내려받고, Node의 `--env-file-if-exists=.env`로 앱 폴더의 설정을 읽은 뒤 기존 Electron 개발 실행을 시작합니다. `.env`가 없어도 카드 화면을 실행할 수 있으며, 이미 설정된 process 환경변수가 우선합니다. 설정을 바꾸면 개발 명령을 종료하고 다시 실행합니다.

`pnpm --filter @dfragon/desktop dev`는 실제 앱 진입점의 새 카드 화면을 열고 소스 수정을 즉시 반영합니다. 샘플 데이터 없이 빈 슬롯 네 개로 시작하며 상단 바의 게임 연결 상태 칩을 눌러 창을 선택하면 main에 등록만 합니다. **Alt+R**이나 파티 머리의 캡처 버튼을 누르면 Windows GDI 모듈로 프레임 한 장을 읽고, 이 회차 프레임으로 닉네임, 얼굴 크롭, OCR과 검색을 처리합니다. OCR은 연속 관측을 기다리지 않고 첫 후보의 앞뒤 공백만 제거해 확정하며 두 번째 후보로 보정하지 않습니다. 처리를 마치면 추가 프레임을 읽지 않고 회차 결과를 유지하며 반복 인식과 인식 간격 설정은 제공하지 않습니다. 다른 창에 가려진 픽셀은 인식에서 제외합니다. 창 전체가 가려졌거나 최소화됐거나 파티 프레임을 검출하지 못하면 안내 후 회차 인식을 끝냅니다. 화면이 돌아와도 자동 재개하지 않으며 **Alt+R**이나 캡처 버튼을 다시 눌러야 합니다. 최소화된 창의 백그라운드 캡처는 지원하지 않습니다. OCR 식별 상태와 선택된 캐릭터의 기본 정보를 슬롯별로 표시하며, 같은 회차 프레임의 얼굴 크롭을 동명 후보의 네오플 캐릭터 이미지와 색으로 비교합니다. 비교로 한 명을 가르지 못하면 최고 명성 후보를 얼굴 확정과 구분해 표시합니다. 연결중 팝업 등으로 일부 슬롯만 검출되지 않으면 그 슬롯은 비워 두고 검색하지 않으며 다른 슬롯은 같은 프레임으로 처리합니다. 화면 캡처 창을 닫아도 캡처는 유지되며 별도 중지 버튼으로 정리합니다. 합성 데이터의 자동 식별 상태는 `pnpm --filter @dfragon/desktop dev:preview`로 확인합니다. 상태와 빌드 미리보기는 [디자인 이관 안내](../../docs/reference/desktop-mvp-design-handoff.md#renderer-미리보기)를 참고합니다.

## 장비 점수 엔진

카드의 장비 점수(버퍼는 버프 점수)는 비공개 엔진 저장소가 만든 네이티브 라이브러리를 main이 불러 계산합니다. 엔진이 없어도 빌드와 실행은 그대로 되고 카드의 점수 칸만 `-`입니다. 엔진 경계와 입력 변환은 [카드 전달과 점수 엔진](../../docs/reference/desktop-character-search.md#카드-전달과-점수-엔진)에 있습니다.

- **위치**: 패키지는 `resources/score/`를 asar 밖으로 푼 `app.asar.unpacked/resources/score/dnfscore.dll`만 엽니다. 개발 실행은 `DFRAGON_SCORE_LIBRARY`에 라이브러리의 절대 경로가 있으면 그 파일을, 없으면 앱 폴더 `resources/score/`의 플랫폼별 파일(`dnfscore.dll`, `libdnfscore.dylib`, `libdnfscore.so`)을 엽니다. 패키지는 이 환경변수를 읽지 않습니다.
- **개발 설정**: 엔진 저장소에서 직접 빌드한 라이브러리를 쓰려면 `apps/desktop/.env`에 `DFRAGON_SCORE_LIBRARY=<라이브러리 절대 경로>`를 두고 `dev`를 다시 시작합니다. 라이브러리는 첫 점수 계산 때 한 번만 엽니다.
- **자산 입수**: 엔진 바이너리는 OCR 모델과 같이 `@dfragon/models`의 `packages/models/score-engine` submodule이 고정한 커밋에 있습니다(현재 엔진 `native-v0.3.1`, 규칙 rev14). 비공개 저장소라 기본 checkout에서 빠지므로, 읽기 권한이 있으면 [받기](../../packages/models/README.md#받기)의 명령으로 한 번 받습니다. 그다음 `pnpm --filter @dfragon/desktop prepare:score-engine`이 플랫폼별 파일(`dnfscore.dll`, `libdnfscore.dylib`)을 `resources/score/`에 복사합니다. submodule을 받지 않았으면 건너뛰고, 복사한 폴더는 스스로 Git에서 제외합니다. 패키지는 Windows만 만듭니다.
- **CI**: Windows Test Build와 Windows Portable workflow가 build 전에 secret `DFRAGON_SCORE_ENGINE_TOKEN`으로 submodule을 받고 이 명령을 실행합니다. 토큰은 엔진 바이너리 저장소의 읽기 권한이 필요하며 저장소 소유자가 설정합니다. 포크 PR은 secret을 받지 못해 엔진 없이 빌드합니다. Windows Portable은 `--require`로 실행해 엔진을 두지 못하면 실패합니다.
- **근사값 표시**: 엔진이 장비 점수 계산을 건너뛰고 근사값을 내면 카드의 점수 칸에 `≈12,345`처럼 `≈`를 붙여 보이고, 보조 기술과 마우스 설명에 근사값이라는 뜻과 사유 종류, 근사 방법을 전합니다. 근사값은 공대 식별의 장비 점수 비교에 쓰지 않습니다.
- **실패 표시**: 파일이 없거나 열 수 없거나 계산, 결과 검증이 실패하면 점수만 null이고 카드의 다른 값은 그대로입니다. 진단 창에 엔진을 불러오지 못했거나 계산하지 못했다는 문구가 남고, 계산이 50ms를 넘으면 느린 계산 문구가 남습니다.

## Windows PC에서 소스로 실행

게임이 도는 Windows PC에 저장소를 받아 소스로 실행하면 빌드, 업로드, 다운로드 왕복 없이 수정을 바로 확인할 수 있습니다. 개발 실행도 캡처는 같은 Windows GDI 모듈, OCR과 검색은 같은 코드로 동작합니다. 패키징에서만 생기는 동작(asar, fuses, 관리자 권한 manifest, 포터블 압축 해제)은 아래 포터블 빌드나 PR의 Windows Test Build로 확인합니다.

1. Node.js 26과 저장소의 pnpm, Git, GitHub CLI를 준비하고 저장소를 받은 뒤 [`@dfragon/models` 받기](../../packages/models/README.md#받기)의 submodule 명령을 한 번 실행합니다.
2. `pnpm install --frozen-lockfile`로 의존성을 설치합니다. 패키지 registry 토큰은 필요하지 않습니다.
3. 검색만 실제 API로 확인하려면 `apps/desktop/.env`에 `DFRAGON_API_ORIGIN=<배포 API origin>` 한 줄만 둡니다.
4. `pnpm --filter @dfragon/desktop dev`를 실행하고 게임 창을 띄웁니다. 던파가 관리자 권한으로 실행 중이면 이 명령도 관리자 권한 PowerShell에서 실행합니다. 권한이 낮으면 게임 창이 활성일 때 Alt+R 단축키를 받지 못합니다. 패키지는 실행할 때 관리자 권한을 요청하도록 빌드되므로 이 차이가 없습니다. 소스를 고치면 renderer는 즉시, main은 다시 시작할 때 반영됩니다.

Mac에서 편집하려면 Windows PC에 OpenSSH 서버를 켜고 편집기의 원격 SSH 접속으로 같은 checkout을 열거나, branch를 push한 뒤 Windows PC에서 pull합니다. 두 PC가 같은 checkout을 동시에 고치지 않도록 한쪽에서만 편집합니다.

CI를 기다리지 않고 포터블을 만들려면 같은 PC에서 `pnpm --filter @dfragon/desktop build:win:test:portable`을 실행합니다. `apps/desktop/dist/test/DFragon-Test-<버전>-x64-portable.exe`가 생기며 버전은 `package.json`의 기본 버전, 채널은 PR 빌드와 같은 test 채널입니다. 개발 설치본은 `build:win:development`, 배포본은 [Windows 배포 빌드](#windows-배포-빌드) 절을 따릅니다.

## 파인튜닝 OCR 모델로 빌드하기

파인튜닝 모델은 공개 저장소 [dfragon-ocr-models](https://github.com/blahaj94/dfragon-ocr-models)의 루트 `model.onnx`, `characters.txt` 한 쌍으로 관리합니다. 부모 저장소는 `packages/models/ocr-finetuned` submodule에서 특정 커밋을 고정하고, workspace 패키지 `@dfragon/models`로 Desktop에 제공합니다. 모델 저장소에 파일을 올리는 것만으로 기존 빌드의 모델이 바뀌지는 않습니다.

처음 checkout할 때와 실제 모델을 업로드한 뒤 고정 커밋을 옮길 때의 submodule 명령은 [`@dfragon/models` 안내](../../packages/models/README.md#받기)를 따릅니다. Windows Test Build와 Windows Portable workflow도 고정된 submodule 커밋을 가져오며, 빌드 중 최신 브랜치를 자동으로 가져오지 않습니다.

[`ocr-model.config.mjs`](ocr-model.config.mjs)에는 `bundledOcrModel`, `fineTunedOcrModel` 두 설정이 있습니다. 마지막 줄 하나가 빌드에 넣을 모델을 정하며 현재 값은 다음과 같습니다.

```js
export default fineTunedOcrModel
```

`fineTunedOcrModel`은 `@dfragon/models/ocr-finetuned/model.onnx`, `@dfragon/models/ocr-finetuned/characters.txt`를 패키지 이름으로 찾아 사용합니다. 다른 로컬 모델을 사용하려면 해당 설정의 이름을 바꾸고 경로를 `apps/desktop` 기준 상대 경로나 절대 경로로 지정합니다. 현재 선택은 `fineTunedOcrModel`이고 submodule은 모델 저장소의 13에폭 모델 커밋을 고정합니다. 기본 vendor 파일과 고정 체크섬은 수정하지 않습니다.

```sh
# 파일과 모델 호환성만 먼저 확인
pnpm --filter @dfragon/desktop prepare:ocr-assets

# 선택한 모델을 포함해 앱 빌드
pnpm --filter @dfragon/desktop build

# 검증한 submodule 커밋과 모델 선택을 함께 PR에 포함
git add packages/models/ocr-finetuned apps/desktop/ocr-model.config.mjs
```

`dev`, `build:development`, `build:distribution`과 Windows 패키징도 같은 설정을 사용합니다. 모델이나 설정을 바꾸면 개발 프로세스를 다시 시작하거나 다시 빌드합니다. 일반 캡처와 개발자 평가에 같은 모델이 적용되며, 앱 화면에서 바꾸거나 서버에서 내려받는 기능은 아닙니다. submodule을 초기화하지 않았거나 선택한 커밋에 모델 파일이 없으면 빌드를 실패시키고 기본 모델로 대체하지 않습니다. 기본 모델로 돌아가려면 마지막 줄을 `export default bundledOcrModel`로 되돌립니다.

현재 PP-OCRv5 인식 경로와 호환되는 단일 ONNX 파일을 사용합니다. 가중치가 별도 external data 파일로 분리된 모델과 Paddle 학습 체크포인트는 이 설정에 직접 넣을 수 없습니다. 앱 입력은 float32 BGR `[1, 3, 48, 320]`, `[-1, 1]` 정규화입니다. 가변 너비 모델도 앱에서는 너비 320으로 실행합니다. 첫 출력은 float32 CTC `[1, steps, classes]`여야 합니다. 닉네임 크롭에 Otsu 반전 이진화를 적용하므로 해당 입력으로 학습, 평가한 모델을 사용합니다.

사전은 UTF-8, BOM 없이 한 줄에 한 문자이며 중복, 빈 행, 공백 문자를 넣지 않습니다. CRLF와 마지막 개행 한 개는 허용합니다. 학습할 때 사용한 사전 순서를 그대로 유지해야 합니다. CTC blank는 0번, 공백은 마지막 클래스로 앱이 추가하므로 출력 클래스 수는 사전 문자 수 + 2입니다. 문자 확장 모델은 확장된 ONNX와 사전을 함께 지정합니다.

준비 단계는 앱과 같은 [ONNX Runtime WASM의 추론 API](https://onnxruntime.ai/docs/api/js/interfaces/InferenceSession.html)로 `[1, 3, 48, 320]` 입력을 실행해 출력 형식과 사전 클래스 수를 검사합니다. 출력은 유한한 0~1의 softmax 확률이고 시점별 클래스 확률 합이 1이어야 하며, 합계 오차는 0.001까지 허용합니다. 런타임 디코더도 같은 조건을 검사하고 허용된 합계 오차만 보정합니다. logits에 softmax를 다시 적용하지 않습니다. 파일 누락이나 호환성 오류는 빌드 실패로 처리하며 기본 모델로 대체하지 않습니다. 이 검사가 실패하면 기존 public OCR 산출물을 지우지 않습니다. 인식 정확도와 같은 문자 수를 가진 사전의 순서 일치는 자동으로 보장하지 못하므로, 개발자 평가에서 실제 정답 이미지로 확인합니다.

OCR 후보 탐색과 `modelScore`의 의미는 [CTC 후보와 모델 점수](../../docs/reference/desktop-character-search.md#ctc-후보와-모델-점수)에 있습니다.

생성된 `src/frontend/public/ocr/provenance.json`에는 선택한 모델 이름과 실제 배포 파일의 SHA-256을 기록합니다. 사용자 모델을 기본 upstream revision으로 표시하거나 로컬 경로를 산출물에 넣지 않습니다. 기존 PaddleOCR와 ONNX Runtime 라이선스 고지는 유지합니다.

## 테스트 범위와 실행

`App*.test.tsx`는 현재 카드 화면의 캡처, 검색 연결을 확인합니다. `App.capture-controls.test.tsx`는 `PartyCapture` 섹션의 버튼 연결 테스트이며, `integration/search-bridge.test.tsx`, `capture-search.test.tsx`는 `ManualSearch`, `PartyCapture` 섹션을 띄워 검색 흐름을 검증합니다. 이 테스트의 검색 성공은 현재 카드 화면에 검색 결과가 연결됐다는 뜻이 아닙니다.

관련 Vitest 파일부터 실행한 뒤 변경 영향에 따라 Desktop 전체 검사를 선택합니다.

```sh
pnpm --filter @dfragon/desktop exec vitest run src/frontend/src/App.capture-modal.test.tsx
pnpm --filter @dfragon/desktop test
pnpm --filter @dfragon/desktop lint
pnpm --filter @dfragon/desktop format:check
pnpm --filter @dfragon/desktop build
```

`build`에는 node/web typecheck가 포함됩니다. Electron은 설치 단계에서 실행 파일을 내려받지 않으므로 `test`, `dev`가 먼저 `install-electron`으로 Electron runtime을 준비하며, 이미 받은 runtime은 다시 내려받지 않습니다. 의존성을 새로 설치한 뒤 `exec vitest run`으로 파일을 직접 실행하거나 VS Code 디버그 설정을 쓰려면 `pnpm --filter @dfragon/desktop exec install-electron`을 한 번 실행합니다.

GitHub Actions에는 Windows에서 Desktop 테스트를 실행하는 workflow가 없습니다.

Vitest의 HTTP, media, OCR worker mock과 합성 Electron fixture는 실제 Windows 캡처, DPI, 단축키의 검증을 대신하지 않습니다.

## 개발 빌드

```sh
pnpm --filter @dfragon/desktop build:win:development
```

개발 설치본도 새 카드 화면을 사용하며 `dist/development`에 생성됩니다. `dfragon.dev` identity와 로컬 HTTPS API(`https://localhost:3443`)를 씁니다.
