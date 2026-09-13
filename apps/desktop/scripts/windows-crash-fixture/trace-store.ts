import type { CredentialStore } from '../../src/backend/auth/types'
import type { Observer } from './observer'

// Reports actual product method returns separately from adapter/native returns.
export function traceStore({
  store,
  observer,
  scenario
}: {
  store: CredentialStore
  observer: Observer
  scenario(): string
}): CredentialStore {
  const call = async <T>(
    method: string,
    operation: () => Promise<T>,
    outcome: (result: T) => string
  ): Promise<T> => {
    const cutpoint = `store.${method}`
    const detail = { scenario: scenario() }
    await observer.observe({ cutpoint, phase: 'protocol-start', outcome: 'not-called', detail })
    observer.assertActive()
    const result = await operation()
    await observer.observe({ cutpoint, phase: 'protocol-return', outcome: outcome(result), detail })
    return result
  }
  return {
    inspect: () => call('inspect', store.inspect, (state) => state.status),
    establishTransition: (kind) =>
      call(
        'establishTransition',
        () => store.establishTransition(kind),
        (outcome) => outcome
      ),
    reestablishTransition: (kind) =>
      call(
        'reestablishTransition',
        () => store.reestablishTransition(kind),
        (outcome) => outcome
      ),
    commitCredential: (token) =>
      call(
        'commitCredential',
        () => store.commitCredential(token),
        (outcome) => outcome
      ),
    clearCredential: () => call('clearCredential', store.clearCredential, (outcome) => outcome),
    removeTransition: () => call('removeTransition', store.removeTransition, (outcome) => outcome)
  }
}
