import { useState } from 'react'
import { ActionButton, ExampleSection, SupportingText } from '@ldb/ui'
import type { AuthPresentationProps } from './types'

export function SignedInAccount({
  snapshot,
  commandPending = false,
  onIntent
}: AuthPresentationProps): React.JSX.Element {
  const [welcomeDismissed, setWelcomeDismissed] = useState(false)
  const isWelcomeEntry = snapshot.entry === 'welcome'
  const shouldShowWelcome = isWelcomeEntry && !welcomeDismissed

  return (
    <ExampleSection title={shouldShowWelcome ? 'LDB에 오신 것을 환영합니다' : '내 계정'}>
      <SupportingText>{snapshot.user?.nickname}</SupportingText>
      <ActionButton
        type="button"
        disabled={commandPending}
        onClick={() => onIntent({ type: 'managePasskeys' })}
      >
        패스키 관리
      </ActionButton>
      {shouldShowWelcome && (
        <>
          <SupportingText>
            로그인을 완료했습니다. 화면 캡처는 로그인 여부와 관계없이 사용할 수 있습니다.
          </SupportingText>
          <ActionButton
            type="button"
            disabled={commandPending}
            onClick={() => setWelcomeDismissed(true)}
          >
            시작하기
          </ActionButton>
        </>
      )}
      <ActionButton
        type="button"
        disabled={commandPending}
        onClick={() => onIntent({ type: 'logout' })}
      >
        이 기기 로그아웃
      </ActionButton>
    </ExampleSection>
  )
}
