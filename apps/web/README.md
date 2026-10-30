# Web

던삐삐 소개와 내려받기 정적 사이트입니다. `dfragon.com`에 올리며, 첫 화면은 한 문장, 최신 포터블 exe를 받는 버튼, 각본대로 움직이는 던삐삐 창 목업과 푸터의 Neople Open API 로고뿐입니다. 분석, 쿠키, 로그인이 없습니다.

## 실행과 검증

저장소 루트에서 실행합니다.

```sh
pnpm --filter @dfragon/web dev
pnpm --filter @dfragon/web test
pnpm --filter @dfragon/web lint
pnpm --filter @dfragon/web build
pnpm --filter @dfragon/web preview
```

`build`는 `tsc -b`와 Vite production build를 포함하므로 같은 변경을 검증할 때 `typecheck`를 다시 실행할 필요는 없습니다. `pnpm verify`는 Web의 `test`, `build`를 실행합니다. 산출물은 `dist`에 생기며 GitHub Pages 배포는 별도 작업입니다.

## 구성

- `index.html`: 제목, 설명, OG 메타 태그. OG 이미지는 `https://dfragon.com/og.png`(1200×630)를 가리키며, 이미지는 `public/og.png`에 둡니다.
- `src/App.tsx`: 상단 바(아이콘, 이름, GitHub 링크), 첫 화면, 푸터입니다. 첫 화면 배경은 방문자의 현지 시각에 따라 Desktop 창 아이콘과 같은 밤, 새벽, 낮, 오후 바다 그림으로 바뀝니다.
- `src/download`: GitHub API `repos/dungeon-and-dragon/dfragon/releases/latest`에서 `DFragon-<버전>-x64-portable.exe`의 주소, 버전, 용량을 읽습니다. 요청이 실패하거나, 사용량 제한에 걸리거나, 포터블 exe가 없거나, 주소가 `https://github.com/` 밖이면 버튼은 Release 페이지(`releases/latest`)로 보내고 버전, 용량 없이 안내합니다. GitHub의 `releases/latest`는 Pre-release를 제외합니다.
- 창 목업: Desktop renderer가 사이트용으로 공개한 `apps/desktop/src/frontend/src/site/index.ts`를 `@dfragon/desktop-site` 별칭으로 가져옵니다. 실제 상단 바와 카드 컴포넌트를 쓰고, 캡처와 검색 IPC 대신 각본 상태로 카드를 채웁니다. Desktop의 다른 source는 직접 import하지 않습니다. 별칭은 `workspace-aliases.ts`와 `tsconfig.app.json`의 `paths`에 있습니다.

## 글꼴과 고지

제목은 마루미냐 한글을 12px의 정수 배로, 본문은 Noto Sans KR, 숫자는 Barlow Condensed로 씁니다. 세 글꼴과 사이트 자산은 사이트에 함께 배포하고 외부 CDN에서 받지 않습니다.

서드파티 고지는 화면에 링크하지 않고 빌드 산출물의 `notices`에 둡니다. 배포하면 `https://dfragon.com/notices/` 아래에서 볼 수 있습니다.

- `notices/THIRD-PARTY.txt`: 번들 입력 package의 license와 NOTICE(Noto Sans KR의 OFL 1.1 포함)
- `notices/desktop/`: Desktop과 같은 글꼴(마루미냐 한글, Barlow Condensed)과 Lucide 아이콘 고지
- `notices/site/NOTICE.md`: 캐릭터 초상화와 Neople Open API 로고의 출처, 권리([원본](NOTICE.md))

## 테스트 경계

`src/download`의 테스트는 2026-10-31 v0.1.0 응답 형태로 버튼 주소와 버전 줄, Release 페이지로 보내는 경우를 확인합니다. 창 목업의 각본은 Desktop의 `site/WindowMockup.test.tsx`가 확인합니다. jsdom은 실제 레이아웃을 재현하지 않으므로 390px 폭의 가로 넘침, 글자 대비, 키보드 조작은 production build를 브라우저에서 확인합니다.
