# DFRAGON 아이콘

`dfragon.png`는 사용자가 제공한 DFRAGON 공통 아이콘 원본입니다. 투명 배경과 원본 구도를 유지하고, 앱·설치 파일·웹·인증 화면에 필요한 크기와 형식만 변환합니다.

의존성 설치 후 저장소 루트에서 다음 명령으로 파생 파일을 갱신합니다. 기존 Desktop의 electron-builder 아이콘 변환 도구를 사용하며 도구가 캐시에 없으면 처음 실행할 때 다운로드합니다.

```sh
node scripts/generate-brand-icons.mjs
```

- Desktop `build/icon.ico`, `build/icon.icns`, `build/icon.png`: OS 앱과 설치 파일 아이콘
- Desktop `resources/icon.png`: 실행 중인 창·Dock 아이콘
- Desktop `resources/brand.png`: 화면 안의 브랜드 표시와 파비콘
- Web `public/favicon.png`: 브라우저 파비콘
- API `browser/icon.png`: 패스키 인증 화면의 브랜드 표시와 파비콘
