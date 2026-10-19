---
type: reference
status: active
scope: apps/api character card enchant grade table
last-reviewed: 2026-10-19
---

# 마법부여 등급표

`apps/api/src/characters/card/enchant-grades.json`의 출처, 판정 규칙, 다시 만드는 절차, 부위별 근거와 정할 것을 적는다. API의 판정 규칙은 [캐릭터 상세](../rules/character-details.md#마법부여-등급)가 정한다. 담당자는 이 문서의 표를 보고 JSON의 항목을 PR에서 고친다.

## 규칙

담당자가 2026-10-19에 정한 규칙이다. 던전앤파이터 공식 홈페이지의 업데이트, 퍼스트서버 게시판에서 "신규 마법부여 카드"로 소개된 가장 최근 글의 카드가 종결이고, 그 부위에서 그보다 앞선 세대의 카드가 준종결이다.

- 부위마다 따로 본다. 그 부위에 장착할 수 있는 카드가 나온 가장 최근 글의 카드가 종결, 그보다 앞선 글 중 그 부위 카드가 나온 가장 최근 글의 카드가 준종결이다.
- 같은 날짜에 (1), (2), (3)으로 나뉜 글은 한 세대다. 한 글의 레전더리와 유니크 카드는 모두 같은 세대다.
- 카드의 업그레이드 단계와 무관하게 그 카드면 같은 등급이다. 모든 단계의 옵션을 표에 넣는다.
- 같은 옵션 조합을 주는 카드가 여럿이면 이름만 다른 다른 카드이므로 한 항목에 `cardNames` 배열로 모두 둔다. 그 조합이 종결과 준종결에 걸치면 종결을 바꾸지 않고 종결 항목에 둔다.
- 기타 등급은 두지 않는다. 표에 없는 마법부여는 null(미평가)이다.
- 정기 실행, Actions, API 서버 갱신 같은 자동화는 하지 않는다. 카드는 3개월에서 6개월에 한 번 추가되므로 그때 사람이나 AI 에이전트가 아래 절차로 다시 만든다.

## 다시 만드는 절차

저장소에 생성 스크립트를 두지 않는다. 게시판과 Neople API를 읽는 임시 코드는 작업 폴더 밖에서 쓰고 버리며, 게시판 HTML 원문과 API 응답 원문은 저장소에 넣지 않는다.

1. 목록 `https://df.game.naver.com/community/news/update/list?categoryType=4&page=N`(페이지 하나에 글 20개, 서버가 그린 HTML의 `li.title[data-no]`, `li.date`)을 최신부터 읽어 글 번호와 날짜를 모은다. 요청 사이는 1초 이상 둔다.
2. 글 `https://df.game.naver.com/community/news/update/<번호>`의 본문(`div.bd_viewcont`)에서 신규 카드 목록을 읽는다. 문구는 "신규 마법 부여 카드가 추가됩니다"(표, 열은 카드 명, 레어리티, 적용 가능 부위), "레전더리 등급의 ○○ 신규 마법부여 카드입니다"(레이드 보상 표, 아래 `ㄴ 이름`, `- 이름`, 이름만 있는 줄), "신규 마법 부여 몬스터 카드가 추가됩니다"처럼 띄어쓰기와 낱말이 조금씩 다르다. 레이드 보상 표에 이름 없이 "○○ 신규 마법부여 카드입니다"만 있으면 같은 날짜의 다른 글이나 같은 글의 표에서 이름을 찾는다.
3. 이름마다 Neople Open API `GET /df/items?itemName=<이름>&wordType=match`로 itemId를 찾고 `GET /df/items/<itemId>`의 `cardInfo.slots[].slotId`(부위)와 `cardInfo.enchant[].status`(단계별 옵션)를 읽는다. 글의 이름이 실제 이름과 다르면(예: 글의 `추락한 크리테 카드`는 API의 `추락한 크리테스 카드`) `wordType=full`로 찾아 API 이름을 쓴다. API 키는 `NEOPLE_API_KEY` 환경변수로만 읽고 코드, 로그, 문서에 남기지 않는다.
4. `status`에서 `모험가 명성`을 뺀다. 카드의 다른 옵션 표기는 장비의 `enchant.status`와 같다(예: 보조장비 카드의 크리티컬 `"3.0%"`, 무기 카드의 캐스트속도 `"7%"`).
5. 부위마다 최신 세대와 그 앞 세대를 고르고 모든 단계의 옵션을 항목으로 넣는다. 같은 조합은 한 항목에 카드 이름을 모두 모으고, 두 등급에 걸치면 종결에 둔다. 12부위가 모두 두 세대를 갖출 때까지 거슬러 올라간다.
6. JSON의 `source.dataset`은 `first-server <종결에 쓴 가장 최근 글 번호> <날짜>`, `generated_at`은 만든 시각(UTC)이다. `pnpm --filter @dfragon/api run --sequential '/^(lint|test)$/'`로 형식 검사를 돌리고, 실응답 fixture(`apps/api/test/fixtures/character-card-*.json`)와 Desktop의 사본(`apps/desktop/src/frontend/src/testing/fixtures/api-character-cards.ts`), Desktop 카드 면 테스트의 등급 단언을 새 표에 맞춘다. 이 문서의 표도 함께 고친다.

## 부위별 판정

종결 83개, 준종결 68개다. 항목은 옵션 조합 하나이며 같은 조합의 카드는 한 항목에 모였다.

| 부위 | 등급 | 글 날짜 | 글 | 카드 | 항목 수 |
| --- | --- | --- | --- | --- | --- |
| 무기(WEAPON) | 종결 | 2026-07-29 | [2928057](https://df.game.naver.com/community/news/update/2928057) | 영혼의 안내자 사리엘 카드 | 3 |
| 무기(WEAPON) | 준종결 | 2025-11-26 | [2924011](https://df.game.naver.com/community/news/update/2924011) | 뒤얽힌 사념 : 종언 카드, 허망한 맹신, 호스디그 카드 | 6 |
| 상의(JACKET) | 종결 | 2026-07-29 | [2928057](https://df.game.naver.com/community/news/update/2928057) | 공정의 저울 라구엘 카드, 부리는 자 앤지 카드 | 6 |
| 상의(JACKET) | 준종결 | 2026-04-15 | [2926972](https://df.game.naver.com/community/news/update/2926972) | 눈물짓는 블리스 카드, 신실한 소코르스 카드, 정직한 픽툼 카드, 종말의 칼날 로페즈 카드 | 12 |
| 머리어깨(SHOULDER) | 종결 | 2024-12-24 | [2846229](https://df.game.naver.com/community/news/update/2846229), [2846230](https://df.game.naver.com/community/news/update/2846230) | 벌목꾼 그레일로 카드, 일각수 크라켄 카드, 파종하는 머크 카드, 폭음 크래시머 카드 | 14 |
| 머리어깨(SHOULDER) | 준종결 | 2023-05-03 | [2800088](https://df.game.naver.com/community/news/update/2800088) | 코드네임 게이볼그 카드 | 1 |
| 하의(PANTS) | 종결 | 2026-07-29 | [2928057](https://df.game.naver.com/community/news/update/2928057) | 마법 같은 행운 엘리브 카드, 마법을 품은 배니부 카드 | 6 |
| 하의(PANTS) | 준종결 | 2026-03-11 | [2925842](https://df.game.naver.com/community/news/update/2925842), [2925844](https://df.game.naver.com/community/news/update/2925844) | 땅지기 스크리본 카드, 지혜를 간직한 그레이슨 카드 | 6 |
| 벨트(WAIST) | 종결 | 2026-03-11 | [2925842](https://df.game.naver.com/community/news/update/2925842), [2925844](https://df.game.naver.com/community/news/update/2925844) | 무관심한 카리타 카드, 추락한 크리테스 카드 | 6 |
| 벨트(WAIST) | 준종결 | 2026-01-28 | [2925369](https://df.game.naver.com/community/news/update/2925369) | 재앙을 일으키는 육신 카드, 종언을 고하는 본능 카드 | 5 |
| 신발(SHOES) | 종결 | 2026-07-29 | [2928057](https://df.game.naver.com/community/news/update/2928057) | 진리의 불꽃 우리엘 카드, 치유의 손길 라파엘 카드 | 6 |
| 신발(SHOES) | 준종결 | 2025-11-26 | [2924011](https://df.game.naver.com/community/news/update/2924011) | 오만한 위신, 셀게이퍼 카드, 왜곡된 욕신, 루브라 카드 | 6 |
| 목걸이(AMULET) | 종결 | 2025-11-26 | [2924011](https://df.game.naver.com/community/news/update/2924011) | 더러운 피를 흘리는 자 카드, 제6사도 디레지에 카드 | 6 |
| 목걸이(AMULET) | 준종결 | 2025-04-09 | [2918806](https://df.game.naver.com/community/news/update/2918806) | 과학자 모리 카드, 인공신 프로토타입 카드 | 4 |
| 팔찌(WRIST) | 종결 | 2026-07-29 | [2928057](https://df.game.naver.com/community/news/update/2928057) | 가려진 정의 미카엘 카드, 무너진 성자 미카엘라 카드 | 6 |
| 팔찌(WRIST) | 준종결 | 2026-03-11 | [2925842](https://df.game.naver.com/community/news/update/2925842), [2925844](https://df.game.naver.com/community/news/update/2925844) | 결백의 페카토르 카드, 고귀한 빌리스 카드 | 4 |
| 반지(RING) | 종결 | 2026-03-11 | [2925842](https://df.game.naver.com/community/news/update/2925842), [2925844](https://df.game.naver.com/community/news/update/2925844) | 제어할 수 없는 파비아 카드, 침묵의 카라 카드 | 6 |
| 반지(RING) | 준종결 | 2026-01-28 | [2925369](https://df.game.naver.com/community/news/update/2925369) | 3대대 부관 철편자 카르케오 카드, 비명을 머금은 분노 카드 | 4 |
| 보조장비(SUPPORT) | 종결 | 2026-07-29 | [2928057](https://df.game.naver.com/community/news/update/2928057) | 하늘의 목소리 지브릴 카드, 희망의 속삭임 레미엘 카드 | 10 |
| 보조장비(SUPPORT) | 준종결 | 2026-04-15 | [2926972](https://df.game.naver.com/community/news/update/2926972) | 자유로운 이카 카드 | 3 |
| 마법석(MAGIC_STON) | 종결 | 2026-03-11 | [2925842](https://df.game.naver.com/community/news/update/2925842), [2925844](https://df.game.naver.com/community/news/update/2925844) | 거짓의 베리디쿠스 카드, 해방된 비올렌티아 카드 | 6 |
| 마법석(MAGIC_STON) | 준종결 | 2025-01-22 | [2869529](https://df.game.naver.com/community/news/update/2869529) | 베누스의 보석함 카드, 요격대 테아스 카드 | 10 |
| 귀걸이(EARRING) | 종결 | 2026-07-29 | [2928057](https://df.game.naver.com/community/news/update/2928057) | 진실을 꿰뚫어 보는 자 카드, 타락한 사도 미카엘라 카드 | 8 |
| 귀걸이(EARRING) | 준종결 | 2026-01-28 | [2925369](https://df.game.naver.com/community/news/update/2925369) | 만개한 불신, 라르고 카드, 붕괴한 광신, 마흐나발 카드 | 7 |

## 읽은 글과 세대

최신 글부터 12부위가 모두 두 세대를 갖출 때까지 읽었다. 카드 수는 글에서 읽어 API로 확인한 이름의 수다.

| 글 날짜 | 글 | 카드 수 | 비고 |
| --- | --- | --- | --- |
| 2026-07-29 | [2928057](https://df.game.naver.com/community/news/update/2928057) | 13 |  |
| 2026-04-15 | [2926972](https://df.game.naver.com/community/news/update/2926972) | 5 |  |
| 2026-03-11 | [2925842](https://df.game.naver.com/community/news/update/2925842), [2925844](https://df.game.naver.com/community/news/update/2925844) | 11 |  |
| 2026-01-28 | [2925369](https://df.game.naver.com/community/news/update/2925369) | 6 |  |
| 2025-11-26 | [2924011](https://df.game.naver.com/community/news/update/2924011) | 8 |  |
| 2025-08-13 | [2922535](https://df.game.naver.com/community/news/update/2922535) | 6 |  |
| 2025-04-09 | [2918806](https://df.game.naver.com/community/news/update/2918806) | 14 |  |
| 2025-01-22 | [2869529](https://df.game.naver.com/community/news/update/2869529) | 8 |  |
| 2024-12-24 | [2846229](https://df.game.naver.com/community/news/update/2846229), [2846230](https://df.game.naver.com/community/news/update/2846230) | 18 |  |
| 2024-04-17 | [2842268](https://df.game.naver.com/community/news/update/2842268) | 5 |  |
| 2024-02-14 | [2840972](https://df.game.naver.com/community/news/update/2840972) | 8 |  |
| 2023-11-01 | [2839230](https://df.game.naver.com/community/news/update/2839230) | 2 |  |
| 2023-08-30 | [2837503](https://df.game.naver.com/community/news/update/2837503) | 12 |  |
| 2023-05-03 | [2800088](https://df.game.naver.com/community/news/update/2800088) | 1 |  |
| 2022-12-21 | [2755892](https://df.game.naver.com/community/news/update/2755892) | 1 |  |
| 2022-10-19 | [2725621](https://df.game.naver.com/community/news/update/2725621) | 9 |  |
| 2022-09-14 | [2714148](https://df.game.naver.com/community/news/update/2714148) | 0 | 이름이 그림에만 있음 |
| 2022-06-29 | [2685625](https://df.game.naver.com/community/news/update/2685625) | 4 |  |
| 2022-05-04 | [2665156](https://df.game.naver.com/community/news/update/2665156) | 2 |  |

- 2022-09-14 글은 카드 이름이 그림에만 있어 읽지 못했다. 이 글보다 앞선 세대가 필요한 부위가 없어 판정에 영향이 없다.
- 글의 이름이 API 이름과 다른 카드 4장은 API 이름으로 넣었다. `추락한 크리테 카드`는 `추락한 크리테스 카드`, `폭주하는 안개 브림 카드`는 `분노하는 안개 브림 카드`, `불신위괴 카드`는 `불신위괴 라르고 카드`, `기억의 도서관 지기 카드`는 `기억의 도서관지기 카드`다.
- `붕괴한 광신, 마흐나발 카드`는 2025-11-26 글의 레이드 보상 목록과 2026-01-28 글의 신규 카드 표에 모두 나온다. 최신 글인 2026-01-28 세대로 두었다.

## 같은 옵션을 주는 카드

신규 카드의 낮은 단계가 직전 카드의 높은 단계와 같은 옵션이거나, 같은 글의 카드끼리 같은 옵션인 경우다. 한 항목에 이름을 모두 두었고, 두 등급에 걸친 조합은 종결이다.

| 부위 | 등급 | 카드 |
| --- | --- | --- |
| 머리어깨(SHOULDER) | 종결 | 일각수 크라켄 카드, 파종하는 머크 카드, 코드네임 게이볼그 카드 |
| 머리어깨(SHOULDER) | 종결 | 일각수 크라켄 카드, 파종하는 머크 카드 |
| 머리어깨(SHOULDER) | 종결 | 파종하는 머크 카드, 코드네임 게이볼그 카드 |
| 벨트(WAIST) | 종결 | 추락한 크리테스 카드, 재앙을 일으키는 육신 카드 |
| 목걸이(AMULET) | 종결 | 제6사도 디레지에 카드, 인공신 프로토타입 카드 |
| 목걸이(AMULET) | 종결 | 더러운 피를 흘리는 자 카드, 과학자 모리 카드 |
| 팔찌(WRIST) | 종결 | 무너진 성자 미카엘라 카드, 결백의 페카토르 카드 |
| 팔찌(WRIST) | 종결 | 가려진 정의 미카엘 카드, 고귀한 빌리스 카드 |
| 반지(RING) | 종결 | 침묵의 카라 카드, 비명을 머금은 분노 카드 |
| 반지(RING) | 종결 | 제어할 수 없는 파비아 카드, 3대대 부관 철편자 카르케오 카드 |
| 귀걸이(EARRING) | 종결 | 진실을 꿰뚫어 보는 자 카드, 붕괴한 광신, 마흐나발 카드 |

## 정할 것

- 머리어깨 준종결: 2024-12-24 세대 앞에 머리어깨 카드가 나온 글이 2023-05-03의 코드네임 게이볼그 카드뿐이라 준종결이 오래된 카드다. 2022-09-14 글(이름이 그림에만 있음)에 머리어깨 카드가 있었다면 그 글이 준종결이 된다.
- 보조장비: 2026-03-11의 조율의 감시자 오르테르 카드는 세 번째 세대라 표에 없다.
- 기타 등급: 표에 기타 항목이 없어 종결, 준종결이 아닌 마법부여는 모두 미평가다.

## 표본 판정 분포

비공개 엔진 저장소 golden vector 캐릭터 30명의 12부위 장착 마법부여 360개를 이 표로 판정한 결과다. 옵션 없음은 `status`가 비어 판정하지 않은 슬롯이다.

| 부위 | 종결 | 준종결 | 미평가 | 옵션 없음 |
| --- | --- | --- | --- | --- |
| 무기(WEAPON) | 4 | 5 | 21 | 0 |
| 상의(JACKET) | 12 | 3 | 15 | 0 |
| 머리어깨(SHOULDER) | 19 | 0 | 11 | 0 |
| 하의(PANTS) | 2 | 12 | 15 | 1 |
| 벨트(WAIST) | 10 | 4 | 16 | 0 |
| 신발(SHOES) | 2 | 11 | 17 | 0 |
| 목걸이(AMULET) | 5 | 4 | 20 | 1 |
| 팔찌(WRIST) | 6 | 4 | 20 | 0 |
| 반지(RING) | 5 | 5 | 20 | 0 |
| 보조장비(SUPPORT) | 8 | 2 | 20 | 0 |
| 마법석(MAGIC_STON) | 4 | 11 | 15 | 0 |
| 귀걸이(EARRING) | 1 | 3 | 26 | 0 |
| 합계 | 78 | 64 | 216 | 2 |

## 이력

2026-10-19 첫 초안은 PVF 카드 데이터의 옵션 지표(속성강화, 공격력 등)로 1등을 종결, 2등을 준종결로 두었으나 담당자가 같은 날 위 규칙으로 바꿨다.
