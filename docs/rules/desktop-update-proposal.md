---
type: rule
status: active
scope: apps/desktop new version notice for the Windows distribution channel; automatic update remains a proposal
last-reviewed: 2026-10-10
rationale: 코드 서명 없이 운영하는 동안 사용자가 새 버전을 놓치지 않게 하되, 서명 없는 자동 설치가 배포 경로 침해를 모든 사용자에게 퍼뜨리는 위험은 피한다.
evidence: "Issue #632 결정 항목(https://github.com/blahaj94/dfragon/issues/632)과 1단계 구현 결정 ; electron-updater 6.8.9 npm package, 저장소의 electron-builder 26.15.3, electron-builder 저장소 master branch(미배포) source와 SignPath Foundation 약관 확인(2026-10-10) ; GitHub releases.atom 응답 확인(2026-10-10)"
review-after: 설치형 배포 시작, 코드 서명 방식 결정, Release tag 규칙이나 GitHub feed 형식 변경, electron-updater나 electron-builder major 갱신 전
---

# Desktop 새 버전 알림과 업데이트 제안

[1단계: 새 버전 알림](#1단계-새-버전-알림)은 채택해 구현한 제품 계약이다. 자동 설치 선택지, [포터블에서 설치형으로 옮기기](#포터블에서-설치형으로-옮기기), [자동 설치를 고를 때 정할 것](#자동-설치를-고를-때-정할-것)은 채택 전 제안이며, 자동 설치를 정하는 PR에서 채택 범위를 다시 바꾼다. 앱은 아직 업데이트를 내려받거나 설치하지 않는다.

## 전제

- Release에는 포터블 exe만 첨부한다([Windows Portable workflow](../../.github/workflows/desktop-release.yml)). NSIS 설치형은 `build:win`으로 만들 수 있지만 Release에 첨부하지 않는다.
- 코드 서명을 하지 않는다. 유료 인증서를 쓸 예산이 없다(2026-10-10 결정). Release 파일의 무결성 근거는 SHA-256 checksum, build provenance attestation, `v*` tag ruleset과 production 환경 제한이다.
- Release tag는 `v<semver>`다. `-alpha`는 OCR 자료 수집 빌드, `-beta`는 사전 배포이고 suffix가 없으면 정식이다. 지금까지 게시한 Release는 모두 GitHub에서 Pre-release로 표시되어 있다.
- test, development 채널과 채널 없는 실행은 업데이트 대상이 아니다.

## 확인한 동작

npm에 배포된 electron-updater 6.8.9와 저장소의 electron-builder 26.15.3 기준이다. electron-builder 저장소 master branch에만 있는 미배포 동작은 따로 적는다.

- 자동 설치는 Windows에서 NSIS 설치본만 지원한다. electron-builder는 포터블 target의 update 정보 파일을 만들지 않는다(`NsisTarget`의 `isWriteUpdateInfo: !this.isPortable`).
- publish 설정이 있으면 `--publish never`로 빌드해도 앱 안의 `app-update.yml`과 dist의 update 정보 파일을 만든다. 지금은 `publish: null`이라 둘 다 만들지 않는다. NSIS와 포터블을 한 번에 빌드하면 같은 `win-unpacked`를 쓰므로 포터블에도 `app-update.yml`이 들어갈 수 있다. 포터블은 실행할 때 `PORTABLE_EXECUTABLE_DIR`, `PORTABLE_EXECUTABLE_FILE`, `PORTABLE_EXECUTABLE_APP_FILENAME` 환경변수를 설정하므로 앱이 이를 보고 업데이트를 끌 수 있다.
- 채널 파일: GitHub provider는 버전에서 채널을 추정하지 않고 publish 설정의 `channel` 값, 없으면 `latest`의 파일 하나만 만든다. updater는 prerelease tag의 Release에서 `alpha.yml`이나 `beta.yml`을 먼저 요청하고 없으면 같은 Release의 `latest.yml`로 넘어간다. 그래서 Release마다 `latest.yml` 하나로도 동작한다.
- 설치 파일 검증은 `app-update.yml`의 `publisherName`과 내려받은 설치 파일의 Authenticode 서명을 비교한다. 6.8.9는 서명하지 않아 `publisherName`이 없으면 경고 없이 검증을 건너뛴다. master에는 같은 경우에 경고를 남기고 electron-builder v28부터 검증 실패로 처리하겠다는 문구가 있다. 서명 없는 자동 설치는 그 버전 이후 별도 우회 코드가 필요하다.
- Release 선택: GitHub provider는 공개 저장소에서 토큰 없이 동작하고 GitHub REST API를 쓰지 않아 rate limit을 피한다. 현재 버전이 정식이면 `/releases/latest` 리다이렉트로 Pre-release가 아닌 최신 Release만 본다. 현재 버전에 `-alpha`나 `-beta`가 붙어 있으면 `allowPrerelease` 기본값이 true가 되어 `releases.atom`을 읽는다. alpha는 alpha, beta, 정식을 후보로 보고 beta는 beta와 정식을 본다.
- 6.8.9는 `releases.atom`의 게시 순서에서 처음 맞는 항목을 고른다. 그래서 더 높은 alpha 뒤에 낮은 정식 hotfix를 게시하면 그 hotfix가 먼저 걸리고, 현재보다 낮은 버전은 설치하지 않으므로 alpha 사용자가 더 높은 alpha를 받지 못할 수 있다. master는 semver로 가장 높은 후보를 고르도록 바뀌었다.
- 단계적 배포는 update 정보 파일의 `stagingPercentage`와 userData의 `.updaterId`로 정한다. 잘못된 버전을 되돌리려면 더 높은 버전을 배포한다.
- 사용자별 NSIS 설치는 권한 상승 없이 설치된다. 앱은 `requireAdministrator`로 실행하므로 업데이트 뒤 재실행할 때 UAC를 다시 묻는다.
- GitHub `releases.atom`은 인증 없이 받을 수 있고 최근 Release 10개를 게시 순서로 담는다. 항목마다 첫 link가 `/releases/tag/<tag>` 형식의 Release 페이지이고, Release note는 escape한 HTML로 들어 있다(2026-10-10, Release 12개 가운데 10개 확인).
- 서명 없는 파일의 SmartScreen 평판은 파일 hash마다 새로 쌓인다. 앱이 직접 내려받은 파일에는 Mark of the Web이 없어 SmartScreen 검사를 건너뛸 가능성이 크지만 실제로 확인하지 않았다.

## 선택지

| 선택지 | 서명 | 대상 | 위험 | 구현 비용 |
| --- | --- | --- | --- | --- |
| A. 새 버전 알림 | 필요 없음 | 포터블, 설치형 모두. 사용자가 Release에서 직접 받는다 | 지금과 같다. 사용자가 checksum과 attestation을 확인할 수 있다 | 작다 |
| B. 자동 설치, 서명 검증 생략 | 필요 없음 | 설치형만 | GitHub 계정이나 Release 첨부 권한이 침해되면 악성 파일이 모든 설치형 사용자에게 자동으로 퍼진다. v28 뒤 우회 코드가 필요하다 | 중간 |
| C. 자동 설치, attestation 검증 | 필요 없음 | 설치형만 | 설치 전에 이 저장소의 Release workflow가 만든 파일인지 확인하므로 B보다 침해 범위가 좁다 | 크다 |
| D. 무료 서명(SignPath Foundation) 뒤 자동 설치 | 무료, 조건부 | 설치형만 | electron-updater 기본 검증을 쓰고 SmartScreen 평판이 인증서로 쌓인다 | 신청과 라이선스, 정책 정비 |

C는 sigstore 검증 라이브러리를 main process에 넣고, 내려받은 설치 파일의 SHA-256으로 GitHub attestation을 받아 `.github/workflows/desktop-release.yml`과 `refs/tags/v*` identity를 확인한다. trust root 갱신, 오프라인일 때의 실패 처리와 의존성 크기를 함께 검토해야 한다.

D는 SignPath Foundation 약관의 다음 조건을 모두 맞춰야 하며, 게시자는 SignPath Foundation으로 표시된다.

- 모든 구성요소에 OSI 승인 라이선스를 적용하고 비공개 구성요소가 없어야 한다. 지금은 저장소에 라이선스 파일이 없다.
- 바이너리를 공개 저장소의 소스에서 검증 가능한 방식으로 자동 빌드해야 한다. 지금의 Release workflow와 attestation이 이 방향이지만 SignPath의 CI 연동은 따로 정해야 한다.
- 서명할 형태로 이미 Release되어 있어야 한다. NSIS 설치형은 아직 Release에 없다.
- 사용자가 지정하지 않은 시스템으로 데이터를 보내면 개인정보 정책을 설치 중에 보이고 그 기능을 끄는 설치 옵션을 둬야 한다. alpha 빌드의 OCR 자료 수집 업로드가 여기에 해당한다.
- 모든 구성원이 SignPath와 저장소에 MFA를 쓰고, Release마다 서명을 수동으로 승인하며, 홈페이지와 내려받기 페이지에 code signing policy를 게시해야 한다.

## 권장안

1단계로 A를 채택해 구현했다. 서명 없이도 지금의 신뢰 모델을 바꾸지 않고, 포터블 사용자도 새 버전을 알 수 있다. 자동 설치는 설치형 사용자가 생기고 필요가 분명해질 때 C 또는 D로 다시 정한다. B는 권장하지 않는다.

## 1단계: 새 버전 알림

- 대상: 배포 채널(`distribution`) 빌드만 확인한다. test, development 채널과 채널 없는 실행은 확인하지 않는다.
- 시점: 앱 시작 뒤 한 번, 이후 6시간마다 확인한다. 실패하면 다음 주기에 다시 시도한다.
- 방법: main process가 `https://github.com/blahaj94/dfragon/releases.atom`을 받아 각 항목의 tag를 semver로 해석한다. 토큰과 GitHub REST API를 쓰지 않는다. Release의 Pre-release 표시는 보지 않고 tag의 semver로 판단한다. 지금은 모든 Release가 Pre-release라 `/releases/latest`를 쓸 수 없다.
- 범위: feed에 없는 오래된 Release는 후보가 되지 않는다. 새 정식 Release 뒤에 다른 Release가 10개 넘게 게시되면 정식 버전 사용자는 그 정식 Release를 알림으로 받지 못한다.
- 후보: 현재 버전이 정식이면 정식, beta면 beta와 정식, alpha면 alpha, beta, 정식 중에서 현재보다 높고 semver로 가장 높은 버전 하나를 알린다. alpha, beta 사용자의 후보를 고르는 방식은 electron-updater 6.8.9의 게시 순서 규칙이 아니라 master의 semver 규칙과 같다. 정식 버전 사용자에게는 electron-updater가 Pre-release 표시를 기준으로 `/releases/latest`를 보는 것과 달리, 1단계 알림은 Pre-release 표시를 보지 않고 tag의 semver로 판단한다. `v<semver>` 형식이 아닌 tag와 alpha, beta가 아닌 suffix는 무시한다.
- 표시: 카드 화면 상단에 새 버전 한 줄과 **Release 열기** 버튼을 보인다. 버튼은 지금 알리는 tag의 `https://github.com/blahaj94/dfragon/releases/tag/<tag>` 주소만 `shell.openExternal`로 연다. 알림을 닫으면 앱을 다시 시작할 때까지 같은 버전을 다시 알리지 않는다. 알림 상태는 main process가 보관하므로 창을 다시 만들어도 유지된다.
- OCR 자료 수집: alpha 빌드에서 beta나 정식 버전을 알릴 때는 그 버전으로 옮기면 자료 수집이 꺼진다는 안내를 함께 보인다.
- 실패 처리: 네트워크, 파싱 실패는 화면에 보이지 않고 기존 진단 기록에 `UPDATE_CHECK_FAILED`만 남긴다. 확인에 실패해도 이전 알림은 유지한다. Release 페이지를 열지 못하면 `UPDATE_RELEASE_OPEN_FAILED`를 남긴다. 응답 크기와 대기 시간에 상한을 둔다.
- 개인정보: github.com에 IP와 User-Agent가 전달된다. 그 밖의 정보는 보내지 않는다. 언어 header는 사용자 설정 대신 고정값 `en-US`를 보내고, 나머지 header도 사용자와 관계없는 고정값이다(2026-10-10, Electron 44.7.0 session fetch의 요청 header 확인).
- 검증: atom 파싱, 후보 규칙, 주소 allowlist의 단위 테스트와 실제 Release 목록으로 확인한다.
- 구현: 확인 주기, 판정, IPC는 `apps/desktop/src/backend/update-notice/`, 화면은 `apps/desktop/src/frontend/src/components/UpdateNotice.tsx`에 있다.

## 포터블에서 설치형으로 옮기기

자동 설치를 고른 뒤의 전환 방법이다.

- 데이터: 설치형과 포터블은 같은 배포 identity와 사용자 profile(`appData/dfragon`)을 쓴다([Windows MVP 배포 구성](desktop-auth-platform.md#windows-mvp-배포-구성)). 설치형으로 바꿔도 설정과 로그인 정보가 이어진다. 단일 인스턴스 lock도 같은 profile 기준이라 둘을 동시에 실행할 수 없다.
- 첨부: 전환 기간에는 Release에 포터블과 설치형을 함께 첨부한다. 포터블은 설치 없이 쓰려는 사용자에게 계속 제공하되 자동 설치는 받지 못한다.
- 앱 안내: 포터블로 실행 중이면 `PORTABLE_EXECUTABLE_FILE`로 이를 알아보고 업데이트를 내려받지 않는다. 대신 1단계 알림 자리에 설치형으로 바꾸면 자동으로 업데이트된다는 안내와, 설치형이 첨부된 Release 페이지를 여는 버튼을 보인다. 버튼이 여는 주소는 1단계의 Release tag 페이지 제한을 그대로 따른다.
- 차이: 설치형은 OS 로그인 복귀 protocol을 등록하고 바로가기를 만든다. 포터블은 둘 다 하지 않는다.

## 자동 설치를 고를 때 정할 것

- GitHub provider 구성: 배포 채널의 electron-builder 설정에만 `publish: { provider: 'github', owner: 'blahaj94', repo: 'dfragon' }`를 둔다. test, development 채널에는 두지 않는다. `channel`은 지정하지 않고 Release마다 생기는 `latest.yml`을 쓴다.
- Release 첨부: setup.exe, `.blockmap`, `latest.yml`을 첨부하고 setup.exe를 checksum과 attestation 대상에 더한다.
- 게시 순서: 지금은 Release 게시가 빌드를 시작하므로 update 정보 파일이 올라가기 전에 잠시 404가 날 수 있다. draft로 만들고 첨부한 뒤 게시하는 흐름을 검토한다.
- 정식 채널: 정식 Release는 Pre-release 표시를 끄고 게시해야 정식 버전 사용자가 받는다.
- Release 순서: electron-updater 6.8.9를 쓰는 동안은 더 높은 alpha 뒤에 낮은 정식 hotfix를 게시하지 않거나, semver 규칙이 들어간 버전으로 올린다.
- OCR 수집: alpha 사용자가 더 높은 beta나 정식으로 올라가면 버전에서 `-alpha`가 빠져 자료 수집이 꺼진다.
- 관리자 권한: 다른 관리자 계정으로 승격해 실행하는 PC에서는 사용자별 설치 경로가 달라질 수 있어 확인이 필요하다.

## 바꾸지 않는 것

1단계 알림과 이 제안은 승인된 배포 identity, 복귀 주소, Release workflow를 바꾸지 않는다. 자동 설치를 고르기 전까지 앱은 Release 파일을 내려받거나 설치하지 않는다.
