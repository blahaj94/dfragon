import type { ReactNode } from 'react'
import { ContentStack, LayoutBlock } from '@dfragon/ui'
import type { AuthApi } from '../../../../preload/common/types/auth'
import { LoginSection } from '../../sections/LoginSection'

export function LoginPage({ api, home }: { api: AuthApi; home?: ReactNode }): React.JSX.Element {
  return (
    <LayoutBlock header="DFRAGON" footer="DFRAGON Desktop">
      <ContentStack>
        <LoginSection api={api} />
        {home}
      </ContentStack>
    </LayoutBlock>
  )
}
