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
  'ort/ort-wasm-simd-threaded.asyncify.mjs',
  'ort/ort-wasm-simd-threaded.asyncify.wasm'
]
export const OCR_MODEL_NOTICE = 'OCR-Model-NOTICE.txt'
const defaultDestination = fileURLToPath(new URL('../src/frontend/public/ocr', import.meta.url))

/**
 * @param {string} destination
 * @param {{name: string, modelPath: string, dictionaryPath: string, noticePath?: string}} selection
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
  const notice = await readModelNotice(selection.noticePath)
  const classes = countOcrClasses(dictionary)
  await validateOcrModel(model, classes)
  vendorBytes.set('korean-rec.onnx', model)
  vendorBytes.set('korean-dict.txt', dictionary)

  const files = provenance.files.map(({ file }) => {
    const sha256 = createHash('sha256').update(vendorBytes.get(file)).digest('hex')

    return { file, sha256 }
  })
  if (notice !== undefined) {
    vendorBytes.set(OCR_MODEL_NOTICE, notice)
    files.push({
      file: OCR_MODEL_NOTICE,
      sha256: createHash('sha256').update(notice).digest('hex')
    })
  }
  const selectedProvenance =
    usesBundledModel && usesBundledDictionary
      ? { ...provenance, model: selection.name, files }
      : { model: selection.name, format: 'onnx', files }
  vendorBytes.set(
    'provenance.json',
    Buffer.from(`${JSON.stringify(selectedProvenance, null, 2)}\n`)
  )

  const targets = notice === undefined ? OCR_ASSETS : [...OCR_ASSETS, OCR_MODEL_NOTICE]
  await rm(destination, { recursive: true, force: true })
  await Promise.all(
    targets.map(async (target) => {
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

/**
 * @param {string | undefined} noticePath
 * @returns {Promise<Buffer | undefined>}
 */
async function readModelNotice(noticePath) {
  if (noticePath === undefined) {
    return undefined
  }

  try {
    return await readFile(resolve(appRoot, noticePath))
  } catch {
    throw new Error('Could not read the OCR model notice selected in ocr-model.config.mjs.')
  }
}

const invokedPath = process.argv[1]
if (
  invokedPath != null &&
  invokedPath !== '' &&
  import.meta.url === pathToFileURL(resolve(invokedPath)).href
) {
  await prepareOcrAssets()
}
