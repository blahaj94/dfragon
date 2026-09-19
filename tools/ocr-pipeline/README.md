# LDB OCR 모델 제작 파이프라인

LDB에 배포할 OCR 모델을 만들기 위한 **로컬 개발 도구의 구현 초안**입니다. 노트북 실습이나 일부 한글에만 제한한 샘플 트레이너가 아닙니다. 운영에서 지원할 문자 전체와 렌더링 프로필을 입력받아 데이터 준비, 공식 PaddleOCR 학습 실행, ONNX 변환, 기존 모델 대비 평가를 수행하는 코드입니다.

**현재 상태:** 데이터·설정·평가 로직과 외부 프로그램 연결을 테스트했습니다. 실제 PaddleOCR 학습, 실제 ONNX 모델 실행·변환, 실제 게임 정확도와 Electron 통합은 이 환경에서 검증하지 못했습니다. 학습된 모델·폰트·게임 캡처는 포함하지 않습니다. GitHub 저장소나 LDB의 모델을 수정하는 명령도 없습니다.

## 구현 범위

| 명령 | 동작 |
| --- | --- |
| `prepare` | 전체 목표 문자와 프로필별 학습 커버리지, 문자·그룹·픽셀 중복, 이미지·경로·정답을 검사하고 데이터 사본과 해시 목록을 만듭니다. |
| `train` | 지정한 PaddleOCR 커밋과 가중치 해시를 확인하고 공식 한국어 모델 설정에서 전체 문자 학습 설정을 생성하여 실제 `tools/train.py`를 실행합니다. |
| `export` | 완료된 실행의 가중치와 문자 목록을 확인하고 공식 export 및 Paddle2ONNX 프로그램을 호출합니다. 결과는 미검증 후보입니다. |
| `evaluate` | 보류한 test 데이터에서 후보와 기존 모델의 완전 일치율·문자 오류율·CPU 지연, 프로필·문자군별 회귀 및 Paddle/ONNX 출력 차이를 검사합니다. |

문자는 삭제·소문자화·NFKC 치환하지 않습니다. `A`와 `Ａ`, `1`과 `①`, 한자와 가나·기호를 서로 다른 코드 포인트로 취급합니다. NFC는 **학습/시험 간 같은 문자열의 누출 검사에만** 사용하며 정답 자체는 바꾸지 않습니다.

기존 문자 목록의 순서는 유지하고 새 문자를 뒤에 추가합니다. 공간 문자는 LDB의 현재 디코더와 같이 별도로 마지막에 추가하고 CTC blank는 0번으로 둡니다. 새 문자가 있으면 `--allow-expanded-head`를 명시해야 학습을 실행합니다. 이는 기존 분류층 일부가 크기 불일치로 다시 초기화될 수 있음을 받아들이는 옵션이며, 기존 출력 가중치 행을 직접 이식하는 기능은 아닙니다.

## 기준 소스

- LDB 확인 기준: `a18fc4b8003ae55957ab163f9617ce730c135631`.
- PaddleOCR 고정 기준: `9d5e7663a3d7035456538435fae82a1762cd3529` (`release/3.5`에서 확인).
- 설정: `configs/rec/PP-OCRv5/multi_language/korean_PP-OCRv5_mobile_rec.yml`.
- 기본 문자 목록: `ppocr/utils/dict/ppocrv5_korean_dict.txt`.

PaddleOCR의 최신 버전으로 자동 이동하지 않습니다. 버전을 바꾸려면 고정값과 API를 함께 검토하고 실제 학습·내보내기 검증을 다시 수행해야 합니다. 고정된 소스 및 해시 기록은 재현의 입력을 남기는 것이지, GPU 연산의 비트 단위 결정성이나 배포 인증을 보장하지 않습니다.

## 필요한 입력

운영에서 지원하기로 확인한 `allowed-characters.txt`, 정답이 검증된 닉네임 crop과 `manifest.jsonl`, 공식 한국어 **학습용** `.pdparams`, 기존 모델의 ONNX 및 그 모델과 같은 순서의 문자 목록이 필요합니다.

게임의 실제 허용 문자 목록과 두 폰트의 실제 렌더링 데이터는 이 도구가 추측하거나 수집하지 않습니다. 폰트 폴백·작은 픽셀 렌더링을 재현하는 생성기는 포함하지 않았습니다. 잘못 그려진 글자와 잘못 붙인 정답은 파일 형식 검사로 판별할 수 없으므로 별도 확인해야 합니다.

`allowed-characters.txt`는 UTF-8, BOM 없이 코드 포인트 한 개씩 한 줄에 적습니다. 최종 서비스 범위 전체를 사용합니다. 범위를 임의로 한글·영문으로 축소하지 않습니다. 실제 허용 문자에 공백이 있으면 ASCII 공백 하나가 들어 있는 줄을 명시합니다. 모델의 기본 사전에는 공간 문자를 중복 추가하지 않습니다.

데이터는 다음 JSON Lines 구조입니다. 아래 문자열은 형식 설명용으로 만든 것으로 실제 닉네임이나 학습 데이터가 아닙니다.

```json
{"id":"sample-0001","image":"crops/0001.png","text":"가Aね月※1","split":"train","group":"render-0001","profile":"dotum-ui100","source":"synthetic"}
```

`split`은 `train`, `val`, `test`입니다. `profile`은 실제 지원할 렌더링 조건 식별자입니다. `group`은 같은 캡처 세션의 연속 프레임 또는 같은 원본의 변형을 묶는 불투명한 식별자입니다. 개인정보나 실제 닉네임을 식별자로 쓰지 않습니다. `source`는 `synthetic` 또는 `real`입니다.

같은 문자열의 두 폰트 버전·색깔 변형은 같은 split에 넣습니다. 같은 crop 픽셀의 중복은 같은 split에서도 거절합니다. 실제 입력을 학습용으로 저장·사용하는 허가를 받은 경우에만 `source=real`과 `--allow-real-data`를 사용합니다. 이 옵션은 허가를 대신하지 않습니다.

## 설치

데이터, 실행 결과, PaddleOCR 소스와 이 패키지를 서로 다른 디렉터리에 둡니다. 아래 명령 예시는 Bash/WSL 계열 셸용입니다. Windows 앱의 배포 환경과 모델 학습 환경은 별개입니다. Windows native GPU 학습은 여기서 검증하지 않았습니다.

```bash
python -m venv .venv
source .venv/bin/activate
python -m pip install -e '.[evaluation,test]'
```

장비·드라이버에 맞는 PaddlePaddle과 Paddle2ONNX는 공식 설치 문서에 따라 같은 가상환경에 설치합니다. 임의의 CUDA 버전을 강제하는 설치 명령은 제공하지 않습니다. 이어서 별도 디렉터리에서:

```bash
git clone https://github.com/PaddlePaddle/PaddleOCR.git ../PaddleOCR
git -C ../PaddleOCR checkout 9d5e7663a3d7035456538435fae82a1762cd3529
python -m pip install -r ../PaddleOCR/requirements.txt
```

PaddleOCR checkout은 깨끗하게 유지합니다. 데이터·사용자 설정·학습 결과를 그 안에 추가하지 않습니다. 프로그램은 실행마다 주요 패키지 버전을 기록합니다. 이 초안에는 실제 GPU에서 검증한 완전한 dependency lock이 없으므로, 운영 학습 환경이 정해지면 성공한 환경을 고정해야 합니다.

## 실행

### 데이터 준비

```bash
python -m ldb_ocr prepare \
  --source ../source-crops \
  --manifest ../manifest.jsonl \
  --base-dictionary ../PaddleOCR/ppocr/utils/dict/ppocrv5_korean_dict.txt \
  --allowed-characters ../allowed-characters.txt \
  --profiles dotum-ui100 nanum-neo-ui50 \
  --min-occurrences 20 \
  --max-text-length 25 \
  --output ../prepared-v1
```

이 명령의 프로필·빈도·길이는 입력 예시이며 던파의 확정 규칙이나 충분한 학습량이 아닙니다. 실제 제품 범위와 데이터에 맞춰 지정합니다. `--max-text-length`는 코드 포인트 기준이며, 두 프로필만으로 실제 폰트 폴백이 모두 설명된다고 가정하지 않습니다.

각 프로필의 학습 데이터에 **목표 문자 모두**가 지정 횟수 이상 있어야 성공합니다. 모든 split이 필요합니다. 실제 입력이 포함되면 명령에 `--allow-real-data`가 추가로 필요합니다. 정답과 PNG 사본을 저장하므로 prepared 디렉터리는 비공개 데이터로 취급합니다.

### 학습

```bash
python -m ldb_ocr train \
  --data ../prepared-v1 \
  --upstream ../PaddleOCR \
  --weights ../weights/korean.pdparams \
  --expected-weights-sha256 "$PRETRAINED_SHA256" \
  --epochs 40 --batch-size 32 --learning-rate 0.00005 \
  --seed 1729 --device cuda \
  --allow-expanded-head \
  --output ../run-v1
```

`PRETRAINED_SHA256`에는 출처를 확인하고 기록한 가중치 SHA-256을 넣습니다. 지금 파일의 해시를 계산하는 것 자체가 배포처 신뢰성을 인증하지는 않습니다. 위 학습 파라미터는 측정된 최적값이 아닙니다. 배치·학습률·에포크는 검증 데이터의 성능으로 선택합니다. test 데이터는 선택에 사용하지 않습니다.

학습은 실제 공식 프로그램을 동기 실행합니다. CPU fallback을 자동 선택하지 않습니다. 오류나 중단 시 실행 상태를 `failed_or_interrupted`로 남기며, 다른 실행을 자동 재개하거나 덮어쓰지 않습니다. 같은 목적의 재실행도 새 output을 지정합니다.

프로그램 stdout에 외부 라이브러리의 원문 로그를 전달하지 않습니다. **PaddleOCR 자체가 private run 디렉터리에 로그·설정을 기록할 수 있습니다.** 그 디렉터리는 민감 데이터로 취급하고 저장소·이슈·공용 로그로 올리지 않습니다. 이 초안은 upstream 내부의 모든 로그 저장을 제거한 것은 아닙니다.

### ONNX 후보 생성

```bash
python -m ldb_ocr export \
  --run ../run-v1 --upstream ../PaddleOCR \
  --output ../candidate-v1
```

후보에 `model.onnx`, `dict.txt`, Paddle 추론 모델, 출처 메타데이터가 들어갑니다. 기존 LDB 자산을 복사하거나 교체하지 않습니다. 배포 모델 라이선스·저작권 고지의 승계는 실제 제품 패키징에서 별도로 확인해야 합니다.

### 기존 모델과 평가

`policy.example.json`의 수치는 **사용자가 결정할 평가 기준의 형식 예시**입니다. 서비스에 적절한 정확도·지연 기준이라고 검증된 값이 아닙니다. 운영 목표를 확정한 파일을 별도로 작성합니다.

```bash
python -m ldb_ocr evaluate \
  --data ../prepared-v1 --candidate ../candidate-v1 \
  --baseline-model ../ldb/apps/desktop/assets/ocr/korean-rec.onnx \
  --baseline-dictionary ../ldb/apps/desktop/assets/ocr/korean-dict.txt \
  --policy-path ../evaluation-policy.json \
  --output ../evaluation-v1
```

별도 test에서 전체·프로필·문자군별 정확도와 기존 모델 대비 회귀를 검사합니다. 실게임 test 최소 수와 목표 문자별·프로필별 test 커버리지도 필요합니다. 실제 데이터를 하나도 평가하지 않은 결과를 운영 검증으로 통과시키지 않습니다.

동일한 입력 tensor로 Paddle 추론 모델과 ONNX 출력의 `rtol=1e-4`, `atol=1e-5` 수치 차이 및 최종 문자열 일치를 검사합니다. 이 허용 오차도 검증 설계상의 선택이며 플랫폼 전체의 동등성 증명이 아닙니다.

결과에는 원본 닉네임·이미지·개별 예측을 기록하지 않고 집계만 저장합니다. 종료 코드 0은 CPU 평가 기준 통과, 2는 기준 미달, 1은 실행/입력 오류입니다. **0도 LDB 배포 승인을 뜻하지 않습니다.**

## LDB 적용 전에 남은 작업

Python 평가의 resize는 Pillow bilinear입니다. LDB의 Canvas resize와 픽셀 단위로 같다고 검증하지 않았습니다. CPU ONNX Runtime과 브라우저 WASM은 실행 환경도 다릅니다. 따라서 결과의 `deployment_approved`는 항상 `false`이며, 이 도구에 그 값을 true로 바꾸는 배포 명령은 없습니다.

실제 제품 연결에서는 LDB의 원래 crop → Canvas 전처리 → WASM 모델 → 후처리 → 검색 경로로 보류한 입력을 다시 검증해야 합니다. Stop·취소·늦은 결과 차단·수동 수정과 모델 파일/문자 목록의 원자적 교체·롤백도 실제 앱에서 확인합니다.

확인한 LDB의 `normalizeNickname()`은 현재 한글·ASCII 영문·숫자 이외를 삭제합니다. 새 모델만 넣어서는 한자·가나·기호가 검색에 보존되지 않습니다. 실제 게임의 허용 문자 규칙과 API 입력 계약을 확인한 뒤 이 처리를 수정해야 하므로, 임의의 정규식 교체 패치는 포함하지 않았습니다.

현재 모델 파일 체크섬은 단일 ONNX 파일 기준입니다. 매우 큰 모델의 external-data ONNX 패키지는 이 초안의 지원·검증 범위가 아닙니다. 학습용 crop 크기는 안전상 4096×1024 이하, 평가용 확대 너비는 4096 이하로 제한합니다. 학습은 공식 높이 48·폭 320 resize를 사용하고 CPU 평가는 동적 폭을 사용하므로, 긴 닉네임의 학습/운영 차이도 제품 평가 대상입니다.

## 검증

```bash
python -m pytest -q
python -m compileall -q ldb_ocr
python -m ldb_ocr --help
```

테스트의 색상 이미지와 가짜 checkpoint/engine은 **도구의 동작을 시험하는 입력**입니다. OCR 정확도나 실제 Paddle/ONNX 작동의 근거가 아닙니다. 실제 실행·미실행 범위는 `VALIDATION.md`에 기록했습니다.

## 참고한 공식 자료

- https://github.com/PaddlePaddle/PaddleOCR/blob/9d5e7663a3d7035456538435fae82a1762cd3529/configs/rec/PP-OCRv5/multi_language/korean_PP-OCRv5_mobile_rec.yml
- https://www.paddleocr.ai/latest/en/version3.x/module_usage/text_recognition.html
- https://www.paddleocr.ai/latest/en/version2.x/ppocr/model_train/finetune.html
- https://github.com/PaddlePaddle/Paddle2ONNX
- https://onnxruntime.ai/docs/api/python/api_summary.html
