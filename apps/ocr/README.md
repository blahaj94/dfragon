# OCR 자료실

원본 게임 화면, 닉네임 크롭 영역, 정답과 train/val/test 배정을 관리하는 개인용 Linux NestJS 서버, React SPA입니다. 관리는 기존 패스키로 인증한 지정 계정만 사용할 수 있으며 합성 자료 등록은 별도 전용 토큰을 사용합니다. 로그인한 Desktop의 수집과 명시적으로 켠 테스트 버전의 비로그인 수집을 받습니다. 서버의 자동 재전송, 학습 실행, 데이터셋 버전 관리는 포함하지 않습니다. 최초 자동 분할은 미리보기 후 사용자가 명시 적용합니다.

```sh
pnpm --filter @dfragon/ocr test
pnpm --filter @dfragon/ocr test:browser
pnpm --filter @dfragon/ocr test:ui
pnpm --filter @dfragon/ocr lint
pnpm --filter @dfragon/ocr build
pnpm --filter @dfragon/ocr start
```

Node 24를 사용합니다. 실행 환경, 기존 인증 API 연결, 영속 저장은 [제품 이미지, 인프라 책임 안내](../../docs/reference/api-start-development.md#서버-이미지)를 따릅니다. 직접 실행 시 `OCR_DATA_DIR`에 절대 경로를 주고, `OCR_ORIGIN`, `OCR_AUTH_ORIGIN`, `OCR_OWNER_ID`를 지정합니다. 기본 listen은 `127.0.0.1:3100`입니다. HTTP 개발 우회 로그인은 제공하지 않습니다.

기본 로그인 제한은 직접 연결한 IP를 사용하며 IPv6는 /64 대역을 공유합니다. 같은 60초 창에서 클라이언트별 10회, 전체 60회 시작, 대기와 인증 API 호출 중 요청은 클라이언트별 3개, 전체 100개까지 허용합니다. 실패와 교체도 시작 횟수를 소비합니다. reverse proxy를 사용할 때만 선택적으로 `OCR_TRUST_PROXY=single-hop`을 지정합니다. 프록시는 외부의 `X-Forwarded-For`를 직접 연결한 주소로 덮어쓰고 OCR 서버는 프록시 외부의 직접 접근을 차단해야 합니다. 다른 값은 시작 오류입니다.

### 테스트의 검증 범위

- `test`는 실제 HTTP 서버와 메모리, 임시 파일 SQLite를 사용합니다. 중간 쓰기 실패의 rollback, 부분 정답 갱신, 오래된 분할 거부, 다운로드 시점의 일관성, 모델 식별자, 해시와 입력, 인증 경계를 검사합니다. 인증 서버 응답은 격리된 fixture로 제공합니다.
- `test:browser`는 jsdom에서 실제 React hook, component와 조회 캐시를 실행해 초안, 선택 유지, 늦은 응답, 겹친 명령과 요청 본문 보존을 검사합니다. 네트워크 응답은 제어하지만 검사할 상태 판단 자체를 대체하지 않습니다.
- `test:ui`는 임시 자체 서명 HTTPS 서버, SQLite, Chromium을 연결합니다. 서버 저장 뒤 응답 실패를 합성한 재시도, 자료 변경으로 만료된 미리보기의 거부, 복구, 정답 입력, 분할, 다운로드와 화면 흐름을 검사합니다.

모두 합성 자료와 임시 자원을 사용하며 실제 사용자 저장소를 열지 않습니다. 합성 로그인, 자체 서명 인증서 검증은 실제 패스키, 운영 HTTPS, 프록시 설정이나 Windows 학습 성공을 보장하지 않습니다.

## 이미지 실행 계약

입력, 포트, readiness, 저장 조건은 [제품 이미지 실행 계약](../../docs/reference/api-start-development.md#ocr)을 따릅니다.

## 관리 화면

패스키 로그인 후 원본 PNG와 크롭 좌표를 수동 등록하거나 수집 클라이언트가 API로 올린 자료를 조회합니다. 미작성, 완료, 제외, HUD, 파티원창, 공대원창, 분할 필터를 제공합니다. 선택한 크롭의 정답, 제외 여부를 저장하고 원본을 열 수 있습니다. UI 크기는 %로 표시하고 미상과 추정값을 구분합니다.

같은 표본의 서버 정답, 분할, 제외 상태가 갱신되어도 작성 중인 초안은 유지합니다. 저장 요청 이후 추가로 입력한 내용도 지우지 않습니다. 수정하지 않은 입력은 최신 서버 정답을 따르며, 다른 표본으로 이동하면 해당 표본의 정답으로 시작합니다. `test:browser`는 jsdom에서 React 상태, 요청 경합을 검증하며, 실제 Chromium 화면, HTTPS 연결을 확인하는 `test:ui`를 대신하지 않습니다.

정답 저장에 분할 변경 확인이 필요하면 현재 편집 중인 표본에서만 확인 창을 표시합니다. 응답을 기다리는 동안 다른 표본으로 이동하면 이전 표본의 확인 창과 확인 후 재전송은 취소합니다. 이미 서버에서 완료된 저장을 되돌리는 동작은 아닙니다.

**정답 저장**은 정답만, **학습에서 제외 / 제외 복원**은 제외 여부만 변경합니다. 제외 버튼으로 작성 중인 정답 초안을 함께 저장하지 않습니다. 서로 다른 필드의 덮어쓰기를 방지하는 범위이며, 두 창에서 같은 필드를 동시에 바꿀 때의 버전 충돌 감지는 제공하지 않습니다.

[Penpot OCR 자료실 시안](https://design.penpot.app/#/workspace?team-id=d8ac01df-6646-81d2-8008-a69ecfb5e821&file-id=d8ac01df-6646-81d2-8008-a69f349be8fc&page-id=61bb727b-6711-8058-8008-bdeef5019fb0&board-id=f47e4ca8-7ec0-8075-8008-c287a2842a9f)을 기준으로 구현합니다. 상단 `이미지 업로드`로 등록 폼을 펼치며 접어도 작성 중인 파일, 좌표를 유지합니다. 수집 종류를 바꾸면 종류별 크롭 좌표 초안을 보존하고, HUD, 파티원창은 위치 1~4, 공대원창은 위치 1~12 중 실제 저장 대상을 선택할 수 있습니다. 테마 버튼으로 밝은 화면과 어두운 화면을 전환하고 브라우저에 선택을 저장합니다. 좁은 화면에서는 이미지 목록 아래에서 정답을 편집합니다.

색은 디자인 인계 저장소의 [색 체계](https://github.com/blahaj94/dfragon-design/blob/main/design/colors.md)를 따르며 강조색은 파랑입니다. `browser/theme.stylex.ts`가 `bgCanvas`, `bgBrandSolid`, `fgBrand`처럼 의미 토큰 이름으로 변수를 정의하고 값은 SEED 팔레트 변수를 참조합니다. 팔레트 값은 `html`의 `data-seed-color-mode`를 따르므로 다크 테마는 단계가 다른 토큰만 덮어쓰고, 테마 전환은 이 속성과 다크 테마를 같은 화면 갱신에서 바꿉니다. 캡션과 입력 라벨은 `fgSubtle`, 설명 글자는 `fgMuted`로 구분하고, 업로드와 정답 편집의 결과 안내는 성공이면 `fgBrand`, 실패면 `fgDanger`로 표시합니다. 크롭 미리보기 배경은 `bgInset`이라 밝은 화면에서는 밝은 면 위에 크롭 경계가 그대로 보입니다. 버튼은 SEED ActionButton medium(높이 40)을 쓰고 버튼 범위에서 주 버튼은 `bgBrandSolid`, 보조 버튼은 `bgControl`, 글자는 16px 굵게 맞춥니다. 입력과 선택 상자의 높이는 40이고, 입력은 `bgInset`, 선택 상자는 `bgControl` 배경입니다. 선택 상자와 파일 입력은 브라우저 기본 요소를 유지하므로 선택 상자의 화살표는 브라우저 모양을 따릅니다. 닉네임 단위 분할은 SEED `controlChip` recipe의 small 칩(높이 32)이며, 현재 값은 `bgBrandWeak` 배경, `fgBrand` 글자, `borderBrand` 테두리로 표시합니다.

실패한 업로드 재시도는 최초 요청의 ID, 이미지, 크롭, 배율을 그대로 다시 보냅니다. 그동안 폼을 수정해도 재시도 본문은 바뀌지 않습니다. 다른 파일을 선택하면 이전 재시도 요청을 비우며, 보관된 요청이 없거나 이미 처리 중이면 재시도하지 않습니다.

닉네임 단위 분할은 `미배정 / train / val / test` 버튼으로 선택하며 현재 값은 강조색으로 표시합니다. 다른 값을 누르면 기존 확인 창을 거쳐 적용하고 현재 값을 다시 누르면 요청하지 않습니다. 정답 미작성, 수정 중, 저장 중에는 분할 버튼을 비활성화합니다.

정답, 제외, 분할 hook도 실행 잠금을 공유해 같은 렌더에서 겹친 명령을 보내지 않습니다. 미저장 정답의 분할 명령을 거절하며, 다른 표본으로 이동한 뒤 늦게 끝난 이전 분할 요청은 현재 편집기의 안내를 바꾸지 않습니다.

분할은 NFC 정규화한 닉네임 정답에 저장합니다. 같은 닉네임의 모든 샘플은 같은 분할을 따르고 새 샘플도 정답이 저장되면 기존 배정을 따릅니다. 정답이 없으면 미배정입니다. 대소문자, 공백은 임의로 제거하지 않습니다. 분할된 샘플의 정답 수정으로 분할이 달라지면 명시 확인이 필요합니다. 자동 분할의 비율은 사용자가 직접 정합니다.

### 자동 분할

**자동 분할 · 실제 자료 분포**를 펼치면 정답 완료, 미제외 이미지와 고유 닉네임 수, 문자군, 개별 문자 빈도를 확인할 수 있습니다. 이미지 기준 목표 비율을 합계 100%로 입력해 미리보기합니다. 기본 비율은 지정하지 않습니다. 기본은 기존 배정 유지이며, 최초 전체 분할 등 기존 배정도 바꿔야 할 때만 재배정 항목을 선택합니다.

미리보기는 규모, 문자 분포와 목표 차이, 기존 분할에서 이동할 닉네임 수를 표시합니다. **미리보기 분할 적용**의 확인 창을 승인할 때만 저장합니다. 닉네임 묶음과 희귀 문자 때문에 비율을 정확히 맞추지 못할 수 있습니다. 그 사이 자료가 바뀌면 409로 거절하므로 다시 미리보기합니다. 빈 분할은 경고하며 Windows 학습에는 세 분할이 모두 필요합니다.

버튼뿐 아니라 hook의 명령도 입력 비율과 실행 중 여부를 확인합니다. 한 명령이 처리 중이면 다른 미리보기, 적용 요청을 보내지 않고, 비율이나 재배정 설정을 바꾸면 이전 미리보기를 적용할 수 없습니다. 서버는 적용 시 자료 변경 여부를 계속 최종 검사합니다.

수동으로 **미배정**을 선택한 닉네임은 재배정 옵션을 켜도 자동 분할에서 보존하며 유지 개수를 표시합니다. 다시 배정하려면 해당 닉네임의 train/val/test 버튼을 사용합니다.

첫 적용 이후 새 미제외 닉네임은 정답 저장 시 train으로 들어갑니다. 기존 닉네임의 새 캡처는 기존 배정을 따릅니다. 주간 자료를 학습에 반영하려면 Windows 앱에서 새 실험으로 다시 가져오세요. 서버의 val/test에 이미지가 추가되어도 과거 로컬 실험 입력은 바뀌지 않습니다.

알고리즘은 닉네임 그룹의 이미지 수, 문자군, 개별 문자 빈도를 사용한 결정적 greedy 배정과 제한된 개선을 수행합니다. 흔한 문자와 이미지 규모를 우선하고 희귀 문자에는 약한 목적함수를 적용합니다. 최적해나 희귀 문자의 모든 분할 출현을 보장하지 않습니다.

`src/split-plan.ts`는 이미지 점수 가중치 4, 닉네임 1, 문자군 합계 2, 개별 문자 합계 1과 희귀 문자 정규화 분모 하한 10을 구분합니다. 개선은 최대 8회 반복하며 점수 변화가 엄격히 `-1e-12`보다 작을 때만 이동합니다. 비율 합은 100에서 `1e-6` 이내 오차를 허용합니다. 가중치 나눗셈, 제곱, 정규화 순서와 동률, 정렬 규칙은 유지합니다.

### 구현 구조와 조회 캐시

자동 분할 화면과 적용 확인 창은 `SplitPlanner.tsx`, 요청, 미리보기 수명과 캐시 무효화는 기존 `browser/hooks` 아래 `use-split-planner.ts`, 전용 StyleX는 `SplitPlanner.style.ts`가 소유합니다. 확인을 취소하면 요청하지 않으며 승인한 미리보기만 hook에 전달합니다. 분할, 문자군 식별자는 `src/model.ts`에서 공유하고 표시 문구는 `browser/constants.ts`의 기존 상수 패턴을 따릅니다. `split-plan.ts`의 계산과 `store.ts`의 transaction 경계는 구분합니다.

표본 정답 수정의 다음 분할, 신규 train 배정, 분할 변경 확인은 `src/sample-update.ts`의 순수 계획 함수가 판단합니다. 저장소는 transaction 안에서 현재 표본, 닉네임 배정을 읽고 계획이 승인된 뒤에만 분할과 표본을 씁니다. 확인하지 않은 분할 변경은 정답, 제외, 배정 모두를 그대로 유지합니다.

서버는 기존 API와 같은 NestJS 12 버전의 controller, DI, exception filter를 사용합니다. 큰 본문을 읽기 전 인증과 업로드 동시 제한을 적용하며 경로별 크기 제한만 Express 어댑터의 JSON parser를 사용합니다. 쿠키 파싱은 `cookie-parser`, 발급, 삭제는 응답 기본 API를 사용합니다. 로그인 요청 한도는 완료된 대기 요청과 인증 API 호출 중인 요청의 합계입니다. `__Host-ocr-login`은 로그인 시작 브라우저와 callback을 연결하는 임시 쿠키, `__Host-ocr-session`은 인증 후 서버 세션을 찾는 쿠키입니다. 두 쿠키의 값은 Node `crypto.randomBytes`로 생성한 난수이고 기존 API token을 담지 않습니다.

인증은 `OcrAuth`가 담당하고 JSON parser보다 먼저 등록한 middleware에서 호출합니다. [NestJS 요청 순서](https://docs.nestjs.com/faq/request-lifecycle)에 따라 Guard는 middleware 이후 실행되므로, 현재 body parser 구성에서 인증을 Guard로 옮기면 인증 전 큰 본문을 파싱하게 됩니다. Desktop 요청의 정확한 method, URL 판정은 `isDesktopRequest`, 합성 업로드는 `isSyntheticUploadRequest`에서 정의하며 Origin 검사와 인증 방식 선택이 같은 판정을 사용합니다.

인증 대기 중 연결이 끊기면 인증 완료 뒤 업로드 슬롯을 예약하지 않습니다. 살아 있는 요청은 기존 한도에서 즉시 `UPLOAD_BUSY`로 거절하며 대기열에 넣지 않습니다. 예약한 슬롯은 응답 종료, 오류, 취소의 `close`에서 한 번만 반환합니다.

SPA는 TanStack Query로 세션, 필터별 목록, 통계를 조회합니다. 30초 동안 fresh 상태를 유지하고 사용하지 않는 캐시는 5분 후 제거합니다. 업로드, 정답, 분할 mutation 성공 시 모든 목록과 통계를 invalidate하고, 로그아웃, 인증 만료 시 캐시를 비웁니다. Mutation 자동 재시도는 끄고 실패한 업로드만 사용자가 같은 ID로 재시도합니다. Query parameter 생성은 순수 utility, 필터, 페이지 상태는 전용 hook이 담당합니다. 스타일, 테마는 StyleX로 컴파일하며 전역 CSS에는 reset, Pretendard font-face와 body의 UI 글꼴, 한국어 줄바꿈 기준을 둡니다. 폰트는 같은 서버에서 제공하고 원문 라이선스를 browser 산출물 `THIRD-PARTY.txt`에 포함합니다.

## HTTP API

### 학습 모델 보관

웹의 **학습 모델**에서 공식 `korean_PP-OCRv5_mobile_rec` 기본 가중치와 문자 사전을 미니PC에 등록하고, 등록된 모델의 이름, 종류, 등록 시각, 크기, 파일을 확인합니다. 기본 모델 다운로드는 약 106 MiB이며 같은 모델은 한 번만 저장합니다. 서버에서 학습을 실행하지 않습니다.

기본 파일은 [코드에 고정한 출처와 SHA-256](src/base-model.ts)에 일치해야 저장됩니다. 2026-09-30 공식 HTTPS URL에서 확인한 가중치 110,996,478 bytes의 SHA-256은 `8975dede5e0c2f47e0a7712b3d79ffdc766972f872fd0441ebcccd9d77cd52a3`입니다. PaddleOCR commit `b03f46425e8ff4442b268ce449e3eef758146cd4`의 사전 47,451 bytes는 `a88071c68c01707489baa79ebe0405b7beb5cca229f4fc94cc3ef992328802d7`입니다. 이 값은 저장소가 검토해 고정한 기준이며 공급자가 별도 서명한 배포 manifest를 뜻하지 않습니다. 이후 원격 파일이 바뀌면 자동으로 신뢰하지 않습니다. 기존 기본 모델이 불일치해도 자동 삭제, 덮어쓰기를 하지 않으므로 파일과 출처를 확인한 뒤 별도 복구를 판단해야 합니다.

별도 [Windows 평가 앱](https://github.com/blahaj94/dfragon-ocr-eval-tool)이 웹 로그인 후 모델과 train/val/test 데이터를 REST로 내려받아 로컬 입력을 고정하고 GPU로 학습, 평가합니다. 앱 구현과 검증은 [앱 PR #1](https://github.com/blahaj94/dfragon-ocr-eval-tool/pull/1)에서 확인할 수 있습니다. 앱은 main process의 웹 로그인 세션으로 브라우저 경로를 호출합니다. 사용자가 **미니PC에 올리기**를 누르면 학습된 가중치, 사전, 평가 요약을 새로운 모델로 등록합니다. 자동 결과 업로드는 없습니다. 일반 파인튜닝은 시작 모델 사전의 SHA-256을 유지합니다. 문자 확장 모델은 기존 문자 순서를 보존하고 명시 선택한 문자만 뒤에 추가하며, 새 모델 ID로 보관합니다.

| Method / path | 동작 |
| --- | --- |
| `GET /api/models` | `{schemaVersion: 1, models: [...]}` 목록 |
| `GET /api/models/:id` | ID, 이름, preset, kind, parentId, 등록 시각, 파일별 bytes/SHA-256 |
| `GET /api/models/:id/files/:name` | 보관된 파일 bytes |
| `POST /api/models` | `metadata` JSON 필드와 `files` multipart 파일로 새 모델 등록 |
| `POST /api/models/base/korean-v5` | 공식 기본 한국어 모델을 고정 ID로 등록 |

목록, 상세, 파일, multipart 등록은 `/api/desktop/models`에도 동일한 계약으로 제공하며 Origin 없는 활성 owner Bearer가 필요합니다. 브라우저 경로는 owner cookie를 사용하고 POST는 정확한 OCR Origin이 필요합니다. 토큰으로 정답, 분할 변경이나 브라우저 세션 발급은 할 수 없습니다.

`metadata`는 `{id: UUID, name: 1~100자, preset: "korean-ppocrv5", kind: "pretrained" | "finetuned" | "expanded", parentId: UUID | null}`입니다. pretrained는 parent가 없고 finetuned, expanded는 존재하는 시작 모델 ID가 필요합니다. 파일 이름은 `weights.pdparams`, `characters.txt`, 선택적인 `evaluation.json`만 받습니다. 합계 128 MiB, 사전, 평가 파일 각각 1 MiB 이하입니다. 사전은 중복 없는 한 줄 한 문자이며 공백은 모델에서 추가합니다. finetuned의 사전 해시는 시작 모델과 같아야 합니다. expanded는 부모 사전의 모든 문자가 같은 순서로 앞부분에 남고 새 문자가 뒤에 추가된 경우만 허용합니다. 서버는 가중치를 실행하지 않습니다.

업로드의 두 파일 개수 한도는 허용 목록 `MODEL_FILES.length`에서 파생합니다. `src/model-library.ts`는 파일 본문 합계 128 MiB, 보조 파일별 1 MiB, 메타데이터 parser 한도 8192 bytes, 전체 요청의 multipart 부가 예산 64 KiB, parser parts 한도 5를 각각 구분합니다. 서로 다른 예산을 합치거나 확장하지 않습니다. 현행 parser는 메타데이터가 정확히 8192 bytes여도 400으로 거절합니다. 필수 두 파일, 메타데이터와 선택 평가 파일의 네 part를 허용하며, 파일 3개, 필드 1개의 별도 한도도 적용합니다. `Content-Disposition` 없는 무시된 part도 세므로 정확히 다섯 part는 허용하고 여섯 번째는 거절합니다. 파일 본문 합계와 보조 파일 검사는 정확한 상한을 허용하며, 전체 요청은 128 MiB + 64 KiB를 넘을 때 연결을 끊습니다.

파일과 메타데이터는 한 SQLite transaction으로 저장합니다. 같은 ID, 같은 bytes/메타데이터 재요청은 기존 결과를 반환하고 다르면 409입니다. 원본 PNG와 모델 파일에 하나의 저장 용량 한도를 적용하며 기존 자료를 자동 삭제하지 않습니다. 응답은 `{model, duplicate}`이고 POST 성공은 201입니다. 모델 업로드와 기본 모델 가져오기는 인증 후 제한하며, 실제 기본 모델 다운로드 작업은 연결 취소 후 재요청에서도 한 개를 유지합니다. [인프라 운영 절차](../../docs/reference/api-start-development.md#서버-이미지)를 함께 적용해야 합니다.

부모 preset, 사전 관계는 `src/model-library.ts`의 순수 검증 함수가 확인하고 부모 조회, 중복 확인, 파일 쓰기는 저장소 transaction이 소유합니다. finetuned는 줄바꿈을 포함한 사전 bytes가 같아야 하며 expanded는 기존처럼 LF/CRLF 문자 행을 비교해 동일 순서의 전체 부모 접두부와 실제 문자 추가를 요구합니다. 계보 거절은 기존 모델과 파일을 바꾸거나 일부 새 모델을 저장하지 않습니다.

### 데이터와 로그인

자료실의 관리, 조회 요청은 로그인 쿠키가 필요합니다. 쿠키는 HttpOnly, Secure, SameSite=Lax이며 변경 요청에는 정확한 `Origin: OCR_ORIGIN`이 필요하고 CORS는 열지 않습니다. 별도 `POST /api/desktop/captures`, Desktop 조회 GET 경로와 위 모델 API는 Origin 없는 Desktop Bearer 요청을 받으며 같은 지정 계정의 활성 세션인지 확인합니다. Desktop 토큰은 정답, 분할 수정, 브라우저 로그인과 전체 다운로드 권한을 갖지 않습니다.

| Method / path | 동작 |
| --- | --- |
| `POST /auth/login` | 기존 API의 패스키 로그인 URL 반환, 로그인 요청 쿠키 발급 |
| `GET /auth/callback?code=…` | 요청 쿠키, PKCE로 일회용 code 교환, 허용 계정 확인 후 `/`로 복귀 |
| `POST /auth/logout` | OCR 세션 제거와 기존 인증 세션 종료 요청 |
| `GET /api/session` | 로그인 여부 확인 |
| `GET /api/stats` | 원본, 샘플, 미작성, 제외 개수, 원본 저장 bytes |
| `POST /api/captures` | 아래 원본+좌표 JSON 저장. 최초 201, 같은 요청 재시도 200 |
| `POST /api/desktop/captures` | Desktop의 활성 owner Bearer로 같은 원본+좌표 JSON 저장 |
| `POST /api/synthetic-samples` | 전용 업로드 토큰, Origin 없는 요청으로 합성 PNG, 생성 정답, 렌더링 정보 저장. 최초 201, 동일 재전송 200 |
| `GET /api/captures/:id` | 캡처 메타데이터 |
| `GET /api/captures/:id/image` | 원본 PNG |
| `GET /api/samples` | 샘플 100개와 `nextOffset`. `offset`, `state=pending/labeled/excluded`, `kind=hud/participants/raid/synthetic`, `split`, 정확한 `text` 필터 |
| `GET /api/samples/:id/image` | 원본 픽셀에서 만든 크롭 PNG |
| `PATCH /api/samples/:id` | `{text?: string 또는 null, excluded?: boolean, confirmSplitChange?: boolean}`. text, excluded 중 하나 이상 필요 |
| `PUT /api/splits` | `{text: string, split: unassigned/train/val/test}`. 해당 닉네임 전체에 적용 |
| `GET /api/splits/statistics` | 대상 규모, 문자 빈도, 현재 분할 및 자동 추가 활성화 여부 |
| `POST /api/splits/preview` | `{ratios: {train, val, test}, replaceExisting: boolean}`. 각 값은 %, 합계 100. 읽기 전용 미리보기, fingerprint |
| `POST /api/splits/apply` | 같은 설정과 미리보기 `fingerprint`. 재검사 후 일괄 배정, 추가 규칙 활성화, 변경 시 409 |
| `GET /api/desktop/dataset` | 앱 평가용 정답, 제외, 분할 메타데이터 스냅샷 |
| `GET /api/desktop/samples/:id/image` | 앱 평가용 원본 크롭 PNG |
| `GET /api/export/manifest` | 현재 메타데이터, 정답, 분할 JSON |
| `GET /api/export` | 현재 전체 자료 TAR. 원본, 크롭, manifest 포함 |
| `GET /health` | 데이터 없는 readiness 응답 |

정답 저장은 `{text}`, 제외, 복원은 `{excluded}`로 요청하면 생략한 필드를 transaction 안의 최신 값으로 보존합니다. 기존 두 필드 동시 요청도 지원합니다. `text: null`은 정답 제거, `excluded: false`는 복원이며 빈 요청은 거절합니다. 분할 변경의 `confirmSplitChange` 확인은 유지하고 동일 필드 동시 수정의 revision 충돌 정책은 추가하지 않습니다.

업로드 예시의 ID, 시각은 수집자가 생성합니다. 재시도 때는 ID와 본문을 그대로 보냅니다. 파일명, 로컬 파일 경로는 서버 저장 경로로 사용하지 않습니다.

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

`uiScale`은 비율(0.75 = 75%), `uiScaleSource`는 `game` 또는 `estimated`입니다. 모르면 `null`과 `unknown`을 함께 보냅니다. 원본 너비, 높이는 서버가 PNG에서 읽습니다. 크롭은 원본 기준 정수 좌표이며 `hud`, `participants`는 슬롯 1~4, `raid`는 슬롯 1~12 중 실제 저장 대상만 보냅니다. 샘플 ID는 `{captureId}-{slot}`입니다. 원본이 있어도 선택되지 않은 영역의 detection 라벨까지 완성된 것은 아닙니다.

PNG는 최대 16 MiB, 축별 최대 8192, 총 16,777,216 pixels, non-interlaced 형식입니다. HTTP JSON body는 23 MiB, 동시에 받는 업로드는 2개입니다. `hud`, `participants` 크롭은 1~4개, `raid`는 1~12개이며 중복 슬롯, 경계 밖 좌표, 손상된 PNG는 거절합니다. 원본과 모든 좌표 저장이 끝난 경우만 성공합니다. 업로드 실패의 자동 재시도, 앱 재시작 복구는 제공하지 않습니다.

주요 실패는 400 입력 오류, 401 로그인 필요, 403 다른 계정/Origin, 409 캡처 ID 충돌 또는 분할 변경 확인 필요, 413 크기 초과, 429 일시 제한, 502 인증 서버 연결 실패, 507 저장 상한입니다. 원문 오류, 토큰, 계정 ID는 오류 응답에 넣지 않습니다.

## 합성 이미지와 정답 등록

Python/Node.js 스크립트는 `dnf-ocr-synth`로 만든 이미지와 생성 정답을 `POST https://ocr.dfragon.com/api/synthetic-samples`에 JSON으로 전송합니다. 아래 서버 API를 제공하며 업로더 프로그램은 사용자가 작성합니다.

운영자가 32바이트 이상의 난수 토큰을 생성해 스크립트에 전달하고, 토큰의 SHA-256만 서버의 `OCR_SYNTHETIC_UPLOAD_TOKEN_SHA256`에 설정합니다. 토큰은 43~128자의 영문, 숫자, `_`, `-`로 구성합니다. 예를 들어 서버 실행과 별개로 다음 명령으로 64자의 hex 토큰 파일과 해시를 준비할 수 있습니다.

```sh
umask 077
openssl rand -hex 32 > synthetic-upload-token.txt
tr -d '\n' < synthetic-upload-token.txt | openssl dgst -sha256
```

마지막 명령 결과의 64자리 소문자 hex digest만 환경 변수에 넣습니다. 원본 토큰 파일과 운영 설정은 저장소에 추가하지 않습니다. 미설정이면 합성 업로드가 비활성화되고, 값이 잘못되면 서버가 시작하지 않습니다. 해시를 교체, 제거하고 서버를 재시작하면 이전 토큰이 폐기됩니다. 배포, 운영 토큰 설정은 별도 운영 작업입니다.

스크립트가 파일의 끝 개행을 제거한 토큰을 `Authorization: Bearer <전용 토큰>`으로 보내고 `Content-Type: application/json`을 지정합니다. Origin과 cookie는 보내지 않습니다. 정확한 경로만 허용하며 query, 끝 slash를 붙이지 않습니다. 기존 owner cookie, 로그인 access token으로는 합성 업로드를 할 수 없습니다. 전용 토큰은 합성 등록만 허용하고 데이터 조회, 다운로드, 정답/분할 수정, 실제 캡처/모델 등록 권한은 없습니다. 토큰 오류, 미설정은 401 `UPLOAD_TOKEN_REQUIRED`, Origin이 있는 요청은 403입니다.

```json
{
  "id": "00000000-0000-4000-8000-000000000002",
  "generatedAt": "2026-09-30T00:00:00.000Z",
  "png": "BASE64_ENCODED_OPAQUE_PNG",
  "text": "합성고래",
  "rendering": {
    "rendererVersion": "0.1.2",
    "profile": "dotum",
    "scale": 1.8,
    "foregroundRgb": [75, 209, 255],
    "backgroundRgb": [40, 50, 59]
  }
}
```

한 요청은 이미지 한 장을 등록합니다. 생성 시각은 밀리초가 있는 ISO UTC, ID는 소문자 UUID입니다. 성공 응답은 `{id, duplicate}`이며 재전송 시 ID, 시각, 이미지, 정답, 렌더링 정보를 그대로 유지합니다. 같은 ID로 다른 자료를 보내면 409 `CAPTURE_ID_CONFLICT`입니다. 여러 이미지는 클라이언트가 순차 전송하며 기존 2개 동시 업로드, 23 MiB 본문, 16 MiB PNG, 저장 한도를 공유합니다.

렌더러의 RGBA를 배경에 합성한 불투명 RGB/RGBA PNG로 준비합니다. 알파 채널을 단순히 버린 결과나 투명 픽셀이 남은 PNG를 보내지 않습니다. 단색 배경을 사용하는 Python 예시는 다음과 같습니다. `sample`은 렌더러가 반환한 결과이며 `payload`를 위 전용 토큰 헤더로 전송합니다. 대량 생성 시 이 payload의 ID, 시각도 함께 저장해 재전송에 사용합니다.

```python
import base64
import io
from datetime import datetime, timezone
from uuid import uuid4
from PIL import Image

background_rgb = (40, 50, 59)
background = Image.new("RGBA", sample.image.size, (*background_rgb, 255))
image = Image.alpha_composite(background, sample.image).convert("RGB")
output = io.BytesIO()
image.save(output, format="PNG")
metadata = sample.metadata
payload = {
    "id": str(uuid4()),
    "generatedAt": datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z"),
    "png": base64.b64encode(output.getvalue()).decode("ascii"),
    "text": metadata["text"],
    "rendering": {
        "rendererVersion": metadata["renderer_version"],
        "profile": metadata["profile"],
        "scale": metadata["scale"],
        "foregroundRgb": metadata["foreground_rgb"],
        "backgroundRgb": list(background_rgb),
    },
}
```

렌더러 버전은 숫자 `major.minor.patch`, 프로필은 `dotum/nanum-neo`, 배율은 0 초과 16 이하, 두 색상은 0~255 정수 세 개입니다. 이 계약은 단색 배경 합성을 지원합니다. 서버는 정답의 NFC 정규화, 빈 값, 공백, 제어문자를 검사하며, CP949, 12바이트, 폰트 지원 검사는 생성자가 `dnf-ocr-synth`로 수행합니다. 파일 경로, 폰트 파일, 임의 추가 JSON 필드는 받지 않습니다.

저장과 동시에 전체 이미지 영역을 `kind: synthetic`, 슬롯 1, 정답 완료, 미제외, train으로 등록합니다. 생성 배율은 `synthetic.rendering.scale`에 보관하며 게임 UI 배율로 추정하지 않습니다. 생성 정답과 원본은 수정할 수 없고 제외, 복원만 가능합니다. 기존 미배정, val/test 닉네임과 충돌하거나 합성 닉네임을 train 밖으로 이동하려는 요청은 409 `SYNTHETIC_TRAIN_ONLY`입니다. 합성 이미지는 실제 자료 자동 분할 통계에서 제외하고, 같은 닉네임의 실제 자료는 재배정 때도 train을 유지합니다.

내부 `Capture` 타입은 종류로 구분합니다. `synthetic` 캡처에는 생성 정답, 렌더링 메타데이터가 필수이고 실제 `hud/participants/raid` 캡처에는 이 메타데이터를 넣을 수 없습니다. 각 업로드 parser는 해당 종류로 좁힌 결과를 반환하며 외부 JSON의 런타임 검증도 유지합니다.

HTTP 오류의 식별자, 상태, 안내 문구 원본은 `src/errors.ts`의 `OCR_ERRORS`입니다. `OcrErrorCode`, 기존 `OCR_ERROR_CODE` 상수와 브라우저의 런타임 오류 식별 검사는 이 목록에서 파생하며 등록하지 않은 문자열과 상속된 객체 키는 오류 코드로 받지 않습니다.

자료실의 합성 필터, 전체 manifest, TAR에서 확인하고 내려받을 수 있습니다. 기존 DFragon Desktop의 `/api/desktop/dataset`은 실제 캡처만 반환합니다. 서버는 생성 정보와 이미지의 실제 일치나 학습 효과를 인증하지 않습니다. 이 API는 서버 배포 후 사용할 수 있으며 기존 운영 데이터의 재배정은 하지 않습니다.

## 다운로드와 로컬 선별

`ocr-data.tar`는 다음을 포함합니다.

- `manifest.json`: schemaVersion, 다운로드 시작 시점의 캡처, 샘플, 정답, 제외, 분할 목록
- `originals/{captureId}.png`: 캡처마다 원본 한 장
- `crops/{sampleId}.png`: 원본 픽셀에서 생성한 크롭

제외, 미작성 데이터도 포함하여 전체 자료를 내려받습니다. 로컬 학습 스크립트에서 `excluded=false`, `text!=null`, 필요한 `split`을 선택합니다. 같은 닉네임 배정을 보존해야 하며 로컬에서 파일을 임의 재분할한 결과까지 서버가 보장하지 않습니다. 서버는 영구 데이터셋 버전을 만들지 않고 다운로드 시작 때 메타데이터를 함께 읽습니다. 원본은 수정하지 않으므로 다운로드 도중 정답 변경이 그 TAR에 섞이지 않습니다.

이전 Desktop에 저장된 크롭만으로 원본 화면, 좌표를 복원하지 않습니다. 기존 로컬 자료의 자동 이관은 후속 범위입니다. 새 Desktop 수집 연결은 아래를 따릅니다.

## Desktop 수집 연결

로그인한 Desktop의 main process가 기존 access token으로 `POST /api/desktop/captures`에 원본 PNG와 크롭 좌표를 보냅니다. 업로드 JSON은 `/api/captures`와 같습니다. 서버는 기존 인증 API `/me`로 활성 세션과 `OCR_OWNER_ID`를 확인하며 cookie만 있는 요청이나 Origin이 있는 브라우저 요청은 받지 않습니다. 관리 API와 자료실 로그인은 기존 owner cookie 경계를 유지합니다. 새 DB migration, 환경 변수, 별도 역할은 없습니다. `raid`를 받는 OCR 서버를 먼저 배포한 뒤 공대원창 수집이 포함된 Desktop을 배포합니다. 공대원창은 닉네임 크롭을 같은 정답, 제외, 분할, 평가 흐름으로 제공합니다. 공대원 행 번호는 해당 캡처의 화면 위치이므로, 공대원이 나가 목록이 위로 당겨지면 같은 번호가 다른 사람을 가리킬 수 있습니다.

### 테스트 버전의 비로그인 HUD 수집

`OCR_TEST_UPLOAD_ENABLED=true`로 시작한 서버에 한해 `POST /api/desktop/test-captures`를 받습니다. 생략 또는 `false`는 404이며 그 외 설정은 시작 오류입니다. 서버 배포와 이 설정 적용은 별도 운영 작업입니다. 공개 클라이언트에 비밀 토큰을 넣지 않으며, 이 경로는 Origin, Authorization, Cookie 헤더를 받지 않습니다. 조회, 정답 변경, 분할, 모델, 기존 Desktop 업로드의 인증은 그대로 유지합니다.

본문은 기존 실제 캡처 계약에 `testCollection`만 추가합니다. `kind`는 `hud`입니다. `crops`에는 원본 픽셀 기준 닉네임 좌표를, `testCollection.slots`에는 얼굴과 닉네임을 포함한 전체 파티원 슬롯 좌표를 넣습니다. 두 목록은 같은 슬롯 집합이며 각 전체 슬롯이 해당 닉네임을 포함해야 합니다. 서버는 원본 PNG 한 장을 저장하고 두 크롭을 필요할 때 생성합니다.

```json
{
  "id": "00000000-0000-0000-0000-000000000001",
  "capturedAt": "2026-10-08T00:00:00.000Z",
  "kind": "hud",
  "uiScale": null,
  "uiScaleSource": "unknown",
  "originalPng": "<base64 PNG>",
  "crops": [{ "slot": 1, "x": 42, "y": 10, "width": 73, "height": 16 }],
  "testCollection": {
    "trigger": "ocr",
    "slots": [{ "slot": 1, "x": 10, "y": 4, "width": 142, "height": 38, "prediction": "예측값" }]
  }
}
```

`trigger`는 `ocr` 또는 `shortcut`입니다. `prediction`은 최대 128 UTF-16 code unit 문자열 또는 null이며 `shortcut`에는 null만 허용합니다. 성공 여부와 무관하게 미검수 예측을 보관하고 정답, 분할을 채우지 않습니다. 학습용 `/api/samples/:id/image`는 닉네임 크롭을 유지합니다. owner는 편집기에서 미검수 예측과 `/api/samples/:id/context/image`의 전체 슬롯을 확인할 수 있습니다. Context 경로는 Desktop Bearer에도 추가로 개방하지 않습니다.

같은 ID, 같은 요청은 200 중복 응답입니다. 같은 ID의 다른 내용은 409입니다. ID가 달라도 원본 PNG bytes와 닉네임, 슬롯 좌표가 모두 같으면 200 `{id: 기존 캡처 ID, duplicate: true}`로 중복 저장을 막고 최초 예측을 유지합니다. 다른 픽셀의 연속 프레임까지 같은 자료로 판단하지 않으며 train/val/test를 자동 배정하지 않습니다.

개발 단계의 테스트 수집은 IP별, 전체 요청 횟수, 동시 업로드 수, 누적 저장 용량과 원본 개수로 거절하지 않습니다. `OCR_MAX_BYTES`의 통합 저장 용량 검사와 일반 업로드의 동시 처리 슬롯에서도 제외합니다. 테스트 수집 전용 30초 수신 제한은 제거하고 서버 공통 HTTP 수신 시간 설정을 따릅니다. 본문 23 MiB, PNG 16 MiB, 한 축 8192, 총 16,777,216 pixels의 개별 이미지 검증과 기존 일반 업로드 한도는 유지합니다. 기존 자료를 자동 삭제하지 않습니다.

새 SQL 테이블, 컬럼, migration은 없습니다. 기존 `captures.metadata` JSON에 수집 출처, 전체 슬롯 좌표, 미검수 예측과 서버 계산 content hash를 추가합니다. 기존 자료, 정답, 분할은 변경하지 않습니다. 이 기능만 되돌린 서버에서도 기존 canonical 닉네임 크롭을 읽을 수 있지만 새 문맥과 예측 표시는 제공하지 않습니다.
