# 얼굴 색 비교 오프라인 평가

파티 HUD 얼굴과 네오플 캐릭터 이미지 후보를 `createPortraitColorScorer`로 비교해, 정답 후보가 얼마나 잘 1위가 되는지와 정답, 오답 distance가 얼마나 떨어지는지를 표본으로 측정합니다. `gridSize`와 임계값을 정하기 위한 도구이며 제품에는 연결돼 있지 않습니다. 제품의 `portrait-color.ts`, `portrait-raster.ts`를 그대로 import하고 네트워크는 쓰지 않습니다.

## 실행

Repository root에서 실행합니다. 표본 폴더는 저장소 밖에 둡니다.

```bash
DFRAGON_PORTRAIT_SAMPLES=/path/to/samples \
DFRAGON_PORTRAIT_REPORT=/path/to/report.json \
pnpm --filter @dfragon/desktop run test:portrait-evaluation
```

`test:portrait-evaluation`은 전용 `tsc`로 이 폴더를 검사한 뒤 `vitest.config.ts`로 `*.evaluation.ts`만 실행합니다. Desktop의 기본 `test`에는 포함되지 않습니다. `DFRAGON_PORTRAIT_SAMPLES`가 없으면 평가는 건너뜁니다. 같은 폴더의 `*.test.ts`는 표본 없이 도는 합성 데이터 테스트이며 기본 `test`가 실행합니다.

| 환경 변수 | 설명 |
| --- | --- |
| `DFRAGON_PORTRAIT_SAMPLES` | 표본 폴더. 안에 `manifest.json`이 있어야 합니다. 없으면 건너뜁니다. |
| `DFRAGON_PORTRAIT_REPORT` | 지정하면 후보별 점수까지 담은 결과를 이 경로에 JSON으로 저장합니다. |
| `DFRAGON_PORTRAIT_DETAIL` | `1`이면 후보별 distance, coverage, 비교한 셀 수 표를 추가로 출력합니다. |
| `DFRAGON_PORTRAIT_MIN_COVERAGE` | `minCoverage`. 기본 0.5 |
| `DFRAGON_PORTRAIT_MIN_COMPARED_CELLS` | `minComparedCells`. 기본 6 |
| `DFRAGON_PORTRAIT_TOP_FRACTION` | `topFraction`. 기본 0.5 |
| `DFRAGON_PORTRAIT_ANCHOR_RADIUS` | `anchorRadius`. 기본 2 |
| `DFRAGON_PORTRAIT_ANCHORS` | `0`이면 직업별 얼굴 위치를 쓰지 않고 모든 후보를 `topFraction` 범위에서 찾는다. 기본은 제품처럼 사용 |

세 정책 기본값은 `portrait.evaluation.ts` 상단의 `DEFAULT_POLICY`이며 실표본 결과로 정할 후보값입니다. `gridSize`는 4, 6, 8을 모두 측정합니다.

## manifest 형식

`manifest.json`의 경로는 manifest가 있는 폴더 기준 상대 경로이며 폴더 밖을 가리킬 수 없습니다.

```json
{
  "cases": [
    {
      "id": "case-01",
      "hud": "case-01/hud.png",
      "rasterScale": 1,
      "candidates": [
        { "id": "c0", "image": "case-01/candidate-0.png", "correct": true, "jobName": "귀검사(남)" },
        { "id": "c1", "image": "case-01/candidate-1.png" }
      ]
    }
  ]
}
```

- 케이스 id와 케이스 안의 후보 id는 중복될 수 없고, 정답(`correct: true`)은 케이스마다 정확히 1명입니다.
- `hud`는 이미 잘라 둔 HUD 얼굴 PNG이며 정사각이고 한 변이 `round(26 × rasterScale)`입니다. 읽을 때 `isValidPartyFrameSize`를 만족하는 패딩 프레임의 크롭 위치에 붙인 뒤 제품의 `cropPartyPortrait`로 다시 읽어 마스크(테두리, 왕관 자리)를 얻고, 읽은 픽셀이 입력과 같은지 확인합니다.
- `image`가 null인 후보는 비교하지 않고 표의 `skipped`에 셉니다.
- 후보 PNG는 zoom=1 캐릭터 이미지 원본입니다.
- id에는 `case-01`, `c0` 같은 익명 값을 씁니다.
- `jobName`은 후보의 기본 직업명이며 생략하면 null입니다. 값이 있으면 제품과 같이 `portraitAnchorOf`의 직업별 얼굴 위치 주변만 비교합니다.

## 지표

케이스마다 모든 후보 점수를 구해 `distance`가 작은 순으로 순위를 매깁니다.

- `rank`: 정답보다 distance가 작거나 같은 오답의 수에 1을 더한 값입니다. 동점은 정답에 불리하게 셉니다. 정답 점수가 null이면 비교한 후보 수(최하위)입니다. 오답의 점수가 null이면 순위에 영향을 주지 않습니다.
- `correct`: 정답 후보의 distance입니다.
- `margin`: 점수가 있는 오답의 최소 distance에서 정답 distance를 뺀 값입니다. 정답이 1위면 1위와 2위의 차이이므로 양수이고, 정답이 1위가 아니면 0 이하이며 그 절댓값은 정답과 1위의 차이입니다. 정답이나 점수 있는 오답이 없으면 null입니다.
- `coverage`: 정답 후보의 coverage입니다.
- `ms`: 케이스의 후보 전부를 순서대로 비교하는 데 걸린 시간입니다.
- 점수가 null인 후보(coverage, 비교한 셀 수 미달, 단색, 전부 투명)는 `DFRAGON_PORTRAIT_DETAIL=1` 표와 JSON에 null로 남습니다.

정답 이미지가 없는 케이스는 점수를 구하지 않고, 후보가 1명뿐인 케이스는 점수만 구합니다. 두 경우 모두 1위 정확도와 margin 요약에서 빼며 제외 사유(`correct-image-missing`, `single-candidate`)를 출력합니다.

`gridSize`별 요약은 다음을 출력합니다.

| 열 | 정의 |
| --- | --- |
| `cases`, `excluded` | 요약에 포함한 케이스 수, 제외한 케이스 수 |
| `top1`, `accuracy` | 정답이 1위인 케이스 수, 포함한 케이스 중 비율 |
| `max correct` | 점수가 있는 모든 케이스의 정답 distance 최댓값 |
| `min wrong top1` | 정답이 1위가 아닌 케이스에서 1위가 된 오답의 distance 최솟값 |
| `min wrong` | 모든 케이스의 오답 distance 최솟값 |
| `min top1 margin` | 정답이 1위인 케이스의 margin 최솟값 |
| `null` | 점수가 null인 후보 수 |

`max correct`가 `min wrong`보다 작으면 distance 하나로 정답과 오답을 가를 수 있고, 겹치면 `maxDistance`로 가를 수 없습니다. `min top1 margin`은 `minMargin` 후보를 정할 때 봅니다.

## 후보 PNG 수집

후보는 Neople 캐릭터 이미지 `https://img-api.neople.co.kr/df/servers/{serverId}/characters/{characterId}?zoom=1`에서 받습니다. API key는 필요 없습니다. 요청이 몰리지 않게 한 번에 하나씩 받습니다. 이 도구는 네트워크를 쓰지 않으므로 받은 PNG는 표본 폴더에 직접 넣습니다. 동명 후보의 서버, 캐릭터 id 목록은 정답을 아는 상태에서 캐릭터 검색 결과로 확인합니다.

## 저장소에 넣지 않는 것

표본 PNG, `manifest.json`, 결과 JSON과 플레이어 식별자(캐릭터명, 서버, 캐릭터 id)는 저장소, CI, PR 본문에 넣지 않습니다. 결과를 공유할 때는 위 요약 수치만 적습니다.
