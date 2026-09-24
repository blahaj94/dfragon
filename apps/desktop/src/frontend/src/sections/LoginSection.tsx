import * as stylex from '@stylexjs/stylex'
import { ActionButton } from '@dfragon/ui'
import type { AuthApi } from '../../../preload/common/types/auth'
import { LoginButtonLabel } from '../components/LoginButtonLabel'
import { useAuthBridge } from '../hooks/useAuthBridge'
import { styles } from './LoginSection.style'

export function LoginSection({ api }: { api: AuthApi }): React.JSX.Element | null {
  const { snapshot, commandPending, connectionFailed, onIntent, resynchronize } = useAuthBridge(api)
  const inProgress =
    commandPending ||
    (snapshot == null && !connectionFailed) ||
    snapshot?.phase === 'restoring' ||
    snapshot?.phase === 'startingLogin' ||
    snapshot?.phase === 'waitingBrowser' ||
    snapshot?.phase === 'exchanging' ||
    snapshot?.phase === 'signingOut'
  const canBeginLogin = snapshot?.phase === 'signedOut' && snapshot.providers.includes('passkey')
  const canRetry = snapshot?.phase === 'restorePaused' || snapshot?.phase === 'storageBlocked'

  if (snapshot?.phase === 'signedIn') {
    return null
  }

  return (
    <ActionButton
      {...stylex.props(styles.button)}
      size="small"
      variant="ghost"
      aria-label="로그인"
      aria-busy={inProgress}
      disabled={inProgress || (!canBeginLogin && !canRetry && !connectionFailed)}
      onClick={() => {
        if (inProgress) {
          return
        }
        if (connectionFailed) {
          resynchronize()
        } else if (canRetry) {
          onIntent({ type: 'retryAuth' })
        } else if (canBeginLogin) {
          onIntent({ type: 'beginLogin', provider: 'passkey' })
        }
      }}
    >
      <LoginButtonLabel label="로그인" inProgress={inProgress} />
    </ActionButton>
  )
}
