import { makeHandlerInvoker } from '../ipc'
import type { AsyncIPCFunctions } from '../common/types/ipc'
import { parseOcrCollectionResult } from '../common/ocr-collection'

const invokeCollectOcrSample = makeHandlerInvoker('collectOcrSample')

export const collectOcrSample: AsyncIPCFunctions['collectOcrSample'] = async (input) => {
  try {
    const result: unknown = await invokeCollectOcrSample(input)

    return parseOcrCollectionResult(result)
  } catch {
    return { status: 'failed' }
  }
}
