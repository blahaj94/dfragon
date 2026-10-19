# @dfragon/icons

제품 화면이 번들하는 던전앤파이터 게임 아이콘입니다. 지금은 Desktop 상세 창 스킬 탭의 스킬 아이콘만 담습니다. 코드와 build 명령은 없습니다.

```ts
import skillIcons from '@dfragon/icons/skills.json'
```

## 스킬 아이콘

- `skills.webp`는 28 × 28 스킬 아이콘 2184개를 한 줄에 48칸씩 놓은 1344 × 1288 무손실 WebP sprite(약 1.8MB)입니다. 내용이 같은 아이콘은 한 칸을 함께 씁니다.
- `skills.json`의 `sprite`는 파일 이름, 칸 크기(`iconSize`), 한 줄의 칸 수(`columns`)와 sprite 크기이고, `icons`는 `"<jobId>/<skillId>"`(네오플 API의 직업, 스킬 ID)를 0부터 시작하는 칸 번호에 잇습니다. 칸 `n`의 왼쪽 위는 `(n % columns × iconSize, ⌊n / columns⌋ × iconSize)`입니다. 같은 스킬 ID가 직업마다 다른 스킬일 수 있어 직업 ID를 함께 씁니다. `@dfragon/skill-layouts`의 모든 배치 칸에 아이콘이 있습니다.
- Desktop renderer는 sprite를 `?no-inline`으로 읽어 data URI 없이 파일 하나로 배포하고, 칸마다 배경 위치로 잘라 그립니다.

## 출처와 권리

[dnf-reverse-engineering](https://github.com/blahaj94/dnf-reverse-engineering)이 PVF 판본 `b2725b7c`의 스킬 `[icon]` 태그가 가리키는 그림을 한국 클라이언트 `ImagePacks2`의 NPK에서 꺼낸 아이콘 층(`continuation/outputs/handoff/phase31_live/data_layers/icons`)입니다. 이미지 권리는 NEOPLE/NEXON에 있으며 별도 오픈소스 라이선스를 부여하지 않습니다. 배포 고지는 `packages/licenses/notices/desktop/NOTICE.md`에 있습니다.

네오플 스킬과 PVF 스킬은 같은 직업, 전직에서 이름(`眞`, 띄어쓰기, `:` 등 구분 기호 제외)이 같은 스킬로 잇습니다. 같은 이름이 여럿이면 그 전직이 배울 수 있는 스킬만 남기고, 그래도 여럿이면 아이콘이 모두 같을 때만 씁니다.

`skills.json`과 `skills.webp`는 손으로 고치지 않고 `@dfragon/skill-layouts`와 함께 root의 `scripts/import-skill-data.mjs`로 다시 만듭니다. 명령과 입력은 [`@dfragon/skill-layouts` 안내](../skill-layouts/README.md#출처와-다시-만들기)에 있습니다. 생성은 모든 원본 PNG의 SHA-256을 아이콘 색인과 대조하고, 만든 sprite를 다시 풀어 모든 칸이 원본 픽셀과 같은지 확인한 뒤에 씁니다. 하나라도 다르면 아무것도 쓰지 않고 멈춥니다. 같은 입력이면 같은 바이트의 sprite가 나옵니다. WebP 인코딩은 root 개발 의존성 `sharp`를 씁니다.
