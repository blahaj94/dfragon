# Bundled Korean OCR

- Model: official PaddlePaddle `korean_PP-OCRv5_mobile_rec_onnx`, revision `5c6f574b8e2230adf4287b33e736d71b9fabd28e`, Apache-2.0.
- `korean-rec.onnx` is the unmodified `inference.onnx` from that revision (about 13.4 MB).
- `korean-dict.txt` contains the official Korean model's `PostProcess.character_dict` in its original order, one entry per line. The decoder adds a space and the CTC blank.
- `provenance.json` records source URLs and checksums. Model bytes are checked into the repository so builds and installed apps do not fetch a model.
- `prepare-ocr-assets.mjs` verifies these files and copies them with ONNX Runtime Web's installed WASM runtime to `public/ocr`. Licenses and notices are distributed in the same directory.
- The app applies grayscale conversion and inverted Otsu thresholding before resizing to height 48 and width `min(320, ceil(48 * sourceWidth / sourceHeight))`. It normalizes BGR to `[-1, 1]` and zero-pads to a fixed `[1, 3, 48, 320]` tensor. No extra nickname crop or Gaussian blur is applied.
- Output must contain finite softmax probabilities in `[0, 1]`, with each timestep summing to 1 within 0.001. The decoder corrects only that small sum error. It searches up to 32 CTC prefixes using the top 16 nonblank labels per timestep, then rescores every surviving string by summing all its CTC alignment probabilities. It returns at most five candidates in final score order. Candidate discovery remains approximate.
- Each candidate's `modelScore` is 100 times its CTC sequence probability, not measured accuracy or a percentage normalized across the returned candidates. `decodeCtc` returns the first candidate's nickname string. The worker keeps its `{ text, confidence }` response shape and passes that candidate's `modelScore` through `confidence`.

Known game-text recognition limitations are tracked in [Issue #463](https://github.com/blahaj94/ldb/issues/463). The model includes modern Hangul syllables, but inclusion does not guarantee correct recognition of every font or nickname.
