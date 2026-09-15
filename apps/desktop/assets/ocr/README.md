# Bundled Korean OCR

- Model: official PaddlePaddle `korean_PP-OCRv5_mobile_rec_onnx`, revision `5c6f574b8e2230adf4287b33e736d71b9fabd28e`, Apache-2.0.
- `korean-rec.onnx` is the unmodified `inference.onnx` from that revision (about 13.4 MB).
- `korean-dict.txt` contains the official Korean model's `PostProcess.character_dict` in its original order, one entry per line. The decoder adds a space and the CTC blank.
- `provenance.json` records source URLs and checksums. Model bytes are checked into the repository so builds and installed apps do not fetch a model.
- `prepare-ocr-assets.mjs` verifies these files and copies them with ONNX Runtime Web's installed WASM runtime to `public/ocr`. Licenses and notices are distributed in the same directory.
- Input is a BGR tensor normalized to `[-1, 1]`, height 48, preserving aspect ratio and padded to a width of at least 320. Output uses greedy CTC decoding.

Known game-text recognition limitations are tracked in [Issue #463](https://github.com/blahaj94/ldb/issues/463). The model includes modern Hangul syllables, but inclusion does not guarantee correct recognition of every font or nickname.
