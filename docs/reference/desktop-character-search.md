---
type: reference
status: active
scope: desktop OCR character search implementation and isolated verification
last-reviewed: 2026-09-19
---

# Desktop 캐릭터 검색

OCR 안정화 결과를 현재 capture의 네 슬롯 검색으로 연결한다. [로그인 선택 계약](../rules/desktop-auth.md#최소-화면과-capture-경계)에 따라 창 선택·캡처·OCR·검색·결과는 계정 상태와 독립적이다. 제품 main은 고정 API origin만으로 공개 검색을 구성하며 provider·credential 설정이나 auth snapshot을 요구하지 않는다. 계정 화면은 함께 표시하고 로그인·로그아웃이 진행 중 capture를 중단하지 않는다.

Windows 제품의 [캡처 정책](../rules/desktop-capture-media-fixture-proposal.md#windows-제품-캡처-정책)은 등록 document·source·capture 수명당 빈 media request를 한 번 허용한다. Camera/microphone·media check와 Windows 외 제품 entry는 거절한다. Electron legacy API의 source/gesture 우회 차단을 보장하지 않는다.

## 구현 위치

| 위치                                                                                                                                                   | 책임                                                                                                                                                                 |
| ------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/desktop/src/backend/capture/ipc-handler.ts`                                                                                                      | 현재 source/document와 capture를 결합하고 검색 IPC·media를 같은 수명에서 검사한다. Navigation, destruction, renderer process 종료, source 변경 때 요청을 무효화한다. |
| `apps/desktop/src/backend/search/capture-lifetime.ts`, `slot-lifetime-machine.ts`                                                                      | 함수 factory가 슬롯 DTO·관측 revision을 관리하고 XState actor가 슬롯별 HTTP 취소와 429 대기를 소유한다.                                                              |
| `apps/desktop/src/backend/search/request.ts`                                                                                                           | 입력 접수부터 HTTP·body 검증까지 하나의 검색 예산과 취소 판정을 수행한다.                                                                                            |
| `apps/desktop/src/backend/search/http.ts`                                                                                                              | 고정 `GET /characters`, 선택 query 생략, HTTP/UTF-8/JSON/전체 후보 검증과 다섯 field projection을 수행한다.                                                          |
| `apps/desktop/src/backend/search/retry-after.ts`                                                                                                       | 헤더 수신 시각부터 남은 시간을 검사하고 긴 timer를 지원 범위 안에서 나눠 예약한다.                                                                                   |
| `apps/desktop/src/preload/common/types/search.ts`, `common/search/snapshot.ts`                                                                         | Shared DTO·오류 문구·feature API와 exact own shape·상태 조합 검증을 정의한다.                                                                                        |
| `apps/desktop/src/preload/api/search.ts`, `search-command.ts`, `capture.ts`                                                                            | `window.search`의 제어/구독과 기존 `window.api`의 확장된 OCR 통지를 연결한다. Electron event와 부적합 DTO는 전달하지 않는다.                                         |
| `apps/desktop/src/frontend/src/lib/search-connection.ts`, `search-connection-machine.ts`                                                               | XState actor가 구독 후 read·event 동기화와 run/revision 순서를 관리하고, 명령 응답 유실은 read로만 확인한다.                                                         |
| `apps/desktop/src/frontend/src/lib/capture-search.ts`, `capture-search-machine.ts`, `apps/desktop/src/frontend/src/hooks/useCharacterSearch.ts`        | XState가 Start별 시작·종료 수명을 관리하고, factory와 hook은 로컬 관측 revision·결과 필터·슬롯별 retry를 연결한다.                                                   |
| `apps/desktop/src/frontend/src/lib/party-capture-machine.ts`, `party-capture-session.ts`, `apps/desktop/src/frontend/src/hooks/usePartyRecognition.ts` | begin 완료 뒤 media/OCR 시작, 늦은 begin의 자기 ID 정리와 stable/null 전이 통지를 연결한다. 기존 OCR 안정화·기본 3초 간격은 유지한다.                                |
| `apps/desktop/src/frontend/src/sections/SearchResults.tsx`                                                                                             | 네 슬롯의 상태·후보·고정 오류·수동 retry를 text로 표시한다.                                                                                                          |

`createCaptureSearch`는 호출마다 연결·actor·관측 상태를 클로저에 보관하고 제어 함수를 반환한다. 표시할 슬롯의 계산은 상태를 변경하지 않는 순수 함수로 분리한다. 캡처 검색 수명은 `idle → starting → active`와 `invalidated`, 최종 `disposed` 상태로 관리한다. 새 begin·end·무효화·dispose는 이전 시작 actor를 종료한다. 시작 actor는 종료 뒤에도 직접 응답을 기다려 자신이 생성한 늦은 ID만 end하고 호출자에게 null을 반환한다. Main이 종료를 알린 수명은 로컬 상태만 비우며 END를 중복 전송하지 않는다. 슬롯의 관측 revision·clear·결과 필터·retry 정책은 기존 일반 로직을 유지한다.

Begin의 직접 성공 응답만 해당 Start가 소유한 ID로 사용한다. 응답이 유실되면 read로 상태를 확인하지만 그 결과의 ID를 늦은 Start의 소유로 추정해 end하지 않는다. 해당 시작은 창을 다시 선택하도록 안내하며 같은 begin을 자동 재전송하지 않는다. 새 source 선택은 기존 main 선택/capture 무효화 경로를 사용한다.

`createCaptureSearchLifetime`은 각 슬롯에 XState actor를 만든다. 요청을 준비한 뒤 pending snapshot을 동기 발행하고, 해당 요청이 여전히 유효할 때만 HTTP를 시작한다. 새 이름의 관측·clear·end는 이전 요청과 429 timer를 취소한다. 같은 이름의 새 관측은 기존 요청의 observation revision만 올리며, 15초 예산을 재시작하지 않는다. 429 대기가 끝나면 retry 가능 상태만 발행하고 GET을 자동 재전송하지 않는다.

`createSearchConnection`은 연결마다 별도 XState actor를 클로저에 보관한다. `isReady()`는 호출 시점의 동기화 상태를 읽고, 명령은 호출 당시 actor를 참조해 재연결 후 늦은 응답을 격리한다. 구독의 초기 기준과 마지막 조회의 성공 여부를 병렬 상태로 표현한다. 이미 초기 기준을 세운 연결은 복구 조회에 실패해도 후속 event를 표시할 수 있지만, 다시 조회에 성공하기 전까지 새 begin은 차단한다. 초기 조회 성공 전 event는 최신 revision만 보류하며, 재연결·dispose는 이전 actor와 구독을 종료한다. 슬롯별 명령은 직렬화하지 않고 직접 응답을 각각 돌려준다. 종료된 actor에는 명령·복구 조회 결과를 반영하지 않지만, 늦은 begin의 직접 응답과 그 ID의 end 전송은 캡처 정리를 위해 유지한다.

검색 run이 바뀌면 이전 구독·표시·capture resource를 버리고 새 검색 조회를 시작한다. 초기 read가 성공하기 전에는 Start와 직접 begin 호출을 차단하며, 조회 실패 시 기존 앱 화면 다시 열기 안내를 유지하고 event만으로 회복하거나 자동 재시도하지 않는다. 로컬 관측·clear·Stop·source 변경은 main 응답을 기다리지 않고 이전 표시를 가린다. Renderer와 preload는 같은 DTO 검증기를 각각의 경계에서 사용한다.

## PaddleOCR와 실제 게임 인식 영역

현재 제품은 `korean_PP-OCRv5_mobile_rec` 공식 ONNX 모델을 `onnxruntime-web`의 로컬 WASM worker로 실행한다. 모델·문자 목록·라이선스는 `apps/desktop/assets/ocr`에 고정하고 `provenance.json`에 원본과 checksum을 기록한다. `prepare-ocr-assets.mjs`는 checksum을 검사한 뒤 모델과 설치된 ONNX Runtime의 WASM을 renderer public assets로 복사한다. `.gitattributes`는 vendor assets의 줄바꿈 변환을 막아 Windows checkout에서도 고정 checksum을 유지한다. 빌드와 앱 실행에 모델 다운로드나 외부 OCR 서버가 필요하지 않다. Tesseract 의존성과 language/core assets는 제거했다.

인식 기준은 기존 1920×1080 테두리 없는 게임 창·UI 배율 50%다. 첫 슬롯 기준 MP 검사 영역은 `y=42`, 높이 5이며, 닉네임 영역은 `x=56, y=15, width=91, height=14`다. MP 색상·최소 픽셀 검사를 통과한 슬롯만 인식한다. 밝기 반전으로 밝은 글자를 어두운 글자로 바꾸되 이진화하지 않는다. 기존 Tesseract용 3배 확대와 여백을 제거하고 모델 worker에서 높이 48픽셀로 한 번 리사이즈한다. BGR 정규화와 오른쪽 zero padding, CTC blank·중복 제거로 문자열을 읽는다. Confidence는 정답 확률이나 검색 허용 조건으로 사용하지 않는다.

`createPartyOcrWorker`는 기존 인식 결과 소비 형태와 `terminate`를 유지한다. Capture AbortSignal을 받아 초기화·인식 중에도 worker를 종료하고 대기 요청을 거절한다. 응답이 없는 요청은 30초 뒤 종료한다. 이전 capture의 결과는 기존 signal·검색 수명 검사에서 차단하며, 두 번 연속 관측 일치와 공개 검색 연결은 유지한다. 검색은 인증과 독립적이며 sender·source·capture 검사는 유지한다.

[PR #462](https://github.com/blahaj94/ldb/pull/462)에서 Windows 설치 앱의 실제 선택 창 → 영상 → 한 슬롯의 정확한 OCR → 인증 검색·결과 표시를 확인했다. 이는 당시 Tesseract 빌드의 관측이며 PaddleOCR 전환의 실제 검색 완료 증거와 구분한다. 이번 PaddleOCR 비교는 선택한 게임 창의 허용된 닉네임 영역에서 실제 모델 실행을 확인했으나, 진단 중 검색 전송은 차단했다. UI 100%·돋움은 비교 조건이며 제품의 지원 배율을 확장한 것이 아니다.

작은 한글 글자와 특정 음절의 오인식은 남아 있다. 한 표본의 근접한 결과나 높은 confidence를 전체 정확도로 일반화하지 않는다. 영역 확장·확대·색 분리·Gemma 비교와 합성 입력 재현은 [Issue #463](https://github.com/blahaj94/ldb/issues/463)에 기록했으며 정확도 추가 개선은 MVP 이후로 미뤘다. 임시 비교 UI, 문자별 후보와 Gemma 연결은 제품에서 제거한다.

## UI 구성

캡처 화면은 게임 창·인식 간격·캡처 시작/중지를 한국어로 표시한다. 1920×1080 테두리 없는 창 모드·UI 배율 50%와 닉네임이 보이는 상태를 안내하며, 인식 대기나 오인식 때 닉네임 수정·직접 검색으로 이어진다. 창 선택·캡처 준비·OCR 준비·실행·종료 상태는 계속 유지되는 `role="status"` 영역에서 표시한다. 창 목록 실패는 게임 실행 후 앱 다시 열기, 선택 실패는 창 다시 선택, 영상·OCR 실패는 해당 단계의 복구 안내를 제공한다. 외부 오류 원문을 화면으로 전달하지 않는다. 지원 해상도·배율과 검색·캡처 수명은 바꾸지 않는다.

기존 `@dfragon/ui`의 ActionButton, ContentStack, ExampleSection, SupportingText를 조합한다. 후보의 ordered list와 슬롯별 이름 있는 section은 DFRAGON composition이며 공용 자산의 외형을 덮어쓰는 CSS·style은 없다. 각 슬롯에는 “슬롯 1 검색” 형태의 접근 가능한 이름, 진행 시 `aria-busy`와 상태 안내가 있다. Retry의 loading과 disabled는 함께 적용하며 한 슬롯의 진행이 다른 슬롯 버튼을 막지 않는다.

Keyboard·focus·좁은 화면·theme·reduced-motion의 실제 Electron 관측은 최종 실행 head의 Issue/PR evidence에 기록한다. 공용 spinner의 기존 motion 동작을 변경하지 않으며 unit 성공을 native UI 검증으로 대신하지 않는다.

## 격리 미디어와 화면 검증

아래 검색 결과 조작은 LegacyApp 기반 protocol 회귀 절차다. 현재 카드 App의 UI 검증은 `capture:fixture:smoke`가 담당한다.

기존 [auth capture fixture](desktop-auth-capture.md)를 사용한다. `scripts/auth-capture-fixture/search-effects.ts`의 transport는 고정 합성 origin·endpoint·query와 credential 부재만 받아 메모리에서 Response를 만든다. 전역 fetch나 실제 API·provider를 호출하지 않는다. `session.webRequest` 차단을 main Node HTTP 차단의 근거로 사용하지 않는다.

앱 메뉴에서 아래 응답을 선택한 뒤 **Stop → Start**로 새 OCR 관측을 만들거나 현재 실패의 **다시 시도**를 누른다. 메뉴 선택 자체는 검색을 보내거나 진행 중 응답을 바꾸지 않는다. Source 선택은 기존 fixture 절차를 따른다. 제품 로그인은 선택 사항이다.

| 메뉴                      | 다음 검색의 관측                                                     |
| ------------------------- | -------------------------------------------------------------------- |
| 검색 응답: 성공           | 합성 후보 한 건과 다섯 field 표시                                    |
| 검색 응답: 0건            | 후보 없이 “검색 결과가 없습니다.” 표시                               |
| 검색 응답: 서버 오류      | 고정 오류와 활성화된 수동 retry                                      |
| 검색 응답: 5초 제한       | 429 안내와 비활성 retry, main 대기 만료 뒤 같은 실패의 버튼만 활성화 |
| 검색 응답: 시간 초과 대기 | pending 표시 후 제품의 전체 검색 예산 만료, 종료·Stop 시 abort       |

Main 접수 계측은 결과의 `ok:true`와 capture/slot/nickname/observationRevision의 정확한 일치를 확인한다. 더 높은 snapshot 관측 revision은 오래된 입력의 접수 증거가 아니다. 원문 payload를 저장하지 않고 counter·합성 일치 mask만 기록한다.

```sh
pnpm --filter @dfragon/desktop capture:fixture:build
pnpm --filter @dfragon/desktop capture:fixture
node apps/desktop/scripts/auth-capture-fixture/post-exit-check.mjs --media
```

수동 실행과 자동 media 실행을 같은 profile/process에서 병렬 수행하지 않는다. `--media`는 기존 smoke와 종료 뒤 process/profile 확인을 포함한다. 자동 smoke의 실제 stream/OCR·접수 증거와 화면의 검색 결과·버튼 관측은 구분해 기록한다. 실제 Electron 실행 전 준비만 완료한 상태를 native PASS로 표현하지 않는다.

## 검증 경계

```sh
pnpm --filter @dfragon/desktop exec vitest run src/backend/search src/backend/capture src/preload src/frontend/src/sections src/frontend/src/lib src/frontend/src/integration src/frontend/src/components scripts/auth-capture-fixture
pnpm --filter @dfragon/desktop run --sequential '/^(test|lint|build)$/'
git diff --check
```

일반 tests는 API·DB·native media를 실행하지 않는다. 실제 #125 API·disposable DB 소비 검증은 `apps/desktop/scripts/search-server-integration/README.md`의 별도 command와 격리를 따른다. 이는 Desktop HTTP 클라이언트 소비 검증이며 auth waiter·slot·IPC·renderer·실제 stream/OCR 성공을 대신하지 않는다. 최종 head의 unit/build·독립 review·실제 UI/media·서버 검증 결과는 Issue #144와 PR #149에서 관리한다.

## 검색 UI 전용 native smoke

기존 media smoke와 별도로 아래 command를 사용한다. 준비 build 뒤 Parent가 한 번 실행하며 같은 fixture의 수동 실행과 병렬로 사용하지 않는다.

```sh
pnpm --filter @dfragon/desktop capture:fixture:build
node apps/desktop/scripts/auth-capture-fixture/post-exit-check.mjs --search
```

직접 launcher 경로는 `pnpm --filter @dfragon/desktop capture:fixture:search`다. 기존 media/OCR/deny 모드와 기준은 유지한다. 이 모드는 `legacy-search.html`의 검색 protocol 회귀용 LegacyApp·실제 preload·main, 고정 synthetic source의 native stream과 실제 OCR를 사용한다. HTTP는 기존 memory-only 합성 transport이며 실제 API/provider에 접근하지 않는다.

`search-smoke.ts`는 0건 표시, 두 실패·pending·429의 동시 상태, 슬롯별 수동 retry 독립성, 15초 timeout, 429 양의 대기 중 disabled와 같은 실패의 만료 후 버튼 활성화, 자동 GET 부재, pending 중 로그인 상태 변경의 capture 유지와 Stop 정리를 관측한다. 네 합성 응답의 HTTP 도착 순서는 슬롯 번호 계약으로 취급하지 않고 실제 상태에서 대상 슬롯을 찾는다. 기존 로그인·source 선택·resource 관측 helper는 `actions.ts`에서 공유한다.

`search-observation.ts`는 기존 read API와 실제 DOM의 문구·버튼·후보 field를 별도로 읽는다. Capture/request 식별자는 실행 중 전후 비교에만 사용하며 원문 DOM·nickname·source ID는 로그에 남기지 않는다. 최종 search evidence는 관측한 mask·boolean·요청/abort counter로 구성한다. Post-exit wrapper는 exact evidence, child 성공, native 거절/미처리 오류 부재, process group 종료와 profile 부재를 함께 요구한다. 실패 시 고정 단계만 전달한다.

시간 제한은 새 모드에만 fixture 180초·launcher 210초·post-exit 240초를 적용한다. 네 capture 시작과 로그인·로그아웃, 동시에 진행하는 15초/5초 대기 및 cleanup의 전체 상한이며 완료 시간 보장은 아니다. 각 바깥 계층에 종료·정리 여유 30초를 둔다. 기존 모드는 90/120/150초, 제품 검색 예산은 15초를 유지한다.

소유 window의 640/1100 content 폭과 app-scoped light/dark 전환은 별도 `layout evidence`의 표본 수·가로 overflow 수·theme 불일치 수로 기록한다. 이 보조 관측을 핵심 검색 PASS나 공식 시각 기준 비교의 성공으로 합치지 않는다. OS 설정은 변경하지 않는다. 실제 Tab/Shift+Tab/Return/Space와 focus/loading의 수동 관측은 별도 evidence이며 이 자동화는 native keyboard 검증을 대신하지 않는다. Reduced-motion·픽셀 비교·다른 OS는 이 모드에서 검증하지 않는다. Source/test/build 성공과 실제 native 실행 결과는 Issue/PR에서 구분해 기록한다.

## 이번 전환의 검증

실제 Electron의 local PaddleOCR worker에 공개 합성 문자열을 전달한 단독 인식과 종료 정리는 통과했다. 실제 게임 영상의 PaddleOCR 진단 관측은 위에 구분하며, 새 공개 API를 포함한 Windows 설치 앱의 전체 게임 검색 흐름을 다시 확인한 것으로 주장하지 않는다. 정확도 후속 Issue #463은 열어 둔다.

## 직접 검색과 수정 검색

직접 검색과 슬롯 검색은 같은 `CharacterCandidates.tsx`로 후보를 표시한다. 닉네임·서버명·명성을 한 묶음으로 보여주고 서버 ID·캐릭터 ID는 기본적으로 접힌 ‘식별 정보’에서 확인한다. 후보 값과 서버 응답 순서를 유지하며 명성은 자릿수 구분을 적용하고 `0`과 `null`을 구분한다. 알 수 없는 서버는 응답 ID를 표시한다. 화면 전용 CSS는 SEED token을 사용하며 긴 문자열을 줄바꿈한다. Native `details`의 키보드 동작과 focus 표시를 유지한다. 검색 상태와 완료 시 결과 수는 같은 `role="status"` 영역의 내용을 갱신하며, 후보 목록은 이 영역 밖에 표시한다.

`ManualSearch.tsx`는 캡처 없이 독립 검색 폼과 결과를 제공한다. `manual-ipc.ts`는 별도의 `createCaptureSearchLifetime` 인스턴스로 기존 HTTP·입력·오류·429·취소 구현을 재사용한다. 직접 검색의 시작과 종료는 실제 capture/media 수명을 변경하지 않는다. 공유 DTO의 이름을 제품 안내에 노출하지 않는다.

`SlotNicknameEditor.tsx`와 `useCharacterSearch.ts`는 수정 중 입력을 유지하고 해당 슬롯의 OCR 검색 제출만 멈춘다. 뒤에 관측한 OCR은 임시로 보관해 ‘OCR 다시 사용’ 때 반영하며, 다른 슬롯은 계속 검색한다. Clear/revision을 통해 수정 전 검색의 늦은 결과를 차단한다. 입력 검사는 `manual-input.ts`와 main의 기존 검색 입력 검사를 사용한다.

관련 UI·hook·IPC 검증은 합성 이름을 사용한다. 실제 설치 앱과 게임 확인 결과는 이번 PR에서 fixture 성공과 구분해 기록한다. 추가 OCR 튜닝은 #463의 MVP 이후 범위를 유지한다.

직접 검색은 성공·0건 결과를 받은 뒤 같은 닉네임도 다시 제출할 수 있다. 진행 중 같은 입력의 중복 제출은 막고, 실패는 기존 retry 경로와 429 대기를 유지한다. 입력 길이는 API와 같은 2–12 Unicode 코드 포인트 기준이며, UTF-16 코드 유닛이나 화면상 글자 묶음(grapheme) 기준으로 변경하거나 정규화하지 않는다. 검색 action과 명령 오류는 shared `SEARCH_ACTIONS`·`SEARCH_COMMAND_ERRORS`에서 타입과 runtime 검증 값을 함께 정의한다.
