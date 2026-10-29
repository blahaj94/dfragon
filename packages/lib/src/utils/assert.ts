export class AssertionError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AssertionError'
  }
}

export type AssertionFailure = string | Error | (() => Error)

export function assert(
  condition: unknown,
  failure: AssertionFailure = 'Assertion failed'
): asserts condition {
  if (condition) {
    return
  }

  if (typeof failure === 'string') {
    throw new AssertionError(failure)
  }

  throw failure instanceof Error ? failure : failure()
}
