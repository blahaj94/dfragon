import { createHash } from 'node:crypto'
import { copyFile, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import ocrModel from '../ocr-model.config.mjs'
import { countOcrClasses, validateOcrModel } from './validate-ocr-model.mjs'

const require = createRequire(import.meta.url)
const vendorRoot = fileURLToPath(new URL('../assets/ocr/', import.meta.url))
const appRoot = fileURLToPath(new URL('../', import.meta.url))
const runtimeRoot = dirname(require.resolve('onnxruntime-web'))
export const OCR_ASSETS = [
  'korean-rec.onnx',
  'korean-dict.txt',
  'PaddleOCR-LICENSE.txt',
  'ONNX-Runtime-LICENSE.txt',
  'ONNX-Runtime-ThirdPartyNotices.txt',
  'provenance.json',
  'ort/ort-wasm-simd-threaded.mjs',
  'ort/ort-wasm-simd-threaded.wasm'
]
const defaultDestination = fileURLToPath(new URL('../src/frontend/public/ocr', import.meta.url))

/**
 * 선택한 모델을 검증한 뒤 고정된 runtime 파일명으로 배치한다.
 * @param {string} destination
 * @param {{name: string, modelPath: string, dictionaryPath: string}} selection
 * @returns {Promise<void>}
 */
export async function prepareOcrAssets(destination = defaultDestination, selection = ocrModel) {
  if (
    selection == null ||
    [selection.name, selection.modelPath, selection.dictionaryPath].some(
      (value) => typeof value !== 'string' || value.trim().length === 0
    )
  ) {
    throw new Error('Set name, modelPath and dictionaryPath in ocr-model.config.mjs.')
  }
  const provenance = JSON.parse(await readFile(join(vendorRoot, 'provenance.json'), 'utf8'))
  const vendorBytes = new Map()
  for (const { file, sha256 } of provenance.files) {
    const bytes = await readFile(join(vendorRoot, file))
    if (createHash('sha256').update(bytes).digest('hex') !== sha256) {
      throw new Error('Bundled OCR asset checksum mismatch.')
    }
    vendorBytes.set(file, bytes)
  }
  const modelPath = resolve(appRoot, selection.modelPath)
  const dictionaryPath = resolve(appRoot, selection.dictionaryPath)
  const usesBundledModel = modelPath === join(vendorRoot, 'korean-rec.onnx')
  const usesBundledDictionary = dictionaryPath === join(vendorRoot, 'korean-dict.txt')
  let model
  let dictionary
  try {
    model = usesBundledModel ? vendorBytes.get('korean-rec.onnx') : await readFile(modelPath)
    dictionary = usesBundledDictionary
      ? vendorBytes.get('korean-dict.txt')
      : await readFile(dictionaryPath)
  } catch {
    throw new Error('Could not read the ONNX model or dictionary selected in ocr-model.config.mjs.')
  }
  const classes = countOcrClasses(dictionary)
  await validateOcrModel(model, classes)
  vendorBytes.set('korean-rec.onnx', model)
  vendorBytes.set('korean-dict.txt', dictionary)

  const files = provenance.files.map(({ file }) => {
    const sha256 = createHash('sha256').update(vendorBytes.get(file)).digest('hex')

    return { file, sha256 }
  })
  // 사용자 파일을 선택했을 때 기본 모델의 upstream revision으로 표시하지 않는다.
  const selectedProvenance =
    usesBundledModel && usesBundledDictionary
      ? { ...provenance, model: selection.name, files }
      : { model: selection.name, format: 'onnx', files }
  vendorBytes.set(
    'provenance.json',
    Buffer.from(`${JSON.stringify(selectedProvenance, null, 2)}\n`)
  )

  await rm(destination, { recursive: true, force: true })
  await Promise.all(
    OCR_ASSETS.map(async (target) => {
      const targetPath = join(destination, target)
      await mkdir(dirname(targetPath), { recursive: true })
      if (target.startsWith('ort/')) {
        await copyFile(join(runtimeRoot, target.slice(4)), targetPath)
      } else {
        await writeFile(targetPath, vendorBytes.get(target))
      }
    })
  )
}

const invokedPath = process.argv[1]
if (
  invokedPath != null &&
  invokedPath !== '' &&
  import.meta.url === pathToFileURL(resolve(invokedPath)).href
) {
  await prepareOcrAssets()
}
