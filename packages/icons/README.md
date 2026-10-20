# @dfragon/icons

제품 화면이 번들하는 던전앤파이터 게임 아이콘입니다. Desktop 상세 창 스킬 탭의 스킬 아이콘과, 네오플 이미지 API가 주지 않는 서약 아이콘, 115 세트의 세트 아이콘을 담습니다. 코드와 build 명령은 없습니다.

```ts
import skillIcons from '@dfragon/icons/skills.json'
import equipmentIcons from '@dfragon/icons/equipment.json'
```

## 스킬 아이콘

- `skills.webp`는 28 × 28 스킬 아이콘 2184개를 한 줄에 48칸씩 놓은 1344 × 1288 무손실 WebP sprite(약 1.8MB)입니다. 내용이 같은 아이콘은 한 칸을 함께 씁니다.
- `skills.json`의 `sprite`는 파일 이름, 칸 크기(`iconSize`), 한 줄의 칸 수(`columns`)와 sprite 크기이고, `icons`는 `"<jobId>/<skillId>"`(네오플 API의 직업, 스킬 ID)를 0부터 시작하는 칸 번호에 잇습니다. 칸 `n`의 왼쪽 위는 `(n % columns × iconSize, ⌊n / columns⌋ × iconSize)`입니다. 같은 스킬 ID가 직업마다 다른 스킬일 수 있어 직업 ID를 함께 씁니다. `@dfragon/skill-layouts`의 모든 배치 칸에 아이콘이 있습니다.
- Desktop renderer는 sprite를 `?no-inline`으로 읽어 data URI 없이 파일 하나로 배포하고, 칸마다 배경 위치로 잘라 그립니다.

## 서약, 세트 아이콘

- `equipment.webp`는 서약 아이콘과 세트 아이콘 66칸을 한 줄에 16칸씩 놓은 448 × 140 무손실 WebP sprite(약 71KB)입니다. 칸은 28 × 28이고, 26 × 26인 레어 서약 아이콘은 투명한 칸 가운데에 원본 픽셀을 그대로 둡니다. 내용이 같은 아이콘은 한 칸을 함께 씁니다.
- `equipment.json`의 `sprite`는 `skills.json`과 같은 모양이고, `oaths`는 `"<희귀도>/<서약 이름>"`(네오플 응답의 희귀도 이름과 서약 이름, 예 `태초/강림한 여우 서약`), `sets`는 네오플 `setItemId`를 칸 번호에 잇습니다.
- 네오플 이미지 API(`img-api.neople.co.kr/df/items/<itemId>`)는 서약 본체 그림을 주지 않아(모든 희귀도 404, 2026-10-20 확인) 서약 아이콘을 번들합니다. 결정과 일반 장비 그림은 API에서 받습니다.
- 서약은 PVF 서약 아이템을 이름과 희귀도(`[rarity]` 2 레어, 3 유니크, 4 에픽, 6 레전더리, 8 태초)로 잇습니다. 4와 6은 네오플 응답 표본에서 이름이 한 희귀도에만 있는 서약의 희귀도로 확인했습니다. 버프 아이콘 표시에만 쓰는 장착 불가 서약 아이템(100430002~049, PVF 역할 `group_buff_icon`)은 뺍니다. 이 아이템은 서약 그룹 이름을 그대로 써서 `태초/근원에 닿은 자연 서약`이 장착 서약 100610059와 겹쳤습니다. 남은 서약 중 같은 이름과 희귀도가 여럿이고 아이콘이 다르면 정하지 못해 빼고 생성할 때 목록을 출력하며, 지금은 없습니다.
- 세트 아이콘은 서약 세트 정의가 115 세트 16201~16212에 둔 28px 그림입니다. 네오플 장착 장비 줄의 세트 이름은 희귀도와 관계없는 기본 이름(예 `소울 페어리 세트`)이라 PVF 세트 이름과 같고, 세트 정보의 이름은 희귀도마다 달라(예 `로열 페어리 세트`) 쓰지 않습니다. `setItemId`는 희귀도와 관계없이 같습니다.

## 출처와 권리

[dnf-reverse-engineering](https://github.com/blahaj94/dnf-reverse-engineering)이 PVF 판본 `b2725b7c`의 스킬 `[icon]` 태그가 가리키는 그림을 한국 클라이언트 `ImagePacks2`의 NPK에서 꺼낸 아이콘 층(`continuation/outputs/handoff/phase31_live/data_layers/icons`)입니다. 이미지 권리는 NEOPLE/NEXON에 있으며 별도 오픈소스 라이선스를 부여하지 않습니다. 배포 고지는 `packages/licenses/notices/desktop/NOTICE.md`에 있습니다.

네오플 스킬과 PVF 스킬은 같은 직업, 전직에서 이름(`眞`, 띄어쓰기, `:` 등 구분 기호 제외)이 같은 스킬로 잇습니다. 같은 이름이 여럿이면 그 전직이 배울 수 있는 스킬만 남기고, 그래도 여럿이면 아이콘이 모두 같을 때만 씁니다.

`equipment.json`과 `equipment.webp`도 손으로 고치지 않고 root의 `scripts/import-equipment-icons.mjs`로 다시 만듭니다. `--pvf`는 같은 `data_layers` 폴더(`icons`, `oaths/b2725b7c`, `equipment115/b2725b7c` 필요)이고, `--samples`는 세트 이름과 `setItemId`를 읽을 네오플 캐릭터 응답 표본 폴더(dnf-reverse-engineering의 `spec/vectors`)입니다. 아이콘이 있는 세트를 표본에서 찾지 못하면 아무것도 쓰지 않고 멈춥니다.

```bash
node scripts/import-equipment-icons.mjs --pvf <dnf-reverse-engineering>/continuation/outputs/handoff/phase31_live/data_layers --samples <dnf-reverse-engineering>/spec/vectors
```

`skills.json`과 `skills.webp`는 손으로 고치지 않고 `@dfragon/skill-layouts`와 함께 root의 `scripts/import-skill-data.mjs`로 다시 만듭니다. 명령과 입력은 [`@dfragon/skill-layouts` 안내](../skill-layouts/README.md#출처와-다시-만들기)에 있습니다. 생성은 모든 원본 PNG의 SHA-256을 아이콘 색인과 대조하고, 만든 sprite를 다시 풀어 모든 칸이 원본 픽셀과 같은지 확인한 뒤에 씁니다. 하나라도 다르면 아무것도 쓰지 않고 멈춥니다. 같은 입력이면 같은 바이트의 sprite가 나옵니다. WebP 인코딩은 root 개발 의존성 `sharp`를 씁니다.
