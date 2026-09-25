import type { AuthCoordinator } from '../auth/types'

type OcrUploadLifecycle = {
  signal: AbortSignal
  isCurrent(): boolean
  cleanup(): void
}

/** Binds one upload to its capture, signed-in account and total request deadline. */
export function createOcrUploadLifecycle({
  auth,
  generation,
  captureSignal
}: {
  auth: Pick<AuthCoordinator, 'captureGeneration' | 'subscribe'>
  generation: number
  captureSignal: AbortSignal
}): OcrUploadLifecycle {
  const controller = new AbortController()
  const abort = (): void => controller.abort()
  const unsubscribe = auth.subscribe(() => {
    if (auth.captureGeneration() !== generation) {
      abort()
    }
  })
  captureSignal.addEventListener('abort', abort, { once: true })
  const deadline = setTimeout(abort, 15_000)
  if (captureSignal.aborted) {
    abort()
  }

  return {
    signal: controller.signal,
    isCurrent: (): boolean => auth.captureGeneration() === generation && !controller.signal.aborted,
    cleanup: (): void => {
      clearTimeout(deadline)
      captureSignal.removeEventListener('abort', abort)
      unsubscribe()
    }
  }
}
