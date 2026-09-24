---
type: reference
status: active
scope: desktop design sources and renderer implementation status
last-reviewed: 2026-09-17
---

# Desktop MVP 디자인 이관

Penpot 원본과 현재 Electron 구현 연결점을 설명한다. 확정 동작·접근성·완료 조건은 [Desktop MVP 카드 UI](../rules/desktop-mvp-ui.md)가 원본 계약이다. 이 안내의 합성 renderer 검증은 제품 검색·상세 연결이나 Windows 검증의 완료를 뜻하지 않는다.

## 디자인 원본

| 용도                | Penpot 원본                         | 읽는 방법                                                                         |
| ------------------- | ----------------------------------- | --------------------------------------------------------------------------------- |
| 메인 화면           | [01 · 다크 · 대기][main]            | 같은 페이지의 02~06에서 캡처 중·창 감지 실패와 라이트 테마를 확인한다.            |
| 반응형 배치         | [확정 A · 900px][responsive]        | 같은 이름의 700px·500px·300px 보드까지 비교한다.                                  |
| 메인 슬롯의 면 전환 | [08 · 카드 순환 · 상태 비교][faces] | 캐릭터 → 장비 → 서약 → 투자 현황 → 캐릭터. 슬롯마다 독립적이다.                   |
| 별도 상세창         | [07 · 캐릭터 상세 · 확정 A][detail] | 장비·서약·강화·마법부여·스킬트리를 각각 한 장으로 둔, 반듯하게 겹친 카드 A안이다. |

`보관`으로 시작하는 보드와 09B·09C는 구현 기준에서 제외한다. Penpot의 메인 카드 일부는 시연용 상세창 링크를 가지고 있으므로, 클릭 링크를 그대로 복제하기보다 08의 면 전환과 상세 열기 액션을 구분한다. 프로토타입의 화면 이동은 실제 입력·API 호출·Electron 창 수명 구현을 대신하지 않는다.

## 데이터와 기존 구현 연결

검색은 [캐릭터 검색 계약](../rules/character-search.md), 상세는 [캐릭터 상세 계약](../rules/character-details.md)을 따른다. 공개 검색·상세 조회를 로그인으로 막지 않는다. 상세 API의 캐시·갱신·오류 정책은 원본 계약을 참조하며 UI 문서에서 별도 정책을 만들지 않는다.

| 화면 데이터         | 연결 지점                                | 주의점                                                                                                 |
| ------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| 검색 후보·서버·명성 | `GET /characters`의 `rows`               | 응답은 식별자·이름·서버·명성의 다섯 필드뿐이다. 모험단·직업·장비 정보가 있다고 가정하지 않는다.        |
| 기본 정보·장착 정보 | `GET /characters/:serverId/:characterId` | 선택한 캐릭터의 상세를 연결한다. `character`, `equipment`, `avatar`, `creature`, `oath` 등을 소비한다. |
| 강화·증폭           | 캐릭터에 실제 장착된 장비 값             | 공용 `itemDetail`의 값으로 덮어쓰지 않는다.                                                            |
| 서약 슬롯           | `oath.info`, `oath.crystal`의 `slotNo`   | 장비의 부위 ID와 별도로 명시적 대응을 둔다. 아래 표는 현재 디자인의 대응이다.                          |
| 마법부여            | 장착 데이터와 별도의 평가 기준 필요      | 상세 API는 종결·준종결·기타 판정 결과를 제공하는 계약이 아니다.                                        |
| 스킬                | `skillStyle` 및 `skillDetails`           | 데이터가 있다는 이유로 미설계 스킬트리 UI를 MVP에 추가하지 않는다.                                     |

| 서약 원본 | 대응 장비 부위 | 서약 원본        | 대응 장비 부위 |
| --------- | -------------- | ---------------- | -------------- |
| `info`    | 무기           | 결정 `slotNo: 0` | 머리어깨       |
| 결정 `1`  | 상의           | 결정 `2`         | 하의           |
| 결정 `3`  | 벨트           | 결정 `4`         | 신발           |
| 결정 `5`  | 보조장비       | 결정 `6`         | 귀걸이         |
| 결정 `7`  | 마법석         | 결정 `8`         | 팔찌           |
| 결정 `9`  | 목걸이         | 결정 `10`        | 반지           |

장비 배열 순서만으로 부위를 결정하지 않는다. 12부위 식별자는 `WEAPON`, `JACKET`, `SHOULDER`, `PANTS`, `WAIST`, `SHOES`, `AMULET`, `WRIST`, `RING`, `SUPPORT`, `MAGIC_STON`, `EARRING`이다. `MAGIC_STON`은 원본 식별자를 유지한다. 누락 슬롯·누락 값·이미지 실패는 실제 0이나 다른 아이템으로 채우지 않는다.

| 저장소 위치                                                                                      | 이어받을 책임                                          |
| ------------------------------------------------------------------------------------------------ | ------------------------------------------------------ |
| `apps/desktop/src/frontend/src/sections/SearchResults.tsx`, `components/CharacterCandidates.tsx` | 기존 슬롯·후보 표시를 카드 화면으로 연결할 출발점      |
| `apps/desktop/src/frontend/src/hooks/useCharacterSearch.ts`                                      | 이름 수정·제출·OCR 복귀·슬롯별 검색 상태               |
| `apps/desktop/src/frontend/src/lib/capture-search.ts`, `search-connection.ts`                    | capture와 요청 수명, 순서·취소·늦은 응답 처리          |
| `apps/desktop/src/backend/search/`, `src/preload/common/types/search.ts`                         | main 검색 처리와 공유 IPC 계약                         |
| `apps/desktop/src/backend/main.ts`, `src/preload/index.ts`                                       | 새 상세 기능의 등록 지점. 기능 본문은 별도 모듈로 구성 |

상세 조회용 Desktop 연결과 별도 상세 BrowserWindow는 새 구현 범위다. 현재 검색 IPC가 이미 상세 조회까지 제공한다고 가정하지 않는다. Renderer에 Neople API key나 임의 URL 호출을 추가하지 않고, 기존 main/preload 경계와 runtime 검증을 따른다. 같은 캐릭터의 카드 면을 바꿀 때마다 새 HTTP 요청을 만들지 않도록 조회 데이터와 표시 상태를 분리한다.

레이아웃은 기존 React·TypeScript·StyleX와 `@dfragon/ui`·SEED를 사용한다. [Desktop 스타일 작성](desktop-styling.md), [Design System](../rules/design-system.md), [검색 구현 안내](desktop-character-search.md)의 공용 자산·접근성·캡처 수명을 유지한다. 화면 전용 조합은 Desktop 내부에서 시작하며 별도 디자인 시스템 구축을 선행하지 않는다.

## Typo 적용

[Typo 가이드 보드](https://design.penpot.app/#/view?file-id=d8ac01df-6646-81d2-8008-a69f349be8fc&page-id=d8ac01df-6646-81d2-8008-a69f349be8fd&section=interactions&frame-id=4481fd50-c2f6-80a2-8008-a96a89ac7899)의 10개 텍스트 자산과 React `typographyVariants`를 같은 규격으로 사용한다. 화면 크기와 문서 heading 단계는 분리하며, 예를 들어 화면 제목은 `Typo.h3 as="h1"`로 작성한다.

| 역할                           | variant                       |
| ------------------------------ | ----------------------------- |
| 로그인·회원가입·상세 화면 제목 | h3                            |
| 설정 본문 제목·상세 지표       | h4                            |
| 모달·카드 구역 제목            | h5                            |
| 작은 구역 제목                 | h6                            |
| 설명·닉네임·주요 버튼          | txtM (닉네임·버튼 weight=700) |
| 목록·고지 원문·작은 버튼       | txtS (버튼 weight=700)        |
| 서버·직업·버전·작은 투자 표    | caption                       |

화면에서는 직접 fontSize·lineHeight를 반복하지 않는다. 작은 카드 이름은 24px 행간과 26px input 외곽 높이를 사용하고, 빈 입력은 txtS로 표시한다. 닉네임과 보조 정보 사이의 공간을 함께 조정해 280px 카드 높이를 유지한다. h4–h6의 계약은 weight=600이며 현재 Desktop의 나눔스퀘어 네오 자산은 CSS font matching으로 700 파일을 사용한다. 인증 browser의 기존 글꼴 상속은 유지한다.

현재 적용은 제품 App이 사용하는 화면과 같은 컴포넌트를 쓰는 상세 미리보기까지다. `fixture/legacy`와 연결되지 않은 예전 화면의 일괄 교체는 포함하지 않는다. 실제 인증 UI는 Desktop의 예전 LoginPage가 아닌 `apps/api/browser/passkeys.tsx`이며, 이 entry에서도 같은 Typo를 소비한다.

## Renderer 미리보기

`src/frontend/src/pages/party/PartyPage.tsx`와 `pages/character-detail/CharacterDetailPage.tsx`가 `sections/CharacterCard.tsx`·`sections/DetailDeck.tsx`를 조합해 메인 카드와 상세 A안을 실제 renderer에서 실행한다. `src/frontend/src/fixture/mvp/`는 합성 데이터와 로컬 디자인 자산을 제공하는 별도 HTML 진입점이다. 기본 `dev`와 `dev:app`은 `App.tsx`의 새 카드 화면을 열고 소스 수정은 HMR로 반영한다. 기본 앱은 샘플 데이터 없이 빈 슬롯 네 개로 시작하며 테마 전환을 제공한다. 상단 로그인 버튼은 전용 인증 창을 바로 연다. 숨겨진 로딩 아이콘은 레이아웃 너비를 차지하지 않으며, 진행 시 글자는 오른쪽으로 사라지고 아이콘은 오른쪽에서 들어온다. 버튼은 최소 너비를 유지하면서 내용 너비 전환에 맞춰 줄어들고 취소·실패 후 복귀한다. 진행 중에는 재클릭을 막고, 취소는 인증 창 닫기로 처리한다. 로그인 완료 시 버튼을 숨기며 계정 모달·환영·패스키 관리·로그아웃 메뉴는 제공하지 않는다. 연결 조회 실패와 복원·저장소 실패 시 로그인 버튼으로 조회 또는 복구를 재시도할 수 있다. 인증 여부나 연결 실패가 카드 화면을 제거하지 않는다. 카메라 버튼은 `CaptureControls` 모달을 열고, 선택한 창은 기존 `usePartyCapture`를 통해 즉시 캡처한다. 대상 변경 시 이전 stream·OCR를 정리하고 새 창으로 전환한다. 모달 닫기는 캡처를 중지하지 않으며 로그인 상태와도 독립적이다. 안정화된 OCR 이름을 네 카드에 표시한다. 검색 결과·이름 수정·상세 카드의 실데이터 조합은 후속이며 이 단계의 이름 입력은 읽기 전용이다. 합성 미리보기는 `dev:preview`로 분리한다. 구버전 조합은 `fixture/legacy/LegacyApp.tsx`에 남겨 기존 기능 회귀 테스트와 capture fixture에서만 사용한다.

```bash
pnpm --filter @dfragon/desktop dev
# 합성 데이터 상태·상세·캡처 모달 비교
pnpm --filter @dfragon/desktop dev:preview
```

캡처 창 선택은 `CaptureSourceSelect`에서 Penpot의 다크·라이트 트리거와 팝업을 구현합니다. SEED Menu의 방향키·문자 탐색·Enter/Space·Escape·포커스 복귀를 재사용하고, 창은 `menuitemradio`로 선택 여부를 알리며 목록 아래 새로고침은 별도 명령으로 처리합니다. 팝업 포털은 모달 안에 두어 모달의 접근성 숨김 대상이 되지 않게 합니다. 긴 창 이름은 말줄임과 전체 제목을 제공하고 목록은 화면 경계에 맞춰 배치·스크롤됩니다. 기본 select는 캡처 UI에서 사용하지 않습니다.

캐릭터 카드의 서버 선택도 기본 select 대신 `ServerSelect`를 사용합니다. SEED Select의 단일 선택·키보드 탐색·포커스 복귀에 작은 주황색 트리거와 선택 체크를 적용하고, 카드 밖 포털로 목록이 카드 경계에 잘리지 않게 합니다. 카드와 서버 목록은 두 테마에서 어두운 색을 유지합니다. 컴포넌트는 전달받은 후보만 표시하며 현재 합성 미리보기의 서버 수정 상태와 제품의 입력 비활성 정책은 그대로 유지합니다. 실제 검색 결과 서버 연결은 기존 후속 범위입니다.

Mac에서도 `dev:preview`의 하단 **캡처 미리보기 상태**로 대기·준비 중·캡처 중·창 미감지·실패를 확인할 수 있다. 합성 창 선택은 UI 상태만 바꾸고 실제 media·OCR·IPC를 호출하지 않는다. 제품 UI에는 OS 분기를 추가하지 않으며 실제 캡처 권한은 기존 Windows main 정책이 검사한다.

빌드 결과를 확인할 때는 다음 명령을 사용한다.

```bash
pnpm --filter @dfragon/desktop mvp:build
pnpm --filter @dfragon/desktop ui:fixture mvp dark
```

합성 미리보기에서 창 크기를 900·700·500·300px로 바꾸고 하단에서 상태 비교·네 면 비교를 선택한다. 각 카드 본문은 독립적으로 순환하고 입력·서버·상세 버튼은 면을 넘기지 않는다. 합성 미리보기의 서버 셀렉트는 안톤·바칼·카인·카시야스·디레지에·힐더·프레이·시로코를 표시하고 API `serverId`를 선택값으로 저장한다. 이름·서버 수정은 API를 호출하지 않으며 이전 상세 열기를 막는다. 실제 검색 연결의 서버 후보는 검색 결과에 포함된 서버만 사용하는 계약을 유지한다. 실패·검색 중·0건·빈 상태를 따로 표시한다.

우측 상단 상세 버튼은 격리 fixture의 별도 창을 연다. 같은 미리보기 대상은 이름 있는 창을 재사용하고 메인 fixture 종료 시 함께 닫는다. 이는 합성 화면 확인용 동작이며 제품 BrowserWindow 수명 정책의 결정이나 구현을 대신하지 않는다. 상세 카드는 180ms로 전환하고 모션 감소 설정에서는 이동을 생략한다. 작은 상세창에서는 가로 스크롤로 나머지 카드에 접근한다.

실제 검색 연결, 429 재시도와 OCR 복귀, 상세 API·main/preload·제품 별도 창, Windows 실행은 후속이다. 제품 HTML의 현재 `img-src 'self' data:`는 원격 이미지를 차단한다. 미리보기는 로컬 자산을 사용하며, 실제 이미지 연결 시 [이미지 로딩 계약](../rules/desktop-mvp-ui.md#표현과-이미지)의 고정 origin 허용을 적용한다.

[main]: https://design.penpot.app/#/view?file-id=d8ac01df-6646-81d2-8008-a69f349be8fc&page-id=d8ac01df-6646-81d2-8008-a69f349be8fd&section=interactions&frame-id=e544b383-212e-80a8-8008-a6a5dded2c34
[responsive]: https://design.penpot.app/#/view?file-id=d8ac01df-6646-81d2-8008-a69f349be8fc&page-id=d8ac01df-6646-81d2-8008-a69f349be8fd&section=interactions&frame-id=36a60d12-e4f9-806a-8008-a6de95b3ec65
[faces]: https://design.penpot.app/#/view?file-id=d8ac01df-6646-81d2-8008-a69f349be8fc&page-id=d8ac01df-6646-81d2-8008-a69f349be8fd&section=interactions&frame-id=1c4d04b3-0eec-80a4-8008-a702a86db2a1
[detail]: https://design.penpot.app/#/view?file-id=d8ac01df-6646-81d2-8008-a69f349be8fc&page-id=d8ac01df-6646-81d2-8008-a69f349be8fd&section=interactions&frame-id=1c4d04b3-0eec-80a4-8008-a6fb4242d2e7
