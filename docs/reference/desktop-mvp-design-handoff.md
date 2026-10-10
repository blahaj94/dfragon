---
type: reference
status: active
scope: desktop design sources and renderer implementation status
last-reviewed: 2026-10-10
---

# Desktop MVP 디자인 이관

Penpot 원본과 현재 Electron 구현 연결점을 설명한다. 확정 동작, 접근성, 완료 조건은 [Desktop MVP 카드 UI](../rules/desktop-mvp-ui.md)가 원본 계약이다. 이 안내의 합성 renderer 검증은 제품 검색, 상세 연결이나 Windows 검증의 완료를 뜻하지 않는다.

## 디자인 원본

| 용도                | Penpot 원본                     | 읽는 방법                                                                                                                                                                                                            |
| ------------------- | ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 메인 화면           | [메인 · 01 · 다크 · 대기][main] | 같은 페이지의 메인 02~05에서 캡처 중, 창 감지 실패, 서버 선택, 최소 창 1024×640을 확인한다.                                                                                                                          |
| 반응형 배치         | 없음                            | 900px, 700px, 500px, 300px 표본 보드는 2026-10-09에 지웠다. 새 시안은 기준 창 1280×800과 [최소 창 1024×640][minimum]이며, 좁은 폭의 배치는 [Desktop MVP 카드 UI](../rules/desktop-mvp-ui.md)의 반응형 계약을 따른다. |
| 메인 슬롯의 면 전환 | [CharacterCard 변형][faces]     | 면과 상태 변형 8개를 비교한다. 캐릭터 → 장비 → 서약 → 투자 현황 → 캐릭터. 슬롯마다 독립적이다.                                                                                                                       |
| 별도 상세창         | [상세 · 01 · 장비][detail]      | 같은 페이지의 상세 02~05에서 서약, 강화, 마법부여, 스킬트리를 한 장씩 확인한다.                                                                                                                                      |

위 링크는 편집 페이지 `01, 클라이언트 메인과 상세`의 보드다. 이 보드들은 2026-10-09에 1280×800 창 규격으로 다시 조립한 시안이며 아직 Rule에 반영하지 않았다. 시안과 Rule이 다르면 Rule을 따른다. 카드 280px, 상세창 1120×680처럼 Rule과 현재 구현의 근거가 된 재조립 전 `보관`으로 시작하는 보드와 `23, 이전 클라이언트 시안` 페이지는 2026-10-09에 지웠고, 지우기 전 상태는 Penpot 버전 기록 `페이지 4개와 보관 보드 삭제 전, 2026-10-09`에 있다. 라이트 테마 보드는 따로 두지 않으며 토큰 테마를 `Mode / Light`로 바꿔 확인한다. Penpot의 메인 카드 일부는 시연용 상세창 링크를 가지고 있으므로, 클릭 링크를 그대로 복제하기보다 면 전환과 상세 열기 액션을 구분한다. 프로토타입의 화면 이동은 실제 입력, API 호출, Electron 창 수명 구현을 대신하지 않는다.

Penpot 파일은 화면별 편집 페이지가 편집 기준이다. 페이지를 나누기 전 원본이던 `99, 전체 프로토타입과 원본` 페이지는 2026-10-09에 지웠고, 지우기 전 상태는 Penpot 버전 기록 `99 페이지 정리 전 원본, 2026-10-09`에 있다.

## 이후 기능의 디자인 인계

메인 카드, 캡처, 로그인, 설정, OCR 밖의 기능은 [dfragon-design](https://github.com/blahaj94/dfragon-design)이 인계 자료다. 스킬트리, 쿨타임, 캐릭터 검색과 상세, 모아보기, 패키지 효율, 캐릭터 기록, 아바타 피팅룸, 피아노방, 버프 계산기, 플레이 플래너, 성장 로드맵, 이벤트 보상, 미궁 지도의 14개다. 기능별 요구와 불변조건은 그 저장소의 `README.md`, `decisions.md`, `docs/screens/`에, 시안 요소와 SEED 컴포넌트의 대응은 `ui-mapping.md`에 있다. 14개 기능의 대상 앱은 모두 Desktop이다. dfragon-design의 결정에서 캐릭터 검색 화면은 상단 바의 검색 버튼으로 여는 별도 화면이다. 파티에 없는 캐릭터를 찾을 때 쓰고, 결과를 누르면 기존 상세 창을 연다. 첫 화면의 슬롯 카드와 [Desktop MVP 카드 UI](../rules/desktop-mvp-ui.md) 계약은 그대로이며, 검색 버튼을 제품에 넣을 때는 그 Rule의 변경으로 들여온다. 제품 계약의 원본은 이 저장소의 `docs/rules`이고 dfragon-design은 구현하지 않은 화면의 시안과 요구다. 캐릭터 검색과 상세처럼 두 곳에 모두 있는 주제는 [캐릭터 검색 계약](../rules/character-search.md), [캐릭터 상세 계약](../rules/character-details.md)이 우선하며, 시안에서 채택할 의미는 Rule 변경으로 들여온다.

색 토큰의 기준은 dfragon-design의 [색 체계](https://github.com/blahaj94/dfragon-design/blob/main/design/colors.md)와 같은 Penpot 파일의 토큰 테마 `Mode / Dark`, `Mode / Light`다. `apps/desktop/src/frontend/src/constants/theme.stylex.ts`의 `colors` 키는 의미 토큰 이름을 camelCase로 옮긴 것이고(`bg.brand.solid` → `bgBrandSolid`, `card.stripe` → `cardStripe`), 값은 SEED 팔레트 변수를 참조한다. 카드와 게임 색은 두 모드에서 같은 리터럴이다. 이전 키는 색 체계의 기존 이름 대응표를 기준으로 옮겼고, 보드가 대응표와 다르게 그린 곳은 보드를 따랐다. 카드 그리드 배경은 `bg.canvas`, Print Screen 키캡은 `bg.control`, 닉네임 경계와 범례는 `fg.danger`, 상세 창의 뒤 카드와 설정 내용 영역은 `bg.surface`, 수집 화면의 연결 상태는 `fg.success`와 `fg.warning`이다. 디자인 카드 세트에 없는 서버 메뉴의 hover, 선택 색과 카드 hover 테두리는 다크 값을 카드 토큰으로 두었다. 메인 컬러는 파랑이며 주황은 쓰지 않는다. SEED brand 토큰의 파랑 재매핑은 [앱 공통 StyleX](app-styling.md), 테마 적용 범위와 카드 토큰은 [Desktop 스타일 작성](desktop-styling.md#테마-상태)을 따른다. 새 화면에 필요한 색은 색 체계의 의미 토큰 이름과 값으로 `colors`에 추가한다.

## 데이터와 기존 구현 연결

검색은 [캐릭터 검색 계약](../rules/character-search.md), 상세는 [캐릭터 상세 계약](../rules/character-details.md)을 따른다. 공개 검색, 상세 조회를 로그인으로 막지 않는다. 상세 API의 캐시, 갱신, 오류 정책은 원본 계약을 참조하며 UI 문서에서 별도 정책을 만들지 않는다.

| 화면 데이터         | 연결 지점                                | 주의점                                                                                                 |
| ------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| 검색 후보, 서버, 명성 | `GET /characters`의 `rows`               | 응답은 식별자, 이름, 서버, 명성의 다섯 필드뿐이다. 모험단, 직업, 장비 정보가 있다고 가정하지 않는다.        |
| 기본 정보, 장착 정보 | `GET /characters/:serverId/:characterId` | 선택한 캐릭터의 상세를 연결한다. `character`, `equipment`, `avatar`, `creature`, `oath` 등을 소비한다. |
| 강화, 증폭           | 캐릭터에 실제 장착된 장비 값             | 공용 `itemDetail`의 값으로 덮어쓰지 않는다.                                                            |
| 서약 슬롯           | `oath.info`, `oath.crystal`의 `slotNo`   | 장비의 부위 ID와 별도로 명시적 대응을 둔다. 아래 표는 현재 디자인의 대응이다.                          |
| 마법부여            | 장착 데이터와 별도의 평가 기준 필요      | 상세 API는 종결, 준종결, 기타 판정 결과를 제공하는 계약이 아니다.                                        |
| 스킬                | `skillStyle` 및 `skillDetails`           | 데이터가 있다는 이유로 미설계 스킬트리 UI를 MVP에 추가하지 않는다.                                     |

| 서약 원본 | 대응 장비 부위 | 서약 원본        | 대응 장비 부위 |
| --------- | -------------- | ---------------- | -------------- |
| `info`    | 무기           | 결정 `slotNo: 0` | 머리어깨       |
| 결정 `1`  | 상의           | 결정 `2`         | 하의           |
| 결정 `3`  | 벨트           | 결정 `4`         | 신발           |
| 결정 `5`  | 보조장비       | 결정 `6`         | 귀걸이         |
| 결정 `7`  | 마법석         | 결정 `8`         | 팔찌           |
| 결정 `9`  | 목걸이         | 결정 `10`        | 반지           |

장비 배열 순서만으로 부위를 결정하지 않는다. 12부위 식별자는 `WEAPON`, `JACKET`, `SHOULDER`, `PANTS`, `WAIST`, `SHOES`, `AMULET`, `WRIST`, `RING`, `SUPPORT`, `MAGIC_STON`, `EARRING`이다. `MAGIC_STON`은 원본 식별자를 유지한다. 누락 슬롯, 누락 값, 이미지 실패는 실제 0이나 다른 아이템으로 채우지 않는다.

| 저장소 위치                                                                                      | 이어받을 책임                                          |
| ------------------------------------------------------------------------------------------------ | ------------------------------------------------------ |
| `apps/desktop/src/frontend/src/sections/SearchResults.tsx`, `components/CharacterCandidates.tsx` | 기존 슬롯, 후보 표시를 카드 화면으로 연결할 출발점      |
| `apps/desktop/src/frontend/src/hooks/useCharacterSearch.ts`                                      | 이름 수정, 제출, OCR 복귀, 슬롯별 검색 상태               |
| `apps/desktop/src/frontend/src/lib/capture-search.ts`, `search-connection.ts`                    | capture와 요청 수명, 순서, 취소, 늦은 응답 처리          |
| `apps/desktop/src/backend/search/`, `src/preload/common/types/search.ts`                         | main 검색 처리와 공유 IPC 계약                         |
| `apps/desktop/src/backend/main.ts`, `src/preload/index.ts`                                       | 새 상세 기능의 등록 지점. 기능 본문은 별도 모듈로 구성 |

상세 조회용 Desktop 연결과 별도 상세 BrowserWindow는 새 구현 범위다. 현재 검색 IPC가 이미 상세 조회까지 제공한다고 가정하지 않는다. Renderer에 Neople API key나 임의 URL 호출을 추가하지 않고, 기존 main/preload 경계와 runtime 검증을 따른다. 같은 캐릭터의 카드 면을 바꿀 때마다 새 HTTP 요청을 만들지 않도록 조회 데이터와 표시 상태를 분리한다.

레이아웃은 기존 React, TypeScript, StyleX와 `@dfragon/ui`, SEED를 사용한다. [Desktop 스타일 작성](desktop-styling.md), [Design System](../rules/design-system.md), [검색 구현 안내](desktop-character-search.md)의 공용 자산, 접근성, 캡처 수명을 유지한다. 화면 전용 조합은 Desktop 내부에서 시작하며 별도 디자인 시스템 구축을 선행하지 않는다.

## Typo 적용

[Typo 가이드 보드](https://design.penpot.app/#/view?file-id=d8ac01df-6646-81d2-8008-a69f349be8fc&page-id=61bb727b-6711-8058-8008-bdf0614c4172&section=interactions&frame-id=61bb727b-6711-8058-8008-bdf0660bcb50)의 10개 텍스트 자산과 React `typographyVariants`를 같은 규격으로 사용한다. 화면 크기와 문서 heading 단계는 분리하며, 예를 들어 화면 제목은 `Typo.h3 as="h1"`로 작성한다.

| 역할                           | variant                       |
| ------------------------------ | ----------------------------- |
| 로그인, 회원가입, 상세 화면 제목 | h3                            |
| 설정 본문 제목, 상세 지표       | h4                            |
| 모달, 카드 구역 제목            | h5                            |
| 작은 구역 제목                 | h6                            |
| 설명, 닉네임, 주요 버튼          | txtM (닉네임, 버튼 weight=700) |
| 목록, 고지 원문, 작은 버튼       | txtS (버튼 weight=700)        |
| 서버, 직업, 버전, 작은 투자 표    | caption                       |

화면에서는 직접 fontSize, lineHeight를 반복하지 않는다. 작은 카드 이름은 24px 행간과 26px input 외곽 높이를 사용하고, 빈 입력은 txtS로 표시한다. 닉네임과 보조 정보 사이의 공간을 함께 조정해 280px 카드 높이를 유지한다. h4–h6의 계약은 weight=600이며 Desktop이 번들한 Pretendard 가변 글꼴에서 실제 SemiBold로 표시된다. 인증 browser의 기존 글꼴 상속은 유지한다.

현재 적용은 제품 App이 사용하는 화면과 같은 컴포넌트를 쓰는 상세 미리보기까지다. `fixture/legacy`와 연결되지 않은 예전 화면의 일괄 교체는 포함하지 않는다. 실제 인증 UI는 Desktop의 예전 LoginPage가 아닌 `apps/accounts/browser/passkeys.tsx`이며, 이 entry에서도 같은 Typo를 소비한다.

## Renderer 미리보기

`src/frontend/src/pages/party/PartyPage.tsx`와 `pages/character-detail/CharacterDetailPage.tsx`가 `sections/CharacterCard.tsx`, `sections/DetailDeck.tsx`를 조합해 메인 카드와 상세 A안을 실제 renderer에서 실행한다. `src/frontend/src/fixture/mvp/`는 합성 데이터와 로컬 디자인 자산을 제공하는 별도 HTML 진입점이다. 기본 `dev`와 `dev:app`은 `App.tsx`의 새 카드 화면을 열고 소스 수정은 HMR로 반영한다. 기본 앱은 샘플 데이터 없이 빈 슬롯 네 개로 시작하며 테마 전환을 제공한다. 인증 설정이 있으면 상단 로그인 버튼은 전용 인증 창을 바로 열고, 설정이 없으면 버튼을 표시하지 않는다. 숨겨진 로딩 아이콘은 레이아웃 너비를 차지하지 않으며, 진행 시 글자는 오른쪽으로 사라지고 아이콘은 오른쪽에서 들어온다. 버튼은 최소 너비를 유지하면서 내용 너비 전환에 맞춰 줄어들고 취소, 실패 후 복귀한다. 진행 중에는 재클릭을 막고, 취소는 인증 창 닫기로 처리한다. 로그인 완료 시 버튼을 숨기며 계정 모달, 환영, 패스키 관리, 로그아웃 메뉴는 제공하지 않는다. 연결 조회 실패와 복원, 저장소 실패 시 로그인 버튼으로 조회 또는 복구를 재시도할 수 있다. 인증 여부나 연결 실패가 카드 화면을 제거하지 않는다. 카메라 버튼은 `CaptureControls` 모달을 열고, 선택한 창은 기존 `usePartyCapture`를 통해 즉시 캡처한다. 대상 변경 시 이전 프레임 읽기, OCR를 정리하고 새 창으로 전환한다. 모달 닫기는 캡처를 중지하지 않으며 로그인 상태와도 독립적이다. 안정화된 OCR 이름을 네 카드에 표시한다. 검색 결과, 이름 수정, 상세 카드의 실데이터 조합은 후속이며 이 단계의 이름 입력은 읽기 전용이다. 합성 미리보기는 `dev:preview`로 분리한다. 구버전 조합은 `fixture/legacy/LegacyApp.tsx`에 남겨 기존 기능 회귀 테스트에서만 사용한다.

```bash
pnpm --filter @dfragon/desktop dev
# 합성 데이터 상태, 상세, 캡처 모달 비교
pnpm --filter @dfragon/desktop dev:preview
```

상단 바의 카메라, 테마, 설정은 디자인 `IconButton`과 같은 40 정사각형에 24px Lucide 아이콘(`camera`, `sun` 또는 `moon`, `settings`)을 둡니다. 카메라는 `neutralWeak` 배경, 테마와 설정은 배경 없는 `ghost`입니다. 로그인은 SEED `medium` `neutralWeak` 버튼에 `Typo.txtM` 700 라벨입니다.

설정 대화상자는 디자인 대화상자 lg 크기 800 × 600, 반지름 12, `border.default` 1이고 머리 아래에 구분선을 둡니다. 폭 200의 메뉴는 높이 40의 `NavItem`이며 선택 항목은 `bg.brand.weak`입니다. 디자인 메뉴에 없는 `버전 정보`는 제품 기능이라 첫 메뉴로 유지합니다. 라이선스 목록은 디자인 표처럼 배경 없이 반지름 4의 행을 쌓고, 첫 행부터 한 줄 걸러 `bg.stripe`를 칠합니다. 디자인 표의 머리 행 대신 검색 입력과 구성 요소 개수를 두므로, 머리 행을 세는 디자인의 짝수 행이 여기서는 홀수 행입니다. 행은 이름(16/24)과 버전(12/18)의 두 줄에 위아래 여백 3을 둔 48이고, 버전이 없는 한 줄 행도 최소 높이 48입니다. 행 끝에는 24px `chevron-right`(`fg.subtle`)를 둡니다. 고지 상세 패널의 반지름은 12입니다. 개발자 모드는 SEED `Switch` 한 줄로 켜고 끄며, 켜진 동안에만 `개발 도구 열기`(medium brandSolid)를 표시합니다.

캡처 모달은 `@dfragon/ui` 대화상자에 디자인 대화상자 sm 폭 480, 반지름 12, `border.default` 1을 적용합니다. 상태는 SEED `Badge`(large, weak)에 `role="status"`로 표시하며 tone은 준비 중과 창 확인 중 neutral, 캡처 중 informative, 조회 실패 critical, 창 미감지 warning, 창 감지됨 positive입니다. 카메라 아이콘은 캡처 중에만 `fg.brand`입니다. 바닥에는 `닫기`(neutralWeak)와, 준비 중과 캡처 중에만 보이는 `캡처 중지`(brandSolid)를 이 순서로 둡니다. 디자인 화면 문서는 `캡처 중지`를 캡처 중에만 두지만, 창 등록을 기다리는 동안에도 중지할 수 있어야 해서 준비 중에도 표시합니다.

캡처 창 선택은 `CaptureSourceSelect`에서 Penpot의 다크, 라이트 트리거와 팝업을 구현합니다. SEED Menu의 방향키, 문자 탐색, Enter/Space, Escape, 포커스 복귀를 재사용하고, 창은 `menuitemradio`로 선택 여부를 알리며 목록 아래 새로고침은 별도 명령으로 처리합니다. 팝업 포털은 모달 안에 두어 모달의 접근성 숨김 대상이 되지 않게 합니다. 긴 창 이름은 말줄임과 전체 제목을 제공하고 목록은 화면 경계에 맞춰 배치, 스크롤됩니다. 기본 select는 캡처 UI에서 사용하지 않습니다. 트리거는 높이 40, 반지름 8, `bg.control`에 24px `monitor`와 `chevron-down`을 두고, 목록은 반지름 8에 32px 아이콘 타일과 16px 선택 `check`, 16px 새로고침 아이콘을 씁니다.

캐릭터 카드의 서버 선택도 기본 select 대신 `ServerSelect`를 사용합니다. SEED Select의 단일 선택, 키보드 탐색, 포커스 복귀에 카드 토큰의 작은 트리거와 `fg.brand` 다크 값의 선택 글자, 체크를 적용하고, 카드 밖 포털로 목록이 카드 경계에 잘리지 않게 합니다. 트리거는 높이 24(`size.control.xs`)에 16px `chevron-down`(`card.fgSubtle`)이고 값이 없으면 `서버`를 표시합니다. 목록은 디자인 `Menu`(폭 120, 안쪽 여백 4, 항목 간격 2, 반지름 8)와 `MenuItem`(높이 32, 좌우 여백 8, 반지름 4, `txtS`, 선택 항목은 700과 이름 옆 16px `check`) 규격을 SEED Select `medium` 위에 화면 범위 StyleX로 맞추며, 그룹 제목 없이 목록의 `aria-label`로 이름을 알립니다. 포인터 hover와 키보드 이동이 같은 강조 상태를 쓰므로 강조 항목에는 디자인의 hover 배경에 `border.focus` 1px 테두리를 더합니다. 카드와 서버 목록은 두 테마에서 어두운 색을 유지합니다. 컴포넌트는 전달받은 후보만 표시하며 현재 합성 미리보기의 서버 수정 상태와 제품의 입력 비활성 정책은 그대로 유지합니다. 실제 검색 결과 서버 연결은 기존 후속 범위입니다.

카드의 명성은 16px `user` 아이콘과 700 숫자로 표시하고, 화면 낭독기는 화면에서 숨긴 `명성` 글자와 함께 읽습니다. 지금 카드 높이 280에서는 모험단, 직업과 같은 `caption` 크기를 유지하며 디자인의 `txtS`는 카드 296 × 384 전환과 함께 적용합니다. 상세 버튼 반지름은 8, 카드 그리드 패널 반지름은 12입니다.

Mac에서도 `dev:preview`의 하단 **캡처 미리보기 상태**로 대기, 준비 중, 캡처 중, 창 미감지, 실패를 확인할 수 있다. 합성 창 선택은 UI 상태만 바꾸고 실제 media, OCR, IPC를 호출하지 않는다. 제품 UI에는 OS 분기를 추가하지 않으며 실제 캡처 권한은 기존 Windows main 정책이 검사한다.

빌드 결과를 확인할 때는 다음 명령을 사용한다.

```bash
pnpm --filter @dfragon/desktop mvp:build
pnpm --filter @dfragon/desktop ui:fixture mvp dark
```

합성 미리보기에서 창 크기를 900, 700, 500, 300px로 바꾸고 하단에서 상태 비교, 네 면 비교를 선택한다. 각 카드 본문은 독립적으로 순환하고 입력, 서버, 상세 버튼은 면을 넘기지 않는다. 합성 미리보기의 서버 셀렉트는 안톤, 바칼, 카인, 카시야스, 디레지에, 힐더, 프레이, 시로코를 표시하고 API `serverId`를 선택값으로 저장한다. 이름, 서버 수정은 API를 호출하지 않으며 이전 상세 열기를 막는다. 실제 검색 연결의 서버 후보는 검색 결과에 포함된 서버만 사용하는 계약을 유지한다. 실패, 검색 중, 0건, 빈 상태를 따로 표시한다.

우측 상단 상세 버튼은 격리 fixture의 별도 창을 연다. 같은 미리보기 대상은 이름 있는 창을 재사용하고 메인 fixture 종료 시 함께 닫는다. 이는 합성 화면 확인용 동작이며 제품 BrowserWindow 수명 정책의 결정이나 구현을 대신하지 않는다. 상세 카드는 180ms로 전환하고 모션 감소 설정에서는 이동을 생략한다. 작은 상세창에서는 가로 스크롤로 나머지 카드에 접근한다.

실제 검색 연결, 429 재시도와 OCR 복귀, 상세 API, main/preload, 제품 별도 창, Windows 실행은 후속이다. 제품 HTML의 현재 `img-src 'self' data:`는 원격 이미지를 차단한다. 미리보기는 로컬 자산을 사용하며, 실제 이미지 연결 시 [이미지 로딩 계약](../rules/desktop-mvp-ui.md#표현과-이미지)의 고정 origin 허용을 적용한다.

[main]: https://design.penpot.app/#/view?file-id=d8ac01df-6646-81d2-8008-a69f349be8fc&page-id=61bb727b-6711-8058-8008-bdec5680efc4&section=interactions&frame-id=f47e4ca8-7ec0-8075-8008-c267fa7f5c85
[minimum]: https://design.penpot.app/#/view?file-id=d8ac01df-6646-81d2-8008-a69f349be8fc&page-id=61bb727b-6711-8058-8008-bdec5680efc4&section=interactions&frame-id=f47e4ca8-7ec0-8075-8008-c26d789098c1
[faces]: https://design.penpot.app/#/view?file-id=d8ac01df-6646-81d2-8008-a69f349be8fc&page-id=61bb727b-6711-8058-8008-bdec5680efc4&section=interactions&frame-id=f47e4ca8-7ec0-8075-8008-c267c4c984ff
[detail]: https://design.penpot.app/#/view?file-id=d8ac01df-6646-81d2-8008-a69f349be8fc&page-id=61bb727b-6711-8058-8008-bdec5680efc4&section=interactions&frame-id=f47e4ca8-7ec0-8075-8008-c26ba452f760
