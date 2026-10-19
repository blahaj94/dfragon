import type { AuthApi, AuthSnapshot } from '../../../../preload/common/types/auth'

// 미리보기의 설정 대화상자에 두는 합성 로그인. 실제 인증 없이 로그인 전, 진행 중(취소)만 오간다.
export function createPreviewAuthApi(): AuthApi {
  let snapshot: AuthSnapshot = {
    runId: 'preview-run',
    revision: 1,
    phase: 'signedOut',
    providers: ['passkey'],
    login: null,
    user: null,
    entry: null,
    notice: null
  }
  const listeners = new Set<(snapshot: AuthSnapshot) => void>()
  const publish = (change: Partial<AuthSnapshot>): AuthSnapshot => {
    snapshot = { ...snapshot, ...change, revision: snapshot.revision + 1 }
    listeners.forEach((listener) => listener(snapshot))

    return snapshot
  }

  return {
    getAuthState: async () => snapshot,
    onAuthStateChanged: (listener) => {
      listeners.add(listener)

      return () => listeners.delete(listener)
    },
    beginLogin: async () => {
      const waiting = publish({
        phase: 'waitingBrowser',
        login: { attemptId: 'preview-attempt', provider: 'passkey', expiresAt: null }
      })

      return { ok: true, snapshot: waiting }
    },
    cancelLogin: async () => {
      const signedOut = publish({ phase: 'signedOut', login: null })

      return { ok: true, snapshot: signedOut }
    },
    retryAuth: async () => ({ ok: true, snapshot }),
    logout: async () => ({ ok: true, snapshot }),
    managePasskeys: async () => ({ ok: true, snapshot })
  }
}
