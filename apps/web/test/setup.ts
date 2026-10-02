import { afterAll } from 'vitest'

const previousGlobals = ['IS_REACT_ACT_ENVIRONMENT', 'ResizeObserver'].map((name) => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, name)

  return { name, descriptor }
})

// UI setup의 layout 관측 대체가 설치되기 전에 원래 글로벌을 보존한다.
await import('../../../packages/ui/test/setup')
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })

afterAll(() => {
  for (const { name, descriptor } of previousGlobals) {
    if (descriptor == null) {
      Reflect.deleteProperty(globalThis, name)
    } else {
      Object.defineProperty(globalThis, name, descriptor)
    }
  }
})
