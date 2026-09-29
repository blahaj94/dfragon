# OCR 자료실

원본 게임 화면, 닉네임 크롭 영역, 정답과 train/val/test 배정을 관리하는 개인용 Linux NestJS 서버·React SPA입니다. 기존 패스키로 인증한 지정 계정만 사용할 수 있습니다. 로그인 중 Desktop에서 수집한 원본과 크롭 좌표를 받을 수 있으며, 자동 업로드 큐, 학습 실행, 데이터셋 버전 관리는 포함하지 않습니다. 최초 자동 분할은 미리보기 후 사용자가 명시 적용합니다.

```sh
pnpm --filter @dfragon/ocr test
pnpm --filter @dfragon/ocr test:ui
pnpm --filter @dfragon/ocr lint
pnpm --filter @dfragon/ocr build
pnpm --filter @dfragon/ocr start
```

Node 24를 사용합니다. 실행 환경·기존 인증 API 연결·영속 저장은 [배포 안내](../../deploy/ocr/README.md)를 따릅니다. 직접 실행 시 `OCR_DATA_DIR`에 절대 경로를 주고, `OCR_ORIGIN`, `OCR_AUTH_ORIGIN`, `OCR_OWNER_ID`를 지정합니다. 기본 listen은 `127.0.0.1:3100`입니다. HTTP 개발 우회 로그인은 제공하지 않습니다.

## 이미지 실행 계약

[제품 CI 이미지](../../README.md#서버-이미지)는 `deploy/ocr/Dockerfile`로 만듭니다.
기본 CMD는 `node dist/src/main.js`, 실행 사용자는 `node`(UID/GID `1000:1000`)이며,
이미지 기본값은 `OCR_HOST=0.0.0.0`, `PORT=3100`, `OCR_DATA_DIR=/data`입니다.

- `OCR_ORIGIN`, `OCR_AUTH_ORIGIN`에는 정확한 HTTPS origin, `OCR_OWNER_ID`에는 기존 지정 계정의
  UUID가 필요합니다. 인증 서버의 `passkey.ocrReturnUrl`도 OCR callback과 일치해야 합니다.
- `/data`에는 실행 사용자가 쓸 수 있는 영속 저장소를 mount합니다. `OCR_DATA_DIR`을 바꿀 때는
  절대 경로를 사용합니다. `ocr.sqlite`에 원본·메타데이터·모델 파일을 저장하며 기존 SQLite 구성을 유지합니다.
- `OCR_MAX_BYTES` 기본은 1 GiB, 최소는 16 MiB입니다. 저장 상한에 도달해도 기존 자료를 자동 삭제하지 않습니다.
- `GET /health`의 200·`{"ok":true}`는 HTTP 시작 확인이며 인증 서버 연결이나 DB 상태를 매번 검사하지 않습니다.
- 별도 migration/cleanup CLI는 없습니다. 시작 시 기존 `OcrStore`가 `CREATE TABLE IF NOT EXISTS`로
  테이블을 준비합니다. 기존 자료의 변환·복구·보관은 운영 담당자가 선택하며 앱 시작이 이를 대신하지 않습니다.

이미지 빌드에는 운영 설정·인증정보·실데이터를 전달하지 않습니다.

## 관리 화면

패스키 로그인 후 원본 PNG와 크롭 좌표를 수동 등록하거나 수집 클라이언트가 API로 올린 자료를 조회합니다. 미작성·완료·제외, HUD·파티원창·공대원창, 분할 필터를 제공합니다. 선택한 크롭의 정답·제외 여부를 저장하고 원본을 열 수 있습니다. UI 크기는 %로 표시하고 미상과 추정값을 구분합니다.

[Penpot OCR 자료실 시안](https://design.penpot.app/#/workspace?team-id=d8ac01df-6646-81d2-8008-a69ecfb5e821&file-id=d8ac01df-6646-81d2-8008-a69f349be8fc&page-id=d8ac01df-6646-81d2-8008-a69f349be8fd&board-id=e2d75c67-3d48-8021-8008-b16f9bafcdf5)을 기준으로 구현합니다. 상단 `이미지 업로드`로 등록 폼을 펼치며 접어도 작성 중인 파일·좌표를 유지합니다. 수집 종류를 바꾸면 종류별 크롭 좌표 초안을 보존하고, HUD·파티원창은 위치 1~4, 공대원창은 위치 1~12 중 실제 저장 대상을 선택할 수 있습니다. 테마 버튼으로 밝은 화면과 어두운 화면을 전환하고 브라우저에 선택을 저장합니다. 좁은 화면에서는 이미지 목록 아래에서 정답을 편집합니다.

닉네임 단위 분할은 `미배정 / train / val / test` 버튼으로 선택하며 현재 값은 강조색으로 표시합니다. 다른 값을 누르면 기존 확인 창을 거쳐 적용하고 현재 값을 다시 누르면 요청하지 않습니다. 정답 미작성·수정 중·저장 중에는 분할 버튼을 비활성화합니다.

분할은 NFC 정규화한 닉네임 정답에 저장합니다. 같은 닉네임의 모든 샘플은 같은 분할을 따르고 새 샘플도 정답이 저장되면 기존 배정을 따릅니다. 정답이 없으면 미배정입니다. 대소문자·공백은 임의로 제거하지 않습니다. 분할된 샘플의 정답 수정으로 분할이 달라지면 명시 확인이 필요합니다. 자동 분할의 비율은 사용자가 직접 정합니다.

### 자동 분할

**자동 분할 · 실제 자료 분포**를 펼치면 정답 완료·미제외 이미지와 고유 닉네임 수, 문자군·개별 문자 빈도를 확인할 수 있습니다. 이미지 기준 목표 비율을 합계 100%로 입력해 미리보기합니다. 기본 비율은 지정하지 않습니다. 기본은 기존 배정 유지이며, 최초 전체 분할 등 기존 배정도 바꿔야 할 때만 재배정 항목을 선택합니다.

미리보기는 규모·문자 분포와 목표 차이, 기존 분할에서 이동할 닉네임 수를 표시합니다. **미리보기 분할 적용**의 확인 창을 승인할 때만 저장합니다. 닉네임 묶음과 희귀 문자 때문에 비율을 정확히 맞추지 못할 수 있습니다. 그 사이 자료가 바뀌면 409로 거절하므로 다시 미리보기합니다. 빈 분할은 경고하며 Windows 학습에는 세 분할이 모두 필요합니다.

수동으로 **미배정**을 선택한 닉네임은 재배정 옵션을 켜도 자동 분할에서 보존하며 유지 개수를 표시합니다. 다시 배정하려면 해당 닉네임의 train/val/test 버튼을 사용합니다.

첫 적용 이후 새 미제외 닉네임은 정답 저장 시 train으로 들어갑니다. 기존 닉네임의 새 캡처는 기존 배정을 따릅니다. 주간 자료를 학습에 반영하려면 Windows 앱에서 새 실험으로 다시 가져오세요. 서버의 val/test에 이미지가 추가되어도 과거 로컬 실험 입력은 바뀌지 않습니다.

알고리즘은 닉네임 그룹의 이미지 수·문자군·개별 문자 빈도를 사용한 결정적 greedy 배정과 제한된 개선을 수행합니다. 흔한 문자와 이미지 규모를 우선하고 희귀 문자에는 약한 목적함수를 적용합니다. 최적해나 희귀 문자의 모든 분할 출현을 보장하지 않습니다.

### 구현 구조와 조회 캐시

자동 분할 화면과 적용 확인 창은 `SplitPlanner.tsx`, 요청·미리보기 수명과 캐시 무효화는 기존 `browser/hooks` 아래 `use-split-planner.ts`, 전용 StyleX는 `SplitPlanner.style.ts`가 소유합니다. 확인을 취소하면 요청하지 않으며 승인한 미리보기만 hook에 전달합니다. 분할·문자군 식별자는 `src/model.ts`에서 공유하고 표시 문구는 `browser/constants.ts`의 기존 상수 패턴을 따릅니다. `split-plan.ts`의 계산과 `store.ts`의 transaction 경계는 구분합니다.

서버는 기존 API와 같은 NestJS 12 버전의 controller·DI·exception filter를 사용합니다. 큰 본문을 읽기 전 인증과 업로드 동시 제한을 적용하며 경로별 크기 제한만 Express 어댑터의 JSON parser를 사용합니다. 쿠키 파싱은 `cookie-parser`, 발급·삭제는 응답 기본 API를 사용합니다. 로그인 요청 한도는 완료된 대기 요청과 인증 API 호출 중인 요청의 합계입니다. `__Host-ocr-login`은 로그인 시작 브라우저와 callback을 연결하는 임시 쿠키, `__Host-ocr-session`은 인증 후 서버 세션을 찾는 쿠키입니다. 두 쿠키의 값은 Node `crypto.randomBytes`로 생성한 난수이고 기존 API token을 담지 않습니다.

인증은 `OcrAuth`가 담당하고 JSON parser보다 먼저 등록한 middleware에서 호출합니다. [NestJS 요청 순서](https://docs.nestjs.com/faq/request-lifecycle)에 따라 Guard는 middleware 이후 실행되므로, 현재 body parser 구성에서 인증을 Guard로 옮기면 인증 전 큰 본문을 파싱하게 됩니다. Desktop 업로드의 정확한 method·URL 판정은 `isDesktopUpload`에서 정의하며 Origin 검사와 인증 방식 선택이 같은 판정을 사용합니다.

SPA는 TanStack Query로 세션·필터별 목록·통계를 조회합니다. 30초 동안 fresh 상태를 유지하고 사용하지 않는 캐시는 5분 후 제거합니다. 업로드·정답·분할 mutation 성공 시 모든 목록과 통계를 invalidate하고, 로그아웃·인증 만료 시 캐시를 비웁니다. Mutation 자동 재시도는 끄고 실패한 업로드만 사용자가 같은 ID로 재시도합니다. Query parameter 생성은 순수 utility, 필터·페이지 상태는 전용 hook이 담당합니다. 스타일·테마는 StyleX로 컴파일하며 전역 CSS에는 reset과 NanumSquare Neo font-face를 둡니다. 폰트는 같은 서버에서 제공하고 원문 라이선스를 browser 산출물 `THIRD-PARTY.txt`에 포함합니다.

## HTTP API

### 학습 모델 보관

웹의 **학습 모델**에서 공식 `korean_PP-OCRv5_mobile_rec` 기본 가중치와 문자 사전을 미니PC에 등록하고, 등록된 모델의 이름·종류·등록 시각·크기·파일을 확인합니다. 기본 모델 다운로드는 약 106 MiB이며 같은 모델은 한 번만 저장합니다. 서버에서 학습을 실행하지 않습니다.

별도 [Windows 평가 앱](https://github.com/blahaj94/dfragon-ocr-eval-tool)이 웹 로그인 후 모델과 train/val/test 데이터를 REST로 내려받아 로컬 입력을 고정하고 GPU로 학습·평가합니다. 앱 구현과 검증은 [앱 PR #1](https://github.com/blahaj94/dfragon-ocr-eval-tool/pull/1)에서 확인할 수 있습니다. 앱은 main process의 웹 로그인 세션으로 브라우저 경로를 호출합니다. 사용자가 **미니PC에 올리기**를 누르면 학습된 가중치·사전·평가 요약을 새로운 모델로 등록합니다. 자동 결과 업로드는 없습니다. 일반 파인튜닝은 시작 모델 사전의 SHA-256을 유지합니다. 문자 확장 모델은 기존 문자 순서를 보존하고 명시 선택한 문자만 뒤에 추가하며, 새 모델 ID로 보관합니다.

| Method / path | 동작 |
| --- | --- |
| `GET /api/models` | `{schemaVersion: 1, models: [...]}` 목록 |
| `GET /api/models/:id` | ID·이름·preset·kind·parentId·등록 시각·파일별 bytes/SHA-256 |
| `GET /api/models/:id/files/:name` | 보관된 파일 bytes |
| `POST /api/models` | `metadata` JSON 필드와 `files` multipart 파일로 새 모델 등록 |
| `POST /api/models/base/korean-v5` | 공식 기본 한국어 모델을 고정 ID로 등록 |

목록·상세·파일·multipart 등록은 `/api/desktop/models`에도 동일한 계약으로 제공하며 Origin 없는 활성 owner Bearer가 필요합니다. 브라우저 경로는 owner cookie를 사용하고 POST는 정확한 OCR Origin이 필요합니다. 토큰으로 정답·분할 변경이나 브라우저 세션 발급은 할 수 없습니다.

`metadata`는 `{id: UUID, name: 1~100자, preset: "korean-ppocrv5", kind: "pretrained" | "finetuned" | "expanded", parentId: UUID | null}`입니다. pretrained는 parent가 없고 finetuned·expanded는 존재하는 시작 모델 ID가 필요합니다. 파일 이름은 `weights.pdparams`, `characters.txt`, 선택적인 `evaluation.json`만 받습니다. 합계 128 MiB, 사전·평가 파일 각각 1 MiB 이하입니다. 사전은 중복 없는 한 줄 한 문자이며 공백은 모델에서 추가합니다. finetuned의 사전 해시는 시작 모델과 같아야 합니다. expanded는 부모 사전의 모든 문자가 같은 순서로 앞부분에 남고 새 문자가 뒤에 추가된 경우만 허용합니다. 서버는 가중치를 실행하지 않습니다.

파일과 메타데이터는 한 SQLite transaction으로 저장합니다. 같은 ID·같은 bytes/메타데이터 재요청은 기존 결과를 반환하고 다르면 409입니다. 원본 PNG와 모델 파일에 하나의 저장 용량 한도를 적용하며 기존 자료를 자동 삭제하지 않습니다. 응답은 `{model, duplicate}`이고 POST 성공은 201입니다. 모델 업로드와 기본 모델 가져오기는 인증 후 제한하며, 실제 기본 모델 다운로드 작업은 연결 취소 후 재요청에서도 한 개를 유지합니다. [프록시 크기 제한과 배포 순서](../../deploy/ocr/README.md#모델-보관-기능-배포)를 함께 적용해야 합니다.

### 데이터와 로그인

자료실의 `/api/*` 요청은 로그인 쿠키가 필요합니다. 쿠키는 HttpOnly·Secure·SameSite=Lax이며 변경 요청에는 정확한 `Origin: OCR_ORIGIN`이 필요하고 CORS는 열지 않습니다. 별도 `POST /api/desktop/captures`, Desktop 조회 GET 경로와 위 모델 API는 Origin 없는 Desktop Bearer 요청을 받으며 같은 지정 계정의 활성 세션인지 확인합니다. Desktop 토큰은 정답·분할 수정, 브라우저 로그인과 전체 다운로드 권한을 갖지 않습니다.

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
| `GET /api/samples` | 샘플 100개와 `nextOffset`. `offset`, `state=pending/labeled/excluded`, `kind=hud/participants/raid`, `split`, 정확한 `text` 필터 |
| `GET /api/samples/:id/image` | 원본 픽셀에서 만든 크롭 PNG |
| `PATCH /api/samples/:id` | `{text: string 또는 null, excluded: boolean, confirmSplitChange?: boolean}` |
| `PUT /api/splits` | `{text: string, split: unassigned/train/val/test}`. 해당 닉네임 전체에 적용 |
| `GET /api/splits/statistics` | 대상 규모·문자 빈도·현재 분할 및 자동 추가 활성화 여부 |
| `POST /api/splits/preview` | `{ratios: {train, val, test}, replaceExisting: boolean}`. 각 값은 %, 합계 100. 읽기 전용 미리보기·fingerprint |
| `POST /api/splits/apply` | 같은 설정과 미리보기 `fingerprint`. 재검사 후 일괄 배정·추가 규칙 활성화, 변경 시 409 |
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

`uiScale`은 비율(0.75 = 75%), `uiScaleSource`는 `game` 또는 `estimated`입니다. 모르면 `null`과 `unknown`을 함께 보냅니다. 원본 너비·높이는 서버가 PNG에서 읽습니다. 크롭은 원본 기준 정수 좌표이며 `hud`·`participants`는 슬롯 1~4, `raid`는 슬롯 1~12 중 실제 저장 대상만 보냅니다. 샘플 ID는 `{captureId}-{slot}`입니다. 원본이 있어도 선택되지 않은 영역의 detection 라벨까지 완성된 것은 아닙니다.

PNG는 최대 16 MiB, 축별 최대 8192, 총 16,777,216 pixels, non-interlaced 형식입니다. HTTP JSON body는 23 MiB, 동시에 받는 업로드는 2개입니다. `hud`·`participants` 크롭은 1~4개, `raid`는 1~12개이며 중복 슬롯·경계 밖 좌표·손상된 PNG는 거절합니다. 원본과 모든 좌표 저장이 끝난 경우만 성공합니다. 업로드 실패의 자동 재시도·앱 재시작 복구는 제공하지 않습니다.

주요 실패는 400 입력 오류, 401 로그인 필요, 403 다른 계정/Origin, 409 캡처 ID 충돌 또는 분할 변경 확인 필요, 413 크기 초과, 429 일시 제한, 502 인증 서버 연결 실패, 507 저장 상한입니다. 원문 오류·토큰·계정 ID는 오류 응답에 넣지 않습니다.

## 다운로드와 로컬 선별

`ocr-data.tar`는 다음을 포함합니다.

- `manifest.json`: schemaVersion, 다운로드 시작 시점의 캡처·샘플·정답·제외·분할 목록
- `originals/{captureId}.png`: 캡처마다 원본 한 장
- `crops/{sampleId}.png`: 원본 픽셀에서 생성한 크롭

제외·미작성 데이터도 포함하여 전체 자료를 내려받습니다. 로컬 학습 스크립트에서 `excluded=false`, `text!=null`, 필요한 `split`을 선택합니다. 같은 닉네임 배정을 보존해야 하며 로컬에서 파일을 임의 재분할한 결과까지 서버가 보장하지 않습니다. 서버는 영구 데이터셋 버전을 만들지 않고 다운로드 시작 때 메타데이터를 함께 읽습니다. 원본은 수정하지 않으므로 다운로드 도중 정답 변경이 그 TAR에 섞이지 않습니다.

이전 Desktop에 저장된 크롭만으로 원본 화면·좌표를 복원하지 않습니다. 기존 로컬 자료의 자동 이관은 후속 범위입니다. 새 Desktop 수집 연결은 아래를 따릅니다.

## Desktop 수집 연결

로그인한 Desktop의 main process가 기존 access token으로 `POST /api/desktop/captures`에 원본 PNG와 크롭 좌표를 보냅니다. 업로드 JSON은 `/api/captures`와 같습니다. 서버는 기존 인증 API `/me`로 활성 세션과 `OCR_OWNER_ID`를 확인하며 cookie만 있는 요청이나 Origin이 있는 브라우저 요청은 받지 않습니다. 관리 API와 자료실 로그인은 기존 owner cookie 경계를 유지합니다. 새 DB migration·환경 변수·별도 역할은 없습니다. `raid`를 받는 OCR 서버를 먼저 배포한 뒤 공대원창 수집이 포함된 Desktop을 배포합니다. 공대원창은 닉네임 크롭을 같은 정답·제외·분할·평가 흐름으로 제공합니다. 공대원 행 번호는 해당 캡처의 화면 위치이므로, 공대원이 나가 목록이 위로 당겨지면 같은 번호가 다른 사람을 가리킬 수 있습니다.
