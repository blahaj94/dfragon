---
type: reference
status: active
scope: desktop OCR character search implementation and verification
last-reviewed: 2026-10-10
---

# Desktop 캐릭터 검색

OCR 안정화 결과의 첫 번째 이름을 네 슬롯 검색으로 연결한다. [로그인 선택 계약](../rules/desktop-auth.md#최소-화면과-capture-경계)에 따라 창 선택, 캡처, OCR, 검색과 결과는 계정 상태와 독립적이다. 제품 main은 고정 API origin만으로 공개 검색을 구성하며 provider, credential 설정이나 auth snapshot을 요구하지 않는다. 로그인과 로그아웃이 진행 중 capture를 중단하지 않는다. 자동 조회를 마친 슬롯은 Alt+R 전까지 유지하고 수동 서버, 닉네임 조회만 해당 슬롯을 교체한다.

Windows 제품의 [캡처 정책](../rules/desktop-windows-capture.md#windows-제품-캡처-정책)은 개발자 수집과 같은 공통 GDI 구현으로 선택한 창의 보이는 클라이언트 영역을 읽는다. Main이 창, 프로세스와 캡처 수명을 검증하며 다른 창에 가려진 픽셀은 제외하며 전체 가림과 최소화 상태에서는 대기한다. 제품의 Electron media 권한은 거절한다.

## 구현 위치

| 위치                                                                                                                                                           | 책임                                                                                                                                                                 |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/desktop/src/backend/capture/ipc-handler.ts`                                                                                                              | 현재 source/document와 capture를 결합하고 검색 IPC를 같은 수명에서 검사한다. Navigation, destruction, renderer process 종료, source 변경 때 요청을 무효화한다.        |
| `apps/desktop/src/backend/search/capture-lifetime.ts`, `slot-lifetime-machine.ts`                                                                              | 함수 factory가 슬롯 DTO, 관측 revision을 관리하고 XState actor가 슬롯별 HTTP 취소와 429 대기를 소유한다.                                                              |
| `apps/desktop/src/backend/search/request.ts`                                                                                                                   | 입력 접수부터 HTTP, body 검증까지 하나의 검색 예산과 취소 판정을 수행한다.                                                                                            |
| `apps/desktop/src/backend/search/http.ts`                                                                                                                      | 고정 `GET /characters`, 선택 query 생략, HTTP/UTF-8/JSON/전체 후보 검증과 다섯 field projection을 수행한다.                                                          |
| `apps/desktop/src/backend/search/retry-after.ts`                                                                                                               | 헤더 수신 시각부터 남은 시간을 검사하고 긴 timer를 지원 범위 안에서 나눠 예약한다.                                                                                   |
| `apps/desktop/src/preload/common/types/search.ts`, `common/search/snapshot.ts`                                                                                 | Shared DTO, 오류 문구, feature API와 exact own shape, 상태 조합 검증을 정의한다.                                                                                        |
| `apps/desktop/src/preload/api/search.ts`, `search-command.ts`, `capture.ts`                                                                                    | `window.search`의 제어/구독과 기존 `window.api`의 확장된 OCR 통지를 연결한다. Electron event와 부적합 DTO는 전달하지 않는다.                                         |
| `apps/desktop/src/frontend/src/lib/search-connection.ts`, `search-connection-machine.ts`                                                                       | XState actor가 구독 후 read, event 동기화와 run/revision 순서를 관리하고, 명령 응답 유실은 read로만 확인한다.                                                         |
| `apps/desktop/src/frontend/src/lib/capture-search.ts`, `capture-search-machine.ts`, `apps/desktop/src/frontend/src/hooks/useCharacterSearch.ts`                | XState가 Start별 시작, 종료 수명을 관리하고, factory와 hook은 로컬 관측 revision, 결과 필터, 슬롯별 retry를 연결한다.                                                   |
| `apps/desktop/src/frontend/src/lib/party-capture-machine.ts`, `party-capture-session.ts`, `apps/desktop/src/frontend/src/hooks/usePartyRecognition.ts`         | begin 완료 뒤 네이티브 프레임/OCR 시작, 늦은 begin의 자기 ID 정리와 stable/null 전이 통지를 연결한다. 기존 OCR 안정화, 기본 3초 간격은 유지한다.                                |
| `apps/desktop/src/frontend/src/sections/SearchResults.tsx`                                                                                                     | 네 슬롯의 상태, 후보, 고정 오류, 수동 retry를 text로 표시한다.                                                                                                          |
| `apps/desktop/src/backend/character-detail/windows.ts`, `snapshot.ts`                                                                                          | 현재 선택의 기본 정보를 복사하고 캐릭터별 상세 창의 생성, 재사용, 읽기 권한과 종료를 관리한다.                                                                       |
| `apps/desktop/src/preload/character-detail.ts`, `common/character-detail.ts`, `apps/desktop/src/frontend/src/pages/character-detail/CharacterSnapshotPage.tsx` | 전용 읽기 bridge의 응답을 검증하고 기본 정보와 조회 시각을 표시한다.                                                                                                 |

`createCaptureSearch`는 호출마다 연결, actor, 관측 상태를 클로저에 보관하고 제어 함수를 반환한다. 표시할 슬롯의 계산은 상태를 변경하지 않는 순수 함수로 분리한다. 캡처 검색 수명은 `idle → starting → active`와 `invalidated`, 최종 `disposed` 상태로 관리한다. 새 begin, end, 무효화, dispose는 이전 시작 actor를 종료한다. 시작 actor는 종료 뒤에도 직접 응답을 기다려 자신이 생성한 늦은 ID만 end하고 호출자에게 null을 반환한다. Main이 종료를 알린 수명은 로컬 상태만 비우며 END를 중복 전송하지 않는다. 슬롯의 관측 revision, clear, 결과 필터, retry 정책은 기존 일반 로직을 유지한다.

Begin의 직접 성공 응답만 해당 Start가 소유한 ID로 사용한다. 응답이 유실되면 read로 상태를 확인하지만 그 결과의 ID를 늦은 Start의 소유로 추정해 end하지 않는다. 해당 시작은 창을 다시 선택하도록 안내하며 같은 begin을 자동 재전송하지 않는다. 새 source 선택은 기존 main 선택/capture 무효화 경로를 사용한다.

`createCaptureSearchLifetime`은 각 슬롯에 XState actor를 만든다. 요청을 준비한 뒤 pending snapshot을 동기 발행하고, 해당 요청이 여전히 유효할 때만 HTTP를 시작한다. 새 이름의 관측, clear, end는 이전 요청과 429 timer를 취소한다. 같은 이름의 새 관측은 기존 요청의 observation revision만 올리며, 15초 예산을 재시작하지 않는다. 429 대기가 끝나면 retry 가능 상태만 발행하고 GET을 자동 재전송하지 않는다.

`createSearchConnection`은 연결마다 별도 XState actor를 클로저에 보관한다. `isReady()`는 호출 시점의 동기화 상태를 읽고, 명령은 호출 당시 actor를 참조해 재연결 후 늦은 응답을 격리한다. 구독의 초기 기준과 마지막 조회의 성공 여부를 병렬 상태로 표현한다. 이미 초기 기준을 세운 연결은 복구 조회에 실패해도 후속 event를 표시할 수 있지만, 다시 조회에 성공하기 전까지 새 begin은 차단한다. 초기 조회 성공 전 event는 최신 revision만 보류하며, 재연결, dispose는 이전 actor와 구독을 종료한다. 슬롯별 명령은 직렬화하지 않고 직접 응답을 각각 돌려준다. 종료된 actor에는 명령, 복구 조회 결과를 반영하지 않지만, 늦은 begin의 직접 응답과 그 ID의 end 전송은 캡처 정리를 위해 유지한다.

검색 run이 바뀌면 이전 구독, 표시, capture resource를 버리고 새 검색 조회를 시작한다. 초기 read가 성공하기 전에는 Start와 직접 begin 호출을 차단하며, 조회 실패 시 기존 앱 화면 다시 열기 안내를 유지하고 event만으로 회복하거나 자동 재시도하지 않는다. 로컬 관측, clear, Stop, source 변경은 main 응답을 기다리지 않고 이전 표시를 가린다. Renderer와 preload는 같은 DTO 검증기를 각각의 경계에서 사용한다.

## 공통 Windows 화면 획득

`backend/lib/win32-window-capture.ts`와 `win32-pixels.ts`가 창 선택 시점의 프로세스 결합, DPI 처리, GDI 복사, 가림 확인과 자원 정리를 소유한다. `backend/developer/win32-party-capture.ts`는 그 결과에서 수집 영역을 검출하고, `backend/capture/native-frame.ts`는 일반 캡처용 프레임 또는 고정 대기 사유를 만든다. 각 기능의 오류와 저장 정책은 공통 lib로 옮기지 않는다.

`readCaptureFrame(captureId)`는 현재 선택한 창에만 결합된 읽기를 실행한다. 등록 문서와 source/capture 수명이 읽기 전후에 일치해야 하며, 임의 창 ID나 좌표를 renderer에서 받지 않는다. Preload는 반환된 RGBA 크기를 검증한다. 공통 lib는 네이티브 호출을 마치기 전에 자원과 DPI를 정리한다.

`party-capture-session.ts`는 최초 프레임 확인과 OCR worker 준비 후 프레임 읽기와 인식을 직렬 실행한다. 영상 스트림과 HTMLVideoElement를 만들지 않는다. `party.ts`는 RGBA 프레임에서 닉네임과 얼굴 크롭을 생성한다. 가려진 픽셀과 아직 검출하지 못한 슬롯은 다음 프레임을 기다린다. 해당 회차에서 이미 조회한 슬롯의 결과를 비우거나 다시 인식하지 않는다. 종료 후 도착한 프레임이나 OCR 결과는 버린다.

## OCR 식별용 HTTP 통신 준비

`apps/desktop/src/backend/search/character-http.ts`는 후보 조회, 캐릭터 이미지 다운로드, 상세 조회를 위한 main 전용 클라이언트를 제공한다. 전달 가능한 데이터 형태는 `apps/desktop/src/preload/common/types/character.ts`에 두며, API 앱의 소스를 직접 import하지 않는다.

- `createCharacterCandidatesHttp`: 이름 하나로 고정 `GET /characters/candidates`를 호출한다. 응답의 이름, 지원 서버, 캐릭터 ID와 이미지 URL을 검증하고 공급자가 반환한 후보 순서를 유지한다.
- `createCharacterImageHttp`: 검증한 서버와 캐릭터 ID로 네오플의 `zoom=1` 이미지 URL을 직접 구성한다. 임의 URL을 받지 않으며 PNG 다운로드와 디코딩의 크기를 제한한다. 결과는 전체 캐릭터 이미지의 원본 RGBA이며 얼굴 비교 결과가 아니다.
- `createCharacterAppearanceHttp`: 고정 `/characters/{serverId}/{characterId}/appearance`에서 외형 필드만 받고 identity, 외형 필드와 clone 쌍을 검증한다.
- `createCharacterDetailsHttp`: 고정 상세 경로를 호출하고 요청한 서버, 캐릭터 ID와 응답의 식별자가 일치하는지 검사한다. 기본 정보와 섹션 JSON을 전달하며 장비 점수나 마법부여 등급을 계산하지 않는다.

각 클라이언트는 호출자의 AbortSignal을 사용하고 자동 재시도나 새로운 전체 검색 시간 예산을 만들지 않는다. 호출 제한은 헤더를 받은 시점을 함께 전달하며, 상세 조회의 오류도 기존 검색 오류 형태로 정제한다. 원격 오류 원문은 화면으로 전달하지 않는다.

제품의 OCR 전용 관측은 아래 IPC 경로로 식별 함수를 사용한다. 기존 수동 검색은 `/characters`의 일반 검색을 유지하며 카드의 수동 서버 조회는 지정한 서버와 이름에 맞는 실제 캐릭터 상세를 선택한다. API origin이 설정된 제품은 외형 조회, Stay 생성과 윤곽 비교를 연결한다. 얼굴 크롭을 사용할 수 없어도 이름 검색 결과가 있으면 최고 명성 후보를 대체 표시한다. HTTP 클라이언트 테스트와 실제 게임의 식별 성공을 구분한다.

## 얼굴 크롭의 교체 경계와 비교 입력

`lib/party.ts`의 `capturePartyRecognitionInputs`는 한 번 읽은 원본 RGBA에서 닉네임과 얼굴 입력을 같은 슬롯에 묶는다. 닉네임에는 기존 OCR 전처리를 적용하고 얼굴 cropper에는 전처리하지 않은 전체 프레임, 검출된 닉네임 영역과 래스터 배율을 전달한다. `capturePartyNicknameCrops`는 기존 소비자를 위한 닉네임 전용 반환을 유지한다.

실제 얼굴 위치는 `lib/party-portrait.ts`의 `cropPartyPortrait`가 소유한다. 검출된 HP, MP 시작점의 왼쪽 28 기준 픽셀, 화면 위쪽 11 기준 픽셀에서 26×26 기준 픽셀 영역을 관측 래스터 배율로 투영한다. 기준은 높이 600px의 기본 HUD이며, 실제 영상에서 새로 검출한 각 슬롯의 x와 배율을 사용한다. 원본 RGBA를 복사하고 화면 밖 영역이나 처리 한도를 넘는 영역은 null로 반환한다. 해상도나 파일명, 게임 UI 설정 퍼센트로 좌표를 고정하지 않는다.

크롭 결과 `CharacterPortrait`는 `image: { width, height, rgba }`, `rasterScale`, 선택적 `validMask`다. 현재 cropper는 게임 UI 퍼센트가 아닌 관측 HUD 래스터 배율을 전달한다. 비교기는 이 값으로 기본 크기를 복원하지만 API 스프라이트와 모든 외형의 얼굴이 동일하게 대응한다는 보장은 아직 없다. 마스크는 얼굴 이미지의 픽셀 수와 같은 길이이며, 왕관이나 PC 표시 등 제외할 픽셀은 0, 사용할 픽셀은 1이다. 마스크가 없으면 투명하지 않은 얼굴 픽셀을 모두 사용한다.

얼굴 마스크는 기준 픽셀로 바깥쪽 1px, 위쪽 2px과 좌우 위 모서리 각각 12×9px을 제외한다. 파티장 왕관, PC 표시와 테두리가 없는 슬롯에도 같은 영역을 제외해 장식 변화가 다른 얼굴 관측을 만들지 않게 한다. 비교에 남는 얼굴 정보가 줄어들므로 이 마스크의 적용 자체를 캐릭터 식별 정확도나 일치 기준의 검증으로 해석하지 않는다.

원본 스크린샷 8장 중 정상 7장, 28개 슬롯과 연결중 화면의 정상 1개 슬롯에서 얼굴 크롭을 확인했다. 영상 크기는 1067×600, 1600×900, 1920×1080, 2560×1440, 3840×2160이며 검출 배율은 1.00, 1.20, 1.28, 1.42, 1.80, 1.82였다. UI 0%, 50%, 100% 표본을 포함하지만 모든 해상도와 UI 조합을 전수 검증한 결과는 아니다. 원본과 플레이어 이름은 저장소에 포함하지 않는다.

### 연결중과 가려진 슬롯

`연결중..` 팝업이 닉네임, 얼굴과 HP, MP의 왼쪽을 가린 표본에서는 기존 프레임 검출기가 정상 1번만 반환하고 2~4번을 제외한다. 검출하지 못한 슬롯은 닉네임과 얼굴 전체를 null로 취급하므로 OCR과 후보 검색을 시작하지 않는다. 실제 닉네임일 수 있는 `연결중` 문자열을 금지어로 처리하지 않는다.

아직 조회하지 않은 슬롯은 팝업이 사라져 정상 영역이 돌아오면 두 번 연속 같은 입력의 안정화를 거친다. 전체 파티의 준비 완료를 추측하지 않고 정상으로 검출된 슬롯은 독립적으로 처리한다. 해당 회차에서 이미 조회한 슬롯은 팝업, 반짝임이나 파티원 변경으로 지우지 않는다. Alt+R만 전체 회차를 새로 시작한다. 기존 연속 OCR fixture는 제품의 결과 유지 정책과 구분한다.

### 얼굴 비교와 일치 기준

`backend/search/portrait-match.ts`의 `scoreCharacterPortrait`는 이미 잘린 얼굴을 배율에 맞춰 정규화한 뒤 후보 이미지의 불투명 영역 주변에서 정렬을 찾는다. API 이미지의 머리 위치를 고정하지 않는다. 반환값은 채널당 평균 RGB 오차(0~255), 실제 비교 픽셀 수, 유효 얼굴 픽셀 중 비교한 비율, 후보 이미지 안의 정렬 좌표다. 이는 확률이나 서버 식별의 확정 근거가 아니다. 정보가 없는 단색, 전체 투명, 전체 제외 얼굴은 점수를 만들지 않는다.

`createPortraitMatcher`에는 `maxMeanChannelError`, `minCoverage`, `minComparedPixels`를 명시적으로 전달해야 한다. 기준을 모두 만족하는 정렬이 하나라도 있으면 통과하며 운영 기본값은 없다. 실제 Windows 표본으로 기준을 정해야 한다. 입력 크기와 계산량에는 별도 상한을 두고, 계산 중 주기적으로 event loop를 양보해 취소를 확인한다. 연산 상한 초과나 잘못된 입력을 불일치로 숨기지 않는다. 원본 버퍼는 변경하지 않는다.

`backend/search/portrait-edges.ts`의 `scoreCharacterPortraitEdges`는 염색에 덜 민감한 윤곽 비교 점수를 계산한다. 원본을 관측 래스터 배율로 정규화하고 회색조, Sobel 기울기, 방향의 두 배 각도 벡터, 국소 기울기 크기 정규화를 적용한다. 밝고 어두운 방향이 반전돼도 같은 경계 방향으로 취급한다. 색상을 단색으로 덮어쓰는 방식이 아니며 원본 RGBA와 마스크는 수정하지 않는다. 특징 배열은 Float32Array로 보관하고 새 이미지 처리 라이브러리는 추가하지 않는다.

Sobel의 3×3 이웃 전체가 불투명하고 마스크에서 허용된 위치만 사용한다. 가려진 픽셀을 검정색으로 채워 가짜 윤곽을 만들지 않는다. 소스의 0이 아닌 기울기 벡터만 비교 표본으로 삼으므로 평탄한 여백으로 비교 픽셀 수를 채울 수 없다. 점수는 -1~1 범위의 `similarity`, 비교 픽셀 수, 유효 윤곽 표본 대비 겹침 비율, 정렬 위치를 반환한다. 확률이 아니며 색상이나 밝기가 달라진 모든 아바타를 같게 만든다는 보장은 없다.

Scorer에는 `{ minCoverage, minComparedPixels }`를 전달한다. `createPortraitEdgeMatcher`에는 이 조건과 `minSimilarity`를 명시적으로 전달해야 한다. 각 정렬에서 세 조건을 함께 검사하고 첫 합격을 반환하므로, 최고 점수 위치가 겹침 조건을 만족하지 못해 다른 유효 위치를 가리지 않는다. 반환 함수는 기존 식별 흐름의 `matchesPortrait`에 주입할 수 있으며 OCR 이름과 명성 순서, 첫 통과 후보 선택은 유지된다. 입력, 정규화 크기와 비교 연산의 한도, 취소 확인과 event loop 양보는 기존 비교기의 제한을 따른다.

윤곽 비교의 픽셀 수와 겹침 비율은 RGB 비교의 원본 픽셀 기준과 다르므로 기존 임계값을 그대로 옮기지 않는다. `portrait-policy.ts`의 초기 기준은 최소 유사도 0.55, 최소 겹침 0.8, 최소 비교 픽셀 100이다. 이 값을 main이 신뢰할 설정으로 주입하며 renderer는 변경할 수 없다. 같은 아바타에 색만 다른 캐릭터를 구분하는 능력은 줄어든다. 초기 표본에 근거한 기준으로, Windows 실시간과 더 많은 동명 후보에 대한 검증이 필요하다.

제품 모듈을 원본 HUD 5개와 Stay 참조 6개에 적용한 로컬 평가에서 각 외형의 정답이 대조 외형보다 높은 점수를 얻었다. 염색된 HUD를 같은 아바타의 미염색 참조와 비교한 유사도는 0.575, 염색색을 맞춘 참조는 0.764, 다른 외형 중 최고는 0.265였다. 이 평가의 최소 겹침 0.8과 최소 비교량 100을 초기 설정에 사용한다. 후보 한 쌍의 최적 정렬 탐색은 로컬 Node 실행에서 약 0.11~0.17초였고, Windows 실행 성능이나 동명 후보 전체의 정확도를 보장하지 않는다. 실제 이미지와 플레이어 식별자는 저장소와 CI에 포함하지 않는다.

기존 RGB 방식으로 서버 정답이 있는 캐릭터 5명의 API 이미지를 비교했을 때 한 외형은 서로 다른 해상도의 정상 화면에서 낮은 오차를 보였지만, 다른 외형 중에는 정답보다 대조 이미지의 오차가 작은 경우가 있었다. 이후 HUD는 stay, 기존 캐릭터 이미지 API는 stand 자세인 차이를 확인했다. 서로 같은 자세의 픽셀이라는 전제가 성립하지 않으므로, 이 결과를 배율이나 정렬 문제만으로 해석하거나 임계값을 완화하지 않는다. 제품 식별은 같은 자세의 Stay PNG와 윤곽 비교를 사용한다. 기존 stand PNG는 카드의 표시 이미지로 유지하며 Stay 실패 때 비교용 fallback으로 사용하지 않는다.

[공식 OpenAPI 문서](https://developers.neople.co.kr/contents/apiDocs/df)는 캐릭터 이미지의 zoom 1~3만 안내하며 자세 선택은 문서화하지 않는다. 별도 쇼룸 이미지 서비스의 `wearInfo.animation: "Stay.1"`은 실제 PNG 자세를 바꾼다. 같은 아바타 구성 한 건에서 animation 생략과 Stay.1 응답을 대조했고, 해당 HUD 얼굴과의 RGB 평균 오차는 62.3에서 14.6으로 줄었다. 이는 한 외형의 비교이며 일반적인 식별 기준 검증은 아니다.

쇼룸 이미지 서비스는 OpenAPI와 다른 계약을 사용한다. [공식 쇼룸 JS](https://resource.df.nexon.com/showroom/avatar_simulator.app.js?v=20230424)는 아바타 index와 염색 index로 wearInfo를 구성하지만, 네오플 itemId에서 이 index로 변환하는 공개 연결은 확인하지 못했다. [쇼룸 아바타 목록](https://bbscdn.df.nexon.com/data7/showroom/static/json/4_cap.json)에는 이름 중복도 있어 이름만으로 확정 매핑하지 않는다. 아래 변환 정책으로 API의 외형명을 쇼룸에 연결한다. 이 서비스는 공식 OpenAPI와 별도로 변경될 수 있으며, 미지원 응답을 실제 외형 불일치로 해석하지 않는다.

쇼룸의 캐릭터 불러오기는 로그인 계정의 내 캐릭터 목록에서 얻은 별도 캐릭터 번호로 외형 정보를 요청한다. 확인한 UI는 위시리스트와 내 캐릭터 탭이며 임의의 서버, 닉네임 검색 입력은 없다. 이 번호를 OpenAPI characterId와 같은 값으로 취급하거나, 해당 경로를 다른 파티원의 외형 조회 API로 사용하지 않는다. 로그인 응답과 서버의 소유권 검사 방식은 확인하지 않았다.

### Stay 이미지 공급과 캐시

`backend/search/stay-images.ts`의 `createStayImageSource`는 공식 외형 API 응답과 쇼룸의 공개 catalog를 사용한다. 직업명은 공식 쇼룸 목록의 18개 job 번호로 변환하고, 슬롯은 대응하는 부위에 연결한다. clone ID와 이름이 모두 있으면 복사 외형을 우선하며 그 외에는 장착 아이템명을 사용한다. 앞뒤 공백만 제거해 catalog 이름을 비교한다. 같은 직업, 부위, 이름의 후보는 유효한 icon 경로까지 전부 같을 때 첫 index를 대표로 사용한다. 이는 승인된 초기 변환 정책이며 모든 중복 코드의 이미지 동등성을 보장하지 않는다. 서로 다른 icon, 알 수 없는 직업이나 외형은 보류한다.

catalog에 없는 빈 `레어 머리 클론 아바타`와 `무기 클론 아바타`는 확인된 기본 외형 예외로 null을 사용한다. 다른 매핑 실패는 기본 외형으로 바꾸지 않는다. AURORA와 AURA_SKIN은 얼굴 레이어 범위에서 명시적으로 제외한다. 일반 장비 무기는 재구성하지 않으므로 얼굴을 가리는 무기와 효과는 추가 검증 대상이다. color 0은 염색 복원값이 아닌 윤곽 비교용 기본색이다. level은 쇼룸처럼 0, grow는 미리보기 기본값 0을 쓰고 아처의 헌터, 호크 아이, 메이븐, 眞 헌터는 확인된 헌터 미리보기 값 3을 사용한다.

직업별 animation 목록에서 Stay.0, Stay.1, Stay2.0을 확인해 해당 자세들을 반환한다. 지원하지 않는 Stay 표기나 빈 목록은 보류하며 Stand로 대체하지 않는다. 같은 캐릭터의 자세들은 순서대로 비교하고 하나가 통과하면 다음 후보로 넘어가지 않는다. 카탈로그와 렌더링 URL은 고정 Nexon origin에서만 구성하며 API key와 로그인 cookie를 전송하지 않는다. redirect, 자체 재시도와 원문 오류 노출은 허용하지 않는다.

성공한 catalog는 최대 32개, 16MiB, 30분이고 성공 RGBA는 최대 64개, 16MiB, 5분인 메모리 LRU 캐시를 사용한다. factory를 캡처마다 다시 만들지 않는다. 완료값만 공유하므로 한 슬롯의 취소가 다른 슬롯의 진행 중 요청을 취소하지 않지만, 동시에 시작한 최초 요청은 중복될 수 있다. 카탈로그 body는 4MiB, PNG는 기존 4MiB와 해상도, 압축 해제 한도를 적용한다. 외형 API와 catalog, 이미지 요청은 모두 최초 접수부터 15초인 같은 식별 예산에 포함된다.

복원할 수 없는 외형이나 비교 실패는 최고 명성 대체 표시로 이어진다. 이를 외형 일치로 표시하거나 다음 OCR 이름으로 넘어가지 않는다. 후보 검색과 상세 조회의 HTTP 실패, 429는 기존 오류로 전달하며 실행 취소, 만료와 늦은 결과 차단을 유지한다. 명성이 같은 후보는 기존 순서, null 명성은 마지막 순서를 유지한다.

## 크롭 결과 이후의 식별 처리

`backend/search/identify.ts`의 `createCharacterIdentifier`는 후보 검색, 비교할 이미지 목록 확보, 얼굴 비교, 상세 조회라는 업무 연산을 주입받는다. 전달된 OCR 이름 중 첫 번째만 사용하고 첫 이름이 비어 있거나 잘못돼도 두 번째를 승격하지 않는다. 식별 규칙은 HTTP 구현, clock, 취소 신호, 현재 요청 여부와 실행 제어에 의존하지 않는다.

`backend/search/request.ts`는 일반 검색, 지정 서버 수동 조회와 OCR 식별의 요청 경계다. 요청마다 업무 연산을 `operation.ts`의 실행 범위에 연결하고 단일 이미지와 Stay 이미지 응답을 이미지 목록으로 변환한다. 선택된 상세는 슬롯 요약으로 투영하며 `selectionMethod`의 `portrait`, `highest-fame`, `manual`로 선택 근거를 전달한다. HTTP 클라이언트와 Stay 캐시는 요청마다 다시 생성하지 않는다.

첫 이름이 유효하면 한 번 검색한다. 후보가 없으면 조회 실패이며 두 번째 이름을 시도하지 않는다. 후보는 명성 내림차순, null 후순위로 비교하고 처음 통과한 캐릭터를 선택한다. 크롭이 null이거나 외형 확인이 불가능하거나 모두 불일치하면 가장 명성이 높은 후보를 선택한다. 선택한 한 캐릭터의 실제 상세를 조회하고 대체 선택이라는 근거를 카드에 남긴다.

외형 확인 실패는 외형 일치와 구분한 최고 명성 선택으로 처리한다. 실행 계층은 취소와 만료를 우선하므로 중단된 요청이 대체 선택을 발행하지 않는다. 후보나 상세 조회 실패는 기존 정제된 오류로 남고 상세의 호출 제한도 원래 헤더 수신 시각을 보존한다.

`backend/search/operation.ts`는 일반 검색과 식별 흐름에 처음 접수부터 15초인 공통 시간 예산을 적용한다. 요청 경계에 제공하는 `run`이 각 연산의 호출 전, 성공 후, 실패 후에 현재 요청과 남은 예산을 확인하며 전체 결과 전달 전에도 다시 확인한다. 같은 취소 신호를 HTTP와 이미지 연산에 연결하지만 식별 서비스에 검사 콜백을 전달하지 않는다. 캡처가 끝나거나 요청이 오래된 상태이면 늦은 결과를 버리고 시간 초과 후 대체 후보의 상세를 새로 조회하지 않는다. 취소, 만료와 429는 최고 명성 대체 표시보다 우선한다. 외형 응답이 전체 예산을 소모하면 최고 명성 대신 시간 초과가 표시되는 한계가 있다.

`identify.test.ts`는 실행 환경 없이 첫 이름만 사용, 후보 순서, 첫 일치와 최고 명성 선택을 검증한다. `request.test.ts`는 실제 식별기와 요청 경계를 연결해 공통 취소 신호, 15초 예산, 늦은 응답 차단, 실패 우선순위와 공개 결과 변환을 검증한다. 슬롯과 IPC 수명은 기존 통합 테스트를 유지한다.

### OCR 관측 IPC와 슬롯 수명

제품 `App`은 OCR 식별 옵션의 `usePartyCapture`를 사용한다. `usePartyRecognition`은 같은 프레임의 첫 이름과 얼굴 입력이 안정화되면 `notifyOcrCandidatesDetected`로 전달한다. 첫 이름의 원문을 유지하고 두 번째 이름으로 보정하지 않는다. 비교에서 제외한 픽셀의 변화는 같은 얼굴로 취급한다. 조회를 시작한 슬롯은 해당 회차에서 고정하며 이후 프레임 변화로 검색을 재실행하지 않는다. 기본 옵션을 쓰는 `fixture/legacy/LegacyApp`의 `PartyCapture`는 기존 연속 관측 경로를 유지한다.

IPC 입력은 `{ captureId, slot, observationRevision, nickname, candidateNicknames, portrait }`다. Main은 기존 sender, main frame, exact document 검사를 적용하고 후보 개수, 이름, 별칭의 일치, 이미지와 마스크 크기, 배율을 검증한다. 얼굴은 최대 512px/축, 262,144픽셀이며 원본 버퍼를 복사해 보관한다. 이 데이터는 로컬 프로세스 사이에서만 전달하고 API에 업로드하지 않는다.

크롭 null도 후보를 조회해 최고 명성 선택을 시도한다. 비교기를 구성하지 않은 fixture나 API 미설정 상태의 `waiting-policy`는 유지한다. 제품 main은 `portraitEdgeMatchPolicy`를 구성하며 정책은 renderer가 보낼 수 없다. 기존 RGB 정책은 별도의 합성 검증 경로로만 남고 두 정책을 동시에 설정하면 거절한다. clear, 캡처 종료, source와 document 변경은 이전 요청, 얼굴과 선택 상세를 모두 비운다. 수동 카드 조회는 별도 수명에서 같은 취소와 최신성 검사를 적용한다.

성공한 슬롯의 `selected`에는 검증된 기본 요약만 넣는다. 명성, 레벨, 직업과 모험단의 잘못된 표시 타입이나 누락은 null이며 다른 값으로 추정하지 않는다. 전체 상세는 main에 남기고 현재 capture, slot, requestId가 일치할 때만 내부 `selection`으로 읽는다. 이전 선택이 새 슬롯이나 캡처를 덮어쓰지 못하게 한다. Windows 실시간 캡처와 실제 캐릭터 정답을 이용한 일치 기준 검증은 여전히 후속이다.

## 캐릭터별 상세 창

식별된 슬롯의 상세 버튼은 `openCharacterDetails({ captureId, slot, requestId })`를 호출한다. Main은 현재 등록된 renderer와 main frame, 정확한 document, 입력 형태를 검사하고 검색 수명의 `selection`으로 선택된 상세를 읽는다. Renderer가 임의 URL, 서버나 캐릭터 ID, 상세 데이터를 지정해 창을 열 수 없다. 새 창을 읽고 표시하기 전에 선택이 바뀌었는지 다시 확인하며, 로딩 중 캡처가 끝나거나 슬롯이 교체되면 해당 창을 표시하지 않는다.

`backend/character-detail/windows.ts`는 서버와 캐릭터 ID별로 별도 창을 관리한다. 같은 캐릭터를 다시 열면 기존 창을 복원하고 포커스하며, 최초 선택에서 복사한 기본 정보와 `freshness`를 유지한다. 이미 표시한 창은 캡처 중지나 슬롯 변경 이후에도 그대로 읽을 수 있다. 창을 닫고 현재 선택에서 다시 열면 그 선택에 보관된 정보로 새 snapshot을 만들며 추가 HTTP 조회나 자동 갱신은 하지 않는다. 메인 창의 `closed`에서 모든 상세 창과 reader를 정리한다. 취소된 메인 창 닫기 시도만으로 상세 창을 지우지 않는다.

제품은 고정 `character-detail.html`과 전용 preload를 사용한다. `window.characterDetail.read()`만 노출하며 capture, auth, developer bridge는 포함하지 않는다. Main reader는 등록된 상세 창의 WebContents와 현재 main frame, 정확한 document URL, detached와 destroyed 상태를 매번 검사한다. 별도 메모리 session에서 권한 요청과 미디어 접근을 거절하고, 팝업, 외부 탐색과 redirect, webview를 차단한다. 공급자 전체 JSON은 main에 남기며 상세 renderer에는 검증한 기본 요약과 조회 시각만 복사해 전달한다.

`CharacterSnapshotPage`는 이미지, 이름, 서버, 모험단, 직업, 전직, 실제 레벨과 명성, 마지막 조회 시각과 정보 유효 시각을 표시한다. 누락된 값은 `정보 없음`으로 표시하며 고정 레벨, 계산한 장비 점수나 예시 마법부여 등급을 넣지 않는다. 기존 `CharacterDetailPage`와 `DetailDeck`의 장비, 서약, 투자 카드 조합은 합성 미리보기로 남는다. 장비 카드 확장과 마법부여 평가는 이 연결에 포함하지 않는다.

창 수명과 IPC, 기본 정보 화면의 합성 검증은 실제 얼굴 식별 완료와 구분한다. 얼굴 cropper와 Stay 공급원, 초기 윤곽 정책이 제품에 연결되어 일반 캡처의 선택 결과와 상세 창까지 이어진다. API의 candidates와 appearance endpoint가 배포되어야 하며 Windows 실제 게임에서의 연속 캡처 검증은 별도로 필요하다.

## PaddleOCR와 실제 게임 인식 영역

현재 기본 설정은 `korean_PP-OCRv5_mobile_rec` 공식 ONNX 모델이며 `onnxruntime-web`의 로컬 WASM worker로 실행한다. 파인튜닝 모델 선택은 별도 빌드 설정이다. 모델, 문자 목록과 라이선스는 `apps/desktop/assets/ocr`에 고정하고 `provenance.json`에 원본과 checksum을 기록한다. `prepare-ocr-assets.mjs`는 checksum을 검사한 뒤 모델과 설치된 ONNX Runtime의 WASM을 renderer public assets로 복사한다. `.gitattributes`는 vendor assets의 줄바꿈 변환을 막아 Windows checkout에서도 고정 checksum을 유지한다. 이번 전처리 변경은 기본 모델을 교체하지 않는다.

일반 캡처는 [공용 파티 프레임 검출기](desktop-party-geometry.md)가 HP, MP와 주변 경계에서 확인한 닉네임 영역만 원본 크기로 자른다. BT.601 회색 변환과 Otsu 반전 이진화로 밝은 글자를 검게, 어두운 배경을 희게 만든다. 모델 worker에서 높이 48픽셀, 너비 최대 320픽셀로 한 번 리사이즈하고 실제 검은 글자 경계를 입력 폭 320의 가로 중앙으로 이동한다. 글자 크기와 세로 위치는 유지하며 새 좌우 여백은 이진화한 배경과 같은 흰색(정규화 값 1)으로 채운다. 구두점을 제거하는 잡음 필터나 세로 크롭은 추가하지 않는다. 제품 전처리 평가도 같은 중심화 경로를 사용하고 원본 평가만 기존 왼쪽 정렬을 유지한다. CTC 후보 디코더의 1위 문자열만 검색에 사용하며 모델 점수는 정답 확률이나 검색 허용 조건이 아니다.

`createPartyOcrWorker`는 기존 인식 결과 소비 형태와 `terminate`를 유지한다. Capture AbortSignal을 받아 초기화, 인식 중에도 worker를 종료하고 대기 요청을 거절한다. 응답이 없는 요청은 30초 뒤 종료한다. 이전 capture의 결과는 기존 signal, 검색 수명 검사에서 차단하며, 두 번 연속 관측 일치와 공개 검색 연결은 유지한다. 검색은 인증과 독립적이며 sender, source, capture 검사는 유지한다.

[PR #462](https://github.com/blahaj94/ldb/pull/462)에서 Windows 설치 앱의 실제 선택 창 → 영상 → 한 슬롯의 정확한 OCR → 인증 검색, 결과 표시를 확인했다. 이는 당시 Tesseract 빌드의 관측이며 PaddleOCR 전환의 실제 검색 완료 증거와 구분한다. 이번 PaddleOCR 비교는 선택한 게임 창의 허용된 닉네임 영역에서 실제 모델 실행을 확인했으나, 진단 중 검색 전송은 차단했다. UI 100%, 돋움은 비교 조건이며 제품의 지원 배율을 확장한 것이 아니다.

작은 한글 글자와 특정 음절의 오인식은 남아 있다. 한 표본의 근접한 결과나 높은 모델 점수를 전체 정확도로 일반화하지 않는다. 영역 확장, 확대, 색 분리, Gemma 비교와 합성 입력 재현은 [Issue #463](https://github.com/blahaj94/ldb/issues/463)에 기록했으며 정확도 추가 개선은 MVP 이후로 미뤘다. 임시 비교 UI, 문자별 후보와 Gemma 연결은 제품에서 제거한다.

### CTC 후보와 모델 점수

`lib/paddle-recognition.ts`가 내보내는 `decodeCtcCandidates(data, steps, characters, candidateCount = 2)`는 네 번째 인자로 받은 개수까지 `{ rank, modelScore, nickname }`을 반환한다. 생략 시 최대 2개, `5`를 전달하면 최대 5개다. 개수는 양의 안전한 정수여야 하며 잘못된 값은 거절한다. `lib/ctc-candidates.ts`는 시점별 상위 nonblank 문자 16개로 prefix를 확장하고 최대 `max(32, candidateCount)`개를 유지한다. 32개보다 많이 요청하면 탐색 폭과 계산량도 증가한다. Blank 경로와 마지막 문자의 연속 반복은 문자 상위 16개에 포함되는지와 관계없이 합산한다. Blank 없이 이어진 같은 문자는 하나로 합치며 blank로 분리된 반복 문자는 유지한다.

탐색을 마친 뒤 남은 문자열 모두를 CTC forward 계산으로 다시 채점한다. 이 계산은 각 문자열로 축약되는 모든 경로를 원래 출력 확률에서 합산한다. 최종 점수 내림차순으로 요청한 개수까지 고르고 `rank`를 1부터 부여한다. 동점은 사전 token 순서로 결정한다. 후보 탐색은 제한된 beam을 사용하므로 전체 가능한 문자열의 정확한 상위 후보를 보장하지 않는다. Blank만 관측되면 빈 문자열 후보를 유지하며, 후보 수를 채우려고 다른 이름을 만들지 않는다.

`modelScore`는 재계산한 문자열 확률의 100배다. 실제 정답률이나 상위 후보 사이의 상대 비율이 아니며, 반환한 후보 점수의 합을 100으로 맞추지 않는다. 입력은 유한한 0~1의 softmax 확률이어야 한다. 시점별 확률 합과 1의 차이가 0.001 이하면 그 합으로 나누어 보정하고, 범위를 벗어나면 거절한다. Logits에 softmax를 다시 적용하지 않는다. 빌드 준비 단계도 같은 확률 범위와 합계 조건을 검사한다.

`decodeCtc(data, steps, characters)`는 같은 후보 목록의 첫 `nickname` 문자열을 반환한다. Worker는 후보를 한 번 계산한 뒤 `{ text, confidence, candidates }`를 반환한다. `text`와 `confidence`는 각각 1위 닉네임과 `modelScore`를 유지하고, `candidates`에는 최대 두 개의 원문, 순위, 모델 점수를 전달한다. 빈 문자열이나 같은 이름을 worker 경계에서 보정하거나 제거하지 않는다.

`createPartyOcrWorker`는 후보 개수, 1부터 시작하는 연속 순위, 유한한 0~100 점수의 내림차순과 1위 호환 필드의 일치를 확인한다. 초기화와 인식, 실패가 섞인 응답은 거절하고 기존 worker 종료, 취소, 시간 초과 처리를 유지한다. 이 전달 변경만으로 기존 닉네임 안정화나 검색 정책을 바꾸지 않는다. 개발자 평가는 **모델 점수**를 저장된 정답과 비교한 일치율, CER과 구분한다.

## UI 구성

제품 `App`은 네 슬롯의 상태와 `selected` 요약을 각각 `PartyPage`에 전달한다. `lib/character-card.ts`는 기본 정보만 표시 값으로 바꾸며 누락된 명성을 0으로 대체하거나 장비 점수를 계산하지 않는다. 실제 선택 identity가 바뀌면 카드의 편집 초기 상태도 교체해, 늦게 도착한 결과를 이름 수정 중으로 오인하지 않는다. 제품은 기본 면만 표시하며 식별된 슬롯의 상세 버튼으로 해당 캐릭터의 기본 정보 창을 연다. 창 열기 실패는 정제한 안내로 표시하고 이전 선택의 늦은 실패를 새 슬롯에 표시하지 않는다.

카드는 중앙 진행 표시와 조회 완료, 빈 결과, 정제된 오류를 구분한다. 최고 명성 대체 결과는 외형 일치와 다르게 표시한다. 서버와 닉네임은 항상 수정할 수 있으며 Enter나 서버 변경으로 수동 조회한다. Alt+R은 기존 결과를 비우고 전체 OCR부터 새로 실행한다. 합성 미리보기의 이전 대기 상태와 재시도 시나리오는 제품의 새 회차 동작과 구분한다. Electron의 화면 확인은 실제 게임의 얼굴 식별 정확도 검증을 대신하지 않는다.

## 실제 자료와 평가 범위

테스트 수집은 원본, 닉네임 좌표와 전체 슬롯 좌표를 보관하고 정답은 미작성 상태로 남긴다. 운영 자료의 정답이나 train, val, test 배정은 자동 변경하지 않는다. 현재 자료실 분할은 같은 정답 닉네임을 한 집합으로 묶는다. 동일 원본이나 연속 프레임의 서로 다른 닉네임까지 같은 집합으로 묶는 보장은 없으므로 실제 모델 평가 자료를 선정할 때 원본과 인접 캡처의 중복을 함께 검토해야 한다.

제품과 개발자 평가의 `party` 전처리는 같은 worker 경로다. 별도 학습 저장소의 전처리와 학습된 가중치의 실제 입력분포 일치는 이 변경에서 검증하지 않았다. 글자 가운데 정렬의 픽셀 검증을 인식률 향상으로 보고하지 않으며 새 val, test에서 완전 일치율과 CER을 재평가해야 한다. 기본 모델을 자동 교체하거나 학습 작업을 실행하지 않는다.

캡처 화면은 게임 창, 인식 간격, 캡처 시작/중지를 한국어로 표시한다. 1920×1080 테두리 없는 창 모드, UI 배율 50%와 닉네임이 보이는 상태를 안내하며, 인식 대기나 오인식 때 닉네임 수정, 직접 검색으로 이어진다. 창 선택, 캡처 준비, OCR 준비, 실행, 종료 상태는 계속 유지되는 `role="status"` 영역에서 표시한다. 창 목록 실패는 게임 실행 후 앱 다시 열기, 선택 실패는 창 다시 선택, 영상, OCR 실패는 해당 단계의 복구 안내를 제공한다. 외부 오류 원문을 화면으로 전달하지 않는다. 지원 해상도, 배율과 검색, 캡처 수명은 바꾸지 않는다.

기존 `@dfragon/ui`의 ActionButton, ContentStack, ExampleSection, SupportingText를 조합한다. 후보의 ordered list와 슬롯별 이름 있는 section은 DFragon composition이며 공용 자산의 외형을 덮어쓰는 CSS, style은 없다. 각 슬롯에는 “슬롯 1 검색” 형태의 접근 가능한 이름, 진행 시 `aria-busy`와 상태 안내가 있다. Retry의 loading과 disabled는 함께 적용하며 한 슬롯의 진행이 다른 슬롯 버튼을 막지 않는다.

Keyboard, focus, 좁은 화면, theme, reduced-motion의 실제 Electron 관측은 최종 실행 head의 Issue/PR evidence에 기록한다. 공용 spinner의 기존 motion 동작을 변경하지 않으며 unit 성공을 native UI 검증으로 대신하지 않는다.

## 검증 경계

```sh
pnpm --filter @dfragon/desktop exec vitest run src/backend/search src/backend/capture src/preload src/frontend/src/sections src/frontend/src/lib src/frontend/src/integration src/frontend/src/components
pnpm --filter @dfragon/desktop run --sequential '/^(test|lint|build)$/'
git diff --check
```

일반 tests는 API, DB, native media를 실행하지 않는다. 실제 #125 API, disposable DB 소비 검증은 `apps/desktop/scripts/search-server-integration/README.md`의 별도 command와 격리를 따른다. 이는 Desktop HTTP 클라이언트 소비 검증이며 auth waiter, slot, IPC, renderer, 실제 stream/OCR 성공을 대신하지 않는다. 최종 head의 unit/build, 독립 review, 실제 UI/media, 서버 검증 결과는 Issue #144와 PR #149에서 관리한다.

## 이번 전환의 검증

실제 Electron의 local PaddleOCR worker에 공개 합성 문자열을 전달한 단독 인식과 종료 정리는 통과했다. 실제 게임 영상의 PaddleOCR 진단 관측은 위에 구분하며, 새 공개 API를 포함한 Windows 설치 앱의 전체 게임 검색 흐름을 다시 확인한 것으로 주장하지 않는다. 정확도 후속 Issue #463은 열어 둔다.

## 직접 검색과 수정 검색

직접 검색과 슬롯 검색은 같은 `CharacterCandidates.tsx`로 후보를 표시한다. 닉네임, 서버명, 명성을 한 묶음으로 보여주고 서버 ID, 캐릭터 ID는 기본적으로 접힌 ‘식별 정보’에서 확인한다. 후보 값과 서버 응답 순서를 유지하며 명성은 자릿수 구분을 적용하고 `0`과 `null`을 구분한다. 알 수 없는 서버는 응답 ID를 표시한다. 화면 전용 CSS는 SEED token을 사용하며 긴 문자열을 줄바꿈한다. Native `details`의 키보드 동작과 focus 표시를 유지한다. 검색 상태와 완료 시 결과 수는 같은 `role="status"` 영역의 내용을 갱신하며, 후보 목록은 이 영역 밖에 표시한다.

`ManualSearch.tsx`는 캡처 없이 독립 검색 폼과 결과를 제공한다. `manual-ipc.ts`는 별도의 `createCaptureSearchLifetime` 인스턴스로 기존 HTTP, 입력, 오류, 429, 취소 구현을 재사용한다. 직접 검색의 시작과 종료는 실제 capture/media 수명을 변경하지 않는다. 공유 DTO의 이름을 제품 안내에 노출하지 않는다.

`SlotNicknameEditor.tsx`와 `useCharacterSearch.ts`는 수정 중 입력을 유지하고 해당 슬롯의 OCR 검색 제출만 멈춘다. 뒤에 관측한 OCR은 임시로 보관해 ‘OCR 다시 사용’ 때 반영하며, 다른 슬롯은 계속 검색한다. Clear/revision을 통해 수정 전 검색의 늦은 결과를 차단한다. 입력 검사는 `manual-input.ts`와 main의 기존 검색 입력 검사를 사용한다.

관련 UI, hook, IPC 검증은 합성 이름을 사용한다. 실제 설치 앱과 게임 확인 결과는 이번 PR에서 fixture 성공과 구분해 기록한다. 추가 OCR 튜닝은 #463의 MVP 이후 범위를 유지한다.

직접 검색은 성공, 0건 결과를 받은 뒤 같은 닉네임도 다시 제출할 수 있다. 진행 중 같은 입력의 중복 제출은 막고, 실패는 기존 retry 경로와 429 대기를 유지한다. 입력 길이는 API와 같은 2–12 Unicode 코드 포인트 기준이며, UTF-16 코드 유닛이나 화면상 글자 묶음(grapheme) 기준으로 변경하거나 정규화하지 않는다. 검색 action과 명령 오류는 shared `SEARCH_ACTIONS`, `SEARCH_COMMAND_ERRORS`에서 타입과 runtime 검증 값을 함께 정의한다.
