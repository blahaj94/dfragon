import { useCallback, useLayoutEffect } from 'react'
import { useMachine } from '@xstate/react'
import type { AuthApi, AuthSnapshot } from '../../../preload/common/types/auth'
import type { AuthIntent } from '../types/auth'
import { authBridgeMachine } from '../lib/auth-bridge-machine'

type AuthBridge = {
  snapshot: AuthSnapshot | null
  commandPending: boolean
  connectionFailed: boolean
  onIntent: (intent: AuthIntent) => void
  resynchronize: () => void
}

export function useAuthBridge(api: AuthApi): AuthBridge {
  const [state, send] = useMachine(authBridgeMachine, { input: { api } })
  useLayoutEffect(() => {
    send({ type: 'CONNECT', api })
  }, [api, send])

  const onIntent = useCallback(
    (intent: AuthIntent): void => send({ type: 'COMMAND', api, intent }),
    [api, send]
  )
  const resynchronize = useCallback((): void => send({ type: 'RESYNCHRONIZE', api }), [api, send])
  // 새 API의 연결 effect 전 렌더에서도 이전 계정 snapshot을 노출하지 않는다.
  const hasSameSource = state.context.api === api
  return {
    snapshot: hasSameSource ? state.context.snapshot : null,
    commandPending: hasSameSource && state.hasTag('commandPending'),
    connectionFailed: hasSameSource && state.hasTag('connectionFailed'),
    onIntent,
    resynchronize
  }
}
