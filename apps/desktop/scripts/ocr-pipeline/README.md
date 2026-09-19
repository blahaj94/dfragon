# Desktop OCR 모델 제작 도구

Desktop에 배포할 OCR 모델의 데이터 준비·학습·변환·평가를 위한 개발 도구입니다. 위치는 `apps/desktop/scripts/ocr-pipeline/`, 실행 진입점은 `@ldb/desktop`의 pnpm script입니다. 새 workspace나 별도 Node 패키지를 만들지 않습니다.

**모델 학습과 게임 정확도, Electron 통합은 아직 미검증입니다.** 테스트의 가짜 가중치·실행기는 도구 동작의 검증이며 OCR 성능의 근거가 아닙니다. 모델·폰트·게임 캡처와 이미지 생성기는 포함하지 않으며 기존 배포 모델을 자동 교체하지 않습니다. 관련 작업은 [#463](https://github.com/blahaj94/ldb/issues/463)에서 추적합니다.

## 환경과 책임

Node.js 24, 루트 `package.json`의 pnpm, 기존 `pnpm-lock.yaml`을 사용합니다. Python 3.11–3.13은 이 도구를 쓰는 개발자만 준비합니다. CI는 Python 3.12입니다. PaddleOCR는 Python 프로그램이므로 Node로 재구현하지 않고 도구 전용 `.venv`에서 실행합니다.

앱 `dependencies`·`postinstall`·빌드에 Python을 추가하지 않습니다. 기존 `prepare:ocr-assets`는 선택한 배포 모델의 검증·복사 역할을 유지합니다. 학습용 도구는 Electron 패키징의 `out`·`resources` 밖에 둡니다.

저장소 루트에서:

```sh
# OCR 도구만 사용할 새 checkout의 명시적 설치. 준비된 checkout에서는 생략합니다.
pnpm install --frozen-lockfile --ignore-scripts
pnpm --filter @ldb/desktop ocr:setup --python python
pnpm --filter @ldb/desktop ocr:check
pnpm --filter @ldb/desktop ocr:test
pnpm --filter @ldb/desktop ocr --help
```

첫 install은 pnpm의 암묵적 설치로 네이티브 postinstall이 실행되는 것을 피합니다. 앱 자체를 실행·빌드할 때는 [Desktop 설치 안내](../../README.md)를 따릅니다. Linux에서 인터프리터 이름이 `python3`이면 `--python python3`를 사용합니다. 공백이 있는 실행 파일 경로는 한 인자로 quote하며 셸 명령을 넣지 않습니다.

`ocr:setup`은 `.venv`를 만든 뒤 `requirements-tooling.txt`의 고정된 CPU 도구·테스트 의존성과 로컬 패키지를 설치합니다. 이 파일은 GPU 학습 lock이나 해시 검증된 의존성 목록이 아닙니다. 기존 환경에 도구 의존성만 재설치할 때는 `ocr:setup`을 인자 없이 사용합니다. Python을 변경하려면 작업을 종료하고 이 도구의 `.venv`만 삭제한 뒤 재생성합니다. 설치 실패 시 전역 Python으로 fallback하지 않습니다.

`ocr:check`는 Node/Python 구문과 설치 의존성을, `ocr:test`는 Node 실행기와 Python 도구 테스트를 확인합니다. GPU 학습이나 앱 검증을 대신하지 않습니다. 가상환경·캐시·모델·사적 생성 디렉터리는 Git과 코드 검사에서 제외하며 실제 데이터와 결과는 저장소 밖에 둡니다.

### 학습 환경

장비·드라이버에 맞는 PaddlePaddle과 Paddle2ONNX는 같은 `.venv`에 별도로 설치합니다. `pnpm --filter @ldb/desktop ocr python -m pip ...`을 쓰면 활성화 없이 동일 인터프리터를 선택합니다. 임의 CUDA 설치나 유료 GPU 실행을 setup/CI에 넣지 않습니다. GPU 패키지 설치 후 도구 requirements를 덮어씌우기 전에 호환성을 확인해야 합니다.

PaddleOCR 소스는 저장소 밖의 깨끗한 checkout으로 유지합니다. 다음 `git` 명령은 저장소 루트 기준입니다.

```sh
git clone https://github.com/PaddlePaddle/PaddleOCR.git ../PaddleOCR
git -C ../PaddleOCR checkout 9d5e7663a3d7035456538435fae82a1762cd3529
pnpm --filter @ldb/desktop ocr python -m pip install -r ../../../PaddleOCR/requirements.txt
pnpm --filter @ldb/desktop ocr python -m pip install -e "scripts/ocr-pipeline[evaluation]"
pnpm --filter @ldb/desktop ocr:check
```

**도구에 전달하는 상대 경로의 기준은 항상 `apps/desktop`입니다.** 저장소 옆 `PaddleOCR`는 `../../../PaddleOCR`, 앱 자산은 `assets/ocr/...`입니다. 아래 명령은 사적 입력과 결과를 저장소 옆 `ldb-ocr-data`에 두는 예시이며 절대 경로도 지원합니다. 여러 줄 예시는 Bash/WSL 문법입니다. PowerShell에서는 한 줄 또는 해당 셸의 줄 연속 문법을 사용합니다.

고정된 PaddleOCR commit은 `9d5e7663a3d7035456538435fae82a1762cd3529`이며 설정은 `configs/rec/PP-OCRv5/multi_language/korean_PP-OCRv5_mobile_rec.yml`입니다. 버전 변경 시 API와 실제 학습·변환을 함께 검증합니다. 실제 GPU/드라이버/의존성 조합은 별도로 고정해야 하며 CPU CI나 출처 해시만으로 결정성과 호환성을 보장하지 않습니다.

## 입력 계약

공식 한국어 **학습용** `.pdparams`, 그 출처와 SHA-256, 기본 문자 목록, 운영의 전체 허용 문자 목록, 정답이 확인된 crop과 manifest가 필요합니다. 게임의 허용 문자와 폰트 폴백은 도구가 추측하지 않습니다.

`allowed-characters.txt`는 UTF-8, BOM 없이 코드 포인트 하나씩 한 줄에 적습니다. ASCII 공백을 허용하면 공백 하나인 줄을 명시합니다. 기본 사전에는 공간 문자를 넣지 않습니다. CTC blank는 0번, 공간 문자는 별도로 마지막에 추가합니다. 기존 문자 순서는 유지하고 새 문자는 뒤에 추가합니다. 새 문자가 있으면 출력층 일부의 재초기화 가능성을 수용하는 `--allow-expanded-head`가 필요하며, 기존 출력 가중치 행을 이식하는 기능은 아닙니다.

manifest는 UTF-8 JSON Lines입니다. 아래 문자열은 형식 설명용 합성 예시입니다.

```json
{"id":"sample-0001","image":"crops/0001.png","text":"가Aね月※1","split":"train","group":"render-0001","profile":"dotum-ui100","source":"synthetic"}
```

`split`은 `train`·`val`·`test`, `source`는 `synthetic`·`real`입니다. `group`은 같은 원본의 변형·연속 프레임을 묶는 불투명한 식별자이며 실제 닉네임을 넣지 않습니다. 같은 문자열의 폰트·색깔 변형은 같은 split에 둡니다. 동일 픽셀의 중복 crop은 같은 split에서도 거절합니다. `real`은 저장·학습에 사용할 허가가 있는 데이터에만 쓰고 `--allow-real-data`를 추가합니다. 이 옵션 자체가 허가는 아닙니다.

정답의 문자 삭제·소문자화·NFKC 치환은 하지 않습니다. NFC는 split 사이의 문자열 누출 검사에만 사용합니다. 파일 형식 검사는 잘못 그려진 글자나 잘못 붙인 정답을 판별하지 못하므로 실제 이미지를 별도로 확인해야 합니다.

## 실행

### 데이터 준비

```bash
pnpm --filter @ldb/desktop ocr prepare \
  --source ../../../ldb-ocr-data/source-crops \
  --manifest ../../../ldb-ocr-data/manifest.jsonl \
  --base-dictionary ../../../PaddleOCR/ppocr/utils/dict/ppocrv5_korean_dict.txt \
  --allowed-characters ../../../ldb-ocr-data/allowed-characters.txt \
  --profiles dotum-ui100 nanum-neo-ui50 \
  --min-occurrences 20 --max-text-length 25 \
  --output ../../../ldb-ocr-data/prepared-v1
```

프로필·빈도·코드 포인트 길이는 입력 예시이며 게임의 확정 규칙이나 충분한 학습량이 아닙니다. 프로필마다 전체 목표 문자가 지정 빈도 이상 등장해야 하고 세 split 모두 필요합니다. 두 프로필이 실제 폴백까지 설명한다고 가정하지 않습니다. 출력은 이미지·정답 사본과 해시 목록이므로 비공개 데이터로 취급합니다.

### 학습

```bash
pnpm --filter @ldb/desktop ocr train \
  --data ../../../ldb-ocr-data/prepared-v1 --upstream ../../../PaddleOCR \
  --weights ../../../ldb-ocr-data/weights/korean.pdparams \
  --expected-weights-sha256 "$PRETRAINED_SHA256" \
  --epochs 40 --batch-size 32 --learning-rate 0.00005 \
  --seed 1729 --device cuda --allow-expanded-head \
  --output ../../../ldb-ocr-data/run-v1
```

`PRETRAINED_SHA256`는 출처를 확인해 기록한 값입니다. 파일 해시 계산만으로 배포처를 인증하지 않습니다. 파라미터는 최적값이 아니라 예시이며 validation으로 선택하고 test는 선택에 쓰지 않습니다. CPU fallback, 자동 재개, 기존 output 덮어쓰기는 하지 않습니다.

학습은 공식 프로그램을 동기 실행합니다. 오류·처리 가능한 중단은 `failed_or_interrupted`로 기록합니다. Windows 실행기 종료는 소유 프로세스 트리를 강제 종료할 수 있어 상태 파일 갱신까지 보장하지 않습니다. OS 강제 종료·호스트 장애 후 남은 output도 성공으로 취급하지 않습니다. 외부 원문 로그를 stdout에 전달하지 않지만 PaddleOCR가 private run 폴더에 로그·설정을 저장할 수 있으므로 해당 폴더를 Git·Issue·공용 로그에 올리지 않습니다.

### 변환과 평가

```bash
pnpm --filter @ldb/desktop ocr export \
  --run ../../../ldb-ocr-data/run-v1 --upstream ../../../PaddleOCR \
  --output ../../../ldb-ocr-data/candidate-v1

pnpm --filter @ldb/desktop ocr evaluate \
  --data ../../../ldb-ocr-data/prepared-v1 --candidate ../../../ldb-ocr-data/candidate-v1 \
  --baseline-model assets/ocr/korean-rec.onnx \
  --baseline-dictionary assets/ocr/korean-dict.txt \
  --policy-path ../../../ldb-ocr-data/evaluation-policy.json \
  --output ../../../ldb-ocr-data/evaluation-v1
```

후보는 `model.onnx`·`dict.txt`·Paddle 추론 모델·출처 메타데이터입니다. `policy.example.json`은 기준 파일의 형식 예시이며 운영 목표가 아니므로 별도 기준을 정합니다. 평가에는 학습에 쓰지 않은 입력과 실제 게임 test 최소 수, 문자·프로필별 커버리지가 필요합니다.

전체·프로필·문자군별 정확도, 문자 오류율, 기존 모델 대비 회귀, CPU 지연을 확인합니다. 같은 입력 tensor의 Paddle/ONNX 출력은 `rtol=1e-4`, `atol=1e-5`와 최종 문자열 일치로 비교합니다. 이 오차는 플랫폼 전체 동등성의 증명이 아닙니다. 개별 닉네임·이미지·예측은 보고서에 남기지 않고 집계만 기록합니다.

평가 종료 코드는 0(지정 CPU 기준 통과), 2(기준 미달), 1(실행/입력 오류)입니다. **0도 배포 승인이 아닙니다.** `deployment_approved`는 항상 `false`이며 배포를 활성화하는 명령은 없습니다.

## 제품 연결 전 남은 범위

Python 평가는 Pillow bilinear·CPU ONNX Runtime을 쓰므로 LDB의 Canvas·WASM과 같다고 가정하지 않습니다. 학습은 높이 48·폭 320, CPU 평가는 동적 폭이며 긴 닉네임도 제품 경로에서 검증해야 합니다. crop 한도는 4096×1024, 평가 확대 너비 한도는 4096입니다. 대형 모델의 external-data ONNX 패키지는 현재 지원·검증 범위 밖입니다.

실제 제품의 crop → Canvas → WASM → 후처리 → 검색에서 정확도와 Stop·취소·늦은 결과 차단·수동 수정을 확인해야 합니다. 현재 `normalizeNickname()`은 한글·ASCII 영문·숫자 밖 문자를 삭제하므로 모델만 바꿔서는 한자·가나·기호가 보존되지 않습니다. 게임·API 계약에 맞춘 후처리, 모델과 문자 목록의 함께 교체·롤백, 라이선스·고지 승계는 후속 제품 작업입니다.

변경별 검증·실패·미실행은 PR #500에 기록합니다. 최초 ZIP의 검증 문서와 체크섬은 초기 커밋에 보존하며 현재 검증의 원본으로 쓰지 않습니다. Code Quality는 Ubuntu/Windows에서 같은 pnpm 명령으로 CPU 도구를 검사하고 GPU 학습이나 Electron을 실행하지 않습니다.

공식 참고: [PaddleOCR 인식 모델](https://www.paddleocr.ai/latest/en/version3.x/module_usage/text_recognition.html), [파인튜닝](https://www.paddleocr.ai/latest/en/version2.x/ppocr/model_train/finetune.html), [Paddle2ONNX](https://github.com/PaddlePaddle/Paddle2ONNX).
