import { env, InferenceSession, Tensor } from 'onnxruntime-web/wasm'

const OCR_DICTIONARY_CARRIAGE_RETURN_PATTERN = /\r/g
const OCR_DICTIONARY_TERMINATOR_PATTERN = /\n$/
const OCR_LABEL_WHITESPACE_PATTERN = /\s/u

/**
 * 현재 worker의 사전 순서와 암묵적인 blank, 공백 클래스를 확인한다.
 * @param {Uint8Array} dictionary
 * @returns {number}
 */
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- JSDoc carries the JavaScript return type.
export function countOcrClasses(dictionary) {
  const text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(dictionary)
  const characters = text
    .replace(OCR_DICTIONARY_CARRIAGE_RETURN_PATTERN, '')
    .replace(OCR_DICTIONARY_TERMINATOR_PATTERN, '')
    .split('\n')
  if (
    characters.some(
      (character) => [...character].length !== 1 || OCR_LABEL_WHITESPACE_PATTERN.test(character)
    ) ||
    new Set(characters).size !== characters.length
  ) {
    throw new Error(
      'OCR dictionary must contain unique characters, one per line, without spaces or a BOM.'
    )
  }

  return characters.length + 2
}

/**
 * 앱과 같은 WASM 엔진에서 고정 48×320 입력과 CTC 출력, 사전 클래스 수를 검사한다.
 * @param {Uint8Array} model
 * @param {number} classes
 * @returns {Promise<void>}
 */
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- JSDoc carries the JavaScript return type.
export async function validateOcrModel(model, classes) {
  env.logLevel = 'fatal'
  env.wasm.numThreads = 1
  env.wasm.proxy = false
  let session
  try {
    session = await InferenceSession.create(model, {
      executionProviders: ['wasm'],
      logSeverityLevel: 4
    })
    if (session.inputNames.length !== 1 || session.outputNames.length === 0) {
      throw new Error('Invalid OCR model inputs or outputs.')
    }
    const tensor = new Tensor('float32', new Float32Array(3 * 48 * 320), [1, 3, 48, 320])
    let outputs
    try {
      outputs = await session.run({ [session.inputNames[0]]: tensor })
      const output = outputs[session.outputNames[0]]
      if (
        output.dims.length !== 3 ||
        output.dims[0] !== 1 ||
        !Number.isSafeInteger(output.dims[1]) ||
        output.dims[1] < 1 ||
        output.dims[2] !== classes ||
        output.type !== 'float32' ||
        output.data.length !== output.dims[1] * classes ||
        !output.data.every(Number.isFinite)
      ) {
        throw new Error('Invalid OCR model output.')
      }
      // 런타임 후보 디코더와 같은 softmax 계약을 빌드 시점에도 확인한다.
      for (let step = 0; step < output.dims[1]; step += 1) {
        let sum = 0
        for (let token = 0; token < classes; token += 1) {
          const probability = output.data[step * classes + token]
          if (probability < 0 || probability > 1) {
            throw new Error('Invalid CTC probabilities.')
          }
          sum += probability
        }
        if (Math.abs(sum - 1) > 1e-3) {
          throw new Error('CTC probabilities must sum to one at each step.')
        }
      }
    } finally {
      tensor.dispose()
      if (outputs != null) {
        for (const output of Object.values(outputs)) {
          output.dispose()
        }
      }
    }
  } catch {
    throw new Error(
      `OCR model must accept float32 [1, 3, 48, 320] and return normalized softmax float32 CTC [1, steps, ${classes}] in ONNX Runtime WASM. Check the model and matching dictionary.`
    )
  } finally {
    await session?.release()
  }
}
