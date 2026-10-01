import type { AuthAuthorization, AuthCoordinator } from '../auth/types'
import type { createOcrUploadLifecycle } from './ocr-upload-lifecycle'

/** 401 자격 증명만 한 번 복구하며 호출자의 요청·본문·응답 처리 계약을 유지한다. */
export async function requestWithOcrAuthorizationRecovery({
  auth,
  generation,
  authorization,
  lifecycle,
  send
}: {
  auth: Pick<AuthCoordinator, 'recoverAuthorization'>
  generation: number
  authorization: AuthAuthorization
  lifecycle: Pick<ReturnType<typeof createOcrUploadLifecycle>, 'signal' | 'isCurrent'>
  send: (accessToken: string, signal: AbortSignal) => Promise<Response>
}): Promise<Response | null> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    if (
      !lifecycle.isCurrent() ||
      authorization.status !== 'available' ||
      authorization.generation !== generation
    ) {
      return null
    }
    const response = await send(authorization.accessToken, lifecycle.signal)
    if (response.status !== 401) {
      return response
    }
    await response.body?.cancel()
    authorization = await auth.recoverAuthorization(
      {
        generation,
        accessGeneration: authorization.accessGeneration,
        finalRejection: attempt === 1
      },
      lifecycle.signal
    )
  }

  return null
}
