<img src="assets/brand/dfragon.png" width="96" height="96" alt="던삐삐" />

# 던삐삐

던전앤파이터 파티, 공대원의 캐릭터 정보를 게임 화면에서 바로 확인하는 Windows 앱입니다. 게임 화면의 닉네임을 읽어 검색하고, 카드마다 모험단, 길드, 직업, 명성과 장비 점수를 보여 줍니다. 로그인 없이 사용합니다.

## 내려받기

[dfragon.com](https://dfragon.com)이나 [최신 Release](https://github.com/dungeon-and-dragon/dfragon/releases/latest)에서 `DFragon-<버전>-x64-portable.exe`를 내려받습니다.

## 사용법

1. exe를 실행하고 Windows 관리자 권한 요청을 승인합니다.
2. 게임을 창 모드나 테두리 없는 창 모드로 두고 HP, MP가 가득 찬 파티 프레임을 표시합니다. 던파 창이 하나면 앱이 자동으로 등록합니다.
3. **Alt+R**이나 상단 바의 캡처 버튼을 누르면 파티원 네 명의 닉네임을 읽어 검색합니다. 검색의 **공대** 화면에서는 게임의 공대 상세 창에서 12명을 읽습니다.
4. 닉네임을 직접 입력해 검색할 수도 있습니다. 카드의 서버와 닉네임은 언제든 고쳐 다시 조회할 수 있습니다.

단축키, 후보 선택, 캡처 중지 같은 자세한 사용법은 [Desktop 안내의 기존 배포본 설치와 사용](apps/desktop/README.md#기존-배포본-설치와-사용)에 있습니다.

## 앱이 보내는 정보

- **캐릭터 검색**: 서버와 닉네임을 API(`api.dfragon.com`)에 보내고, API가 [Neople 오픈 API](https://developers.neople.co.kr)에서 조회합니다.
- **새 버전 확인**: 앱의 첫 실행, 이후 6시간마다 GitHub Release 목록을 확인합니다.
- **사용 통계**: 앱 실행, 캡처, 검색을 하면 Google Analytics 4에 이벤트를 보냅니다. 무작위 ID, 세션 ID, 앱 버전, 파티인지 공대인지만 수집합니다. 닉네임, 서버, 캐릭터, 이미지, OCR 결과는 수집하지 않습니다.

## 개발

pnpm workspace 모노레포입니다.

| 경로 | 내용 |
| --- | --- |
| [`apps/desktop`](apps/desktop/README.md) | Windows 앱(Electron) |
| [`apps/api`](apps/api/README.md) | Neople 오픈 API를 조회해 캐시하는 공개 캐릭터 API |
| [`apps/web`](apps/web/README.md) | 소개와 내려받기 사이트(dfragon.com) |
| [`packages/lib`](packages/lib/README.md) | API와 Desktop이 함께 쓰는 입력 규칙, 게임 UI 좌표, 픽셀 계산 |
| [`packages/ui`](packages/ui/README.md) | 디자인 토큰과 공용 컴포넌트 |
| [`packages/licenses`](packages/licenses/README.md) | 배포물에 넣는 오픈소스 고지 수집 |
| [`packages/models`](packages/models/README.md) | OCR 모델과 점수 엔진 submodule |

설치, 검증 명령과 작업 경계는 [AGENTS.md](AGENTS.md), 제품 계약과 결정 기록은 [문서 안내](docs/README.md)에서 시작합니다.

---

배포 앱에 포함된 오픈소스 고지의 위치는 [Desktop 안내의 Windows 배포 빌드](apps/desktop/README.md#windows-배포-빌드)에 있습니다.

<a href="https://developers.neople.co.kr"><img src="apps/web/src/assets/neople-open-api.png" width="191" height="36" alt="Neople 오픈 API" /></a>
