# 공대 행 판독 오프라인 평가

공대 상세 창 원본에서 창 검출, 수치 열 종류(`fame`, `equipment-score`, `unknown`), 수치 표기, 직업명 OCR이 정답과 얼마나 맞는지 표본으로 측정합니다. 공대 식별의 직업명 비교 규칙과 명성 허용 오차를 다시 측정하는 도구입니다. `@dfragon/lib`의 검출, 판독 함수와 `src/backend/lib/`의 기준 이미지, renderer의 OCR 전처리와 CTC 디코딩, 제품의 직업명 비교 규칙(`src/backend/search/raid-job-name.ts`)을 그대로 import하고 네트워크는 쓰지 않습니다.

## 실행

Repository root에서 실행합니다. 표본 폴더는 저장소 밖에 둡니다.

```bash
DFRAGON_RAID_ROW_SAMPLES=/path/to/samples \
DFRAGON_RAID_ROW_REPORT=/path/to/report.json \
pnpm --filter @dfragon/desktop run test:raid-row-evaluation
```

`test:raid-row-evaluation`은 전용 `tsc`로 이 폴더를 검사한 뒤 `vitest.config.ts`로 `*.evaluation.ts`만 실행합니다. Desktop의 기본 `test`에는 포함되지 않습니다. `DFRAGON_RAID_ROW_SAMPLES`가 없으면 평가는 건너뜁니다. 같은 폴더의 `*.test.ts`는 표본 없이 도는 합성 데이터 테스트이며 기본 `test`가 실행합니다.

| 환경 변수 | 설명 |
| --- | --- |
| `DFRAGON_RAID_ROW_SAMPLES` | 표본 폴더. 안에 `manifest.json`이 있어야 합니다. 없으면 건너뜁니다. |
| `DFRAGON_RAID_ROW_REPORT` | 지정하면 행별 판독값과 요약을 이 경로에 JSON으로 저장합니다. |
| `DFRAGON_RAID_ROW_OCR_MODEL` | OCR 모델 경로. 기본은 `packages/models/ocr-finetuned/model.onnx`입니다. |
| `DFRAGON_RAID_ROW_OCR_DICTIONARY` | OCR 사전 경로. 기본은 `packages/models/ocr-finetuned/characters.txt`입니다. |

모델이나 사전 파일이 없으면 직업명 OCR만 `not_run`으로 남기고 나머지를 측정합니다. 파인튜닝 모델은 `git submodule update --init --recursive packages/models/ocr-finetuned`로 받습니다.

## manifest 형식

`manifest.json`의 경로는 manifest가 있는 폴더 기준 상대 경로이며 폴더 밖을 가리킬 수 없습니다. 이미지는 게임 client 영역 전체를 찍은 PNG 원본입니다.

```json
{
  "cases": [
    {
      "id": "raid-01",
      "image": "originals/raid-01.png",
      "columnKind": "equipment-score",
      "rows": [
        {
          "row": 1,
          "jobGrowName": "眞 소드마스터",
          "visibleJobText": "眞 소드마스",
          "jobClipped": true,
          "valueText": "2,212",
          "uniqueName": null,
          "candidates": []
        }
      ]
    }
  ]
}
```

- `columnKind`는 화면의 수치 열 제목입니다.
- `jobGrowName`은 잘리지 않은 전체 직업명, `visibleJobText`는 화면에 보이는 글자까지입니다. 긴 직업명은 돋보기 아이콘 앞에서 글자 중간이 잘립니다.
- `valueText`는 화면 표기 그대로 적습니다(`12,345`, `1000.4K`).
- `uniqueName`은 같은 이름의 후보가 1명뿐이면 `true`, 동명 후보가 있으면 `false`, 확인하지 않았으면 `null`입니다.
- `candidates`는 선택 항목입니다. 정답을 아는 상태에서 동명 후보의 `fame`, `jobName`, `jobGrowName`를 따로 모아 적고, 정답 후보 1명에 `correct: true`를 둡니다. 모든 행에 후보가 없으면 명성 차이는 `not_run`입니다.
- 그 밖의 필드는 읽지 않습니다. 정답 확인에 쓰는 캐릭터 이름 같은 메모를 같은 파일에 둘 수 있습니다.

## 지표

| 항목 | 정의 |
| --- | --- |
| `coverage` | 이미지, 행 수와 해상도, 열 종류, `K` 표기, 잘린 직업명, 동명 여부별 행 수 |
| `detection` | 열 종류별 창 검출 성공 수와 최소 `matchScore`. 명성 열 화면에서도 기존 기준 헤더로 창을 찾는지 봅니다. |
| `columnKind` | `classifyDNFRaidValueColumn`의 판별이 manifest와 같은 이미지 수 |
| `value` | `readDNFRaidParticipantMetadata`의 표기가 정답과 같은 행, 해상도별 결과와 실패 목록, 표기를 `parseDNFRaidValueNotation`으로 바꾼 범위가 같은 행 |
| `jobOcr` | 전처리별 직업명 OCR 일치. 아래 표를 봅니다. |
| `candidates` | 화면 직업명이 후보의 `jobGrowName`, `jobName` 중 무엇과 같은지, 명성 차이, 같은 직업 동명 후보 사이 명성 간격. 차이는 후보 값이 화면 표기 범위에서 벗어난 거리입니다. |

직업명 OCR은 renderer worker와 같은 WASM 엔진, 사전, CTC 디코딩을 씁니다. 전처리는 두 가지를 모두 측정합니다. `nickname`은 공대 닉네임과 같은 반전 이진화와 가운데 정렬이고, `raw`는 원본 색 그대로입니다. 모델 입력 높이로 줄이는 단계는 canvas 대신 쌍선형 보간으로 근사하므로 브라우저와 픽셀 단위로 같지는 않습니다.

| 열 | 정의 |
| --- | --- |
| `exactRaw` | OCR 문자열이 `visibleJobText`와 그대로 같은 행 |
| `exactWithoutSpaceAndMark` | 공백과 앞의 `眞`만 지운 뒤 같은 행 |
| `exactNormalized` | 제품 규칙의 정규화(`眞`을 지우고 한글 음절만 남김) 뒤 같은 행 |
| `ruleMatched` | 제품 규칙 `matchJobName`이 정답 `jobGrowName`과 맞다고 본 행 |
| `ruleFalseMatched` | 제품 규칙이 manifest에 있는 다른 직업명과도 맞다고 본 행 |

`matchJobName`은 정규화한 두 문자열이 같으면 `exact`, 읽은 문자열이 4자 이상이고 후보 이름이 그 문자열이나 마지막 한 글자를 뺀 문자열(5자 이상일 때)로 시작하면 `clipped-prefix`입니다. 칸은 `眞` 표식 자리에서 시작하므로, 읽은 문자열이 `眞`으로 시작하지 않으면 첫 글자를 표식 오인식으로 보고 뺀 문자열로도 비교합니다. 공대 후보 선택(`src/backend/search/raid-candidate.ts`)이 이 규칙을 씁니다.

## 측정 결과

표본은 Windows 실기에서 게임 client 영역 전체를 찍은 PNG 32장입니다. 1067×600(검출 배율 1.0) 17장과 1920×1080(검출 배율 1.8) 15장이며, 장마다 참가자가 1행에만 있어 모두 32행입니다.

| 해상도, 수치 열 | 행 | 창 검출 | 열 종류 | 수치 판독 | 직업명(`matchJobName`) |
| --- | --- | --- | --- | --- | --- |
| 1067×600, 명성 | 5 | 5 (최소 `matchScore` 0.872) | 5 | 5 | 5 |
| 1067×600, 장비 점수 | 12 | 12 | 12 | 12 | 12 |
| 1920×1080, 장비 점수 | 15 | 15 (`matchScore` 0.978) | 15 | 13 | 15 |
| 1920×1080, 명성 | 표본 없음 | | | | |

수치 기준 글자는 표본에서 자르지 않고 렌더링했으므로 수치 판독은 표본과 독립입니다. 열 제목 기준 이미지는 1067×600 표본에서 잘랐습니다. 게임은 1920×1080에서 UI 0% 글자를 부드럽게 확대해 그리므로 판독기가 확대된 칸을 원래 픽셀 중심에서 쌍선형으로 표본합니다. 남은 실패 2행은 밝은 초록 글자의 버퍼 행으로, 확대 때 번진 가장자리까지 대비 기준을 넘어 획이 두꺼워집니다.

직업명 OCR은 `nickname` 전처리에서 그대로 비교 0/32, 공백과 `眞` 정규화 뒤 29/32, `matchJobName` 32/32였고 다른 직업과 잘못 맞은 행은 없었습니다. `raw` 전처리는 `matchJobName`으로 7/32였습니다.

후보 대조에서 화면 직업명은 후보 `jobGrowName`과 24행이 같았고, 2행은 후보의 `jobGrowName`이 이전 전직명으로 남아 있어 달랐습니다. 명성 열 5행의 화면 명성과 후보 명성 차이는 0, 0, 0, 0, 428이었습니다. 직업까지 같은 동명 후보의 명성 간격은 56,957 이상이었습니다.

1920×1080 명성 열, `K` 표기, 2~12행과 여러 행 공대는 표본이 없습니다. 동명 후보가 있는 11행 중 6행은 직업까지 같은 후보가 여럿이라 정답을 정하지 못해 후보 대조에서 뺐습니다.

## 기준 이미지

`src/backend/lib/`의 다음 파일을 읽습니다. 캐릭터 이름이나 참가자 정보가 든 영역은 넣지 않았습니다.

- `raid-heading.png`: 창 검출 기준 헤더. 제품과 같은 파일입니다.
- `raid-value-heading-fame.png`, `raid-value-heading-equipment-score.png`: 수치 열 제목 칸(`75 × 18`). 1067×600, 검출 배율 1.0 원본에서 잘라 낸 UI 0% 게임 UI입니다.
- `raid-value-glyphs.png`: 수치 글자 `0`~`9`, 쉼표, 소수점, `K`를 이 순서로 여백 없이 이어 붙인 `81 × 17` sprite. 글자별 폭은 `raid-value-glyphs.ts`의 표에 있고 제품과 평가가 같은 함수로 자릅니다. 표본에서 자르지 않고 [dnf-ocr-synth](https://github.com/blahaj94/dnf-ocr-synth)로 만들었습니다.
  - 렌더링: 돋움(`gulim.ttc` 글꼴 번호 2), `profile="dotum"`, `scale=1`(UI 0%)로 그려 어두운 배경에 합칩니다. 숫자 윗줄을 높이 17 칸의 다섯째 줄(0부터 4)에 맞춥니다.
  - 자르기: 쉼표, 소수점, `K`는 기준선을 유지하려고 `0,`, `0.`, `0K`로 그린 뒤 둘째 글자를 씁니다. 국소 대비로 나눈 글자를 좌우 1px 여백과 함께 높이 17로 자릅니다.
  - 확인: `0`~`9`와 쉼표는 실제 화면에서 자른 글자와 획 모양이 같습니다. 소수점과 `K`는 실제 화면 표본이 없습니다.

파티 표식 기준은 저장소에 없고 이 평가는 파티를 읽지 않으므로, 입력 검증만 통과하는 합성 플레이스홀더를 넘기고 결과의 `party`는 쓰지 않습니다.

## 저장소에 넣지 않는 것

표본 PNG, `manifest.json`, 결과 JSON과 플레이어 식별자(캐릭터명, 서버, 캐릭터 id)는 저장소, CI, PR 본문에 넣지 않습니다. 결과를 공유할 때는 요약 수치만 적습니다.
