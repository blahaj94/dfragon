import { ActionButton, ExampleSection, SupportingText } from '@ldb/ui'

export function AuthConnectionStatus({
  connectionFailed,
  onReconnect
}: {
  connectionFailed: boolean
  onReconnect: () => void
}): React.JSX.Element {
  return (
    <ExampleSection title="LDB 로그인">
      <SupportingText>
        {connectionFailed
          ? '인증 연결을 확인할 수 없습니다. 연결을 다시 확인해 주세요.'
          : '인증 상태를 확인하고 있습니다.'}
      </SupportingText>
      {connectionFailed && (
        <>
          <ActionButton type="button" onClick={onReconnect}>
            연결 다시 확인
          </ActionButton>
          <SupportingText>
            계속 연결되지 않으면 앱을 다시 실행해 주세요. 로그인 설정이나 안전한 저장소가 준비되지
            않은 앱에서는 로그인을 사용할 수 없습니다.
          </SupportingText>
        </>
      )}
    </ExampleSection>
  )
}
