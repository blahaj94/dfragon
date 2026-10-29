# DFragon 아이콘

`dfragon.png`는 DFragon 공통 아이콘 원본입니다. 시간대별 창 아이콘 중 낮 그림과 같은 픽셀 아트 바다 풍경(1024×1024, 배경까지 채운 정사각형)이며, 앱과 설치 파일에 필요한 크기와 형식만 변환합니다(2026-10-30 사용자 요청).

의존성 설치 후 저장소 루트에서 다음 명령으로 파생 파일을 갱신합니다. 기존 Desktop의 electron-builder 아이콘 변환 도구를 사용하며 도구가 캐시에 없으면 처음 실행할 때 다운로드합니다.

```sh
node scripts/generate-brand-icons.mjs
```

- Desktop `build/icon.ico`, `build/icon.icns`, `build/icon.png`: OS 앱과 설치 파일 아이콘
- Desktop `resources/brand.png`: 화면 안의 브랜드 표시와 파비콘

실행 중인 Desktop 창과 Dock 아이콘은 이 원본에서 만들지 않습니다. `apps/desktop/resources/time-of-day/`의 시간대별 바다 그림(`night.png`, `dawn.png`, `day.png`, `afternoon.png`, 256×256)을 PC 시각에 맞춰 바꿔 씁니다. 시간대 기준은 [Desktop MVP 카드 UI의 표현과 이미지](../../docs/rules/desktop-mvp-ui.md#표현과-이미지)에 있습니다.
