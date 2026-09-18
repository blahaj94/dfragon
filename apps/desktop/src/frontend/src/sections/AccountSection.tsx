import { useState } from 'react'
import {
  ActionButton,
  DialogAction,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogRoot,
  DialogTrigger,
  SupportingText
} from '@ldb/ui'
import type { AuthApi, AuthSnapshot } from '../../../preload/common/types/auth'
import { AuthConnectionStatus } from '../components/AuthConnectionStatus'
import { authNotices, authPhaseLabels } from '../constants/auth'
import { useAuthBridge } from '../hooks/useAuthBridge'
import { AuthPresentation } from './AuthPresentation'

function getAccountButtonLabel({
  connectionFailed,
  snapshot
}: {
  connectionFailed: boolean
  snapshot: AuthSnapshot | null
}): string {
  if (connectionFailed) {
    return '로그인 연결 확인'
  }
  if (snapshot == null) {
    return '계정 확인 중'
  }
  return authPhaseLabels[snapshot.phase]
}

export function AccountSection({ api }: { api: AuthApi }): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const { snapshot, presentationEpoch, commandPending, connectionFailed, onIntent, resynchronize } =
    useAuthBridge(api)
  const label = getAccountButtonLabel({ connectionFailed, snapshot })
  const canBeginLogin = snapshot?.phase === 'signedOut' && snapshot.providers.includes('passkey')

  return (
    <DialogRoot open={open && !canBeginLogin} onOpenChange={setOpen}>
      {canBeginLogin ? (
        <>
          <ActionButton
            size="small"
            variant="ghost"
            disabled={commandPending}
            onClick={() => {
              setOpen(false)
              onIntent({ type: 'beginLogin', provider: 'passkey' })
            }}
          >
            {label}
          </ActionButton>
          {snapshot.notice != null && (
            <div role="status">
              <SupportingText>{authNotices[snapshot.notice]}</SupportingText>
            </div>
          )}
        </>
      ) : (
        <DialogTrigger asChild>
          <ActionButton size="small" variant="ghost">
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
