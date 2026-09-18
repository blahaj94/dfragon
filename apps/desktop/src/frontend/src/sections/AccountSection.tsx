import { useState } from 'react'
import {
  ActionButton,
  DialogAction,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogRoot,
  DialogTrigger,
  ProgressCircle
} from '@ldb/ui'
import type { AuthApi } from '../../../preload/common/types/auth'
import { AuthConnectionStatus } from '../components/AuthConnectionStatus'
import { useAuthBridge } from '../hooks/useAuthBridge'
import { AuthPresentation } from './AuthPresentation'

export function AccountSection({ api }: { api: AuthApi }): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const { snapshot, presentationEpoch, commandPending, connectionFailed, onIntent, resynchronize } =
    useAuthBridge(api)
  const label = snapshot?.phase === 'signedIn' ? '내 계정' : '로그인'
  const inProgress =
    commandPending ||
    (snapshot == null && !connectionFailed) ||
    snapshot?.phase === 'restoring' ||
    snapshot?.phase === 'startingLogin' ||
    snapshot?.phase === 'waitingBrowser' ||
    snapshot?.phase === 'exchanging' ||
    snapshot?.phase === 'signingOut'
  const canBeginLogin = snapshot?.phase === 'signedOut' && snapshot.providers.includes('passkey')

  return (
    <DialogRoot open={open && !canBeginLogin} onOpenChange={setOpen}>
      {canBeginLogin ? (
        <ActionButton
          size="small"
          variant="ghost"
          disabled={commandPending}
          aria-busy={inProgress}
          onClick={() => {
            setOpen(false)
            onIntent({ type: 'beginLogin', provider: 'passkey' })
          }}
        >
          {inProgress && <ProgressCircle size="24" aria-hidden="true" />}
          {label}
        </ActionButton>
      ) : (
        <DialogTrigger asChild>
          <ActionButton size="small" variant="ghost" aria-busy={inProgress}>
            {inProgress && <ProgressCircle size="24" aria-hidden="true" />}
            {label}
          </ActionButton>
        </DialogTrigger>
      )}
      <DialogContent title="LDB 계정">
        <DialogBody>
          <div role="status">
            {snapshot != null ? (
              <AuthPresentation
                key={`${snapshot.runId}:${presentationEpoch}`}
                snapshot={snapshot}
                commandPending={commandPending}
                onIntent={onIntent}
              />
            ) : (
              <AuthConnectionStatus
                connectionFailed={connectionFailed}
                onReconnect={resynchronize}
              />
            )}
          </div>
        </DialogBody>
        <DialogFooter>
          <DialogAction variant="neutralOutline">카드 화면으로</DialogAction>
        </DialogFooter>
      </DialogContent>
    </DialogRoot>
  )
}
