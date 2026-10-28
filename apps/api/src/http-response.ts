import type { Response } from 'express'

export async function respondWithCancellation(
  response: Response,
  operation: (signal: AbortSignal) => Promise<unknown>
): Promise<void> {
  const controller = new AbortController()
  const cancelDisconnectedRequest = (): void => {
    if (!response.writableFinished) {
      controller.abort()
    }
  }
  response.once('close', cancelDisconnectedRequest)
  try {
    const result = await operation(controller.signal)
    if (!response.destroyed) {
      response.status(200).json(result)
    }
  } finally {
    response.removeListener('close', cancelDisconnectedRequest)
  }
}
