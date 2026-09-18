import type { AuthApi } from '../../../preload/common/types/auth'
import { AuthConnectionStatus } from '../components/AuthConnectionStatus'
import { AuthPresentation } from './AuthPresentation'
import { useAuthBridge } from '../hooks/useAuthBridge'

export function AuthSection({ api }: { api: AuthApi }): React.JSX.Element {
  const { snapshot, presentationEpoch, commandPending, connectionFailed, onIntent, resynchronize } =
    useAuthBridge(api)
  return (
    <>
      {snapshot != null ? (
        <AuthPresentation
          key={`${snapshot.runId}:${presentationEpoch}`}
          snapshot={snapshot}
          commandPending={commandPending}
          onIntent={onIntent}
        />
      ) : (
        <AuthConnectionStatus connectionFailed={connectionFailed} onReconnect={resynchronize} />
      )}
    </>
  )
}
