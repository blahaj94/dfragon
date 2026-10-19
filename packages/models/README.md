# @dfragon/models

앱 빌드에 넣는 학습 모델 파일을 모아 둔 workspace 패키지입니다. 모델 원본은 별도 저장소에 두고 이 패키지가 submodule로 특정 커밋을 고정합니다. 코드와 build 명령은 없습니다.

| 경로 | 내용 | 원본 | 소비 |
| --- | --- | --- | --- |
| `ocr-finetuned/` | Desktop OCR 파인튜닝 모델 `model.onnx`와 사전 `characters.txt` | [dfragon-ocr-models](https://github.com/blahaj94/dfragon-ocr-models), Apache-2.0 | Desktop `ocr-model.config.mjs` |

## 받기

처음 checkout할 때 한 번 실행합니다. CI의 Desktop job도 고정된 submodule 커밋을 가져옵니다.

```sh
git submodule update --init --recursive packages/models/ocr-finetuned
```

## 쓰기

소비 앱의 `devDependencies`에 `"@dfragon/models": "workspace:*"`를 두고 패키지 이름으로 파일 경로를 찾습니다.

```js
import { fileURLToPath } from 'node:url'

const modelPath = fileURLToPath(import.meta.resolve('@dfragon/models/ocr-finetuned/model.onnx'))
```

`exports`에 적은 파일만 가져올 수 있습니다. 새 모델 파일을 제공하려면 `package.json`의 `exports`에 경로를 추가합니다.

## 갱신

모델 저장소에 파일을 올리는 것만으로 빌드의 모델이 바뀌지는 않습니다. 작업 브랜치에서 submodule을 원하는 커밋으로 옮기고 그 변경을 PR에 넣습니다. Desktop의 모델 선택과 호환성 조건은 [파인튜닝 OCR 모델로 빌드하기](../../apps/desktop/README.md#파인튜닝-ocr-모델로-빌드하기)를 따릅니다.

```sh
git -C packages/models/ocr-finetuned fetch origin
git -C packages/models/ocr-finetuned checkout <모델을-포함한-커밋-SHA>
git add packages/models/ocr-finetuned
```
