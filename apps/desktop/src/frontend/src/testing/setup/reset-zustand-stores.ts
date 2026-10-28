import { afterEach, vi } from 'vitest'
import type * as Zustand from 'zustand'

// zustand store는 모듈 싱글턴이라 같은 파일의 테스트끼리 상태가 이어진다. 테스트마다 초기 상태로 되돌린다.
const { storeResets } = vi.hoisted(() => ({ storeResets: new Set<() => void>() }))

vi.mock('zustand', async (importOriginal) => {
  const zustand = await importOriginal<typeof Zustand>()
  const createWithReset = <T>(stateCreator: Zustand.StateCreator<T>) => {
    const store = zustand.create(stateCreator)
    const initialState = store.getInitialState()
    storeResets.add(() => store.setState(initialState, true))

    return store
  }
  const create = (<T>(stateCreator?: Zustand.StateCreator<T>) => {
    if (stateCreator == null) {
      return createWithReset
    }

    return createWithReset(stateCreator)
  }) as typeof zustand.create

  return { ...zustand, create }
})

afterEach(() => {
  for (const reset of storeResets) {
    reset()
  }
})
