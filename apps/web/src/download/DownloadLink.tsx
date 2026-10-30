import * as stylex from '@stylexjs/stylex'
import { DownloadIcon } from '../icons'
import { LATEST_RELEASE_PAGE } from './latest-release'
import { useLatestPortableUrl } from './useLatestPortableUrl'
import { styles } from './DownloadLink.style'

export function DownloadLink(): React.JSX.Element {
  const href = useLatestPortableUrl() ?? LATEST_RELEASE_PAGE

  return (
    <a href={href} {...stylex.props(styles.button)}>
      <DownloadIcon width={20} height={20} />
      Windows용 내려받기
    </a>
  )
}
