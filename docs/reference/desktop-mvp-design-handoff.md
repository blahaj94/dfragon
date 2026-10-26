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
| 반응형 배치         | 없음                            | 기준 창 1280×800과 [최소 창 1024×640][minimum]이다. 좁은 폭의 배치는 [Desktop MVP 카드 UI](../rules/desktop-mvp-ui.md)의 반응형 계약을 따른다. |
| 메인 슬롯의 상태     | [CharacterCard 변형][faces]     | 상태 변형을 비교한다. 지금 카드는 캐릭터 면 하나이고 면 탭, 장비와 기타 면은 없다. 슬롯마다 독립적이다. |

위 링크는 편집 페이지 `01, 클라이언트 메인과 상세`의 보드다. 이 보드들은 1280×800 창 규격의 시안이다. 시안과 Rule이 다르면 Rule을 따른다. 라이트 테마 보드는 따로 두지 않으며 토큰 테마를 `Mode / Light`로 바꿔 확인한다. Penpot의 메인 카드 일부는 시연용 상세창 링크를 가지고 있지만 제품에는 상세 창이 없으므로 그 링크를 옮기지 않는다. 프로토타입의 화면 이동은 실제 입력, API 호출, Electron 창 수명 구현을 대신하지 않는다.

Penpot 파일은 화면별 편집 페이지가 편집 기준이다.

## 이후 기능의 디자인 인계

메인 카드, 캡처, OCR 밖의 기능은 [dfragon-design](https://github.com/blahaj94/dfragon-design)이 인계 자료다. 스킬트리, 쿨타임, 캐릭터 검색과 상세, 모아보기, 패키지 효율, 캐릭터 기록, 아바타 피팅룸, 피아노방, 버프 계산기, 플레이 플래너, 성장 로드맵, 이벤트 보상, 미궁 지도의 14개다. 기능별 요구와 불변조건은 그 저장소의 `README.md`, `decisions.md`, `docs/screens/`에, 시안 요소와 컴포넌트의 대응은 `ui-mapping.md`에 있다. 14개 기능의 대상 앱은 모두 Desktop이다. dfragon-design의 결정에서 캐릭터 검색 화면은 상단 바의 검색 버튼으로 여는 별도 화면이다. 파티에 없는 캐릭터를 찾을 때 쓰고, 결과를 누르면 기존 상세 창을 연다. 첫 화면의 슬롯 카드와 [Desktop MVP 카드 UI](../rules/desktop-mvp-ui.md) 계약은 그대로이며, 검색 버튼을 제품에 넣을 때는 그 Rule의 변경으로 들여온다. 제품 계약의 원본은 이 저장소의 `docs/rules`이고 dfragon-design은 구현하지 않은 화면의 시안과 요구다. 캐릭터 검색과 상세처럼 두 곳에 모두 있는 주제는 [캐릭터 검색 계약](../rules/character-search.md), [캐릭터 상세 계약](../rules/character-details.md)이 우선하며, 시안에서 채택할 의미는 Rule 변경으로 들여온다.

색 토큰의 기준은 dfragon-design의 [색 체계](https://github.com/blahaj94/dfragon-design/blob/main/design/colors.md)다. Desktop 화면은 `@dfragon/ui/tokens.stylex`의 `colors`를 쓰며, 키는 의미 토큰 이름을 camelCase로 옮긴 것이다(`card.stripe` → `cardStripe`). 카드와 게임 색은 두 모드에서 같은 값이다. 이전 키는 색 체계의 기존 이름 대응표를 기준으로 옮겼다. 카드 그리드 배경은 `bg.canvas`다. 새 화면에 필요한 색은 색 체계의 의미 토큰 이름과 값으로 `tokens.css`와 `tokens.stylex`에 추가한다.

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

Renderer에 Neople API key나 임의 URL 호출을 추가하지 않고, 기존 main/preload 경계와 runtime 검증을 따른다. 같은 캐릭터의 카드 면을 바꿀 때마다 새 HTTP 요청을 만들지 않도록 조회 데이터와 표시 상태를 분리한다.

레이아웃은 기존 React, TypeScript, StyleX와 `@dfragon/ui`를 사용한다. [Desktop 스타일 작성](desktop-styling.md), [Design System](../rules/design-system.md), [검색 구현 안내](desktop-character-search.md)의 공용 자산, 접근성, 캡처 수명을 유지한다. 화면 전용 조합은 Desktop 내부에서 시작하며 별도 디자인 시스템 구축을 선행하지 않는다.

## Typo 적용

[Typo 가이드 보드](https://design.penpot.app/#/view?file-id=d8ac01df-6646-81d2-8008-a69f349be8fc&page-id=61bb727b-6711-8058-8008-bdf0614c4172&section=interactions&frame-id=61bb727b-6711-8058-8008-bdf0660bcb50)의 10개 텍스트 자산과 React `typographyVariants`를 같은 규격으로 사용한다. 화면 크기와 문서 heading 단계는 분리하며, 예를 들어 화면 제목은 `Typo.h3 as="h1"`로 작성한다.

| 역할                           | variant                       |
| ------------------------------ | ----------------------------- |
| 모달, 카드 구역 제목            | h5                            |
| 작은 구역 제목                 | h6                            |
| 카드 이름 입력                 | h5 weight=700, 빈 입력은 h6   |
| 설명, 주요 버튼                | txtM (버튼 weight=700)        |
| 목록, 고지 원문, 작은 버튼, 직업 | txtS (버튼 weight=700)        |
| 서버, 모험단, 버전, 작은 투자 표 | caption                       |

화면에서는 직접 fontSize, lineHeight를 반복하지 않는다. 카드 이름은 32px input 외곽 높이를 쓴다. 명성, 장비 점수, 카드 번호 같은 숫자 값은 Typo 대신 Barlow Condensed 숫자 단계(dfragon-design typography.md의 `numeric.*`)를 따른다. 숫자 단계는 아직 토큰이 없어 카드 스타일에 크기를 적는다. h4–h6의 계약은 weight=600이며 Desktop이 번들한 마루미냐 한글은 굵기가 하나라 브라우저가 굵기를 합성한다. 인증 browser의 기존 글꼴 상속은 유지한다.

현재 적용은 제품 App이 사용하는 화면과 같은 컴포넌트를 쓰는 합성 미리보기까지다.

## Renderer 미리보기

`src/frontend/src/pages/party/PartyPage.tsx`가 `sections/CharacterCard.tsx`를 조합해 메인 카드를 실제 renderer에서 실행한다. `src/frontend/src/fixture/mvp/`는 합성 데이터와 로컬 디자인 자산을 제공하는 별도 HTML 진입점이다. 기본 `dev`와 `dev:app`은 `App.tsx`의 새 카드 화면을 열고 소스 수정은 HMR로 반영한다. 기본 앱은 샘플 데이터 없이 빈 슬롯 네 개로 시작하며 테마 전환을 제공한다. 상단 바의 게임 연결 상태 칩은 `CaptureControls` 모달을 열고, 선택한 창은 기존 `usePartyCapture`를 통해 main에 등록만 한다. 던파 창 하나 자동 감지도 등록만 하며 Alt+R이나 파티 머리의 캡처 버튼으로 회차를 시작한다. 대상 변경 시 이전 회차와 프레임 읽기, OCR, 검색 수명을 정리하고 새 창만 등록한다. 모달 닫기는 캡처를 중지하지 않는다. 회차 프레임 한 장의 OCR 첫 후보를 네 카드에 표시하며 연속 관측을 기다리지 않는다. 미검출 슬롯은 비워 두고, 프레임을 쓸 수 없으면 안내 후 다음 회차 시작을 기다린다. 처리를 마친 뒤에는 추가 프레임을 읽지 않고 회차 결과를 유지한다. 합성 미리보기는 `dev:preview`로 분리한다. 통합 테스트가 띄우는 `PartyCapture` 섹션의 캡처 시작 버튼도 Alt+R과 같은 회차 시작을 보내며 인식 간격 선택은 제공하지 않는다.

```bash
pnpm --filter @dfragon/desktop dev
# 합성 데이터 상태, 캡처 모달 비교
pnpm --filter @dfragon/desktop dev:preview
```

상단 바는 `components/TopBar.tsx`가 창 맨 위에 폭 전체, 높이 56으로 그리고 아래에 1px `border.default` 선을 둔다. dfragon-design [레이아웃 규격의 상단 바 구성](https://github.com/blahaj94/dfragon-design/blob/main/design/layout.md#상단-바-구성) 순서대로 로고(오른쪽 위를 자른 24px `brandLogo` 마크와 `Typo.h6` 700의 제품 이름), 구분선, 내비(`components/MainNav.tsx`), 게임 연결 상태, 구분선, 도구 버튼이다. 내비의 검색은 현재 항목 모양(오른쪽 위를 자른 `bg.inset` 면과 아래 2px `signal` 선)이고 `@dfragon/ui`의 `Menu` `RadioGroup`으로 파티와 공대를 고르며, 현재 하위 이름을 12px로 함께 보인다. 게임 연결 상태는 캡처 모달과 같은 `getCaptureControlState`의 이름과 tone을 `StatusChip` `size="md"`(높이 28, 오른쪽 위 자름)로 그리며 `role`을 주지 않는다. 모달이 열려 있으면 모달의 상태 칩이 같은 상태를 알리므로 두 번 읽히지 않게 하려는 것이다. 이 칩은 `components/CaptureControls.tsx`의 `DialogTrigger`가 감싼 native button이라 누르거나 Enter, Space로 캡처 대화상자를 열고, 접근 가능한 이름은 `화면 캡처, <상태 이름>`이다. 포커스 선은 칩의 자른 모서리에 가리지 않도록 버튼 바깥 2px에 그리고, 대화상자를 닫으면 Base UI가 포커스를 칩으로 돌린다. 푸터는 없고, 캡처 진행 상태는 이 칩과 캡처 대화상자가 보인다. 파티 머리는 진행 문구를 되풀이하지 않는다. 대화상자의 상태 칩과 안내 문구가 `role="status"`다. 대화상자를 닫은 동안에는 칩 옆 화면 밖 `role="status"` 영역이 같은 캡처 안내 문구를 알리고, 카드마다 있는 알림 영역이 슬롯의 인식, 검색 결과를 전한다. OS 창 버튼 자리를 뺀 상단 바 내용 폭이 900px 이하면 제품 이름을 container query로 숨긴다. 상태 칩은 캡처 대화상자를 여는 유일한 길이라 숨기지 않는다. Windows 최소 창 1024에서 내용 폭은 846px이고, 카메라, 로그인, 설정 버튼이 빠져 칩과 테마 버튼까지 들어간다. 개발자 작업 공간을 여는 동안은 내비와 상태 칩을 숨긴다.

상단 바의 테마 버튼은 `@dfragon/ui`의 `IconButton` `bar`(36 정사각형)에 20px 아이콘을 둔다. 테마는 다크에서 DFragon 아이콘 마름모 해, 라이트에서 `moon`이다. 상단 바에는 카메라 버튼, 키캡, 설정과 로그인 버튼을 두지 않는다. 캔버스 메인 보드대로 캡처 버튼은 파티 머리에 있다. Desktop 화면 아이콘은 `stroke-linecap="square"`, `stroke-linejoin="miter"`로 그린다.

파티 머리(`components/BoardHeader.tsx`, 공대 머리와 같은 컴포넌트)는 DFragon 디자인 캔버스 메인 보드의 배치다. 왼쪽은 `Typo.h4` 700 `파티`, 캐릭터를 찾은 자리 수(Barlow Condensed 28 700, 분모 `/4`는 `fg.subtle`), `role="status"` 안내(13px `fg.muted`)이고, 오른쪽은 간격 16으로 접기(`IconButton` `lg`), 마지막 캡처(`components/LastCaptureTime.tsx`), 스냅샷(`components/SnapshotToggle`, 켜고 끄는 `IconButton` `lg`), 캡처 버튼 순서다. `IconButton` `lg`는 `bg.inset` 면의 48 정사각형에 오른쪽 위를 자르고 포커스 선을 면 안쪽에 그린다. 마지막 캡처는 12px `fg.subtle` 라벨 아래 13px `fg.muted` 값이며 숫자는 Barlow Condensed 20 600이다. 값은 `usePartyCapture`의 `lastCompletedAt`(캡처 상태가 인식 완료에 들어간 시각, 창 변경과 중지 때 비움)을 `lib/elapsed-time.ts`로 `12초 전`처럼 바꾸고, 없으면 `-`다. 표시 값이 바뀌는 순간에만 다음 타이머를 걸어(초 단위 동안 1초, 분 이상은 그 단위가 바뀔 때) 이 요소만 다시 그리고, 완료 시각이 바뀌면 `key`로 새로 그려 그 순간부터 다시 잰다. 캡처 버튼(`components/CaptureButton.tsx`)은 `Button` `primary` `lg`(신호색 면, 오른쪽 위 자름)에 24px `camera`, 버튼 글자색 30%의 1.5 × 24 구분선, `Kbd` `surface="signal"`(버튼 글자색과 그 55% 외곽선) `Alt`, `R`을 14 간격으로 두고, 좌우 여백은 캔버스대로 14, 18이다. 접근 가능한 이름은 `파티 캡처, 단축키 Alt R`, `aria-keyshortcuts="Alt+R"`이다. 누르면 `usePartyCapture`의 `startRound`를 부르는데, Alt+R의 `desktopShortcut` 구독도 같은 함수를 불러 캡처 상태 machine에 같은 `START`를 보낸다. 버튼의 비활성 조건은 machine이 `START`를 받을 수 있는지(`canStartCapture`)와 같아 Alt+R이 무시되는 상태에서만 누를 수 없다. 왼쪽의 `role="status"` 안내에는 캡처 진행 문구를 넣지 않고 `useCharacterSearch`의 `detailNotice`(상세 정보 창을 열지 못함)만 넣는다. 공대 머리의 안내와 같은 자리, 같은 쓰임이다.

메인 창은 `titleBarStyle: 'hidden'`과 높이 56의 `titleBarOverlay`로 OS 창 버튼을 상단 바 안에 그린다. 플랫폼별 overlay 값은 `backend/window-chrome/title-bar-overlay.ts`가 정한다. 상단 바는 CSS `env(titlebar-area-x)`, `env(titlebar-area-width)`로 OS 버튼 자리를 비우고 높이는 `env(titlebar-area-height)`를 따른다. 끌기 영역은 상단 바 전체를 덮는 빈 요소 하나(`-webkit-app-region: drag`)이고, 버튼은 각자 감싼 요소에서 `no-drag`로 뺀다. Electron 44(Chromium 152)부터 app-region이 상속되므로 버튼 묶음에 `no-drag`를 두면 그 안에 그려지는 대화상자 positioner까지 `no-drag`가 된다. positioner는 닫혀 있어도 창 전체 크기라 끌기 영역이 모두 지워지므로, 대화상자를 여는 버튼은 trigger만 감싼다(`constants/window-chrome.style.ts`). 실제 끌기 영역은 압축하지 않은 앱을 `ELECTRON_DEBUG_DRAGGABLE_REGIONS=1 ELECTRON_ENABLE_LOGGING=1`로 실행하면 main 로그와 화면 표시로 확인할 수 있다. OS 창 버튼은 웹 내용 위에 고정되므로 `<main>`을 창 높이로 고정하고 상단 바 아래 내용만 스크롤한다. 캡처 대화상자는 `margin-top: env(titlebar-area-height)`로 창 버튼 띠 아래에서 가운데에 놓는다. Windows, Linux의 창 버튼 배경과 기호 색은 `hooks/useWindowChromeTheme.ts`가 테마를 바꿀 때 `window-chrome` IPC로 맞춘다. macOS는 신호등 버튼이 왼쪽에 오며 바 높이에 맞춰 세로 가운데에 놓이고, 색은 바꾸지 않는다.

캡처 모달(`components/CaptureControls.tsx`)은 DFragon 디자인 캔버스의 캡처 보드 값을 따릅니다. `DialogContent` 기본 크기 `sm`(폭 480)의 `bg.surface` 면에 공용 닫기 버튼과 여백을 쓰지 않고(`showCloseButton={false}`), 머리, 본문, 바닥이 각자 여백을 가집니다. 머리는 높이 64, 왼쪽 24, 오른쪽 16 여백에 `h2` 제목 `화면 캡처`(18 700, 대화상자의 접근 가능한 이름), 오른쪽 위를 자른 높이 24 `StatusChip` `role="status"`, `IconButton` `sm` 닫기(18px `x`)를 둡니다. 네 모서리에 12px 2px 꺾쇠를 두고 상태 칩과 같은 tone의 의미 토큰(neutral `border.strong`, success `fg.success`, signal `signal`, warning `fg.warning`, danger `fg.danger`)으로 칠하며, 인식 중에는 카드의 이름 수정 중 꺾쇠처럼 박자 두 번마다 바깥 4px에서 조여 듭니다. 대화상자는 테마를 따르는 면이라 카드 전용 `bracket.*` 대신 의미 토큰을 씁니다. 상단 바와 모달의 상태 칩은 `getCaptureControlState`가 정한 이름, tone, `busy`를 함께 씁니다. 준비 중과 창 확인 중 neutral, 인식 중 signal과 `busy`(점 세 개), 인식 완료 signal, 확인 필요와 창 미감지 warning, 창 등록이나 회차가 실패로 끝난 `failed` 단계의 `캡처 실패`와 조회 실패 danger, 창 감지됨 success입니다. 공대 화면은 `getRaidScreenCapture`가 넘긴 공대 회차 단계를 같은 함수로 바꾸므로 공대 회차 실패도 `캡처 실패`입니다. 캡처 안내 문구는 13px `fg.muted`로 trigger 아래에 두고, `확인 필요`(회차 프레임을 쓸 수 없어 끝난 회차)일 때 앞에 18px `!` 칸(오른쪽 위 자름, `fg.warning`과 그 16% 면, 이름 `주의`)을, `캡처 실패`일 때 같은 칸을 `fg.danger`, `bg.dangerWeak`(이름 `실패`)으로 둡니다. 상단 바 칩 옆에는 `shapes.srOnly`인 `role="status"` 영역이 같은 캡처 안내 문구를 담아, 대화상자를 닫은 동안의 문구 변화를 보조 기술에 알립니다. 대화상자가 열리면 Base UI가 바깥 내용을 가리므로 이 영역은 읽히지 않고 대화상자 안 안내만 알립니다. 바닥(위 20, 좌우와 아래 24 여백)에는 `닫기`(`Button` `secondary`를 `bg.control` 면으로 채움)와 `캡처 중지`(`Button` `primary`)를 이 순서로 두며, 창 등록을 기다리는 동안과 회차 진행 중, 완료 뒤에도 중지할 수 있습니다. 공용 대화상자, 버튼, 메뉴 항목이 이미 정한 속성과 같은 속성을 화면에서 다시 주면 어느 class가 이길지 StyleX 산출 순서에 달려 있으므로, 대화상자 여백은 개별 속성으로, 버튼과 목록 항목의 면은 배경 이미지로, 글자 크기와 색은 안쪽 글자에 줍니다.

창 고르기(`components/CaptureSourceSelect.tsx`)의 trigger는 높이 44, `bg.canvas` 면, 1px `border.default` 테두리, 15px 600 글자이고 펼치면 2px `signal` 테두리와 신호색 모니터 아이콘, 위로 뒤집힌 꺾쇠가 됩니다. 창을 고르기 전에는 `게임 창 선택`을 `fg.subtle` 500으로 보입니다. 목록은 `@dfragon/ui` `Menu`이고 그룹 이름 11px, 항목 최소 높이 40, 28px 아이콘 칸, 14px 700 창 이름, 현재 항목의 `bg.control` 면, 신호색 이름, 아이콘, 체크입니다. 던파 창이 없고 조회가 실패하지 않았으면 목록 맨 위에 13px 700 `fg.warning` `던전앤파이터 찾는 중`(`role="status"`)과 `StepDots` `size={5}`, 그 아래 2px `border.default` 홈에 `fg.warning` 진행 막대를 둡니다. 막대는 `constants/capture.ts`의 `CAPTURE_SOURCE_RETRY_INTERVAL_MS`(15초)를 주기로 왼쪽에서 차오르는 한 번짜리 애니메이션입니다. `useCaptureSources`는 조회가 끝날 때마다 새 목록 배열을 넘기고 그 직후 다음 자동 조회를 예약하므로, 상단 바에 늘 있는 `CaptureControls`가 목록 배열이 바뀐 시각을 단조 시계(`performance.now()`)로 기억하고, 목록을 연 순간까지 지난 시간만큼 음수 `animation-delay`로 앞당겨 실제 타이머와 같은 순간에 차게 합니다. 새 목록이 오면 시작 시각이 바뀌어 막대를 새로 그립니다. 동작 줄이기에서는 `animation-play-state: paused`로 연 순간의 위치에 멈춥니다. 조회 실패는 제목과 설명을 두고 진행 막대는 두지 않습니다. 창을 고르기 전 trigger 문구는 캔버스대로 `게임 창 선택`이고 접근 가능한 이름도 같은 말로 시작합니다. 목록 항목에는 캔버스대로 설명 줄을 두지 않습니다.

캡처 창 선택은 `CaptureSourceSelect`에서 Penpot의 다크, 라이트 트리거와 팝업을 구현합니다. `@dfragon/ui`의 `Menu`(Base UI)가 방향키, 문자 탐색, Enter/Space, Escape, 포커스 복귀를 맡고, 창은 `menuitemradio`로 선택 여부를 알리며 목록 아래 새로고침은 별도 명령으로 처리합니다. 팝업은 대화상자 면의 스크롤 영역에 잘리지 않도록 body 포털에 그리며, Base UI가 모달의 접근성 숨김 대상에서 제외합니다. 긴 창 이름은 말줄임과 전체 제목을 제공하고 목록은 화면 경계에 맞춰 배치, 스크롤됩니다. 기본 select는 캡처 UI에서 사용하지 않습니다. 트리거와 목록의 크기, 색은 위 캡처 모달 문단의 창 고르기 설명을 따릅니다.

캐릭터 카드의 서버 선택도 기본 select 대신 `ServerSelect`를 사용합니다. `@dfragon/ui`의 `Select`(Base UI)가 단일 선택, 키보드 탐색, 포커스 복귀를 맡고, 카드 밖 포털로 목록이 카드 경계에 잘리지 않게 합니다. 트리거는 공용 `xs` 칩(높이 24)이고 값이 없으면 `서버`를 표시합니다. 목록은 위쪽 2px 신호색 선, 오른쪽 아래 8 자름, 현재 항목 왼쪽 2px 표시의 공용 `Select` 규격을 따르며, 그룹 제목 없이 목록의 `aria-label`로 이름을 알립니다. 카드는 라이트 모드에서도 다크라서 트리거와 목록에 `surface="card"`를 넘겨 `card*` 토큰으로 그립니다. 컴포넌트는 전달받은 후보만 표시하며 현재 합성 미리보기의 서버 수정 상태와 제품의 입력 비활성 정책은 그대로 유지합니다.

카드는 `@dfragon/ui`의 `CardFrame`(`default`, `selected`, `failure`, `waiting`)으로 그립니다. 상태는 `lib/card-presentation.ts`의 `getCharacterCardFrameState`가 검색 상태와 이름 수정 여부로 정하고, 꺾쇠 색과 머리 오른쪽 표시(이름 수정 중 네모 점 3개, 실패 `!` 칸, 인식 대기 각진 모래시계)로 보입니다. 머리에는 오른쪽 위를 자른 카드 번호와 서버 칩을 둡니다. 그림 칸은 `shapes.gridWell`이고 실패도 격자 그대로입니다. 실패는 노란 꺾쇠, `!` 칸, 이름 입력 테두리(`bracketFailure`, `cardFailure`, `cardFailureWeak`)로 보입니다. 스냅샷에 없는 모험단 카드만 `SnapshotOverlay`(`shapes.alertHatch`)가 카드 전체를 덮습니다. 그 아래 모험단(`card.fgAdventure`)과 길드(`rarity.unique`), 이름 입력, 직업, `dl`로 묶은 명성과 장비 점수(`NumericText`, 400ms 증가)를 둡니다. 면 탭은 없습니다. 값이 없거나 null인 길드, 명성, 장비 점수는 `constants/cards.ts`의 `MISSING_VALUE`(`-`)로 그리고, 숫자 증가는 값이 있을 때만 씁니다. 제품에서는 길드가 상세 응답에서, 장비 점수가 main의 점수 엔진에서 옵니다. 카드 그리드는 패널 없이 콘텐츠 영역(네 변 여백 24)에 파티 머리 48과 간격 16 아래 4열, 거터 16으로 놓고 펼친 카드는 남은 높이를 채웁니다. 파티 머리의 접기를 누르면 그림 칸과 직업이 접히고 카드는 내용 높이만 차지합니다.

Mac에서도 `dev:preview`의 하단 **캡처 미리보기 상태**로 합성 캡처 상태를 확인할 수 있다. 합성 미리보기는 제품의 Alt+R 회차 실행 검증과 구분한다. 합성 창 선택은 UI 상태만 바꾸고 실제 media, OCR, IPC를 호출하지 않는다. 제품 UI에는 OS 분기를 추가하지 않으며 실제 캡처 권한은 기존 Windows main 정책이 검사한다.

빌드 결과를 확인할 때는 다음 명령을 사용한다.

```bash
pnpm --filter @dfragon/desktop mvp:build
pnpm --filter @dfragon/desktop ui:fixture mvp dark
```

합성 미리보기에서 창 크기를 1280 × 800, 최소 1024 × 640과 접은 높이(파티 400, 공대 560)로 바꾸고 하단에서 상태 비교, 자동 식별 상태를 선택한다. 이름 입력에 들어가면 그 카드가 이름 수정 중 상태가 된다. 합성 미리보기의 서버 셀렉트는 안톤, 바칼, 카인, 카시야스, 디레지에, 힐더, 프레이, 시로코를 표시하고 API `serverId`를 선택값으로 저장한다. 이름, 서버 수정은 API를 호출하지 않는다. 실제 검색 연결의 서버 후보는 검색 결과에 포함된 서버만 사용하는 계약을 유지한다. 실패, 검색 중, 0건, 빈 상태를 따로 표시한다.

공대 화면(`pages/raid/RaidPage.tsx`, `sections/RaidCard.tsx`)은 DFragon 디자인 캔버스의 `공대 화면, 12명` 보드 값이다. 머리는 파티 머리와 같은 `BoardHeader`(`공대`, 찾은 자리 수 `/12`, 접기, 마지막 캡처, 스냅샷 토글, 캡처 버튼)이고, 보드는 파티 라벨 열과 축약 카드 네 열, 세 줄이다. 축약 카드는 머리 36(번호 칩 20, 서버 칩, 상태 표시 20), 그림 칸 72, 모험단과 길드 11, 이름 18 700, 직업 12, 안내 줄, 명성과 점수 22 700 바닥이다. 합성 미리보기에서는 카드를 끌거나 Alt와 방향키로 자리를 맞바꿔 볼 수 있다. 자리 배치는 `hooks/useRaidCapture.ts`가 소유하고 순수 함수는 `lib/raid-seats.ts`에 있다.

하단 **미리보기 상태**의 `상위, 랭커 단계`는 기본, 상위, 랭커 카드와 빈 카드를 나란히 보인다. 상위, 랭커는 `CardCharacter.tier`를 채운 합성 데이터이고, `getCharacterCardFrameState`가 조회를 마친 카드에만 `CardFrame`의 `top`, `ranker`를 고른다. 빛줄기와 랭커 스캔선은 `CardFrame`이 그리고, 번호 칩, 숫자 값, 그림 칸 아래 2px 선은 `CharacterCard.style.ts`의 단계 스타일이 그린다. 상단 내비에서 공대를 고르면 `pages/raid/RaidPage.tsx`가 합성 공대원 11명과 빈 자리 하나를 축약 카드 `RaidCard` 12장으로 보인다. 공대 카드의 단계 표현은 `RaidCard.style.ts`가 같은 토큰으로 그린다. 하단 **미리보기 상태**의 `점수 라벨, 역할 비교`는 딜러, 버퍼, 역할을 모르는 카드와 상위 단계 버퍼를 나란히 보여 점수 라벨(`장비 점수`, `버프 점수`)과 색(`scoreDealer`, `scoreBuffer`, 단계 색 우선)을 확인한다. 점수의 라벨과 색 톤은 `lib/card-score.ts`의 `toScoreView`가 카드 값의 역할로 한 번 정하고, 파티 카드와 공대 카드가 그 값을 그린다. 열한 번째 공대원은 길드와 장비 점수가 없어 `-`를 보인다. 제품 `App.tsx`의 공대 화면은 `hooks/useRaidSearch.ts`로 자리별 서버, 이름 조회를 연결하고, 파티를 보는 동안에도 공대 카드를 숨기기만 해 입력과 결과를 유지한다.

**미리보기 상태**의 `모험단 순번 스냅샷`은 서로 다른 모험단 네 명을 파티에 보인다. 스냅샷을 켠 뒤 캡처 버튼을 누르면 다음 회차(`fixture.ts`의 `snapshotPreviewPartyRounds`)로 바뀌어 1번과 2번의 자리가 바뀌고, 3번은 같은 모험단의 다른 캐릭터가 들어와 칩이 없고, 4번은 스냅샷에 없는 모험단이라 빨간 빗금이 덮이며, 한 번 더 누르면 처음 회차로 돌아온다. 스냅샷을 켜면 파티와 공대 머리의 인원수 뒤에 `#1`이 보이고 캡처 버튼을 누를 때마다 `#2`, `#3`으로 오른다(파티와 공대가 따로 센다). 공대는 공대원마다 다른 모험단이며(`snapshotPreviewRaidRounds`), 카드를 맞바꾸면 순번 칩이 생기고 캡처 버튼을 누르면 빈 11번 자리에 스냅샷에 없는 모험단이 들어온다.

미리보기 HTML의 `img-src 'self' data:`는 원격 이미지를 차단하므로 미리보기는 로컬 자산을 사용한다. 제품 HTML은 [이미지 로딩 계약](../rules/desktop-mvp-ui.md#표현과-이미지)의 고정 origin을 허용한다.

[main]: https://design.penpot.app/#/view?file-id=d8ac01df-6646-81d2-8008-a69f349be8fc&page-id=61bb727b-6711-8058-8008-bdec5680efc4&section=interactions&frame-id=f47e4ca8-7ec0-8075-8008-c267fa7f5c85
[minimum]: https://design.penpot.app/#/view?file-id=d8ac01df-6646-81d2-8008-a69f349be8fc&page-id=61bb727b-6711-8058-8008-bdec5680efc4&section=interactions&frame-id=f47e4ca8-7ec0-8075-8008-c26d789098c1
[faces]: https://design.penpot.app/#/view?file-id=d8ac01df-6646-81d2-8008-a69f349be8fc&page-id=61bb727b-6711-8058-8008-bdec5680efc4&section=interactions&frame-id=f47e4ca8-7ec0-8075-8008-c267c4c984ff
