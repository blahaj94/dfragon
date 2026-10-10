import { ActionButton, Typo } from '@dfragon/ui'
import * as stylex from '@stylexjs/stylex'
import type { AuthApi } from '../../../preload/common/types/auth'
import { LoginButtonLabel } from '../components/LoginButtonLabel'
import { RefreshIcon } from '../components/RefreshIcon'
import { useAuthBridge } from '../hooks/useAuthBridge'
import { windowChromeStyles } from '../constants/window-chrome.style'

export function LoginSection({ api }: { api: AuthApi }): React.JSX.Element | null {
  const { snapshot, commandPending, connectionFailed, onIntent, cancelLogin, resynchronize } =
    useAuthBridge(api)
  const loginInProgress =
    snapshot?.phase === 'startingLogin' ||
    snapshot?.phase === 'waitingBrowser' ||
    snapshot?.phase === 'exchanging'
  const inProgress =
    commandPending ||
    (snapshot == null && !connectionFailed) ||
    snapshot?.phase === 'restoring' ||
    loginInProgress ||
    snapshot?.phase === 'signingOut'
  const canBeginLogin = snapshot?.phase === 'signedOut' && snapshot.providers.includes('passkey')
  const canRetry = snapshot?.phase === 'restorePaused' || snapshot?.phase === 'storageBlocked'

  if (snapshot?.phase === 'signedIn') {
    return null
  }

  return (
    <span {...stylex.props(windowChromeStyles.noDrag)}>
      <ActionButton
        size="medium"
        variant="neutralWeak"
        aria-label={loginInProgress ? '취소' : '로그인'}
        aria-busy={inProgress}
        disabled={
          !loginInProgress && (inProgress || (!canBeginLogin && !canRetry && !connectionFailed))
        }
        onClick={() => {
          if (loginInProgress) {
            cancelLogin()

            return
          }

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
        {loginInProgress ? (
          <>
            <RefreshIcon width={16} height={16} />
            <Typo.txtM as="span" weight={700}>
              취소
            </Typo.txtM>
          </>
        ) : (
          <LoginButtonLabel label="로그인" inProgress={inProgress} />
        )}
      </ActionButton>
    </span>
  )
}
