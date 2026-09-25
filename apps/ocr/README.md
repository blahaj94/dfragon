# OCR 자료실

원본 게임 화면, 닉네임 크롭 영역, 정답과 train/val/test 배정을 관리하는 개인용 Linux NestJS 서버·React SPA입니다. 기존 패스키로 인증한 지정 계정만 사용할 수 있습니다. 로그인 중 Desktop에서 수집한 원본과 크롭 좌표를 받을 수 있으며, 자동 업로드 큐, 학습 실행, 데이터셋 버전 관리와 자동 분할은 포함하지 않습니다.

```sh
pnpm --filter @dfragon/ocr test
pnpm --filter @dfragon/ocr test:ui
pnpm --filter @dfragon/ocr lint
pnpm --filter @dfragon/ocr build
pnpm --filter @dfragon/ocr start
```

Node 24를 사용합니다. 실행 환경·기존 인증 API 연결·영속 저장은 [배포 안내](../../deploy/ocr/README.md)를 따릅니다. 직접 실행 시 `OCR_DATA_DIR`에 절대 경로를 주고, `OCR_ORIGIN`, `OCR_AUTH_ORIGIN`, `OCR_OWNER_ID`를 지정합니다. 기본 listen은 `127.0.0.1:3100`입니다. HTTP 개발 우회 로그인은 제공하지 않습니다.

## 관리 화면

패스키 로그인 후 원본 PNG와 크롭 좌표를 수동 등록하거나 수집 클라이언트가 API로 올린 자료를 조회합니다. 미작성·완료·제외, HUD·파티원창, 분할 필터를 제공합니다. 선택한 크롭의 정답·제외 여부를 저장하고 원본을 열 수 있습니다. UI 크기는 %로 표시하고 미상과 추정값을 구분합니다.

[Penpot OCR 자료실 시안](https://design.penpot.app/#/workspace?team-id=d8ac01df-6646-81d2-8008-a69ecfb5e821&file-id=d8ac01df-6646-81d2-8008-a69f349be8fc&page-id=d8ac01df-6646-81d2-8008-a69f349be8fd&board-id=e2d75c67-3d48-8021-8008-b16f9bafcdf5)을 기준으로 구현합니다. 상단 `이미지 업로드`로 등록 폼을 펼치며 접어도 작성 중인 파일·좌표를 유지합니다. 테마 버튼으로 밝은 화면과 어두운 화면을 전환하고 브라우저에 선택을 저장합니다. 좁은 화면에서는 이미지 목록 아래에서 정답을 편집합니다.

분할은 NFC 정규화한 닉네임 정답에 저장합니다. 같은 닉네임의 모든 샘플은 같은 분할을 따르고 새 샘플도 정답이 저장되면 기존 배정을 따릅니다. 정답이 없으면 미배정입니다. 대소문자·공백은 임의로 제거하지 않습니다. 분할된 샘플의 정답 수정으로 분할이 달라지면 명시 확인이 필요합니다. 선별·비율 결정은 로컬 스크립트의 책임입니다.

### 구현 구조와 조회 캐시

서버는 기존 API와 같은 NestJS 12 버전의 controller·DI·exception filter를 사용합니다. 큰 본문을 읽기 전 인증과 업로드 동시 제한을 적용하며 경로별 크기 제한만 Express 어댑터의 JSON parser를 사용합니다. 쿠키 파싱은 `cookie-parser`, 발급·삭제는 응답 기본 API를 사용합니다. 로그인 요청 한도는 완료된 대기 요청과 인증 API 호출 중인 요청의 합계입니다. `__Host-ocr-login`은 로그인 시작 브라우저와 callback을 연결하는 임시 쿠키, `__Host-ocr-session`은 인증 후 서버 세션을 찾는 쿠키입니다. 두 쿠키의 값은 Node `crypto.randomBytes`로 생성한 난수이고 기존 API token을 담지 않습니다.

인증은 `OcrAuth`가 담당하고 JSON parser보다 먼저 등록한 middleware에서 호출합니다. [NestJS 요청 순서](https://docs.nestjs.com/faq/request-lifecycle)에 따라 Guard는 middleware 이후 실행되므로, 현재 body parser 구성에서 인증을 Guard로 옮기면 인증 전 큰 본문을 파싱하게 됩니다. Desktop 업로드의 정확한 method·URL 판정은 `isDesktopUpload`에서 정의하며 Origin 검사와 인증 방식 선택이 같은 판정을 사용합니다.

SPA는 TanStack Query로 세션·필터별 목록·통계를 조회합니다. 30초 동안 fresh 상태를 유지하고 사용하지 않는 캐시는 5분 후 제거합니다. 업로드·정답·분할 mutation 성공 시 모든 목록과 통계를 invalidate하고, 로그아웃·인증 만료 시 캐시를 비웁니다. Mutation 자동 재시도는 끄고 실패한 업로드만 사용자가 같은 ID로 재시도합니다. Query parameter 생성은 순수 utility, 필터·페이지 상태는 전용 hook이 담당합니다. 스타일·테마는 StyleX로 컴파일하며 전역 CSS에는 reset과 NanumSquare Neo font-face를 둡니다. 폰트는 같은 서버에서 제공하고 원문 라이선스를 browser 산출물 `THIRD-PARTY.txt`에 포함합니다.

## HTTP API

자료실의 `/api/*` 요청은 로그인 쿠키가 필요합니다. 쿠키는 HttpOnly·Secure·SameSite=Lax이며 변경 요청에는 정확한 `Origin: OCR_ORIGIN`이 필요하고 CORS는 열지 않습니다. 별도 `POST /api/desktop/captures`와 아래 Desktop 조회 GET 경로만 Origin 없는 Desktop Bearer 요청을 받으며 같은 지정 계정의 활성 세션인지 확인합니다. Desktop 토큰은 정답·분할 수정, 브라우저 로그인과 전체 다운로드 권한을 갖지 않습니다.

| Method / path | 동작 |
| --- | --- |
| `POST /auth/login` | 기존 API의 패스키 로그인 URL 반환, 로그인 요청 쿠키 발급 |
| `GET /auth/callback?code=…` | 요청 쿠키·PKCE로 일회용 code 교환, 허용 계정 확인 후 `/`로 복귀 |
| `POST /auth/logout` | OCR 세션 제거와 기존 인증 세션 종료 요청 |
| `GET /api/session` | 로그인 여부 확인 |
| `GET /api/stats` | 원본·샘플·미작성·제외 개수, 원본 저장 bytes |
| `POST /api/captures` | 아래 원본+좌표 JSON 저장. 최초 201, 같은 요청 재시도 200 |
| `POST /api/desktop/captures` | Desktop의 활성 owner Bearer로 같은 원본+좌표 JSON 저장 |
| `GET /api/captures/:id` | 캡처 메타데이터 |
| `GET /api/captures/:id/image` | 원본 PNG |
| `GET /api/samples` | 샘플 100개와 `nextOffset`. `offset`, `state=pending/labeled/excluded`, `kind=hud/participants`, `split`, 정확한 `text` 필터 |
| `GET /api/samples/:id/image` | 원본 픽셀에서 만든 크롭 PNG |
| `PATCH /api/samples/:id` | `{text: string 또는 null, excluded: boolean, confirmSplitChange?: boolean}` |
| `PUT /api/splits` | `{text: string, split: unassigned/train/val/test}`. 해당 닉네임 전체에 적용 |
| `GET /api/desktop/dataset` | 앱 평가용 정답·제외·분할 메타데이터 스냅샷 |
| `GET /api/desktop/samples/:id/image` | 앱 평가용 원본 크롭 PNG |
| `GET /api/export/manifest` | 현재 메타데이터·정답·분할 JSON |
| `GET /api/export` | 현재 전체 자료 TAR. 원본·크롭·manifest 포함 |
| `GET /health` | 데이터 없는 readiness 응답 |

업로드 예시의 ID·시각은 수집자가 생성합니다. 재시도 때는 ID와 본문을 그대로 보냅니다. 파일명·로컬 파일 경로는 서버 저장 경로로 사용하지 않습니다.

```json
{
  "id": "00000000-0000-4000-8000-000000000001",
  "capturedAt": "2026-09-25T00:00:00.000Z",
  "kind": "hud",
  "uiScale": 0.75,
  "uiScaleSource": "game",
  "originalPng": "BASE64_ENCODED_PNG",
  "crops": [
    {"slot": 1, "x": 100, "y": 100, "width": 90, "height": 14}
  ]
}
```

`uiScale`은 비율(0.75 = 75%), `uiScaleSource`는 `game` 또는 `estimated`입니다. 모르면 `null`과 `unknown`을 함께 보냅니다. 원본 너비·높이는 서버가 PNG에서 읽습니다. 크롭은 원본 기준 정수 좌표이며 슬롯 1~4의 실제 저장 대상만 보냅니다. 샘플 ID는 `{captureId}-{slot}`입니다. 원본이 있어도 선택되지 않은 영역의 detection 라벨까지 완성된 것은 아닙니다.

PNG는 최대 16 MiB, 축별 최대 8192, 총 16,777,216 pixels, non-interlaced 형식입니다. HTTP JSON body는 23 MiB, 동시에 받는 업로드는 2개입니다. 크롭은 1~4개이며 중복 슬롯·경계 밖 좌표·손상된 PNG는 거절합니다. 원본과 모든 좌표 저장이 끝난 경우만 성공합니다. 업로드 실패의 자동 재시도·앱 재시작 복구는 제공하지 않습니다.

주요 실패는 400 입력 오류, 401 로그인 필요, 403 다른 계정/Origin, 409 캡처 ID 충돌 또는 분할 변경 확인 필요, 413 크기 초과, 429 일시 제한, 502 인증 서버 연결 실패, 507 저장 상한입니다. 원문 오류·토큰·계정 ID는 오류 응답에 넣지 않습니다.

## 다운로드와 로컬 선별

`ocr-data.tar`는 다음을 포함합니다.

- `manifest.json`: schemaVersion, 다운로드 시작 시점의 캡처·샘플·정답·제외·분할 목록
- `originals/{captureId}.png`: 캡처마다 원본 한 장
- `crops/{sampleId}.png`: 원본 픽셀에서 생성한 크롭

제외·미작성 데이터도 포함하여 전체 자료를 내려받습니다. 로컬 학습 스크립트에서 `excluded=false`, `text!=null`, 필요한 `split`을 선택합니다. 같은 닉네임 배정을 보존해야 하며 로컬에서 파일을 임의 재분할한 결과까지 서버가 보장하지 않습니다. 서버는 영구 데이터셋 버전을 만들지 않고 다운로드 시작 때 메타데이터를 함께 읽습니다. 원본은 수정하지 않으므로 다운로드 도중 정답 변경이 그 TAR에 섞이지 않습니다.

이전 Desktop에 저장된 크롭만으로 원본 화면·좌표를 복원하지 않습니다. 기존 로컬 자료의 자동 이관은 후속 범위입니다. 새 Desktop 수집 연결은 아래를 따릅니다.

## Desktop 수집 연결

로그인한 Desktop의 main process가 기존 access token으로 `POST /api/desktop/captures`에 원본 PNG와 크롭 좌표를 보냅니다. 업로드 JSON은 `/api/captures`와 같습니다. 서버는 기존 인증 API `/me`로 활성 세션과 `OCR_OWNER_ID`를 확인하며 cookie만 있는 요청이나 Origin이 있는 브라우저 요청은 받지 않습니다. 관리 API와 자료실 로그인은 기존 owner cookie 경계를 유지합니다. 새 DB migration·환경 변수·별도 역할은 없습니다. 이 endpoint가 포함된 OCR 서버와 Desktop을 함께 배포해야 합니다.
