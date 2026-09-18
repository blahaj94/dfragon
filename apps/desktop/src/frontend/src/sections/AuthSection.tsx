import { ActionButton, ExampleSection, SupportingText } from '@ldb/ui'
import type { AuthApi } from '../../../preload/common/types/auth'
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
        <ExampleSection title="LDB 로그인">
          <SupportingText>
            {connectionFailed
              ? '인증 연결을 확인할 수 없습니다. 연결을 다시 확인해 주세요.'
              : '인증 상태를 확인하고 있습니다.'}
          </SupportingText>
          {connectionFailed && (
            <>
              <ActionButton type="button" onClick={resynchronize}>
                연결 다시 확인
              </ActionButton>
              <SupportingText>
                계속 연결되지 않으면 앱을 다시 실행해 주세요. 로그인 설정이나 안전한 저장소가
                준비되지 않은 앱에서는 로그인을 사용할 수 없습니다.
              </SupportingText>
            </>
          )}
        </ExampleSection>
      )}
    </>
  )
}
