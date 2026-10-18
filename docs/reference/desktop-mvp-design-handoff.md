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
| 메인 슬롯의 면 전환 | [CharacterCard 변형][faces]     | 면과 상태 변형 8개를 비교한다. 면은 캐릭터, 장비, 서약, 투자 현황이며 지금은 카드 아래 면 탭으로 고른다. 슬롯마다 독립적이다.                                                                                         |
| 별도 상세창         | [상세 · 01 · 장비][detail]      | 같은 페이지의 상세 02~05에서 서약, 강화, 마법부여, 스킬트리를 한 장씩 확인한다.                                                                                                                                      |

위 링크는 편집 페이지 `01, 클라이언트 메인과 상세`의 보드다. 이 보드들은 2026-10-09에 1280×800 창 규격으로 다시 조립한 시안이며 아직 Rule에 반영하지 않았다. 시안과 Rule이 다르면 Rule을 따른다. 카드 280px, 상세창 1120×680처럼 Rule과 현재 구현의 근거가 된 재조립 전 `보관`으로 시작하는 보드와 `23, 이전 클라이언트 시안` 페이지는 2026-10-09에 지웠고, 지우기 전 상태는 Penpot 버전 기록 `페이지 4개와 보관 보드 삭제 전, 2026-10-09`에 있다. 라이트 테마 보드는 따로 두지 않으며 토큰 테마를 `Mode / Light`로 바꿔 확인한다. Penpot의 메인 카드 일부는 시연용 상세창 링크를 가지고 있으므로, 클릭 링크를 그대로 복제하기보다 면 전환과 상세 열기 액션을 구분한다. 프로토타입의 화면 이동은 실제 입력, API 호출, Electron 창 수명 구현을 대신하지 않는다.

Penpot 파일은 화면별 편집 페이지가 편집 기준이다. 페이지를 나누기 전 원본이던 `99, 전체 프로토타입과 원본` 페이지는 2026-10-09에 지웠고, 지우기 전 상태는 Penpot 버전 기록 `99 페이지 정리 전 원본, 2026-10-09`에 있다.

## 이후 기능의 디자인 인계

메인 카드, 캡처, 로그인, 설정, OCR 밖의 기능은 [dfragon-design](https://github.com/blahaj94/dfragon-design)이 인계 자료다. 스킬트리, 쿨타임, 캐릭터 검색과 상세, 모아보기, 패키지 효율, 캐릭터 기록, 아바타 피팅룸, 피아노방, 버프 계산기, 플레이 플래너, 성장 로드맵, 이벤트 보상, 미궁 지도의 14개다. 기능별 요구와 불변조건은 그 저장소의 `README.md`, `decisions.md`, `docs/screens/`에, 시안 요소와 컴포넌트의 대응은 `ui-mapping.md`에 있다. 14개 기능의 대상 앱은 모두 Desktop이다. dfragon-design의 결정에서 캐릭터 검색 화면은 상단 바의 검색 버튼으로 여는 별도 화면이다. 파티에 없는 캐릭터를 찾을 때 쓰고, 결과를 누르면 기존 상세 창을 연다. 첫 화면의 슬롯 카드와 [Desktop MVP 카드 UI](../rules/desktop-mvp-ui.md) 계약은 그대로이며, 검색 버튼을 제품에 넣을 때는 그 Rule의 변경으로 들여온다. 제품 계약의 원본은 이 저장소의 `docs/rules`이고 dfragon-design은 구현하지 않은 화면의 시안과 요구다. 캐릭터 검색과 상세처럼 두 곳에 모두 있는 주제는 [캐릭터 검색 계약](../rules/character-search.md), [캐릭터 상세 계약](../rules/character-details.md)이 우선하며, 시안에서 채택할 의미는 Rule 변경으로 들여온다.

색 토큰의 기준은 dfragon-design의 [색 체계](https://github.com/blahaj94/dfragon-design/blob/main/design/colors.md)다. Desktop 화면은 `@dfragon/ui/tokens.stylex`의 `colors`를 쓰며, 키는 의미 토큰 이름을 camelCase로 옮긴 것이다(`card.stripe` → `cardStripe`). 카드와 게임 색은 두 모드에서 같은 값이다. 이전 키는 색 체계의 기존 이름 대응표를 기준으로 옮겼다. 카드 그리드 배경은 `bg.canvas`, Print Screen 키캡은 `bg.control`, 닉네임 경계와 범례는 `fg.danger`, 상세 창의 뒤 카드와 설정 내용 영역은 `bg.surface`다. 새 화면에 필요한 색은 색 체계의 의미 토큰 이름과 값으로 `tokens.css`와 `tokens.stylex`에 추가한다.

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

레이아웃은 기존 React, TypeScript, StyleX와 `@dfragon/ui`를 사용한다. [Desktop 스타일 작성](desktop-styling.md), [Design System](../rules/design-system.md), [검색 구현 안내](desktop-character-search.md)의 공용 자산, 접근성, 캡처 수명을 유지한다. 화면 전용 조합은 Desktop 내부에서 시작하며 별도 디자인 시스템 구축을 선행하지 않는다.

## Typo 적용

[Typo 가이드 보드](https://design.penpot.app/#/view?file-id=d8ac01df-6646-81d2-8008-a69f349be8fc&page-id=61bb727b-6711-8058-8008-bdf0614c4172&section=interactions&frame-id=61bb727b-6711-8058-8008-bdf0660bcb50)의 10개 텍스트 자산과 React `typographyVariants`를 같은 규격으로 사용한다. 화면 크기와 문서 heading 단계는 분리하며, 예를 들어 화면 제목은 `Typo.h3 as="h1"`로 작성한다.

| 역할                           | variant                       |
| ------------------------------ | ----------------------------- |
| 로그인, 회원가입, 상세 화면 제목 | h3                            |
| 설정 본문 제목, 상세 지표       | h4                            |
| 모달, 카드 구역 제목            | h5                            |
| 작은 구역 제목                 | h6                            |
| 카드 이름 입력                 | h5 weight=700, 빈 입력은 h6   |
| 설명, 주요 버튼                | txtM (버튼 weight=700)        |
| 목록, 고지 원문, 작은 버튼, 직업 | txtS (버튼 weight=700)        |
| 서버, 모험단, 버전, 작은 투자 표 | caption                       |

화면에서는 직접 fontSize, lineHeight를 반복하지 않는다. 카드 이름은 32px input 외곽 높이를 쓴다. 명성, 장비 점수, 서버 순위, 카드 번호 같은 숫자 값은 Typo 대신 Barlow Condensed 숫자 단계(dfragon-design typography.md의 `numeric.*`)를 따른다. 숫자 단계는 아직 토큰이 없어 카드 스타일에 크기를 적는다. h4–h6의 계약은 weight=600이며 Desktop이 번들한 Pretendard 가변 글꼴에서 실제 SemiBold로 표시된다. 인증 browser의 기존 글꼴 상속은 유지한다.

현재 적용은 제품 App이 사용하는 화면과 같은 컴포넌트를 쓰는 상세 미리보기까지다. `fixture/legacy`와 연결되지 않은 예전 화면의 일괄 교체는 포함하지 않는다. 실제 인증 UI는 Desktop의 예전 LoginPage가 아닌 `apps/accounts/browser/passkeys.tsx`이며, 이 entry에서도 같은 Typo를 소비한다.

## Renderer 미리보기

`src/frontend/src/pages/party/PartyPage.tsx`와 `pages/character-detail/CharacterDetailPage.tsx`가 `sections/CharacterCard.tsx`, `sections/DetailDeck.tsx`를 조합해 메인 카드와 상세 A안을 실제 renderer에서 실행한다. `src/frontend/src/fixture/mvp/`는 합성 데이터와 로컬 디자인 자산을 제공하는 별도 HTML 진입점이다. 기본 `dev`와 `dev:app`은 `App.tsx`의 새 카드 화면을 열고 소스 수정은 HMR로 반영한다. 기본 앱은 샘플 데이터 없이 빈 슬롯 네 개로 시작하며 테마 전환을 제공한다. 인증 설정이 있으면 상단 로그인 버튼은 시스템 기본 브라우저의 로그인 페이지를 바로 열고, 설정이 없으면 버튼을 표시하지 않는다. 숨겨진 로딩 아이콘은 레이아웃 너비를 차지하지 않으며, 진행 시 글자는 오른쪽으로 사라지고 아이콘은 오른쪽에서 들어온다. 버튼은 최소 너비를 유지하면서 내용 너비 전환에 맞춰 줄어들고 취소, 실패 후 복귀한다. 진행 중에는 같은 버튼이 `취소`가 되어 누르면 `cancelLogin`을 보낸다. 로그인 완료 시 버튼을 숨기며 계정 모달, 환영, 패스키 관리, 로그아웃 메뉴는 제공하지 않는다. 연결 조회 실패와 복원, 저장소 실패 시 로그인 버튼으로 조회 또는 복구를 재시도할 수 있다. 인증 여부나 연결 실패가 카드 화면을 제거하지 않는다. 카메라 버튼은 `CaptureControls` 모달을 열고, 선택한 창은 기존 `usePartyCapture`를 통해 main에 등록만 한다. 던파 창 하나 자동 감지도 등록만 하며 Alt+R로 회차를 시작한다. 대상 변경 시 이전 회차와 프레임 읽기, OCR, 검색 수명을 정리하고 새 창만 등록한다. 모달 닫기는 캡처를 중지하지 않으며 로그인 상태와도 독립적이다. 회차 프레임 한 장의 OCR 첫 후보를 네 카드에 표시하며 연속 관측을 기다리지 않는다. 미검출 슬롯은 비워 두고, 프레임을 쓸 수 없으면 안내 후 다음 Alt+R을 기다린다. 처리를 마친 뒤에는 추가 프레임을 읽지 않고 회차 결과를 유지한다. 검색 결과, 이름 수정, 상세 카드의 실데이터 조합은 후속이며 이 단계의 이름 입력은 읽기 전용이다. 합성 미리보기는 `dev:preview`로 분리한다. 구버전 조합은 `fixture/legacy/LegacyApp.tsx`에 남겨 기존 기능 회귀 테스트에서만 사용한다. 이 화면의 캡처 시작 버튼도 Alt+R과 같은 회차 시작을 보내며 인식 간격 선택은 제공하지 않는다.

```bash
pnpm --filter @dfragon/desktop dev
# 합성 데이터 상태, 상세, 캡처 모달 비교
pnpm --filter @dfragon/desktop dev:preview
```

상단 바는 `components/TopBar.tsx`가 창 맨 위에 폭 전체, 높이 56으로 그리고 아래에 1px `border.default` 선을 둔다. dfragon-design [레이아웃 규격의 상단 바 구성](https://github.com/blahaj94/dfragon-design/blob/main/design/layout.md#상단-바-구성) 순서대로 로고(오른쪽 위를 자른 24px `brandLogo` 마크와 `Typo.h6` 700의 제품 이름), 구분선, 내비(`components/MainNav.tsx`), 게임 연결 상태, 구분선, 도구 버튼이다. 내비의 검색은 현재 항목 모양(오른쪽 위를 자른 `bg.inset` 면과 아래 2px `signal` 선)이고 `@dfragon/ui`의 `Menu` `RadioGroup`으로 파티와 공대를 고르며, 현재 하위 이름을 12px로 함께 보인다. 캐릭터, 도구, 플래너는 화면이 없어 `aria-disabled`다. 게임 연결 상태는 캡처 모달과 같은 `getCaptureControlState`의 이름과 tone을 `StatusChip` `size="md"`(높이 28, 오른쪽 위 자름)로 그리며 `role`을 주지 않는다. 모달이 열려 있으면 모달의 상태 칩이 같은 상태를 알리므로 두 번 읽히지 않게 하려는 것이다. 이 칩은 `components/CaptureControls.tsx`의 `DialogTrigger`가 감싼 native button이라 누르거나 Enter, Space로 캡처 대화상자를 열고, 접근 가능한 이름은 `화면 캡처, <상태 이름>`이다. 포커스 선은 칩의 자른 모서리에 가리지 않도록 버튼 바깥 2px에 그리고, 대화상자를 닫으면 Base UI가 포커스를 칩으로 돌린다. 캡처 진행 문구는 푸터 대신 파티 머리(`components/PartyHeader.tsx`)의 `role="status"` 글자가 알린다. OS 창 버튼 자리를 뺀 상단 바 내용 폭이 900px 이하면 제품 이름을 container query로 숨긴다. 상태 칩은 캡처 대화상자를 여는 유일한 길이라 숨기지 않는다. Windows 최소 창 1024에서 내용 폭은 846px이고, 카메라 버튼이 빠져 칩과 로그인 버튼까지 약 650px이면 들어간다. 개발자 작업 공간을 여는 동안은 내비와 상태 칩을 숨긴다.

상단 바의 테마, 설정은 `@dfragon/ui`의 `IconButton` `bar`(36 정사각형)에 20px 아이콘을 둔다. 테마는 다크에서 DFragon 아이콘 마름모 해, 라이트에서 `moon`이고 설정은 조절 막대다. 상단 바에는 카메라 버튼과 키캡을 두지 않는다. 캔버스 메인 보드대로 캡처 버튼은 파티 머리에 있다. 로그인은 공용 `Button`의 `md` `secondary`에 `Typo.txtM` 700 라벨이다. Desktop 화면 아이콘은 `stroke-linecap="square"`, `stroke-linejoin="miter"`로 그린다.

파티 머리(`components/PartyHeader.tsx`)는 DFragon 디자인 캔버스 메인 보드의 배치다. 왼쪽은 `Typo.h4` 700 `파티`, 캐릭터를 찾은 자리 수(Barlow Condensed 28 700, 분모 `/4`는 `fg.subtle`), `role="status"` 진행 문구(13px `fg.muted`)이고, 오른쪽은 간격 16으로 접기(`IconButton` `lg`), 마지막 캡처(`components/LastCaptureTime.tsx`), 스냅샷(`IconButton` `lg`, 비활성), 캡처 버튼 순서다. `IconButton` `lg`는 `bg.inset` 면의 48 정사각형에 오른쪽 위를 자르고 포커스 선을 면 안쪽에 그린다. 마지막 캡처는 12px `fg.subtle` 라벨 아래 13px `fg.muted` 값이며 숫자는 Barlow Condensed 20 600이다. 값은 `usePartyCapture`의 `lastCompletedAt`(캡처 상태가 인식 완료에 들어간 시각, 창 변경과 중지 때 비움)을 `lib/elapsed-time.ts`로 `12초 전`처럼 바꾸고, 없으면 `-`다. 표시 값이 바뀌는 순간에만 다음 타이머를 걸어(초 단위 동안 1초, 분 이상은 그 단위가 바뀔 때) 이 요소만 다시 그리고, 완료 시각이 바뀌면 `key`로 새로 그려 그 순간부터 다시 잰다. 캡처 버튼은 `Button` `primary` `lg`(신호색 면, 오른쪽 위 자름)에 24px `camera`, 버튼 글자색 30%의 1.5 × 24 구분선, `Kbd` `surface="signal"`(버튼 글자색과 그 55% 외곽선) `Alt`, `R`을 14 간격으로 두고, 좌우 여백은 캔버스대로 14, 18이다. 접근 가능한 이름은 `파티 캡처, 단축키 Alt R`, `aria-keyshortcuts="Alt+R"`이다. 누르면 `usePartyCapture`의 `startRound`를 부르는데, Alt+R의 `desktopShortcut` 구독도 같은 함수를 불러 캡처 상태 machine에 같은 `START`를 보낸다. 버튼의 비활성 조건은 machine이 `START`를 받을 수 있는지(`canStartCapture`)와 같아 Alt+R이 무시되는 상태에서만 누를 수 없다.

메인 창은 `titleBarStyle: 'hidden'`과 높이 56의 `titleBarOverlay`로 OS 창 버튼을 상단 바 안에 그린다. 플랫폼별 overlay 값은 `backend/window-chrome/title-bar-overlay.ts`가 정한다. 상단 바는 CSS `env(titlebar-area-x)`, `env(titlebar-area-width)`로 OS 버튼 자리를 비우고 높이는 `env(titlebar-area-height)`를 따른다. 끌기 영역은 상단 바 전체를 덮는 빈 요소 하나(`-webkit-app-region: drag`)이고, 버튼은 각자 감싼 요소에서 `no-drag`로 뺀다. Electron 44(Chromium 152)부터 app-region이 상속되므로 버튼 묶음에 `no-drag`를 두면 그 안에 그려지는 대화상자 positioner까지 `no-drag`가 된다. positioner는 닫혀 있어도 창 전체 크기라 끌기 영역이 모두 지워지므로, 대화상자를 여는 버튼은 trigger만 감싼다(`constants/window-chrome.style.ts`). 실제 끌기 영역은 압축하지 않은 앱을 `ELECTRON_DEBUG_DRAGGABLE_REGIONS=1 ELECTRON_ENABLE_LOGGING=1`로 실행하면 main 로그와 화면 표시로 확인할 수 있다. OS 창 버튼은 웹 내용 위에 고정되므로 `<main>`을 창 높이로 고정하고 상단 바 아래 내용만 스크롤한다. 설정과 캡처 대화상자는 `margin-top: env(titlebar-area-height)`로 창 버튼 띠 아래에서 가운데에 놓는다. Windows, Linux의 창 버튼 배경과 기호 색은 `hooks/useWindowChromeTheme.ts`가 테마를 바꿀 때 `window-chrome` IPC로 맞춘다. macOS는 신호등 버튼이 왼쪽에 오며 바 높이에 맞춰 세로 가운데에 놓이고, 색은 바꾸지 않는다.

설정 대화상자는 `DialogContent` `lg`(800 × 600)이고 다른 대화상자처럼 반지름 0, 테두리 없는 `bg.surface` 면이며 머리 아래에 구분선을 둡니다. 폭 200의 메뉴는 공용 `Button` `ghost` `md`(높이 40, 반지름 2)이며 선택 항목은 `bg.inset`입니다. 디자인 메뉴에 없는 `버전 정보`는 제품 기능이라 첫 메뉴로 유지합니다. 라이선스 목록은 디자인 표처럼 배경 없이 반지름 0의 행을 쌓고, 첫 행부터 한 줄 걸러 `bg.stripe`를 칠합니다. 디자인 표의 머리 행 대신 검색 입력과 구성 요소 개수를 두므로, 머리 행을 세는 디자인의 짝수 행이 여기서는 홀수 행입니다. 행은 이름(16/24)과 버전(12/18)의 두 줄에 위아래 여백 3을 둔 48이고, 버전이 없는 한 줄 행도 최소 높이 48입니다. 행 끝에는 24px `chevron-right`(`fg.subtle`)를 둡니다. 고지 상세 패널과 개발자 모드 줄은 반지름 0의 `bg.inset` 면입니다. 개발자 모드는 `@dfragon/ui`의 `Switch` 한 줄로 켜고 끄며, 켜진 동안에만 `개발 도구 열기`(`Button` `primary`)를 표시합니다.

캡처 모달은 `DialogContent` 기본 크기 `sm`(폭 480)이고 반지름 0, 테두리 없는 `bg.surface` 면입니다. 상태는 `@dfragon/ui`의 `StatusChip`에 `role="status"`로 표시합니다. 상단 바와 모달의 상태 칩은 회차 진행 중 `인식 중`, 완료 뒤 `인식 완료`(neutral), 프레임을 쓸 수 없어 안내 후 끝난 회차는 `확인 필요`(waiting, 중립색과 각진 모래시계)를 표시합니다. 창 등록의 준비 중과 창 확인 중 neutral, 조회 실패 danger, 창 미감지 waiting, 창 감지됨 success입니다. 바닥에는 `닫기`(`Button` `secondary`)와 `캡처 중지`(`Button` `primary`)를 이 순서로 두며, 창 등록을 기다리는 동안과 회차 진행 중, 완료 뒤에도 중지할 수 있습니다.

캡처 창 선택은 `CaptureSourceSelect`에서 Penpot의 다크, 라이트 트리거와 팝업을 구현합니다. `@dfragon/ui`의 `Menu`(Base UI)가 방향키, 문자 탐색, Enter/Space, Escape, 포커스 복귀를 맡고, 창은 `menuitemradio`로 선택 여부를 알리며 목록 아래 새로고침은 별도 명령으로 처리합니다. 팝업은 대화상자 면의 스크롤 영역에 잘리지 않도록 body 포털에 그리며, Base UI가 모달의 접근성 숨김 대상에서 제외합니다. 긴 창 이름은 말줄임과 전체 제목을 제공하고 목록은 화면 경계에 맞춰 배치, 스크롤됩니다. 기본 select는 캡처 UI에서 사용하지 않습니다. 트리거는 입력처럼 높이 40, 반지름 2, `bg.control`에 24px `monitor`와 `chevron-down`을 두고, 목록은 공용 `Menu` 면에 반지름 2의 32px 아이콘 타일과 16px 선택 `check`, 16px 새로고침 아이콘을 씁니다.

캐릭터 카드의 서버 선택도 기본 select 대신 `ServerSelect`를 사용합니다. `@dfragon/ui`의 `Select`(Base UI)가 단일 선택, 키보드 탐색, 포커스 복귀를 맡고, 카드 밖 포털로 목록이 카드 경계에 잘리지 않게 합니다. 트리거는 공용 `xs` 칩(높이 24)이고 값이 없으면 `서버`를 표시합니다. 목록은 위쪽 2px 신호색 선, 오른쪽 아래 8 자름, 현재 항목 왼쪽 2px 표시의 공용 `Select` 규격을 따르며, 그룹 제목 없이 목록의 `aria-label`로 이름을 알립니다. 카드는 라이트 모드에서도 다크라서 트리거와 목록에 `surface="card"`를 넘겨 `card*` 토큰으로 그립니다. 컴포넌트는 전달받은 후보만 표시하며 현재 합성 미리보기의 서버 수정 상태와 제품의 입력 비활성 정책은 그대로 유지합니다. 실제 검색 결과 서버 연결은 기존 후속 범위입니다.

카드는 `@dfragon/ui`의 `CardFrame`(`default`, `selected`, `failure`, `waiting`)으로 그립니다. 상태는 `lib/card-presentation.ts`의 `getCharacterCardFrameState`가 검색 상태와 이름 수정 여부로 정하고, 꺾쇠 색과 머리 오른쪽 표시(이름 수정 중 네모 점 3개, 실패 `!` 칸, 인식 대기 각진 모래시계)로 보입니다. 머리에는 오른쪽 위를 자른 카드 번호, 서버 칩, 서버 순위, 상세 버튼(회색 면 없는 32 아이콘 버튼)을 둡니다. 그림 칸은 `shapes.gridWell`이고 실패 때만 `shapes.hazardStripes`를 겹칩니다. 그 아래 모험단(`card.fgAdventure`)과 길드(`rarity.unique`), 이름 입력, 직업, `dl`로 묶은 명성과 장비 점수(`NumericText`, 400ms 증가)를 두고, 맨 아래 `Tabs` `surface="card"` 면 탭을 둡니다. 값이 없거나 null인 서버 순위, 길드, 명성, 장비 점수는 `constants/cards.ts`의 `MISSING_VALUE`(`-`)로 그리고, 숫자 증가는 값이 있을 때만 씁니다. 제품에서는 길드만 상세 응답에서 오고 서버 순위와 장비 점수는 대응 필드가 없어 `-`입니다. 카드 그리드는 패널 없이 콘텐츠 영역(네 변 여백 24)에 파티 머리 48과 간격 16 아래 4열, 거터 16으로 놓고 펼친 카드는 남은 높이를 채웁니다. 파티 머리의 접기를 누르면 그림 칸, 직업, 면 탭이 접히고 카드는 내용 높이만 차지합니다.

Mac에서도 `dev:preview`의 하단 **캡처 미리보기 상태**로 합성 캡처 상태를 확인할 수 있다. 합성 미리보기는 제품의 Alt+R 회차 실행 검증과 구분한다. 합성 창 선택은 UI 상태만 바꾸고 실제 media, OCR, IPC를 호출하지 않는다. 제품 UI에는 OS 분기를 추가하지 않으며 실제 캡처 권한은 기존 Windows main 정책이 검사한다.

빌드 결과를 확인할 때는 다음 명령을 사용한다.

```bash
pnpm --filter @dfragon/desktop mvp:build
pnpm --filter @dfragon/desktop ui:fixture mvp dark
```

합성 미리보기에서 창 크기를 1280 × 800, 최소 1024 × 640과 접은 높이 400으로 바꾸고 하단에서 상태 비교, 네 면 비교, 자동 식별 상태를 선택한다. 각 카드의 면 탭은 독립적이고 입력, 서버, 상세 버튼은 면을 넘기지 않는다. 이름 입력에 들어가면 그 카드가 이름 수정 중 상태가 된다. 합성 미리보기의 서버 셀렉트는 안톤, 바칼, 카인, 카시야스, 디레지에, 힐더, 프레이, 시로코를 표시하고 API `serverId`를 선택값으로 저장한다. 이름, 서버 수정은 API를 호출하지 않으며 이전 상세 열기를 막는다. 실제 검색 연결의 서버 후보는 검색 결과에 포함된 서버만 사용하는 계약을 유지한다. 실패, 검색 중, 0건, 빈 상태를 따로 표시한다.

우측 상단 상세 버튼은 격리 fixture의 별도 창을 연다. 같은 미리보기 대상은 이름 있는 창을 재사용하고 메인 fixture 종료 시 함께 닫는다. 이는 합성 화면 확인용 동작이며 제품 BrowserWindow 수명 정책의 결정이나 구현을 대신하지 않는다. `ui:fixture`의 상세 창도 제품처럼 1280 × 800에 OS 제목줄을 숨기고, 상세 화면은 보조 창 상단 바 `components/WindowBar.tsx`(로고 마크와 `Typo.h6` 700 창 제목, 끌기 영역, OS 창 버튼 자리) 아래에 카드 더미를 둔다. 카드 더미는 앞 카드 816 × 576과 오른쪽 104, 아래 8씩 겹친 뒤 카드 네 장이고, 각 카드는 `CardFrame` 면과 꺾쇠를 쓴다. 카드 자리는 180ms에 옮겨 가고 모션 감소 설정에서는 바로 옮긴다. 최소 창에서는 가로 스크롤로 나머지 카드에 접근한다.

하단 **미리보기 상태**의 `상위, 랭커 단계`는 기본, 상위, 랭커 카드와 빈 카드를 나란히 보인다. 상위, 랭커는 `CardCharacter.tier`를 채운 합성 데이터이고, `getCharacterCardFrameState`가 조회를 마친 카드에만 `CardFrame`의 `top`, `ranker`를 고른다. 빛줄기와 랭커 스캔선은 `CardFrame`이 그리고, 번호 칩, 서버 순위, 숫자 값, 그림 칸 아래 2px 선은 `CharacterCard.style.ts`의 단계 스타일이 그린다. 상단 내비에서 공대를 고르면 `pages/raid/RaidPage.tsx`가 합성 공대원 11명과 빈 자리 하나를 파티와 같은 `CharacterCard` 12장으로 보인다. 열한 번째 공대원은 길드, 장비 점수, 서버 순위가 없어 `-`를 보인다. 제품 `App.tsx`의 공대 화면은 `hooks/useRaidSearch.ts`로 자리별 서버, 이름 조회를 연결하고, 파티를 보는 동안에도 공대 카드를 숨기기만 해 입력과 결과를 유지한다.

실제 검색 연결, 429 재시도와 OCR 복귀, 상세 API, main/preload, 제품 별도 창, Windows 실행은 후속이다. 제품 HTML의 현재 `img-src 'self' data:`는 원격 이미지를 차단한다. 미리보기는 로컬 자산을 사용하며, 실제 이미지 연결 시 [이미지 로딩 계약](../rules/desktop-mvp-ui.md#표현과-이미지)의 고정 origin 허용을 적용한다.

[main]: https://design.penpot.app/#/view?file-id=d8ac01df-6646-81d2-8008-a69f349be8fc&page-id=61bb727b-6711-8058-8008-bdec5680efc4&section=interactions&frame-id=f47e4ca8-7ec0-8075-8008-c267fa7f5c85
[minimum]: https://design.penpot.app/#/view?file-id=d8ac01df-6646-81d2-8008-a69f349be8fc&page-id=61bb727b-6711-8058-8008-bdec5680efc4&section=interactions&frame-id=f47e4ca8-7ec0-8075-8008-c26d789098c1
[faces]: https://design.penpot.app/#/view?file-id=d8ac01df-6646-81d2-8008-a69f349be8fc&page-id=61bb727b-6711-8058-8008-bdec5680efc4&section=interactions&frame-id=f47e4ca8-7ec0-8075-8008-c267c4c984ff
[detail]: https://design.penpot.app/#/view?file-id=d8ac01df-6646-81d2-8008-a69f349be8fc&page-id=61bb727b-6711-8058-8008-bdec5680efc4&section=interactions&frame-id=f47e4ca8-7ec0-8075-8008-c26ba452f760
