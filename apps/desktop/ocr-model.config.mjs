// 경로는 apps/desktop 기준이다. 파인튜닝 모델과 사전을 함께 바꾼 뒤 다시 빌드한다.
// 사전은 한 줄에 한 문자이며 CTC blank와 마지막 공백 클래스는 포함하지 않는다.
export default {
  name: 'korean_PP-OCRv5_mobile_rec',
  modelPath: 'assets/ocr/korean-rec.onnx',
  dictionaryPath: 'assets/ocr/korean-dict.txt'
}
