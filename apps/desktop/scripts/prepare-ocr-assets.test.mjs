import { createHash } from 'node:crypto'
import { access, copyFile, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { OCR_ASSETS, OCR_MODEL_NOTICE, prepareOcrAssets } from './prepare-ocr-assets.mjs'
import { countOcrClasses } from './validate-ocr-model.mjs'

const modelPath = fileURLToPath(new URL('../assets/ocr/korean-rec.onnx', import.meta.url))
const dictionaryPath = fileURLToPath(new URL('../assets/ocr/korean-dict.txt', import.meta.url))

describe('OCR public asset 준비', () => {
  it('기본 한국어 모델, 문자 목록, WASM, 라이선스와 고정 출처를 보존한다', async () => {
    const destination = await mkdtemp(join(tmpdir(), 'dfragon-ocr-assets-'))

    try {
      await prepareOcrAssets(destination, {
        name: 'korean_PP-OCRv5_mobile_rec',
        modelPath,
        dictionaryPath
      })

      for (const target of OCR_ASSETS) {
        const assetPath = join(destination, target)
        await access(assetPath)
        expect((await stat(assetPath)).size).toBeGreaterThan(0)
      }
      const model = await readFile(join(destination, 'korean-rec.onnx'))
      expect(model.equals(await readFile(modelPath))).toBe(true)
      expect(await readFile(join(destination, 'provenance.json'), 'utf8')).toBe(
        await readFile(new URL('../assets/ocr/provenance.json', import.meta.url), 'utf8')
      )
    } finally {
      await rm(destination, { recursive: true, force: true })
    }
  })

  it('별도 경로의 ONNX, 사전, NOTICE를 선택하면 그 파일과 실제 해시를 runtime 경로에 배치한다', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'dfragon-selected-ocr-'))
    const destination = join(directory, 'public')
    const customModel = join(directory, 'finetuned.onnx')
    const customDictionary = join(directory, 'characters.txt')
    const customNotice = join(directory, 'NOTICE')
    const notice = 'Fixture model notice\nModifications: synthetic fine-tuning\n'
    try {
      await copyFile(modelPath, customModel)
      const characters = (await readFile(dictionaryPath, 'utf8')).trimEnd().split('\n')
      ;[characters[0], characters[1]] = [characters[1], characters[0]]
      const dictionary = `${characters.join('\n')}\n`
      await writeFile(customDictionary, dictionary)
      await writeFile(customNotice, notice)

      await prepareOcrAssets(destination, {
        name: 'fixture-finetuned-model',
        modelPath: customModel,
        dictionaryPath: customDictionary,
        noticePath: customNotice
      })

      const model = await readFile(join(destination, 'korean-rec.onnx'))
      expect(model.equals(await readFile(customModel))).toBe(true)
      expect(await readFile(join(destination, 'korean-dict.txt'), 'utf8')).toBe(dictionary)
      expect(await readFile(join(destination, OCR_MODEL_NOTICE), 'utf8')).toBe(notice)
      const provenanceText = await readFile(join(destination, 'provenance.json'), 'utf8')
      const provenance = JSON.parse(provenanceText)
      expect(provenance.model).toBe('fixture-finetuned-model')
      expect(provenance).not.toHaveProperty('revision')
      expect(provenance).not.toHaveProperty('source')
      expect(provenanceText).not.toContain(directory)
      expect(provenance.files.map(({ file }) => file)).toContain(OCR_MODEL_NOTICE)
      for (const { file, sha256 } of provenance.files) {
        const bytes = await readFile(join(destination, file))
        expect(sha256).toBe(createHash('sha256').update(bytes).digest('hex'))
      }
    } finally {
      await rm(directory, { recursive: true, force: true })
    }
  })

  it.each(['missing-model', 'invalid-model', 'mismatched-dictionary', 'missing-notice'])(
    '%s이면 기본 모델로 대체하지 않고 실패하며 기존 산출물을 보존한다',
    async (failure) => {
      const directory = await mkdtemp(join(tmpdir(), 'dfragon-invalid-ocr-'))
      const destination = join(directory, 'public')
      const replacement = join(directory, 'replacement')
      try {
        await writeFile(destination, 'previous assets')
        const selection = { name: 'invalid-fixture', modelPath, dictionaryPath }
        if (failure === 'mismatched-dictionary') {
          await writeFile(replacement, '가\n나\n')
          selection.dictionaryPath = replacement
        } else if (failure === 'missing-notice') {
          selection.noticePath = replacement
        } else {
          selection.modelPath = replacement
          if (failure === 'invalid-model') {
            await writeFile(replacement, 'not an ONNX model')
          }
        }

        await expect(prepareOcrAssets(destination, selection)).rejects.toThrow(/OCR|ONNX/)
        expect(await readFile(destination, 'utf8')).toBe('previous assets')
      } finally {
        await rm(directory, { recursive: true, force: true })
      }
    }
  )

  it('문자 순서를 유지하며 CRLF와 마지막 개행을 처리하고 blank, 공백 두 클래스를 더한다', () => {
    expect(countOcrClasses(Buffer.from('가\r\n나\r\n'))).toBe(4)
    expect(countOcrClasses(Buffer.from('가\n나'))).toBe(4)
  })

  it.each(['', '가\n가\n', '가\n\n', '가\n \n', '\uFEFF가\n', '가나\n'])(
    '잘못된 사전 형식 %j를 거절한다',
    (dictionary) => {
      expect(() => countOcrClasses(Buffer.from(dictionary))).toThrow(/dictionary/)
    }
  )
})
