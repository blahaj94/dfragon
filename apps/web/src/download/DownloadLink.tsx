import * as stylex from '@stylexjs/stylex'
import { DownloadIcon } from '../icons'
import { formatSize, LATEST_RELEASE_PAGE } from './latest-release'
import { useLatestRelease } from './useLatestRelease'
import { styles } from './DownloadLink.style'

export function DownloadLink(): React.JSX.Element {
  const release = useLatestRelease()
  const href = release?.url ?? LATEST_RELEASE_PAGE

  return (
    <div {...stylex.props(styles.root)}>
      <a href={href} {...stylex.props(styles.button)}>
        <DownloadIcon width={20} height={20} />
        Windows용 내려받기
      </a>
      <p {...stylex.props(styles.meta)}>
        {release !== null && (
          <>
            <span {...stylex.props(styles.number)}>{release.version}</span>
            {' · '}
          </>
        )}
        Windows 10, 11 x64
        {release !== null && (
          <>
            {' · '}
            <span {...stylex.props(styles.number)}>{formatSize(release.size)}</span>
          </>
        )}
        {' · '}포터블, 설치 없음
      </p>
    </div>
  )
}
