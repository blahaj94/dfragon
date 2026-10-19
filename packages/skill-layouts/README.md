# @dfragon/skill-layouts

던전앤파이터 직업별 스킬트리의 고정 11열 배치입니다. Desktop 상세 창 스킬 탭이 캐릭터의 `jobId`, `jobGrowId`로 배치를 찾아, 익히지 않은 스킬까지 정해진 행과 열에 그립니다. 코드와 build 명령은 없고 `layouts.json` 하나를 제공합니다.

```ts
import skillLayouts from '@dfragon/skill-layouts/layouts.json'
```

## 형식

`jobs`는 직업(`jobId`)과 전직(`jobGrowId`)마다 하나이고 71개입니다. `jobGrowId`는 직업마다 다시 쓰이므로 두 값을 함께 키로 씁니다. `skills`의 각 칸은 다음 필드를 가집니다.

| 필드 | 뜻 |
| --- | --- |
| `skillId` | 네오플 API의 스킬 ID |
| `row`, `column` | 0부터 시작하는 행과 열. 열은 0부터 10까지 11개이고, 행 0이 공통 스킬 행이다 |
| `name`, `type`, `requiredLevel` | 배치를 만든 날의 네오플 API 스킬 이름, 종류(`active`, `passive`), 습득 레벨 |
| `awakening` | 게임 데이터(PVF)의 스킬 분류가 1, 2, 3차 각성기이면 true |

배치는 행, 열 순서로 정렬하고, 한 직업 안에서 같은 칸에 스킬이 둘이거나 11열 밖의 좌표가 있으면 생성을 멈춥니다. 행 머리 레벨, 미습득 표시, 설명 상자 같은 화면 규칙은 Desktop(`apps/desktop/src/frontend/src/lib/skill-tree.ts`)이 정합니다.

## 출처와 다시 만들기

- 행, 열: [dcalc](https://git.dnftools.com/dnftools/dcalc) commit `9e325bcab0ba83457c399921a3ac005713f5bdc4`의 `cellPos` 좌표를 네오플 Open API(2026-10-03 조회)의 직업, 스킬 목록과 대조한 수집본 `skill-coordinates.json`(schemaVersion 3)입니다. 이 저장소는 dcalc의 라이선스를 확인하지 않았고, 좌표 값만 옮겼습니다.
- 각성기 여부: [dnf-reverse-engineering](https://github.com/blahaj94/dnf-reverse-engineering)의 PVF 판본 `b2725b7c` 스킬 데이터 층(`continuation/outputs/handoff/phase31_live/data_layers/skills`)에서 같은 직업, 전직, 이름의 스킬 분류입니다.
- 네오플 API에 없는 좌표(`apiStatus`가 `listed`가 아닌 칸)는 캐릭터 응답과 이을 수 없어 넣지 않았습니다. 수집본에 좌표가 없는 네오플 스킬(주로 95, 100레벨 패시브)은 배치에 없어 스킬 탭에 보이지 않습니다.

이 파일은 손으로 고치지 않고 root의 `scripts/import-skill-data.mjs`로 `@dfragon/icons`의 스킬 아이콘과 함께 다시 만듭니다.

```bash
node scripts/import-skill-data.mjs --coordinates <skill-coordinates.json> --pvf <dnf-reverse-engineering>/continuation/outputs/handoff/phase31_live/data_layers
```

`--pvf` 폴더에는 `skills/b2725b7c`와 `icons`(`index/skill_icon.json`, `png/skill`, `ICON_INDEX.json`)가 있어야 합니다. 네오플 스킬과 PVF 스킬을 하나로 잇지 못하면 생성이 실패합니다. 다시 만든 뒤 `pnpm format:check`와 Desktop 테스트로 결과를 확인합니다.
