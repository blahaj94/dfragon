import { PRODUCT_NAME } from '@dfragon/lib'
import type { ReactNode } from 'react'
import { ContentStack, LayoutBlock } from '@dfragon/ui'
import type { AuthApi } from '../../../../preload/common/types/auth'
import { LoginSection } from '../../sections/LoginSection'

export function LoginPage({
  api,
  home
}: {
  api: AuthApi | undefined
  home?: ReactNode
}): React.JSX.Element {
  return (
    <LayoutBlock header={PRODUCT_NAME} footer={`${PRODUCT_NAME} Desktop`}>
      <ContentStack>
        {api != null && <LoginSection api={api} />}
        {home}
      </ContentStack>
    </LayoutBlock>
  )
}
