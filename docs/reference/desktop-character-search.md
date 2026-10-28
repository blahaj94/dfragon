---
type: reference
status: active
scope: desktop OCR character search implementation and verification
last-reviewed: 2026-10-27
---

# Desktop 캐릭터 검색

Alt+R이나 파티 헤더의 캡처 버튼으로 시작한 회차 프레임 한 장의 OCR 첫 번째 이름을 네 슬롯 검색으로 연결한다. 창 선택과 던파 창 하나 자동 감지는 main에 창만 등록하며 인식은 시작하지 않는다. Desktop에는 로그인이 없으며 제품 main은 고정 API origin만으로 공개 검색을 구성한다. 자동 조회를 마친 슬롯은 다음 회차 시작 전까지 유지하고 수동 서버, 닉네임 조회만 해당 슬롯을 교체한다.

Windows 제품의 [캡처 정책](../rules/desktop-windows-capture.md#windows-제품-캡처-정책)은 공통 GDI 구현으로 선택한 창의 보이는 클라이언트 영역을 읽는다. Main이 창, 프로세스와 캡처 수명을 검증하며 다른 창에 가려진 픽셀은 제외한다. 전체 가림, 최소화나 파티 프레임 미검출로 회차 프레임을 쓸 수 없으면 안내하고 인식을 끝낸다. 자동 재읽기나 화면 복귀 후 재개는 하지 않으며 사용자가 Alt+R을 다시 누른다. 제품의 Electron media 권한은 거절한다.

## 구현 위치

| 위치                                                                                                                                                           | 책임                                                                                                                                                                 |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/desktop/src/backend/capture/ipc-handler.ts`                                                                                                              | 현재 source/document와 capture를 결합하고 검색 IPC를 같은 수명에서 검사한다. Navigation, destruction, renderer process 종료, source 변경 때 요청을 무효화한다.        |
| `apps/desktop/src/backend/search/capture-lifetime.ts`, `slot-lifetime-machine.ts`                                                                              | 함수 factory가 슬롯 DTO, 관측 revision을 관리하고 XState actor가 슬롯별 HTTP 취소와 429 대기를 소유한다.                                                              |
| `apps/desktop/src/backend/search/request.ts`                                                                                                                   | 입력 접수부터 HTTP, body 검증까지 하나의 검색 예산과 취소 판정을 수행한다.                                                                                            |
| `apps/desktop/src/backend/search/card-assembler.ts`                                                                                                            | 상세 응답의 `card`에서 역할만 읽고 그 역할로 계산기를 골라 점수 엔진 결과를 채운다.                                                                          |
| `apps/desktop/src/backend/score/input.ts`, `engine.ts`                                                                                                         | 상세 응답을 엔진 입력 문서로 되돌리고, koffi로 연 라이브러리의 호출, 해제, 결과 검증과 실패 정제를 맡는다.                                                           |
| `apps/desktop/scripts/prepare-score-engine.mjs`, `apps/desktop/score-engine.config.mjs`                                                                        | `@dfragon/models`의 score-engine submodule에서 플랫폼별 엔진을 `resources/score/`로 복사한다. submodule을 받지 않았으면 건너뛴다.                                     |
| `apps/desktop/src/backend/search/http.ts`                                                                                                                      | 고정 `GET /characters`, 선택 query 생략, HTTP/UTF-8/JSON/전체 후보 검증과 다섯 field projection을 수행한다.                                                          |
| `apps/desktop/src/backend/search/retry-after.ts`                                                                                                               | 헤더 수신 시각부터 남은 시간을 검사하고 긴 timer를 지원 범위 안에서 나눠 예약한다.                                                                                   |
| `apps/desktop/src/preload/common/types/search.ts`, `common/search/snapshot.ts`                                                                                 | Shared DTO, 오류 문구, feature API와 exact own shape, 상태 조합 검증을 정의한다.                                                                                        |
| `apps/desktop/src/preload/api/search.ts`, `search-command.ts`, `capture.ts`                                                                                    | `window.search`의 제어/구독과 기존 `window.api`의 확장된 OCR 통지를 연결한다. Electron event와 부적합 DTO는 전달하지 않는다.                                         |
| `apps/desktop/src/frontend/src/lib/search-connection.ts`, `search-connection-machine.ts`                                                                       | XState actor가 구독 후 read, event 동기화와 run/revision 순서를 관리하고, 명령 응답 유실은 read로만 확인한다.                                                         |
| `apps/desktop/src/frontend/src/lib/capture-search.ts`, `capture-search-machine.ts`, `apps/desktop/src/frontend/src/hooks/useCharacterSearch.ts`                | XState가 Start별 시작, 종료 수명을 관리하고, factory와 hook은 로컬 관측 revision, 결과 필터, 슬롯별 retry를 연결한다.                                                   |
| `apps/desktop/src/frontend/src/lib/party-capture-machine.ts`, `apps/desktop/src/frontend/src/lib/party-recognition.ts`                                     | 이전 검색, 인식 상태를 비우고 begin 완료 뒤 프레임 한 장으로 OCR과 검색을 연결한다. 늦은 begin의 자기 ID 정리와 회차 종료 뒤 결과 차단을 유지한다.                              |

`createCaptureSearch`는 호출마다 연결, actor, 관측 상태를 클로저에 보관하고 제어 함수를 반환한다. 표시할 슬롯의 계산은 상태를 변경하지 않는 순수 함수로 분리한다. 캡처 검색 수명은 `idle → starting → active`와 `invalidated`, 최종 `disposed` 상태로 관리한다. 새 begin, end, 무효화, dispose는 이전 시작 actor를 종료한다. 시작 actor는 종료 뒤에도 직접 응답을 기다려 자신이 생성한 늦은 ID만 end하고 호출자에게 null을 반환한다. Main이 종료를 알린 수명은 로컬 상태만 비우며 END를 중복 전송하지 않는다. 슬롯의 관측 revision, clear, 결과 필터, retry 정책은 기존 일반 로직을 유지한다.

Begin의 직접 성공 응답만 해당 Start가 소유한 ID로 사용한다. 응답이 유실되면 read로 상태를 확인하지만 그 결과의 ID를 늦은 Start의 소유로 추정해 end하지 않는다. 해당 시작은 창을 다시 선택하도록 안내하며 같은 begin을 자동 재전송하지 않는다. 새 source 선택은 기존 main 선택/capture 무효화 경로를 사용한다.

`createCaptureSearchLifetime`은 각 슬롯에 XState actor를 만든다. 요청을 준비한 뒤 pending snapshot을 동기 발행하고, 해당 요청이 여전히 유효할 때만 HTTP를 시작한다. 새 이름의 관측, clear, end는 이전 요청과 429 timer를 취소한다. 같은 이름의 새 관측은 기존 요청의 observation revision만 올리며, 15초 예산을 재시작하지 않는다. 429 대기가 끝나면 retry 가능 상태만 발행하고 GET을 자동 재전송하지 않는다.

`createSearchConnection`은 연결마다 별도 XState actor를 클로저에 보관한다. `isReady()`는 호출 시점의 동기화 상태를 읽고, 명령은 호출 당시 actor를 참조해 재연결 후 늦은 응답을 격리한다. 구독의 초기 기준과 마지막 조회의 성공 여부를 병렬 상태로 표현한다. 이미 초기 기준을 세운 연결은 복구 조회에 실패해도 후속 event를 표시할 수 있지만, 다시 조회에 성공하기 전까지 새 begin은 차단한다. 초기 조회 성공 전 event는 최신 revision만 보류하며, 재연결, dispose는 이전 actor와 구독을 종료한다. 슬롯별 명령은 직렬화하지 않고 직접 응답을 각각 돌려준다. 종료된 actor에는 명령, 복구 조회 결과를 반영하지 않지만, 늦은 begin의 직접 응답과 그 ID의 end 전송은 캡처 정리를 위해 유지한다.

검색 run이 바뀌면 이전 구독, 표시, capture resource를 버리고 새 검색 조회를 시작한다. 초기 read가 성공하기 전에는 Start와 직접 begin 호출을 차단하며, 조회 실패 시 기존 앱 화면 다시 열기 안내를 유지하고 event만으로 회복하거나 자동 재시도하지 않는다. 로컬 관측, clear, Stop, source 변경은 main 응답을 기다리지 않고 이전 표시를 가린다. Renderer와 preload는 같은 DTO 검증기를 각각의 경계에서 사용한다.

## 공통 Windows 화면 획득

`backend/lib/win32-window-capture.ts`와 `win32-pixels.ts`가 창 선택 시점의 프로세스 결합, DPI 처리, GDI 복사, 가림 확인과 자원 정리를 소유한다. `backend/capture/native-frame.ts`는 일반 캡처용 프레임 또는 고정 대기 사유를 만든다. 각 기능의 오류와 저장 정책은 공통 lib로 옮기지 않는다.

`readCaptureFrame(captureId)`는 현재 선택한 창에만 결합된 읽기를 실행한다. 등록 문서와 source/capture 수명이 읽기 전후에 일치해야 하며, 임의 창 ID나 좌표를 renderer에서 받지 않는다. Preload는 반환된 RGBA 크기를 검증한다. 공통 lib는 네이티브 호출을 마치기 전에 자원과 DPI를 정리한다.

회차를 시작하면 이전 검색, 인식 상태를 비우고 검색 수명을 시작한 뒤 프레임을 한 장만 읽어 보관한다. 영상 스트림과 HTMLVideoElement를 만들지 않는다. `party.ts`는 이 RGBA 프레임에서 네 슬롯의 닉네임과 얼굴 크롭을 생성한다. OCR과 얼굴 비교 검색에 같은 프레임을 사용한다. 일부 슬롯이 가려지거나 미검출이면 그 슬롯은 비워 두고 검색하지 않으며 나머지는 처리한다. 처리를 마친 뒤에는 다음 회차 시작, 창 변경, 중지 전까지 일반 인식용 프레임을 읽지 않는다. 재시도는 보관한 회차 입력과 결과를 사용하며 수동 조회도 새 프레임을 읽지 않는다. 진행 중이나 완료 뒤 Alt+R과 캡처 버튼은 이전 회차를 정리하고 처음부터 다시 시작하며 늦은 프레임이나 OCR 결과는 버린다. 검색 수명을 시작하는 동안 누른 Alt+R과 캡처 버튼은 무시한다. 창 변경은 회차와 검색 수명을 정리하고 새 창만 등록한다. 중지 뒤에는 창을 다시 선택한 다음 Alt+R이나 캡처 버튼을 눌러야 한다.

## OCR 식별용 HTTP 통신 준비

`apps/desktop/src/backend/search/character-http.ts`는 후보 조회, 캐릭터 이미지 다운로드, 상세 조회를 위한 main 전용 클라이언트를 제공한다. 전달 가능한 데이터 형태는 `apps/desktop/src/preload/common/types/character.ts`에 두며, API 앱의 소스를 직접 import하지 않는다.

- `createCharacterCandidatesHttp`: 이름 하나로 고정 `GET /characters/candidates`를 호출한다. 응답의 이름, 지원 서버, 캐릭터 ID와 이미지 URL을 검증하고 공급자가 반환한 후보 순서를 유지한다. `adventureName`은 후보 고르기 화면에만 쓰며, API가 보내지 않으면 null로 받는다.
- `createCharacterImageHttp`: 검증한 서버와 캐릭터 ID로 네오플의 `zoom=1` 이미지 URL을 직접 구성한다. 임의 URL을 받지 않으며 PNG 다운로드와 디코딩의 크기를 제한한다. 결과는 전체 캐릭터 이미지의 원본 RGBA이며 얼굴 비교 결과가 아니다.
- `createCharacterDetailsHttp`: 고정 상세 경로를 호출하고 요청한 서버, 캐릭터 ID와 응답의 식별자가 일치하는지 검사한다. 기본 정보와 섹션 JSON을 전달하며 장비 점수를 계산하지 않는다.

각 클라이언트는 호출자의 AbortSignal을 사용하고 자동 재시도나 새로운 전체 검색 시간 예산을 만들지 않는다. 호출 제한은 헤더를 받은 시점을 함께 전달하며, 상세 조회의 오류도 기존 검색 오류 형태로 정제한다. 원격 오류 원문은 화면으로 전달하지 않는다.

제품의 OCR 전용 관측은 아래 IPC 경로로 식별 함수를 사용한다. 기존 수동 검색은 `/characters`의 일반 검색을 유지하며 카드의 수동 서버 조회는 지정한 서버와 이름에 맞는 실제 캐릭터 상세를 선택한다. API origin이 설정된 제품은 후보 이미지 다운로드와 색 비교를 연결한다. 얼굴 크롭을 사용할 수 없어도 이름 검색 결과가 있으면 최고 명성 후보를 대체 표시한다. HTTP 클라이언트 테스트와 실제 게임의 식별 성공을 구분한다.

## 얼굴 크롭의 교체 경계와 비교 입력

`lib/party.ts`의 `capturePartyRecognitionInputs`는 한 번 읽은 원본 RGBA에서 닉네임과 얼굴 입력을 같은 슬롯에 묶는다. 닉네임에는 기존 OCR 전처리를 적용하고 얼굴 cropper에는 전처리하지 않은 전체 프레임, 검출된 닉네임 영역과 래스터 배율을 전달한다. 이 입력을 `lib/party-recognition.ts`의 `recognizePartyFrame`이 슬롯별로 인식한다.

실제 얼굴 위치는 `lib/party-portrait.ts`의 `cropPartyPortrait`가 소유한다. 검출된 HP, MP 시작점의 왼쪽 28 기준 픽셀, 화면 위쪽 11 기준 픽셀에서 26×26 기준 픽셀 영역을 관측 래스터 배율로 투영한다. 기준은 높이 600px의 기본 HUD이며, 실제 영상에서 새로 검출한 각 슬롯의 x와 배율을 사용한다. 원본 RGBA를 복사하고 화면 밖 영역이나 처리 한도를 넘는 영역은 null로 반환한다. 해상도나 파일명, 게임 UI 설정 퍼센트로 좌표를 고정하지 않는다.

크롭 결과 `CharacterPortrait`는 `image: { width, height, rgba }`, `rasterScale`, 선택적 `validMask`다. 현재 cropper는 게임 UI 퍼센트가 아닌 관측 HUD 래스터 배율을 전달한다. 비교기는 이 값으로 기본 크기를 복원하지만 API 스프라이트와 모든 외형의 얼굴이 동일하게 대응한다는 보장은 아직 없다. 마스크는 얼굴 이미지의 픽셀 수와 같은 길이이며, 왕관이나 PC 표시 등 제외할 픽셀은 0, 사용할 픽셀은 1이다. 마스크가 없으면 투명하지 않은 얼굴 픽셀을 모두 사용한다.

얼굴 마스크는 기준 픽셀로 바깥쪽 1px, 위쪽 2px과 좌우 위 모서리 각각 12×9px을 제외한다. 파티장 왕관, PC 표시와 테두리가 없는 슬롯에도 같은 영역을 제외해 장식 변화가 다른 얼굴 관측을 만들지 않게 한다. 비교에 남는 얼굴 정보가 줄어들므로 이 마스크의 적용 자체를 캐릭터 식별 정확도나 일치 기준의 검증으로 해석하지 않는다.

### 연결중과 가려진 슬롯

`연결중..` 팝업이 닉네임, 얼굴과 HP, MP의 왼쪽을 가린 표본에서는 기존 프레임 검출기가 정상 1번만 반환하고 2~4번을 제외한다. 검출하지 못한 슬롯은 닉네임과 얼굴 전체를 null로 취급하므로 OCR과 후보 검색을 시작하지 않는다. 실제 닉네임일 수 있는 `연결중` 문자열을 금지어로 처리하지 않는다.

미검출 슬롯은 해당 회차에서 빈 상태로 남기며 팝업이 사라져도 자동으로 인식하지 않는다. 정상으로 검출된 슬롯은 같은 회차 프레임으로 독립적으로 처리한다. 해당 회차에서 이미 조회한 슬롯은 팝업, 반짝임이나 파티원 변경으로 지우지 않는다. 새 화면을 인식하려면 Alt+R로 전체 회차를 다시 시작한다. 레거시 회귀 테스트 화면도 같은 회차 방식을 사용한다.

### 얼굴 비교와 일치 기준

`backend/search/portrait-color.ts`의 `createPortraitColorScorer`는 파티 얼굴과 후보의 네오플 캐릭터 이미지를 같은 N×N 셀로 뭉갠 평균 RGB로 비교한다. 후보 쪽 셀 평균은 채널 합과 불투명 개수의 적분 영상으로 구해 창 위치마다 시도한다. 거리가 같으면 비교한 셀이 많은 창, 그다음 위쪽, 왼쪽 창이다.

창을 시도하는 범위는 후보 직업으로 정한다. 네오플 이미지(zoom=1, 200×230)는 캐릭터의 발 위치가 고정이라, HUD 얼굴이 놓이는 자리는 아바타와 무관하게 기본 직업의 체형으로 정해진다. `backend/search/portrait-anchor.ts`의 `portraitAnchorOf`가 기본 직업명별 얼굴 창 좌상단을 돌려주고, 비교는 그 위치에서 `anchorRadius` 안만 본다. 표에 없는 직업(외전, 신규 직업)이나 직업을 모르는 후보는 불투명 영역 위쪽 `topFraction` 범위 전체에서 창을 찾는다.

직업별 위치는 2026-10-20에 직업마다 실제 HUD 캡처 한 건을 그 캐릭터 이미지에 맞춰 잰 값이다. HUD 초상화와 캐릭터 이미지는 같은 그림이 아니어서 무기나 뒷머리가 한쪽에만 그려지기도 하며, 위치에는 ±2px 오차가 있다. 직업 전체를 훑으면 오답 후보에서도 옷이나 이펙트처럼 색이 비슷한 곳이 잡히는데, 얼굴 자리만 비교하면 이런 우연한 일치가 줄어든다. 후보 창의 초상화도 이 창을 보여 주므로 후보마다 얼굴이 같은 자리에 나온다.

반환값은 `{ distance, coverage, comparedCells, alignment }`다. `distance`는 비교한 셀의 평균 RGB 채널 절대 차이 평균(0~255)이고, `coverage`는 얼굴 유효 픽셀이 있는 셀 면적 중 후보 창의 불투명 비율이다. `comparedCells`는 양쪽에 픽셀이 있는 셀 수, `alignment`는 후보 이미지 안의 창 좌표와 크기다. 확률이나 일치 판정이 아니다. 비교할 셀이 부족하거나 coverage가 낮으면 null이고, 단색이나 전체 투명, 전체 제외 얼굴도 점수를 만들지 않는다. 입력 검증, 불투명 영역 찾기, 계산 예산과 event loop 양보, 관측 래스터 배율 정규화는 `backend/search/portrait-raster.ts`가 소유한다. 원본 버퍼는 바꾸지 않고, 취소와 예산 초과는 불일치로 숨기지 않고 그대로 던진다.

`backend/search/portrait-policy.ts`의 `INITIAL_PORTRAIT_COLOR_POLICY`가 비교와 선택 기준을 정한다. main이 신뢰할 설정으로 주입하며 renderer는 바꿀 수 없다.

| 값 | 기준 | 뜻 |
| --- | --- | --- |
| `gridSize` | 8 | 얼굴과 후보 창을 나누는 가로, 세로 셀 수 |
| `minCoverage` | 0.5 | 후보 창의 불투명 비율 하한 |
| `minComparedCells` | 6 | 비교한 셀 수 하한 |
| `topFraction` | 0.5 | 직업별 위치가 없을 때 후보 창의 위쪽 끝이 놓일 수 있는 범위(불투명 영역 높이의 위쪽 비율) |
| `anchorRadius` | 2 | 직업별 위치에서 창을 옮겨 볼 가로, 세로 거리(px) |
| `maxDistance` | 40 | 1위 후보의 거리 상한(포함) |
| `minMargin` | 3 | 1위와 2위의 거리 차이 하한(포함) |
| `maxCandidates` | 6 | 명성 순으로 비교할 후보 수 |

값은 로컬 실표본 평가로 정했다. 실제 이미지, 캐릭터명과 플레이어 식별자는 저장소와 CI에 포함하지 않는다.

### 외형이 같은 후보의 한계

서버가 다른 동명 후보의 아바타가 사실상 같으면 색으로 가를 수 없다. [Issue #756](https://github.com/blahaj94/dfragon/issues/756) 결정에 따라 이 경우에도 거리 1위를 고르고, margin이 `minMargin`에 못 미치므로 카드에 후보를 보여 사용자가 바로잡게 한다. 최고 명성 후보로 대체하면 색 비교가 이미 걸러 낸 다른 외형을 고를 수 있어서다.

### 후보 이미지 공급과 캐시

`backend/search/character-image-source.ts`의 `createCharacterImageSource`는 `createCharacterImageHttp`를 감싸 네오플 캐릭터 이미지의 다운로드를 직렬로 만들고 성공한 이미지만 공유한다. main이 `registerCaptureIpc`마다 하나를 만들어 일반 캡처, 파티 카드의 수동 조회와 공대 수명이 같은 큐와 캐시를 쓴다.

- **큐**: 동시 다운로드는 1개이며 FIFO다. 슬롯 4개가 동시에 식별을 시작해도 이미지 요청은 한 번에 하나만 나간다.
- **취소**: 각 요청은 자기 신호만 쓴다. 대기 중에 취소하면 요청을 시작하지 않고 큐에서 빠지며, 한 슬롯의 취소가 다른 슬롯의 요청을 중단하지 않는다.
- **캐시**: `completed-cache.ts`의 메모리 LRU로 최대 64개, 16MiB, 5분이다. 캐시 hit는 대기열을 건너뛰며, 대기하는 동안 앞 요청이 같은 캐릭터를 받았으면 그 값을 쓴다. 완료값만 공유한다.
- **요청 주소**: 이미지는 검증한 서버와 캐릭터 ID로 구성한 `img-api.neople.co.kr/df/servers/{serverId}/characters/{characterId}?zoom=1`에서 받는다. API key와 로그인 cookie를 보내지 않는다.
- **429**: 이미지 응답의 429는 `SEARCH_RATE_LIMITED`와 `retryAfterSeconds`로 바뀌어 점수 없음으로 처리하지 않는다.
- **정책 등록**: 비교 정책은 `registerCaptureIpc` 등록 때 한 번 검증한다. 잘못된 정책은 등록을 거절하고, renderer는 정책을 보낼 수 없다.

이미지를 받지 못하거나 점수가 없는 후보는 거리 없이 남고, 나머지 후보의 비교는 계속한다. 그 후보를 얼굴 일치로 표시하거나 다음 OCR 이름으로 넘어가지 않는다. 후보 검색과 상세 조회의 HTTP 실패, 429는 기존 오류로 전달하며 실행 취소, 만료와 늦은 결과 차단을 유지한다. 명성이 같은 후보는 기존 순서, null 명성은 마지막 순서를 유지한다.

후보 검색과 상세도 같은 main runtime의 메모리 LRU를 일반 캡처, 공대, 수동 조회가 공유한다. 이름별 후보는 최대 256개, JSON 크기 합계 8MiB, 서버와 캐릭터 ID별 상세는 최대 128개, 64MiB로 제한한다. 상세 한 응답의 HTTP 상한은 8MiB이며 여러 캐릭터를 담도록 총량을 정했다. 둘 다 성공 완료 후 5분 동안 보관하고 실패, 취소와 진행 중 요청은 공유하지 않는다. 반환값을 복제해 호출자의 변경이 캐시에 영향을 주지 않는다.

## 크롭 결과 이후의 식별 처리

`backend/search/identify.ts`의 `createCharacterIdentifier`는 후보 검색, 후보 이미지 한 장 확보, 얼굴 거리 계산이라는 업무 연산과 선택 기준(`maxDistance`, `minMargin`, `maxCandidates`)을 받는다. 전달된 OCR 이름 중 첫 번째만 사용하고 첫 이름이 비어 있거나 잘못돼도 두 번째를 승격하지 않는다. 식별 규칙은 HTTP 구현, clock, 취소 신호, 현재 요청 여부와 실행 제어에 의존하지 않는다.

`backend/search/request.ts`는 일반 검색, 지정 서버 수동 조회와 OCR 식별의 요청 경계다. 요청마다 업무 연산을 `operation.ts`의 실행 범위에 연결하고, 후보 이미지 다운로드와 거리 계산을 식별기에 이어 준다. 선택된 상세는 슬롯 요약으로 투영하며 `selectionMethod`의 `portrait`, `job`, `fame`, `highest-fame`, `manual`로 선택 근거를 전달한다. `job`, `fame`은 공대 식별에서만 나온다. 선택을 확정하지 못했으면 사용자가 고를 후보를 `choices`로 함께 전달한다. HTTP 클라이언트와 이미지 큐, 캐시는 요청마다 다시 생성하지 않는다.

첫 이름이 유효하면 한 번 검색한다. 후보가 없으면 조회 실패이며 두 번째 이름을 시도하지 않는다. 후보는 명성 내림차순, null 후순위로 정렬하고 상위 `maxCandidates`명 전원의 얼굴 거리를 구한 뒤에 고른다. 한 후보의 이미지나 점수가 없어도 나머지 후보를 계속 비교한다.

- **선택**: 거리를 구한 후보 중 가장 가까운 후보를 `portrait`로 선택한다. 거리가 같으면 명성 순서가 앞선 후보다. 거리를 하나도 구하지 못했으면 가장 명성이 높은 후보를 `highest-fame`으로 선택한다.
- **확정**: 1위 거리가 `maxDistance` 이하, 2위와의 차이가 `minMargin` 이상이고 비교한 후보 전원의 거리가 있을 때만 확정이며 `choices`가 없다.
- **후보**: 확정하지 못하면 `choices`에 비교한 후보를 명성 순서로 담는다. 거리를 하나도 구하지 못했으면 동명 후보 전부다. 후보마다 서버, 캐릭터 ID, 이름, 명성, 저장된 모험단명과 얼굴 창을 담고 거리는 담지 않는다. 얼굴 창은 색 비교가 맞춘 창(`alignment`)이고, 비교하지 못한 후보는 직업별 얼굴 위치(`portraitFaceWindowOf`)이며, 직업 위치도 모르면 null이다.
- **후보 한 명**: 2위와 비교할 수 없어 이미지를 받지 않고 `choices` 없이 `highest-fame`이다. 얼굴이 없으면 이미지를 받지 않고 동명 후보 전부를 `choices`로 둔 `highest-fame`이다.

식별기는 후보를 고르는 데까지만 하고 상세를 조회하지 않는다. `request.ts`는 OCR 식별의 결과를 후보 검색 응답으로 만든 요약(레벨, 길드, 카드 null)과 `details: 'pending'`으로 돌려준다. 지정 서버 수동 조회는 같은 요청에서 `runDetailsRequest`와 같은 상세 조회, 점수 계산을 이어 상세까지 채운다.

`capture-lifetime.ts`는 `details: 'pending'`인 슬롯의 상세를 수명마다 한 번에 하나씩 `runDetailsRequest`로 받는다. 어느 슬롯이든 `pending` 상태면 시작하지 않아 회차의 모든 슬롯이 이름과 서버를 먼저 정한다. 다음 상세는 슬롯 번호 순서로 고르고, snapshot을 발행할 때마다 시작할 수 있는지 다시 본다. 상세 요청은 그 요청을 접수한 때부터 15초 예산을 쓰며, 같은 캡처, 같은 요청 ID이고 아직 `pending`일 때만 결과를 반영한다. 성공하면 상세로 만든 요약으로 바꾸고 `details`를 지운다. 실패와 시간 초과는 그 슬롯만 `details: 'failed'`로 두고 고른 이름과 서버를 유지한 채 다음 슬롯으로 넘어간다. 상세나 후보 검색의 429는 남은 `pending` 슬롯까지 모두 `failed`로 바꿔 제한 중에 요청을 더 보내지 않는다. 게임 창 변경의 `cancelOcrRequests`도 OCR로 시작한 슬롯의 받는 중인 상세를 취소하고 남은 상세를 `failed`로 둔다. 슬롯 취소와 수명 무효화는 받는 중인 상세의 신호를 취소한다. OCR 관측이 IPC로 따로 도착하므로, 앞 슬롯의 후보 검색이 캐시로 바로 끝나면 뒤 슬롯을 관측하기 전에 상세가 먼저 시작될 수 있다. 이때는 같은 회차의 다른 슬롯도 같은 캐시로 바로 끝나 이름과 서버 표시가 늦어지지 않고, 상세 동시 요청은 여전히 하나다. 회차의 관측이 모두 도착했다는 신호는 renderer가 보내지 않는다.

거리를 하나도 구하지 못한 최고 명성 선택은 얼굴 일치와 구분해 진단 코드 `SEARCH_APPEARANCE_FALLBACK`을 남기고, 공대 수명의 최고 명성 선택은 `SEARCH_RAID_ROW_FALLBACK`을 남긴다. 실행 계층은 취소와 만료를 우선하므로 중단된 요청이 대체 선택을 발행하지 않는다. 후보나 상세 조회 실패는 기존 정제된 오류로 남고 상세의 호출 제한도 원래 헤더 수신 시각을 보존한다.

`backend/search/operation.ts`는 일반 검색과 식별 흐름에 처음 접수부터 15초인 공통 시간 예산을 적용한다. 요청 경계에 제공하는 `run`이 각 연산의 호출 전, 성공 후, 실패 후에 현재 요청과 남은 예산을 확인하며 전체 결과 전달 전에도 다시 확인한다. 같은 취소 신호를 HTTP와 이미지 연산에 연결하지만 식별 서비스에 검사 콜백을 전달하지 않는다. 캡처가 끝나거나 요청이 오래된 상태이면 늦은 결과를 버리고 시간 초과 후 대체 후보의 상세를 새로 조회하지 않는다. 취소, 만료와 429는 최고 명성 대체 표시보다 우선한다. 이미지 다운로드가 전체 예산을 소모하면 최고 명성 대신 시간 초과가 표시되는 한계가 있다.

`identify.test.ts`는 실행 환경 없이 첫 이름만 사용, 후보 순서, 후보 전원 비교, 거리 상한과 margin의 확정 경계, 점수 없는 후보가 섞인 1위 선택, 최고 명성 선택과 `choices`의 내용을 검증한다. `request.test.ts`는 실제 식별기와 요청 경계를 연결해 공통 취소 신호, 15초 예산, 늦은 응답 차단, 실패 우선순위와 공개 결과 변환을 검증한다. 슬롯과 IPC 수명은 기존 통합 테스트를 유지한다.

### 후보 고르기

식별 결과의 `choices`는 검색 슬롯의 `choices`로 renderer에 전달된다. preload의 snapshot 스키마는 두 명 이상의 후보, 정수 얼굴 창, 선택한 캐릭터가 후보에 들어 있는지를 검사하고 어기면 snapshot 전체를 버린다.

- **표시**: `components/CandidateWindow.tsx`가 카드 위에 한 겹 더 뜨는 후보 창에 후보마다 비교에 쓴 얼굴 초상화(64 × 64)만 한 줄로 그린다. 이름은 후보끼리 같아 쓰지 않고, 서버와 모험단은 `title`과 보조 기술 이름에만 둔다. 얼굴 창이 없거나 이미지를 받지 못하면 빈 칸이다. 카드 폭에 다 들어가지 않으면 가로로 넘긴다. 지금 고른 후보는 회색 테두리, 미리보기 중인 후보는 크림 테두리와 체크다.
- **미리보기와 확정**: `hooks/useCharacterSearch.ts`의 `pickCandidate`가 누른 후보를 슬롯마다 기억한다. 한 번 누르면 미리보기이며, 카드가 보이는 후보와 다르면 서버 칩과 같은 수동 조회로 그 후보를 불러온다. 조회가 끝날 때까지는 대기 화면 대신 지금 보이는 캐릭터를 두고, 조회가 실패해도 후보 창은 남아 다른 후보를 다시 고를 수 있다. 미리보기 중인 후보를 다시 누르면 확정하고 후보 창을 닫는다. 미리보기 중인 카드는 이름 수정과 같은 선택 꺾쇠와 점 세 개로 보인다. 판단은 `lib/candidate-picker.ts`의 순수 함수가 한다.
- **열고 닫기**: 후보 창이 열려 있는지는 `sections/CharacterCard.tsx`의 화면 상태다. 닫기 X로 닫으면 카드 헤더 줄에 `후보 N` 칩(`aria-expanded`)이 남고, 누르면 다시 연다. 후보가 사라지면(확정, 새 요청) 닫힘 상태도 지우고, 다음 회차는 카드를 새로 그려 처음부터 열린 창으로 보인다.
- **수명**: 누른 후보는 캡처 슬롯의 요청 ID에 묶여 새 요청이나 캡처 종료에서 버린다. 서버 칩이나 이름 칸으로 직접 조회하면 확정으로 보고 후보 창을 닫는다. 수동 조회가 시작되면 이 슬롯의 OCR 자동 검색은 다음 캡처까지 멈춘다.
- **문구**: 후보 창이 있는 `highest-fame` 카드는 "외형 미확인" 안내를 따로 쓰지 않는다.

### OCR 관측 IPC와 슬롯 수명

제품 앱의 캡처 Provider(`sections/ScreenCaptureProvider.tsx`)는 `hooks/useScreenCapture.ts`를 거쳐 `usePartyCapture`를 사용한다. `lib/party-recognition.ts`의 `recognizePartyFrame`은 회차 프레임 한 장의 첫 이름과 얼굴을 슬롯별 결과로 돌려주고, `lib/party-capture-machine.ts`가 유효한 회차의 결과만 `notifyOcrCandidatesDetected`로 전달한다. 두 번 연속 같은 입력인지 기다리지 않는다. 첫 이름은 앞뒤 공백만 제거하고 두 번째 이름으로 보정하지 않는다. 공백을 제거한 첫 이름이 비어 있거나 12 code point를 넘거나 잘못된 Unicode이면 해당 슬롯을 조회 실패로 전달하고, 이유와 모델 원문을 renderer DevTools Console에만 표시한다. 슬롯 OCR에 예외가 있으면 검색 통지 없이 `OCR_FAILED`로 회차를 종료한다. 비교에서 제외한 픽셀의 변화는 같은 얼굴로 취급한다. 조회를 시작한 슬롯은 해당 회차에서 고정하며 추가 프레임을 읽거나 검색을 재실행하지 않는다.

IPC 입력은 `{ captureId, slot, observationRevision, nickname, candidateNicknames, portrait }`다. Main은 기존 sender, main frame, exact document 검사를 적용하고 후보 개수, 이름, 별칭의 일치, 이미지와 마스크 크기, 배율을 검증한다. 얼굴은 최대 512px/축, 262,144픽셀이며 원본 버퍼를 복사해 보관한다. 이 데이터는 로컬 프로세스 사이에서만 전달하고 API에 업로드하지 않는다.

크롭 null도 후보를 조회해 최고 명성 선택을 시도한다. 비교기를 구성하지 않은 fixture나 API 미설정 상태의 `waiting-policy`는 유지한다. 제품 main은 `portraitColorPolicy`(`INITIAL_PORTRAIT_COLOR_POLICY`) 하나를 구성하며 정책은 renderer가 보낼 수 없다. clear, 캡처 종료, source와 document 변경은 이전 요청과 얼굴을 모두 비운다. 수동 카드 조회는 별도 수명에서 같은 취소와 최신성 검사를 적용한다.

성공한 슬롯의 `selected`에는 검증된 기본 요약과 [카드](#카드-전달과-점수-엔진)만 넣는다. 명성, 레벨, 직업과 모험단의 잘못된 표시 타입이나 누락은 null이며 다른 값으로 추정하지 않는다. 전체 상세는 main에 남기며 renderer에 보내지 않는다. 일치 기준은 [얼굴 비교와 일치 기준](#얼굴-비교와-일치-기준)의 로컬 실표본 평가로 정했으며 더 많은 실시간 표본의 검증이 필요하다.

## 카드 전달과 점수 엔진

상세 응답의 `card`는 API가 기본 정보의 전직명으로 정한 역할이다. Main의 `backend/search/card-assembler.ts`가 `apiCharacterCardSchema`로 역할만 읽고, 그 역할에 점수 엔진 결과를 채운 `{ role, score }`를 `SelectedCharacterSummary.card`로 보낸다. 이전 API가 함께 보내던 스탯, 서버 순위, 세트, 서약, 강화 값은 읽지 않는다. `card`가 없거나 역할을 읽지 못하면 엔진을 부르지 않고 `card`만 null로 두며 기본 요약은 그대로 보낸다. Renderer에 넘기기 전에는 `characterCardSchema`(모르는 키 거절, 유한한 숫자, 비어 있지 않은 문자열)로 다시 검사한다. 요약의 `equipmentScore`는 `card.score.value`를 옮긴 값이다. `card.score.value`에는 정확한 점수만 두므로 근사값(`card.score.approximate`)은 `equipmentScore`에 들어가지 않는다. Renderer에는 숫자와 enum으로 된 카드만 건너가며 포맷한 문자열은 보내지 않는다.

계산기는 API가 정한 `card.role`로 고른다. `buffer`는 `buff`, 그 밖(역할을 모르는 null 포함)은 `equipment`이며 엔진에 역할 판단을 맡기지 않는다. 엔진 결과가 없으면 API가 보낸 값과 관계없이 점수는 null이다. 계산하지 못한 결과는 `score.value`가 null이고 `skipped`에 사유 종류와 문구가 남는다. 엔진이 근사값을 냈으면 `score.approximate`에 값(`value`), 출처(`source`), 엔진의 원문 경고(`warning`)를 함께 두고, 근사값이 없거나 점수를 낸 결과는 null이다. 점수를 낸 결과에 엔진이 붙인 경고는 카드에 옮기지 않는다. Renderer의 `lib/card-score.ts`가 파티 카드와 공대 카드의 점수 칸을 같은 변환으로 정하며, 근사값은 `≈`를 붙여 보이고 사유 종류와 근사 방법만 보조 기술과 마우스 설명에 전한다.

`backend/score/input.ts`는 상세 응답의 basic을 뺀 10개 섹션을 엔진 입력 문서로 바꾼다. `status`, `equipment`, `avatar`, `creature`, `oath`는 같은 이름이고 `mistAssimilation`은 `mist_assimilation`, `skillStyle`은 `skill_style`, `buff.equipment`, `buff.avatar`, `buff.creature`는 `buff_equip_equipment`, `buff_equip_avatar`, `buff_equip_creature`다. API가 섹션 안쪽만 남기므로 각 문서는 `character`의 basic 응답 상단 필드 12칸과 원래 바깥 키(`status`와 `buff`, `equipment`와 `setItemInfo`, `skill`, `skill.buff` 등)를 붙여 Neople 응답 모양으로 되돌린다. 서버가 더한 `itemDetail`, `skillDetails`는 빼고, `itemDetail.data`가 같은 itemId의 아이템 응답이면 `items[itemId]`에 둔다. API는 장착 장비의 `engrave`에 아이템 상세를 붙이지 않으므로 그 아이템은 엔진 입력의 `items`에 들어가지 않는다.

`backend/score/engine.ts`는 라이브러리를 `koffi`로 열어 `dnfscore_version`, `dnfscore_score`, `dnfscore_free`를 묶는다. 패키지는 `app.asar.unpacked/resources/score/`의 플랫폼별 파일만 열고, 개발 실행만 `DFRAGON_SCORE_LIBRARY`의 절대 경로를 읽는다. 라이브러리는 첫 점수 계산 때 한 번 열며 열지 못한 결과도 기억해 다시 시도하지 않는다. 엔진이 출력으로 할당한 문자열은 반환값과 관계없이 같은 엔진의 `dnfscore_free`로 해제한다. 결과는 Desktop이 쓰는 `calculator`, `score`, `skipped`, `approximate_score`, `approximate_source`, `warning`, `versions`, `display`만 검사하고, 요청한 계산기와 다르거나 점수와 사유가 함께 있거나 둘 다 없으면 버린다. 규칙 rev14 엔진은 건너뛴 결과에 근사값(`approximate_score`), 출처(`approximate_source`), 경고(`warning`)를 더할 수 있고, `native-v0.3.1`부터는 장비 점수(`equipment`)와 버프 점수(`buff`) 모두에 더한다. 근사값과 출처는 함께 있거나 함께 없어야 하고, 있으면 경고도 있으며 `score`가 null인 결과에만 있을 수 있다. 근사값 없이 경고만 있는 결과는 정확한 점수에 붙은 알림(예: 버프 효과에 닿지 않는 부위의 아바타가 번들에 없음)이라 `score`가 있는 결과에만 받는다. 이를 어기면 결과 전체를 버린다. 근사값 칸을 보내지 않는 rev14 이전 엔진의 결과는 근사값 없이 받는다. 출처는 엔진 문서에 네 값이 있지만 새 값이 와도 결과를 버리지 않도록 비어 있지 않은 문자열로 받는다. 파일이 없거나 열기, 호출, 결과 검증이 실패하면 점수만 null이고, 원문 오류는 경로를 담을 수 있어 진단 코드 `SCORE_ENGINE_UNAVAILABLE`, `SCORE_ENGINE_FAILED`만 남긴다.

엔진 호출은 main에서 동기로 실행하며 상세 조회를 마친 같은 상세 operation의 `run` 안에서 한다. 호출 전후에 취소, 상세 요청 접수부터 15초인 예산, 현재 요청 여부를 확인하므로 계산 중 캡처가 끝나거나 예산을 넘긴 카드는 발행하지 않는다. 동기 호출은 중간에 멈출 수 없어 걸린 시간이 50ms를 넘으면 `SCORE_ENGINE_SLOW`를 남긴다. Release `native-v0.3.0`(규칙 rev14)을 macOS arm64 host Node에서 golden 벡터 두 건으로 부른 로컬 측정에서는 첫 호출이 엔진 준비로 약 1.1초, 이후 딜러는 약 1.5ms, 버퍼는 약 30ms였다. Windows와 Electron 안의 시간은 측정하지 않았으며, 첫 호출 준비를 worker로 옮길지는 따로 검토한다. Renderer와 preload는 엔진을 부르지 못하고 main이 검증해 넘긴 카드만 받는다.

엔진 바이너리는 OCR 모델과 같이 `@dfragon/models`의 `packages/models/score-engine` submodule이 고정한 커밋에 있다(규칙 rev14, 번들 `phase32-rev14b`의 Windows x64 `native-v0.3.2`, macOS arm64 `native-v0.3.1` 파일). 바이너리 저장소가 비공개라 `.gitmodules`의 `update = none`으로 기본 checkout에서 빠지고, 읽기 권한이 있는 로컬과 토큰 secret이 있는 CI만 따로 받는다. `apps/desktop/scripts/prepare-score-engine.mjs`가 플랫폼별 파일을 `resources/score/`에 복사하며, electron-builder의 `asarUnpack: resources/**`가 이를 asar 밖에 둔다. submodule을 받지 않았으면 엔진 없이 빌드하고, 패키지는 Windows만 만든다. 입수와 개발 설정은 [Desktop 안내](../../apps/desktop/README.md#장비-점수-엔진)에 있다.

`input.test.ts`는 엔진 저장소 golden 벡터의 입력 원문(가명 처리한 딜러 1명, 버퍼 1명)을 API 투영과 `itemDetail` 보강 규칙대로 상세 응답 모양으로 만든 뒤 엔진 입력으로 되돌려 원문과 대조한다. `engine.test.ts`는 koffi 대신 같은 모양의 라이브러리 더블로 로드 실패 정제, 출력 해제, 결과 검증과 느린 호출 진단을 확인하고, `request.test.ts`는 엔진 호출 중 만료, 취소와 이전 요청의 카드를 버리는지 확인한다. 위 로컬 측정에서 실제 엔진은 두 벡터 모두 원문 입력과 상세 응답을 거친 입력에 같은 점수(딜러 1741, 버퍼 136617)를 냈다. Windows DLL과 Electron 안의 koffi 로드는 Windows 실기에서 확인할 대상이다.

## PaddleOCR와 실제 게임 인식 영역

현재 빌드 설정은 `@dfragon/models` 패키지의 모델 저장소 submodule(`packages/models/ocr-finetuned`)이 고정한 13에폭 파인튜닝 ONNX 모델(`dfragon-finetuned`)이며 `onnxruntime-web`의 로컬 WASM worker로 실행한다. 공식 `korean_PP-OCRv5_mobile_rec` 모델은 vendor 파일로 남아 있고 `ocr-model.config.mjs`의 마지막 줄로 되돌릴 수 있다. 모델, 문자 목록과 라이선스는 `apps/desktop/assets/ocr`에 고정하고 `provenance.json`에 원본과 checksum을 기록한다. `prepare-ocr-assets.mjs`는 checksum을 검사한 뒤 모델과 설치된 ONNX Runtime의 WASM을 renderer public assets로 복사한다. `.gitattributes`는 vendor assets의 줄바꿈 변환을 막아 Windows checkout에서도 고정 checksum을 유지한다.

일반 캡처는 [공용 파티 프레임 검출기](desktop-party-geometry.md)가 HP, MP와 주변 경계에서 확인한 닉네임 영역만 원본 크기로 자른다. BT.601 회색 변환과 Otsu 반전 이진화로 밝은 글자를 검게, 어두운 배경을 희게 만든다. 모델 worker에서 높이 48픽셀, 너비 최대 320픽셀로 한 번 리사이즈하고 실제 검은 글자 경계를 입력 폭 320의 가로 중앙으로 이동한다. 글자 크기와 세로 위치는 유지하며 새 좌우 여백은 이진화한 배경과 같은 흰색(정규화 값 1)으로 채운다. 구두점을 제거하는 잡음 필터나 세로 크롭은 추가하지 않는다. 제품 전처리 평가도 같은 중심화 경로를 사용하고 원본 평가만 기존 왼쪽 정렬을 유지한다. CTC 후보 디코더의 1위 문자열만 검색에 사용하며 모델 점수는 정답 확률이나 검색 허용 조건이 아니다.

`createPartyOcrWorker`는 기존 인식 결과 소비 형태와 `terminate`를 유지한다. Capture AbortSignal을 받아 초기화, 인식 중에도 worker를 종료하고 대기 요청을 거절한다. 응답이 없는 요청은 30초 뒤 종료한다. 이전 회차의 결과는 기존 signal, 검색 수명 검사에서 차단하며 회차 프레임의 첫 OCR 결과를 공개 검색으로 연결한다. 검색은 인증과 독립적이며 sender, source, capture 검사는 유지한다.

한 표본의 근접한 결과나 높은 모델 점수를 전체 정확도로 일반화하지 않는다.

### CTC 후보와 모델 점수

`lib/paddle-recognition.ts`가 내보내는 `decodeCtcCandidates(data, steps, characters, candidateCount = 2)`는 네 번째 인자로 받은 개수까지 `{ rank, modelScore, nickname }`을 반환한다. 생략 시 최대 2개, `5`를 전달하면 최대 5개다. 개수는 양의 안전한 정수여야 하며 잘못된 값은 거절한다. `lib/ctc-candidates.ts`는 시점별 상위 nonblank 문자 16개로 prefix를 확장하고 최대 `max(32, candidateCount)`개를 유지한다. 32개보다 많이 요청하면 탐색 폭과 계산량도 증가한다. Blank 경로와 마지막 문자의 연속 반복은 문자 상위 16개에 포함되는지와 관계없이 합산한다. Blank 없이 이어진 같은 문자는 하나로 합치며 blank로 분리된 반복 문자는 유지한다.

탐색을 마친 뒤 남은 문자열 모두를 CTC forward 계산으로 다시 채점한다. 이 계산은 각 문자열로 축약되는 모든 경로를 원래 출력 확률에서 합산한다. 최종 점수 내림차순으로 요청한 개수까지 고르고 `rank`를 1부터 부여한다. 동점은 사전 token 순서로 결정한다. 후보 탐색은 제한된 beam을 사용하므로 전체 가능한 문자열의 정확한 상위 후보를 보장하지 않는다. Blank만 관측되면 빈 문자열 후보를 유지하며, 후보 수를 채우려고 다른 이름을 만들지 않는다.

`modelScore`는 재계산한 문자열 확률의 100배다. 실제 정답률이나 상위 후보 사이의 상대 비율이 아니며, 반환한 후보 점수의 합을 100으로 맞추지 않는다. 입력은 유한한 0~1의 softmax 확률이어야 한다. 시점별 확률 합과 1의 차이가 0.001 이하면 그 합으로 나누어 보정하고, 범위를 벗어나면 거절한다. Logits에 softmax를 다시 적용하지 않는다. 빌드 준비 단계도 같은 확률 범위와 합계 조건을 검사한다.

`decodeCtc(data, steps, characters)`는 같은 후보 목록의 첫 `nickname` 문자열을 반환한다. Worker는 후보를 한 번 계산한 뒤 `{ text, confidence, candidates }`를 반환한다. `text`와 `confidence`는 각각 1위 닉네임과 `modelScore`를 유지하고, `candidates`에는 최대 두 개의 원문, 순위, 모델 점수를 전달한다. 빈 문자열이나 같은 이름을 worker 경계에서 보정하거나 제거하지 않는다.

`createPartyOcrWorker`는 후보 개수, 1부터 시작하는 연속 순위, 유한한 0~100 점수의 내림차순과 1위 호환 필드의 일치를 확인한다. 초기화와 인식, 실패가 섞인 응답은 거절하고 기존 worker 종료, 취소, 시간 초과 처리를 유지한다. 후보를 여러 개 전달해도 회차의 검색에는 첫 후보만 사용한다.

## UI 구성

`PartyScreen`은 캡처 Provider가 Context로 제공하는 파티 캡처 결과를 `hooks/useScreenCaptureContext.ts`로 읽고, `lib/slot-cards.ts`의 `toSlotCards`로 슬롯마다 상태, 표시 캐릭터, 인식한 이름, 안내, 진행 표시, 스냅샷 표시를 묶어 `PartyPage`에 전달한다. `lib/character-card.ts`는 기본 정보만 표시 값으로 바꾸며 누락된 명성을 0으로 대체하거나 장비 점수를 계산하지 않는다. 실제 선택 identity가 바뀌면 카드의 편집 초기 상태도 교체해, 늦게 도착한 결과를 이름 수정 중으로 오인하지 않는다. 카드는 캐릭터 면 하나만 두며 상세 창, 면 탭, 스탯 한 줄과 서버 순위는 없다.

카드는 중앙 진행 표시와 조회 완료, 빈 결과, 정제된 오류를 구분한다. 최고 명성 대체 결과는 얼굴 일치와 다르게 표시한다. 서버와 닉네임은 항상 수정할 수 있으며 Enter나 서버 변경으로 수동 조회한다. Alt+R은 기존 결과를 비우고 전체 OCR부터 새로 실행한다. 합성 미리보기의 이전 대기 상태와 재시도 시나리오는 제품의 새 회차 동작과 구분한다. Electron의 화면 확인은 실제 게임의 얼굴 식별 정확도 검증을 대신하지 않는다.

## 실제 자료와 평가 범위

제품의 `party` 전처리와 별도 학습 저장소의 전처리와 학습된 가중치의 실제 입력분포 일치는 이 변경에서 검증하지 않았다. 글자 가운데 정렬의 픽셀 검증을 인식률 향상으로 보고하지 않으며 새 val, test에서 완전 일치율과 CER을 재평가해야 한다. 기본 모델을 자동 교체하거나 학습 작업을 실행하지 않는다.

캡처 화면은 게임 창과 캡처 중지를 한국어로 표시한다. 제품은 Alt+R 또는 파티 헤더의 캡처 버튼으로 회차를 시작하며 둘은 같은 회차 시작을 보낸다. 주기적인 반복 인식과 간격 선택은 제공하지 않는다. 1920×1080 테두리 없는 창 모드, UI 배율 50%와 닉네임이 보이는 상태를 안내하며, 인식 실패나 오인식 때 카드의 이름, 서버 입력으로 직접 조회할 수 있다. 창 선택, 캡처 준비, OCR 준비, 실행, 종료 상태는 계속 유지되는 `role="status"` 영역에서 표시한다. 상단 바 상태 배지는 회차 진행 중 `인식 중`, 완료 뒤 `인식 완료`, 안내 후 끝난 회차는 `확인 필요`이며 창 등록 중 `준비 중`과 창 감지 표시는 유지한다. 창 목록 실패는 게임 실행 후 앱 다시 열기, 선택 실패는 창 다시 선택, 회차 프레임을 쓸 수 없으면 Alt+R로 다시 시작하도록 안내한다. OCR 실패는 해당 단계의 복구 안내를 제공한다. 외부 오류 원문을 화면으로 전달하지 않는다. 지원 해상도, 배율과 main의 검색, 캡처 수명 검사는 바꾸지 않는다.

기존 `@dfragon/ui`의 Button, ContentStack, ExampleSection, SupportingText를 조합한다. 후보의 ordered list와 슬롯별 이름 있는 section은 DFragon composition이며 공용 자산의 외형을 덮어쓰는 CSS, style은 없다. 각 슬롯에는 “슬롯 1 검색” 형태의 접근 가능한 이름, 진행 시 `aria-busy`와 상태 안내가 있다. Retry의 loading과 disabled는 함께 적용하며 한 슬롯의 진행이 다른 슬롯 버튼을 막지 않는다.

Keyboard, focus, 좁은 화면, theme, reduced-motion의 실제 Electron 관측은 최종 실행 head의 Issue/PR evidence에 기록한다. 공용 spinner의 기존 motion 동작을 변경하지 않으며 unit 성공을 native UI 검증으로 대신하지 않는다.

## 검증 경계

```sh
pnpm --filter @dfragon/desktop exec vitest run src/backend/search src/backend/capture src/preload src/frontend/src/sections src/frontend/src/lib src/frontend/src/components
pnpm --filter @dfragon/desktop run --sequential '/^(test|lint|build)$/'
git diff --check
```

일반 tests는 API, DB, 네이티브 캡처를 실행하지 않는다. 실제 API, disposable DB 소비 검증은 `apps/desktop/scripts/search-server-integration/README.md`의 별도 command와 격리를 따른다. 이는 Desktop HTTP 클라이언트 소비 검증이며 auth waiter, slot, IPC, renderer, 실제 캡처, OCR 성공을 대신하지 않는다.

## 카드 직접 조회와 공대 식별

파티 카드의 서버, 이름 조회는 `useCharacterSearch.ts`가 `useManualCharacterLookup`으로 실행한다. `manual-ipc.ts`는 별도의 `createCaptureSearchLifetime` 인스턴스로 기존 HTTP, 입력, 오류, 429, 취소 구현을 재사용한다. 직접 조회의 시작과 종료는 실제 캡처 수명을 변경하지 않는다. 공유 DTO의 이름을 제품 안내에 노출하지 않는다.

공대 카드의 서버, 이름 조회는 같은 `registerManualSearchIpc`의 `raid` 수명으로 실행한다. `capture/ipc-handler.ts`가 파티 카드용(`controlManualSearch`, 4자리)과 공대 카드용(`controlRaidSearch`, 12자리) 수명을 따로 등록하고, 문서 이동, 종료, renderer 종료 때 두 수명을 함께 무효화한다. `commands.ts`는 수명의 슬롯 수로 슬롯 번호를 검사하고, preload와 renderer의 snapshot 검사는 채널이 기대하는 슬롯 수와 정확히 같은 snapshot만 받는다. Renderer의 `useRaidSearch.ts`는 `useManualCharacterLookup`을 공대 API와 12자리로 써서 파티 카드 조회와 다른 연결을 만든다.

공대 캡처는 같은 공대 수명을 쓴다. `hooks/useRaidCapture.ts`가 `lib/raid-capture-machine.ts`의 회차를 소유하고, 파티 캡처의 창 등록 상태를 받아 등록이 바뀌면 진행 중 회차를 끝낸다. 회차는 `useManualCharacterLookup`의 `beginRound`로 공대 수명을 새로 시작한 뒤 `window.raidSearch.readCaptureFrame`(`readRaidCaptureFrame`)으로 12행의 닉네임, 직업명 크롭과 수치 표기, 수치 열 종류를 받는다. `lib/raid-recognition.ts`는 파티 캡처와 같은 반전 이진화와 OCR worker로 행마다 닉네임 첫 후보를 판정하고, 검색할 이름이면 직업명 칸도 같은 전처리로 읽는다. 직업명 인식 실패는 그 행의 직업명만 null로 둔다. 인식한 이름은 `notifyRaidOcrCandidatesDetected`로 얼굴 없이, 그 행의 `raidRow`(`jobText`, `valueColumn`, `valueText`)와 함께 알린다. `commands.ts`는 공대 관측에만 `raidRow`를 요구하고 파티 관측에는 받지 않는다. 수치 표기는 숫자, 쉼표, 마침표, `K`로 16자까지, 직업명은 32자까지다.

Main의 공대 수명은 `SearchRuntime.ocrIdentification`을 `raid`로 두어 `identify.ts`의 `createRaidCharacterIdentifier`를 쓴다. `raid-candidate.ts`는 직업명 그룹을 만들고 `job`, `fame`, `highest-fame` 중 선택한다. 명성 비교에는 후보 검색 응답을 쓰며 장비 점수 열은 최고 명성 선택으로 처리한다. 그룹 후보는 얼굴 창 없는 `choices`로 전달한다. 정책값은 [공대 식별 흐름](../rules/character-search.md#desktop의-공대-식별-흐름)과 같다.

식별기는 고른 후보 한 명의 상세만 조회한다. 공대 카드는 후보 창 없이 `lib/character-card.ts`의 공대 안내만 보조 기술과 마우스 설명으로 전한다. 이전 API가 `jobName`, `jobGrowName`을 보내지 않으면 `character-http.ts`가 null로 받아 직업명 단계를 건너뛴다.

공대 보드의 자리 맞바꾸기는 renderer 배치만 바꾼다. `useRaidCapture`의 `seatOrder[화면 자리]`가 그 자리에 놓인 공대 검색 슬롯이고, `RaidPage`는 조회를 그 슬롯 번호로 알린다. 그래서 main 공대 수명의 슬롯 번호와 요청, 취소, 늦은 응답 처리는 그대로이며 진행 중 조회와 늦은 응답은 옮겨 간 카드에 들어간다. 회차를 시작할 때(`beginRound`) 배치를 처음으로 되돌려 OCR 행 번호와 슬롯 번호, 화면 자리가 같아지고, 회차가 인식하는 동안은 `canMoveSeats`가 false라 맞바꾸지 않는다.

공대 수명은 문서 세대만으로 유효성을 보지만 OCR에서 시작한 관측과 요청에는 `isCurrentOcr`(`capture/ipc-handler.ts`의 `isCurrentSearch`, 회차를 시작한 게임 창 선택 세대와 등록 상태)를 더 요구한다. 게임 창 선택이 시작되거나 캡처가 멈추면 `clearSource`가 카드 수명의 `cancelOcrRequests`를 불러 진행 중인 OCR에서 시작한 슬롯만 취소하고 비운다. 이전 회차의 OCR 통지와 OCR 실패의 재시도는 `STALE_SEARCH`로 거절하며, 서버를 고른 조회와 끝난 슬롯은 그대로다. 회차 중 사용자가 서버와 이름으로 조회한 슬롯은 OCR 관측을 보내지 않는다. Alt+R은 `hooks/useRestartShortcut.ts`로 보이는 화면의 회차만 받는다. 상단 바 상태 칩과 공대 헤더는 `lib/capture-presentation.ts`의 `getRaidScreenCapture`로 창 선택 상태와 공대 회차 상태를 고른다. Main의 `readRaidCaptureFrame`은 `capture/ipc-handler.ts`에, OCR 통지는 `search/manual-ipc.ts`의 공대 수명에 있다. 한 슬롯의 새 조회는 그 슬롯의 이전 요청만 취소하며, 동시 요청 수는 사용자가 조회한 슬롯 수를 넘지 않는다. 공개 검색의 호출 제한은 파티와 공대 조회가 함께 쓴다.

선택된 요약에는 상세 응답의 `guildName`과 `equipmentScore`, `card`를 둔다. `equipmentScore`는 [검증한 카드](#카드-전달과-점수-엔진)의 점수이며, 카드가 없거나 엔진이 계산하지 못하면 null로 보내고 추정하지 않는다. 엔진이 근사값을 냈어도 `equipmentScore`는 null이다. 카드는 null을 `-`로, 근사값을 `≈`를 붙인 값으로 표시한다.

관련 UI, hook, IPC 검증은 합성 이름을 사용하며 실제 설치 앱과 게임 확인을 대신하지 않는다.

검색 입력 길이는 API와 같은 2–12 Unicode 코드 포인트 기준이며, UTF-16 코드 유닛이나 화면상 글자 묶음(grapheme) 기준으로 변경하거나 정규화하지 않는다. 검색 action과 명령 오류는 shared `SEARCH_ACTIONS`, `SEARCH_COMMAND_ERRORS`에서 타입과 runtime 검증 값을 함께 정의한다.
