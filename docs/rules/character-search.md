---
type: rule
status: active
enforcement: approval-required
scope: apps/api character search
last-reviewed: 2026-10-29
rationale: 검색 입력, 응답, 실패, 호출 제한을 후속 구현자가 추측하지 않게 한다.
evidence: "2026-09-05 PR #42 검색 계약, PR #48 인증 통합 merge; 2026-10-20 #774, #778 호출 제한 제거; 2026-10-29 #987 회차 상세 동시 조회, #992 공용 아이템 24시간 캐시"
exceptions: 미확인 외부 규격과 새 정책은 사용자 결정 없이 구현하지 않는다.
review-after: 네오플 공식 규격 변경 시
---

# Character Search Contract

이 Rule은 검색 요청, 응답, 오류, timeout과 code point 입력 정책, 호출 제한 및 명시된 한계를 정한다. 이전 인증/session 통합은 아래 공개 검색 정책으로 대체한다. 검색 결과 저장, 캐싱, OCR 보정, 인증은 이 문서의 범위 밖이다. 구현은 현재 요청 범위에서 [제품 계약 적용 기준](../README.md#document-class)을 따른다.

## 요청과 성공 응답

`GET /characters`는 로그인 없이 검색 query를 검증하고 `GET https://api.neople.co.kr/df/servers/:serverId/characters`를 한 번 호출한다. `characterName`은 필수 2~~12자, `serverId` 생략 시 `all`, `limit` 생략 시 10이며 정수 1~~200을 허용한다. Upstream `wordType=full`은 서버가 고정하며 pagination, 직업 filter는 노출하지 않는다. [네오플 02. 캐릭터 검색](https://developers.neople.co.kr/contents/apiDocs/df)

- 기본값은 생략에만 적용한다. Empty value, 검색어 앞뒤 공백, 정수의 십진 숫자 표기가 아닌 `limit`, 중복/배열/객체 query, 미정의 key는 `400 INVALID_SEARCH_QUERY`이며 upstream을 호출하지 않는다.
- URL decoding 외에 trim, OCR 보정, 대소문자 변경, Unicode 정규화를 하지 않는다.
- 성공 HTTP는 200이며 body는 `{"rows":[...]}`다. 결과 없음은 `{"rows":[]}`다. 전체 검증을 통과한 후보를 upstream 순서 그대로 반환하고, 각 row에는 아래 다섯 field만 넣는다.

| Field                                      | 검증, 반환 규격                                                                                                                            |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `characterId`, `characterName`, `serverId` | 필수 string. 빈 문자열, 공백뿐인 값은 실패. 값은 그대로 유지하며 요청 검색어 길이나 별도 ID format을 적용하지 않음.                        |
| `serverName`                               | 우리 server map으로 생성한 string. 미등록 응답 ID는 후보, ID를 유지하고 null. Upstream `serverName`은 사용하지 않음.                       |
| `fame`                                     | 유한한 JSON number는 0을 포함해 그대로 유지. null, 누락은 null. 문자열, boolean, object, array는 실패. 음수, 소수에 별도 제약을 추가하지 않음. |

Top-level은 null, array가 아닌 JSON object이고 `rows`는 array여야 한다. 모든 row도 null, array가 아닌 object여야 한다. 후보 하나라도 invalid하면 `502 NEOPLE_API_ERROR`로 **전체 실패**한다. 일부 후보만 제외하거나 숫자 문자열을 변환하지 않는다. 알려지지 않은 추가 field는 무시한다. `fame` 추가는 [공식 공지](https://developers.neople.co.kr/contents/notice/view/214)로 확인했지만 null, 누락의 실제 발생 여부는 확인하지 않았으며 위 처리는 프로젝트 정책이다.

## OCR 캐릭터 식별 후보

`GET /characters/candidates?characterName=...`는 2026-10-07에 추가한 공개 API다. 기존 `GET /characters`의 `full` 검색, 입력, 응답 순서는 유지한다. 공식 검색 타입은 동일 단어 `match`, 전문 검색 `full`이며, 새 후보 API는 `match`를 사용한다. [네오플 캐릭터 검색](https://developers.neople.co.kr/contents/apiDocs/df)

### 요청과 반환

요청은 OCR 우선순위에서 선택한 이름 하나만 받는다. 필수 query는 `characterName`이고 decode 후 Unicode code point 1~12개를 허용한다. `match`에 `full`의 최소 2자 제한을 적용하지 않으며, 이 길이 상한과 측정 단위는 우리 입력 정책이다. 앞뒤 공백, 중복 key, 배열 key, 미정의 key, 잘못된 URL encoding과 HEAD는 `400 INVALID_SEARCH_QUERY`다. 이름을 trim, 대소문자 변환, Unicode 정규화하거나 OCR 보정하지 않는다. `serverId`, `wordType`, `limit`, `zoom`을 요청자가 지정할 수 없다.

서버는 Neople 검색을 `serverId=all`, `wordType=match`, `limit=200`으로 한 번 호출한다. 현재 8개 서버의 동명 캐릭터를 찾지만 응답을 임의로 8개에서 자르지 않는다. Neople의 `match`는 영문 대소문자를 구분하지 않아 `exe` 검색에 `EXE`도 함께 돌려준다. 2026-10-20 [#770](https://github.com/blahaj94/dfragon/issues/770) 결정으로 대소문자만 다른 이름은 공급자 오류로 보지 않고 후보에서 뺀다. 후보로 반환하는 이름은 요청 이름과 정확히 같다. 대소문자를 무시해도 다른 이름은 공급자 응답 오류다. 후보의 서버는 지원하는 실제 서버 ID이고 캐릭터 ID는 상세 API와 같은 1~256자의 ASCII 영숫자, `_`, `-`여야 한다. 다른 이름이나 사용할 수 없는 식별자가 섞이면 일부만 반환하지 않고 `502 NEOPLE_API_ERROR`로 실패한다. 이 추가 검증은 새 후보 API에 한정하며 기존 검색의 미등록 서버 보존 정책을 바꾸지 않는다.

성공 응답은 `{"rows":[...]}`다. 각 행은 기존 `characterId`, `characterName`, `serverId`, `serverName`, `fame`에 `imageUrl`을 추가한다. `imageUrl`은 검증한 식별자로 구성한 `https://img-api.neople.co.kr/df/servers/<serverId>/characters/<characterId>?zoom=1`이다. 네오플의 전체 캐릭터 이미지 URL이며 얼굴만 잘린 이미지가 아니다. API는 이미지를 다운로드, 변환, 저장하거나 중계하지 않는다.

각 행에는 `jobName`, `jobGrowName`도 붙인다. 2026-10-20 [#760](https://github.com/blahaj94/dfragon/issues/760) 결정으로, Desktop이 공대원 창의 직업명과 같은 후보만 남길 수 있게 Neople 검색 응답의 두 필드를 그대로 전달한다. 문자열이 아니거나 비어 있으면 null이다. 이를 채우려고 Neople을 더 호출하거나 후보마다 상세를 조회하지 않는다. 기존 `GET /characters`는 위 다섯 필드를 유지하며 직업명을 섞지 않는다.

각 행에는 `adventureName`도 붙인다. 2026-10-20 [#756](https://github.com/blahaj94/dfragon/issues/756) 결정으로 Desktop의 후보 고르기 화면에 모험단명을 보이기 위해 추가했다. 저장한 상세에서 찾던 값이라 DB를 지운 뒤로는 항상 null이며([#796](https://github.com/blahaj94/dfragon/issues/796)), 이를 채우려고 Neople을 더 호출하지 않는다. 기존 Desktop이 읽는 필드라 남긴다.

정렬 순서는 아래와 같다.

1. `fame !== null`인 후보를 명성 내림차순으로 반환한다. `0`도 이 그룹에 포함한다.
2. 명성이 같으면 Neople 응답 순서를 유지한다.
3. `fame === null`인 후보를 나머지 후보 뒤에 Neople 응답 순서대로 붙인다. 공급자 응답에서 명성이 누락된 경우에도 기존 정제 규칙에 따라 null이다.

검색 결과가 없으면 200과 빈 `rows`다. 공급자 오류, 통신 실패, 호출 제한을 빈 결과로 바꾸지 않는다. 기존 검색과 동일한 오류, upstream timeout, 자동 retry 없음 정책을 사용한다. 두 검색 경로에는 클라이언트별, 서버 전체 호출 제한이 없다. 후보 API는 상세 서비스와 DB를 쓰지 않는다.

### Desktop의 식별 흐름

API와 Desktop의 역할은 다음 순서로 나눈다. 이 API 구현은 후보 제공까지이며 Desktop의 이미지 비교와 선택 기준은 [Desktop 캐릭터 검색 구현 안내](../reference/desktop-character-search.md#얼굴-비교와-일치-기준)에 둔다.

1. Desktop은 `decodeCtcCandidates`가 반환한 OCR 후보 순서를 유지하고 첫 번째 닉네임으로 후보 API를 호출한다.
2. 후보가 둘 이상이고 얼굴 크롭이 있으면, Desktop은 명성 순 상위 후보 전원(최대 `maxCandidates`명)의 네오플 캐릭터 이미지를 받아 얼굴 크롭과 비교한다. 네오플 전체 이미지에서 비교 영역을 맞추는 처리는 Desktop이 담당한다. 한 후보의 이미지나 점수를 얻지 못해도 나머지 후보는 계속 비교한다. 후보가 한 명이거나 크롭이 없으면 이미지를 받지 않는다.
3. 2026-10-20 [#756](https://github.com/blahaj94/dfragon/issues/756) 결정으로, 거리를 구한 후보가 있으면 거리가 가장 작은 후보를 선택한다. 거리가 같으면 명성 순서가 앞선 후보다. 거리를 하나도 구하지 못했으면 명성이 가장 높은 후보를 선택하고 얼굴로 고른 결과와 구분해 표시한다. 외형이 같은 후보는 얼굴로 가를 수 없고, 얼굴 선택이 실제 서버가 유일하다는 증명도 아니다.
4. 1위 거리가 `maxDistance` 이하이고 2위와의 거리 차이가 `minMargin` 이상이며 비교한 후보 전원의 거리가 있을 때만 선택을 확정한다. 그 밖에는 선택과 함께 사용자가 고를 후보를 카드 위에 한 겹 더 뜨는 후보 창에 보인다([Desktop MVP 카드 UI의 후보 창](desktop-mvp-ui.md#후보-창)). 후보는 비교한 상위 후보이고, 거리를 하나도 구하지 못했으면 동명 후보 전부다. 사용자가 한 번 누르면 그 후보로 수동 조회해 미리보기하고, 같은 후보를 한 번 더 누르면 확정해 후보 창을 닫는다. 확정하지 않고 후보 창을 닫으면 카드에 후보 수를 단 칩이 남아 다시 열 수 있다. 수동 조회가 시작되면 이 슬롯의 OCR 자동 검색은 다음 캡처까지 멈추며, 확정하지 않은 미리보기는 다음 캡처에서 버린다. 서버 칩으로 직접 조회해도 확정으로 본다.
5. 선택한 후보로 `GET /characters/:serverId/:characterId`를 호출해 상세 정보를 표시한다. 호출 순서는 아래 [이름과 서버를 먼저 정하는 순서](#이름과-서버를-먼저-정하는-순서)를 따른다. 후보 검색 결과가 없으면 미식별이며 두 번째 OCR 닉네임으로 넘어가지 않는다. 이미지 로딩 실패를 불일치로 간주하지 않고 그 후보의 거리만 없는 것으로 처리한다.

Desktop의 후보 검색, 후보 이미지, 상세 요청은 각각 HTTP client(ky)의 기본 timeout을 따르고 자동으로 다시 요청하지 않는다. 2026-10-29 [#954](https://github.com/blahaj94/dfragon/issues/954) 결정으로 접수부터 15초이던 검색 한 번의 시간 예산을 없앴다. 단계가 이어지면 사용자가 기다리는 시간이 15초보다 길어질 수 있다.

### Desktop의 공대 식별 흐름

2026-10-20 [#760](https://github.com/blahaj94/dfragon/issues/760) 결정으로, 공대 캡처는 공대원 창 각 행의 직업명과 명성으로 동명 후보의 서버를 고른다. 2026-10-27 결정으로 장비 점수 비교를 없앴다. 서버를 고르려고 후보 여러 명의 상세를 조회하면 Neople 호출이 크게 늘기 때문이다. 공대원 창에는 얼굴이 없어 위 얼굴 비교를 쓰지 않는다. 화면 판독과 표시는 [공대원창 검출 안내](../reference/desktop-raid-participants.md)와 [Desktop 캐릭터 검색 구현 안내](../reference/desktop-character-search.md)에 둔다.

1. Desktop은 행의 닉네임 OCR 첫 후보로 후보 API를 호출한다. 후보가 없으면 미식별이다.
2. 직업명 칸은 닉네임과 같은 전처리로 OCR한다. 앞의 `眞`을 지우고 한글만 남긴 두 문자열이 같으면 일치다. 읽은 문자열이 4자 이상이고 후보 이름이 그 문자열로 시작해도 일치이며, 5자 이상이면 마지막 한 글자를 뺀 문자열로 시작해도 일치다. 읽은 문자열이 `眞`으로 시작하지 않으면 첫 글자를 뺀 문자열로도 비교한다. 후보 쪽은 `jobGrowName`을 같은 방식으로 정규화한다.
3. 직업명이 맞는 후보가 한 명이면 그 후보로 확정한다(`job`). 맞는 후보가 없거나, 직업명을 읽지 못했거나, 이전 API라 `jobGrowName`이 없으면 동명 후보 전체를 그룹으로 쓴다.
4. 수치 열 제목이 명성이면 그룹 후보의 명성을 화면 표기 범위와 비교한다(`fame`). 범위와의 거리가 2,000 이하이고 2위 거리가 1위보다 2,000 이상 크면 확정한다.
5. 비교한 후보 중 값이 없는 후보가 있으면 확정하지 않는다. 확정하지 못해도 거리가 가장 작은 후보를 고르고(같으면 명성 순서가 앞선 후보) 그룹 후보를 함께 넘긴다. 그룹이 한 명이면 고를 후보가 없어 확정으로 본다.
6. 수치 열 제목이 장비 점수이거나 열 종류나 수치를 읽지 못했거나 비교할 값을 하나도 얻지 못하면 그룹 안 최고 명성 후보를 고른다(`highest-fame`). 그룹이 두 명 이상이면 그룹 후보를 함께 넘긴다.
7. 고른 후보 한 명의 상세를 [이름과 서버를 먼저 정하는 순서](#이름과-서버를-먼저-정하는-순서)대로 조회한다. 공대 카드는 확정한 선택이면 선택 근거 안내를 두지 않고, 확정하지 못했으면 추정 안내를, `highest-fame`이면 직업과 수치를 확인하지 못했다는 안내를 보조 기술과 마우스 설명으로 전한다. 공대 카드에 후보 창은 두지 않는다.

서버 고르기까지는 공대 수명의 요청 하나 안에서 기존 취소와 늦은 결과 차단을 그대로 따른다. 상세는 아래 순서대로 따로 받는다.

### 이름과 서버를 먼저 정하는 순서

2026-10-27 결정으로, OCR로 시작한 파티, 공대 회차는 모든 슬롯의 이름과 서버를 먼저 정한 뒤 상세와 장비 점수를 채운다. 공대 12자리의 이름과 서버가 상세 조회를 기다리지 않고 먼저 화면에 뜨게 하기 위해서다.

2026-10-29 [#987](https://github.com/blahaj94/dfragon/issues/987) 사용자 결정으로, 상세는 슬롯 순서로 하나씩 받지 않고 필요한 슬롯 전부를 동시 제한 없이 한꺼번에 받는다. 마지막 슬롯이 앞 슬롯의 상세를 기다리지 않게 하기 위해서다. 공대 12자리면 API가 Neople에 기본정보 12개, 섹션 120개, 공용 아이템 묶음의 세 물결로 요청을 보내며, 이로 인한 API key 할당량 위험은 감수한다.

1. 슬롯마다 후보 검색과 서버 고르기(파티는 얼굴 비교 포함)까지만 하고, 고른 후보의 이름, 서버, 명성, 직업으로 카드를 먼저 채운다. 레벨, 길드와 장비 점수는 아직 비어 있다.
2. 회차의 어느 슬롯도 조회 중이 아니면 이름과 서버를 정한 모든 슬롯의 상세를 한꺼번에 받기 시작하고, 받는 대로 그 슬롯의 레벨, 길드와 장비 점수를 채운다.
3. 상세를 받지 못하면 고른 이름과 서버는 그대로 두고 장비 점수만 비우며, 사용자가 서버와 이름을 직접 조회하면 다시 받는다. 후보 검색이나 상세가 호출 제한(429)을 받으면 아직 받기 시작하지 않은 슬롯의 상세는 받지 않고 같은 실패로 둔다. 이미 받는 중인 다른 슬롯의 상세는 요청이 이미 나갔으므로 취소하지 않고 끝까지 받아 반영한다.
4. 새 회차, 캡처 중지와 창 변경은 받는 중인 상세를 모두 취소하고 남은 상세를 받지 않는다. 한 자리의 새 조회는 그 자리의 상세만 취소하고 다른 자리의 상세는 계속 받는다. 공대 카드처럼 창을 바꿔도 끝난 자리를 남기는 화면은 이전 창에서 정한 자리의 이름과 서버를 남기고 점수만 비운다.
5. 서버 칩, 이름 칸, 후보 미리보기 같은 직접 조회는 사용자가 서버를 정했으므로 기다리지 않고 같은 요청에서 상세까지 채운다.

## Server map

요청 검증과 응답 `serverName`에 하나의 map을 사용한다. `all`은 요청의 별도 허용 값이며 실제 서버명 map에 넣지 않는다. 요청 `serverId`는 대소문자를 구분한다. 아래는 [공식 공통 가이드](https://developers.neople.co.kr/contents/guide/pages/all)에서 확인한 전체 서버 map이다.

| ID        | 이름     | ID         | 이름     |
| --------- | -------- | ---------- | -------- |
| `anton`   | 안톤     | `bakal`    | 바칼     |
| `cain`    | 카인     | `casillas` | 카시야스 |
| `diregie` | 디레지에 | `hilder`   | 힐더     |
| `prey`    | 프레이   | `siroco`   | 시로코   |

미지원 요청 ID는 400이고 비어 있지 않은 미등록 **응답** ID는 정상이다. 예를 들어 응답 `serverId: "future-server"` 또는 `"all"`은 유지하고 `serverName: null`로 반환한다. Map 변경은 공식 규격을 확인한 별도 변경으로 검토한다.

## Raw query 판별

Framework의 object 변환, 숫자 coercion 전에 original request URL의 `?` 이후 원본 query를 검사한다. Express가 만든 `req.query`만으로 중복 여부를 판단하지 않는다.

1. Raw query를 `&`로 나누고 각 component의 첫 `=`만 key/value 경계로 사용한다. `=` 없는 key는 empty value다. 비어 있는 component(`&&`, 마지막 `&`)도 잘못된 입력이다.
2. Key와 value에서 `+`를 space로 처리하고 percent-encoded UTF-8을 정확히 한 번 decode한다. 잘못된 `%` escape나 유효하지 않은 UTF-8은 400이다. `URLSearchParams`의 관대한 오류 복구 결과만 사용하지 않는다.
3. Decode한 key는 정확히 `characterName`, `serverId`, `limit` 중 하나여야 하며 각각 최대 한 번이다. `limit`와 `%6Cimit`도 중복이다. `limit[]`, `limit[0]`, `characterName[x]`와 encode된 bracket key는 허용 key가 아니므로 400이다. JSON/object로 value를 재해석하지 않는다.
4. Decode한 값에 확정 규칙을 적용한다. `characterName !== characterName.trim()`이면 400이며 공백 판별은 ECMAScript `trim`을 사용한다. 내부 공백은 별도 금지하지 않는다. `serverId`도 trim, case 변환 없이 map 또는 `all`과 비교한다.
5. `limit`는 ASCII `/^[0-9]+$/`와 숫자 범위 1~200을 모두 만족해야 한다. Leading zero는 십진 표기로 허용한다(`0010` → 10). 부호, 소수점, 지수, 앞뒤 공백, 비ASCII 숫자는 400이다. `parseInt`의 부분 성공은 사용하지 않는다.

Literal string value가 `[]`처럼 보이는 것만으로 배열로 변환하지 않는다. 배열, 객체 전달 거절은 중복 key와 bracket key 등 query 구조에 적용한다. Decode 후 남은 `%xx`는 다시 decode하지 않는다. 통과한 값을 upstream URL에 만들 때 한 번 encode한다. 이 판별은 인증 guard와 별개로 순수 함수와 raw HTTP integration test에서 검증할 수 있어야 한다.

## 검색어 길이와 외부 규격 한계

**입력 정책은 decode 후 Unicode code point 수 2~12**다. JavaScript string iterator로 세며 정규화하지 않는다. `가나`는 2, `😀`는 1, `😀가`는 2, 분해된 `가`는 2다. 공백 검증은 길이와 별도로 적용한다.

공식 문서는 `full`의 2~12자와 UTF-8 전송을 안내하지만 UTF-16 code unit, code point, grapheme 중 무엇인지는 명시하지 않는다. 이 안을 네오플과 검증된 일치 규격으로 표현하지 않는다. [검색 규격](https://developers.neople.co.kr/contents/apiDocs/df), [UTF-8, 검색 타입 FAQ](https://developers.neople.co.kr/contents/faq?category=2)

| 선택                           | 영향                                                                                    |
| ------------------------------ | --------------------------------------------------------------------------------------- |
| Code point — 채택              | Supplementary character를 하나로 세며 결합 sequence는 여러 개. 별도 dependency 없음.    |
| UTF-16 code unit — 미채택 대안 | JavaScript `length`와 같지만 supplementary character 하나가 둘로 셈.                    |
| Grapheme — 미채택 대안         | 화면상의 글자에 가까우나 Unicode segmentation과 외부 검색 제한이 같다고 보장할 수 없음. |

Code point 입력 정책과 외부 단위 미확인 한계는 승인됐다. 이는 네오플의 측정 단위를 실제로 확인했다는 뜻이 아니며, 다른 측정 정책으로 바꾸려면 별도 승인을 받는다. 우리 검증을 통과한 query를 네오플이 거절하는 경우 아래 502 mapping을 유지하고 임의로 길이, 정규화 정책을 바꾸지 않는다. 이 결정은 credential 없는 runtime, adapter 검증을 막지 않는다.

## 정제된 오류

Body는 `{"error":{"code":"<CODE>","message":"<MESSAGE>"}}`만 사용한다. Upstream body, message, Key, 내부 상세를 포함하지 않는다.

| 우리 HTTP / code            | 고정 message                                                       |
| --------------------------- | ------------------------------------------------------------------ |
| `400 INVALID_SEARCH_QUERY`  | 검색 조건을 확인해 주세요.                                         |
| `429 SEARCH_RATE_LIMITED`   | 검색 요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.             |
| `500 INTERNAL_SERVER_ERROR` | 서버 오류로 검색을 처리하지 못했습니다.                            |
| `502 NEOPLE_API_ERROR`      | 캐릭터 검색 중 오류가 발생했습니다.                                |
| `503 NEOPLE_UNAVAILABLE`    | 현재 캐릭터 검색을 이용할 수 없습니다. 잠시 후 다시 시도해 주세요. |
| `504 NEOPLE_TIMEOUT`        | 캐릭터 검색 응답 시간이 초과됐습니다. 다시 시도해 주세요.          |

| 순서       | 조건                                                                                  | 결과                                                   |
| ---------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| Local      | 우리 query 오류                                                                       | 400; upstream 없음.                                    |
| Local      | 우리 설정, 내부 오류                                                                   | 500; upstream 여부는 오류 발생 지점에 따름.            |
| Upstream 1 | 공급자 응답 timeout                                                                   | 504; 도착이 늦은 response나 code로 결과를 바꾸지 않음. |
| Upstream 2 | 식별한 `API000`, `API003`, `API004`, `API005`                                         | Upstream HTTP와 관계없이 500.                          |
| Upstream 3 | 식별한 `API002`, `API008`, `DNF980`                                                   | Upstream HTTP와 관계없이 503.                          |
| Upstream 4 | 식별한 `API901`, `DNF901`, `DNF000`, `API006`, `API007`, `API900`, `API999`, `DNF999` | Upstream HTTP와 관계없이 502.                          |
| Upstream 5 | 위 분류가 없는 실패이며 upstream HTTP 429 또는 503                                    | 503.                                                   |
| Upstream 6 | 그 밖의 upstream 실패, 통신 실패, JSON/응답 검증 실패                                   | 502.                                                   |

네오플 error code는 exact string `error.code`로 식별하며 `error.status`가 HTTP나 알려진 code를 덮어쓰지 않는 안이다. 표에 없는 code는 미분류 fallback을 적용한다. 알려진 code가 HTTP 2xx와 함께 와도 code 분류를 우선하고, `error`가 존재하는 body는 `rows`와 함께 와도 성공으로 처리하지 않는 안이다. 비JSON 또는 malformed error의 code를 추정하지 않는다. 식별 가능한 code가 없으면 실제 HTTP fallback을 사용하며 2xx body가 유효한 `rows`일 때만 성공한다.

공식 [오류 코드 표](https://developers.neople.co.kr/contents/guide/pages/code)의 Key/IP 사용량 초과는 HTTP 400이다. 이를 우리 입력 400으로 복사하지 않는다. Key 오류의 upstream 401도 우리 로그인 401로 바꾸지 않는다. `API901` + HTTP 503은 알려진 code가 우선하여 502, 미분류 code + HTTP 503은 fallback 503이다.

## Timeout과 adapter

네오플 응답 대기는 HTTP client(ky)의 기본 timeout을 따른다. Timeout은 504 `NEOPLE_TIMEOUT`, 서버 자동 retry는 0회다. 정확한 대기 시간은 제품 계약으로 고정하지 않는다.

Timeout이 나면 transport를 취소하고, 늦게 도착한 response나 code로 결과를 바꾸지 않는다. Timeout 전의 network, body read 실패는 502다. Redirect는 따라가지 않는 안이며 3xx는 위 fallback 오류다. 늦게 끝난 작업으로 추가 응답하거나 retry하지 않는다.

순수 adapter는 **검증된 검색 값 → URL 구성, transport 1회, 전체 응답 검증/projection 또는 정제된 오류**를 담당한다. 인증 guard, user/session, DB와 활동 기록을 import하지 않는다. Transport는 test에서 fake로 제어할 수 있어야 하며 loopback upstream으로 실제 HTTP encoding, status, body를 검증한다. Timeout에 따른 취소는 fake transport로 검증한다. 운영 upstream origin은 고정하고 요청 query가 URL/host를 지정하지 못하게 한다. Loopback origin과 fake credential은 test 주입에만 사용한다. [Node fetch](https://nodejs.org/docs/latest-v26.x/api/globals.html#fetch)

## 공개 검색과 호출 제한

2026-09-15 사용자의 로그인 선택 요구에 따라 검색은 인증 없이 제공한다. Authorization 유무, 유효성으로 기능을 막지 않고 검색 handler는 이를 사용하지 않는다. JWT, session DB 조회, 활동 갱신, refresh는 검색 경로에서 수행하지 않는다.

검색에는 **클라이언트별 호출 제한이 없다**. 2026-10-20 [#774](https://github.com/blahaj94/dfragon/issues/774)의 사용자 결정으로 이전의 클라이언트별 최근 60초 10회 한도를 없앴다. 공대 12자리 조회 한 번이 이 한도를 넘어 일부 슬롯이 429로 실패했기 때문이다.

Neople 호출에도 **서버 전체 호출 제한이 없다**. 2026-10-20 [#778](https://github.com/blahaj94/dfragon/issues/778)의 사용자 결정으로 모든 검색, 캐릭터 섹션, 공용 상세가 함께 쓰던 프로세스 전체 최근 60초 600회, 동시 12회 예산을 없앴다. 공대 12자리가 동시에 조회하면 동시 12회에 닿아 일부 슬롯이 429로 실패할 수 있었기 때문이다. 이제 API는 검색에서 429를 반환하지 않으며, 많은 요청이 몰려 Neople API key의 공식 할당량을 넘으면 key가 막혀 모든 사용자의 검색, 상세가 공급자 오류로 실패할 수 있다. API는 캐릭터 조회 결과를 저장하지 않아 모든 상세 요청이 Neople을 부른다. 같은 결정으로 [캐릭터 상세](character-details.md#오류-호출-제한)의 동시 섹션 조회, 공용 상세 동시 호출 제한도 없앴다. 2026-10-29 [#992](https://github.com/blahaj94/dfragon/issues/992)부터 공용 아이템 상세는 24시간 메모리에 캐시해 이미 받은 아이템을 다시 부르지 않는다([캐릭터 상세](character-details.md#공용-아이템-상세)).

위 표의 `429 SEARCH_RATE_LIMITED`는 앞단 proxy가 호출 제한을 둘 때 쓸 응답 형식으로 남긴다. Desktop은 429 body의 `error.code`가 이 값일 때만 호출 제한 실패로 본다. 2026-10-29 [#954](https://github.com/blahaj94/dfragon/issues/954) 결정으로 Desktop은 `Retry-After`를 읽지 않고 기다리지도 않으므로, 사용자는 호출 제한 실패 뒤 바로 다시 시도할 수 있다.

단일 호스트 Caddy 배포는 명시적 `SEARCH_TRUST_PROXY=single-hop` 설정에서만 Express의 1-hop `trust proxy`를 켠다. Caddy가 `X-Forwarded-For`를 직접 연결한 클라이언트 주소로 덮어쓰고, API의 공개 port는 loopback으로 제한한다. 외부의 유일한 경로가 Caddy라는 배포 경계에 의존하며 호스트, 동일 Docker network의 직접 접근 주체까지 인증하는 설정은 아니다. 다중 proxy, 외부 직접 접근으로 확대하지 않는다. 지금은 API에 IP를 key로 쓰는 한도가 없어 이 설정이 응답에 영향을 주지 않지만, 운영 설정을 바꾸지 않도록 설정 읽기는 남겨 둔다.

- API 키 설정은 listen 전에 검증한다. 서비스는 준비된 검색 어댑터를 주입받으며 요청 단계에서 키를 다시 읽거나 검사하지 않는다. 누락, 빈 값, 공백뿐인 키는 HTTP 응답이 아닌 시작 실패다. [Runtime의 설정 책임](api-runtime.md#실행과-검증-경계)을 따른다.
- 요청에서는 raw query를 먼저 검증한다. 입력 실패는 upstream이 없다. 공급자가 반환하는 키 오류 등 기존 정제 500 정책은 유지한다.
- 같은 peer의 동시 요청도 모두 upstream으로 넘어간다. Queue, 자동 retry는 없다.

### Authentication activity contract

이전 PR #48의 검색 JWT, 계정 admission, DB 활동 계약은 공개 검색에 적용하지 않는다. 계정 서비스는 2026-10-26에 지웠다([#796](https://github.com/blahaj94/dfragon/issues/796)).

## 간결한 경계 예시

아래는 검색 계약의 기대값이다. Upstream 횟수는 유효한 설정을 전제로 한다.

| 사례                                                  | HTTP / body의 핵심                                        | Upstream |
| ----------------------------------------------------- | --------------------------------------------------------- | -------- |
| `characterName=가나`, 옵션 생략, 빈 결과              | 200 / `{"rows":[]}`, upstream `all`, 10, `full`           | 1        |
| `characterName` 없음, 1자, 13자, 앞뒤 공백               | 400 / `INVALID_SEARCH_QUERY`                              | 0        |
| `serverId=`, `limit=`, `limit=1e2`, 미지원 서버          | 400 / `INVALID_SEARCH_QUERY`                              | 0        |
| 중복, encoded 중복, bracket key, unknown key, 깨진 escape | 400 / `INVALID_SEARCH_QUERY`                              | 0        |
| `limit=0001`, `limit=200`                              | 200 / 검증된 rows, upstream limit 1, 200                   | 각 1     |
| 응답 `fame: 0` / null / 누락                          | 200 / 각각 0 / null / null                                | 각 1     |
| 정상 후보와 `fame: "0"` 후보 혼합                     | 502 / `NEOPLE_API_ERROR`, 부분 rows 없음                  | 1        |
| 정상 미등록 응답 서버                                 | 200 / ID 유지, `serverName: null`                         | 1        |
| `API003` + HTTP 401 / `API002` + HTTP 400             | 500 / `INTERNAL_SERVER_ERROR`, 503 / `NEOPLE_UNAVAILABLE` | 각 1     |
| 공급자 응답 없음                                      | 504 / `NEOPLE_TIMEOUT`, retry 없음                        | 1        |
| 같은 peer가 60초 안에 보낸 12번째 요청                | upstream 결과                                             | 1        |

상세 acceptance matrix와 실행 evidence는 기존 작업 기록이나 PR에 둔다. Runtime 도구와 실제 실행 계획은 [`api-runtime.md`](api-runtime.md), 변경별 검증은 [검증 명령](../../scripts/README.md#native-validation)를 따른다. 길이, raw decoding, timeout, 호출 제한 정책과 인증 통합의 변경을 후속 구현자의 일반 선택으로 숨기지 않는다.
