import type { Response } from 'express'

/** 연결이 끊기면 작업을 취소하고 성공, 실패와 관계없이 연결 리스너를 정리한다. */
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
