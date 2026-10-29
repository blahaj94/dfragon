import type { Response } from 'express'

export async function respondWithCancellation(
  response: Response,
  operation: (signal: AbortSignal) => Promise<unknown>
): Promise<void> {
  await sendWithCancellation(response, operation, (result) => {
    response.status(200).json(result)
  })
}

export async function sendWithCancellation<T>(
  response: Response,
  operation: (signal: AbortSignal) => Promise<T>,
  send: (result: T) => void
): Promise<void> {
  // 이미 닫힌 socket의 close event는 아래 listener를 등록하기 전에 지나갔을 수 있어 취소 신호로는 막지 못한다.
  if (response.req.socket.destroyed) {
    return
  }
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
      send(result)
    }
  } finally {
    response.removeListener('close', cancelDisconnectedRequest)
  }
}
