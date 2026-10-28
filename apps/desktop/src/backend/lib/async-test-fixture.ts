export type Deferred<T> = Readonly<{
  promise: Promise<T>
  resolve: (value: T) => void
  reject: (reason: unknown) => void
}>

export function deferred<T>(): Deferred<T> {
  let resolvePromise!: (value: T) => void
  let rejectPromise!: (reason: unknown) => void
  const promise = new Promise<T>((resolve, reject) => {
    resolvePromise = resolve
    rejectPromise = reject
  })

  return { promise, resolve: resolvePromise, reject: rejectPromise }
}
