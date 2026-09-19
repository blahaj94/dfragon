import { licenseDocumentUrl } from '../lib/license-document'
import * as stylex from '@stylexjs/stylex'
import { useColorTheme } from '../hooks/useColorTheme'
import { styles } from './LicensesSection.style'

export function LicensesSection(): React.JSX.Element {
  const { light } = useColorTheme()
  return (
    <section aria-label="오픈소스 고지" {...stylex.props(styles.section)}>
      <iframe
        title="오픈소스 라이선스 원문"
        src={licenseDocumentUrl(window.location.href)}
        sandbox="allow-same-origin"
        {...stylex.props(styles.document, light ? styles.light : styles.dark)}
      />
    </section>
  )
}
