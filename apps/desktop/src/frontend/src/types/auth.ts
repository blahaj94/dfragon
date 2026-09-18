type AuthProvider = 'passkey'

export type AuthIntent = { type: 'beginLogin'; provider: AuthProvider } | { type: 'retryAuth' }
