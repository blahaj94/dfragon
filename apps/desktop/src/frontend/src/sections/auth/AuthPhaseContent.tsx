import { authProviderLabels } from '../../constants/auth'
import { ActionButton, ExampleSection, SupportingText } from '@ldb/ui'
import type { AuthPresentationProps } from '../../types/auth'
import { SignedInAccount } from '../../components/SignedInAccount'

export function AuthPhaseContent({
  snapshot,
  commandPending = false,
  onIntent
}: AuthPresentationProps): React.JSX.Element {
  const { phase, login } = snapshot
  const isSignedIn = phase === 'signedIn'
  const hasUser = snapshot.user != null
  const canShowAccount = isSignedIn && hasUser
  if (canShowAccount) {
    return (
      <SignedInAccount snapshot={snapshot} commandPending={commandPending} onIntent={onIntent} />
    )
  }

  const isSignedOut = phase === 'signedOut'
  if (isSignedOut) {
    const hasProviders = snapshot.providers.length > 0
    return (
      <ExampleSection title="LDB 로그인">
        <SupportingText>패스키로 가입하거나 로그인하세요.</SupportingText>
        {!hasProviders && <SupportingText>사용 가능한 로그인 방법이 없습니다.</SupportingText>}
        {snapshot.providers.map((provider) => (
          <ActionButton
            key={provider}
            type="button"
            disabled={commandPending}
            onClick={() => onIntent({ type: 'beginLogin', provider })}
          >
            {authProviderLabels[provider]}
          </ActionButton>
        ))}
      </ExampleSection>
    )
  }

  const isStarting = phase === 'startingLogin'
  const isWaiting = phase === 'waitingBrowser'
  const isExchanging = phase === 'exchanging'
  const isLoginPending = isStarting || isWaiting || isExchanging
  const hasLogin = login != null
  const canCancelLogin = isLoginPending && hasLogin
  if (canCancelLogin) {
    const isReturnInvalid = snapshot.notice === 'LOGIN_RETURN_INVALID'
    const expiresAt = login.expiresAt
    const hasExpiry = expiresAt != null
    return (
      <ExampleSection title={isExchanging ? '로그인 처리 중' : '로그인 창에서 계속하기'}>
        <SupportingText>
          {isExchanging
            ? '인증을 마친 로그인 정보를 확인하고 있습니다. 잠시 기다려 주세요.'
            : '로그인 전용 창에서 휴대폰 QR 또는 이 기기의 패스키를 선택해 주세요.'}
        </SupportingText>
        {isWaiting && <SupportingText>로그인 창을 닫으면 이번 로그인이 취소됩니다.</SupportingText>}
        {hasExpiry && (
          <SupportingText>
            로그인 대기 만료: <time dateTime={expiresAt}>{expiresAt}</time>
          </SupportingText>
        )}
        <SupportingText>
          로그인 취소를 누르면 전용 창을 닫고 이번 로그인을 중단합니다.
        </SupportingText>
        <ActionButton type="button" disabled loading>
          로그인 진행 중
        </ActionButton>
        <ActionButton
          type="button"
          disabled={commandPending}
          onClick={() => onIntent({ type: 'cancelLogin', attemptId: login.attemptId })}
        >
          로그인 취소
        </ActionButton>
        {isReturnInvalid && (
          <ActionButton
            type="button"
            disabled={commandPending}
            onClick={() => onIntent({ type: 'cancelLogin', attemptId: login.attemptId })}
          >
            새 로그인
          </ActionButton>
        )}
      </ExampleSection>
    )
  }

  const isRestorePaused = phase === 'restorePaused'
  const isStorageBlocked = phase === 'storageBlocked'
  const canRetry = isRestorePaused || isStorageBlocked
  if (canRetry) {
    return (
      <ExampleSection
        title={isStorageBlocked ? '저장소 확인이 필요합니다' : '계정을 복원하지 못했습니다'}
      >
        <SupportingText>
          {isStorageBlocked
            ? '안전한 저장과 삭제를 확인할 때까지 로그인을 사용할 수 없습니다.'
            : '연결을 확인하고 복원을 다시 시도하거나 이 기기에서 로그아웃하세요.'}
        </SupportingText>
        <ActionButton
          type="button"
          disabled={commandPending}
          onClick={() => onIntent({ type: 'retryAuth' })}
        >
          다시 시도
        </ActionButton>
        {isRestorePaused && (
          <ActionButton
            type="button"
            disabled={commandPending}
            onClick={() => onIntent({ type: 'logout' })}
          >
            이 기기 로그아웃
          </ActionButton>
        )}
      </ExampleSection>
    )
  }

  const isSigningOut = phase === 'signingOut'
  const title = isSigningOut ? '로그아웃 중' : '계정 복원 중'
  return (
    <ExampleSection title={title}>
      <SupportingText>완료될 때까지 잠시 기다려 주세요.</SupportingText>
      <ActionButton type="button" disabled loading>
        {title}
      </ActionButton>
    </ExampleSection>
  )
}
