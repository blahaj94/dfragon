import type { ReactNode } from 'react'
import { ContentStack, LayoutBlock } from '@ldb/ui'
import type { AuthApi } from '../../../../../preload/common/types/auth'
import { AuthSection } from '../../../features/auth/components/AuthSection'

export function LoginPage({ api, home }: { api: AuthApi; home?: ReactNode }): React.JSX.Element {
  return (
    <LayoutBlock header="LDB" footer="LDB Desktop">
      <ContentStack>
        <AuthSection api={api} />
        {home}
      </ContentStack>
    </LayoutBlock>
  )
}
