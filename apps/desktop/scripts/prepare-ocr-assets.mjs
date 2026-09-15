import { createHash } from 'node:crypto'
import { copyFile, mkdir, readFile, rm } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const require = createRequire(import.meta.url)
const vendorRoot = fileURLToPath(new URL('../assets/ocr/', import.meta.url))
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

/** @param {string} destination @returns {Promise<void>} */
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- JSDoc carries the JavaScript return type.
export async function prepareOcrAssets(destination = defaultDestination) {
  const provenance = JSON.parse(await readFile(join(vendorRoot, 'provenance.json'), 'utf8'))
  for (const { file, sha256 } of provenance.files) {
    const bytes = await readFile(join(vendorRoot, file))
    if (createHash('sha256').update(bytes).digest('hex') !== sha256) {
      throw new Error('Bundled OCR asset checksum mismatch.')
    }
  }
  await rm(destination, { recursive: true, force: true })
  await Promise.all(
    OCR_ASSETS.map(async (target) => {
      const source = target.startsWith('ort/')
        ? join(runtimeRoot, target.slice(4))
        : join(vendorRoot, target)
      const targetPath = join(destination, target)
      await mkdir(dirname(targetPath), { recursive: true })
      await copyFile(source, targetPath)
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
