import { fileURLToPath } from 'node:url'

// 사전은 한 줄에 한 문자이며 CTC blank와 마지막 공백 클래스는 포함하지 않는다.
export const bundledOcrModel = {
  name: 'korean_PP-OCRv5_mobile_rec',
  modelPath: 'assets/ocr/korean-rec.onnx',
  dictionaryPath: 'assets/ocr/korean-dict.txt'
}

export const fineTunedOcrModel = {
  name: 'dfragon-finetuned',
  modelPath: fileURLToPath(import.meta.resolve('@dfragon/models/ocr-finetuned/model.onnx')),
  dictionaryPath: fileURLToPath(import.meta.resolve('@dfragon/models/ocr-finetuned/characters.txt'))
}

export default fineTunedOcrModel
