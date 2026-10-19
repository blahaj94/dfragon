import { PRODUCT_NAME } from '@dfragon/lib'
import * as stylex from '@stylexjs/stylex'
import type { ReactNode } from 'react'
import { ContentStack } from '@dfragon/ui'
import type { AuthApi } from '@dfragon/desktop-contracts/types/auth'
import { LoginSection } from '../../sections/LoginSection'
import { styles } from './LoginPage.style'

export function LoginPage({
  api,
  home
}: {
  api: AuthApi | undefined
  home?: ReactNode
}): React.JSX.Element {
  return (
    <div {...stylex.props(styles.page)}>
      <header {...stylex.props(styles.bar)}>
        <span {...stylex.props(styles.title)}>{PRODUCT_NAME}</span>
      </header>
      <main {...stylex.props(styles.content)}>
        <ContentStack>
          {api != null && <LoginSection api={api} />}
          {home}
        </ContentStack>
      </main>
      <footer {...stylex.props(styles.bar)}>
        <span {...stylex.props(styles.footer)}>{`${PRODUCT_NAME} Desktop`}</span>
      </footer>
    </div>
  )
}
