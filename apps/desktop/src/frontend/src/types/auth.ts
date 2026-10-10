type AuthProvider = 'passkey'

export type AuthIntent =
  | { type: 'beginLogin'; provider: AuthProvider }
  | { type: 'cancelLogin'; attemptId: string }
  | { type: 'retryAuth' }
