import * as stylex from '@stylexjs/stylex'
import { SupportingText } from '@dfragon/ui'
import { styles } from './CharacterCandidates.style'
import type { CharacterSearchRow } from '../../../preload/common/types/search'

const fameFormat = new Intl.NumberFormat('ko-KR', { maximumSignificantDigits: 21 })

export function CharacterCandidates({
  rows
}: {
  rows: readonly CharacterSearchRow[]
}): React.JSX.Element {
  return (
    <ol {...stylex.props(styles.list)} role="list" aria-label="캐릭터 검색 후보">
      {rows.map((row, index) => (
        <li
          {...stylex.props(styles.item, index > 0 && styles.separator)}
          key={`${index}:${row.characterId}`}
        >
          <div {...stylex.props(styles.overview)}>
            <div {...stylex.props(styles.identity)}>
              <SupportingText>
                <strong {...stylex.props(styles.name)}>{row.characterName}</strong>
              </SupportingText>
              <SupportingText>{row.serverName ?? row.serverId}</SupportingText>
            </div>
            <dl {...stylex.props(styles.fame)}>
              <dt {...stylex.props(styles.supporting)}>명성</dt>
              <dd {...stylex.props(styles.fameValue)}>
                {row.fame == null ? '정보 없음' : fameFormat.format(row.fame)}
              </dd>
            </dl>
          </div>
          <details {...stylex.props(styles.supporting, styles.details)}>
            <summary
              {...stylex.props(styles.summary)}
              aria-label={`${row.characterName} · ${row.serverName ?? row.serverId} 식별 정보`}
            >
              식별 정보
            </summary>
            <dl {...stylex.props(styles.identifiers)}>
              <div {...stylex.props(styles.identifier)}>
                <dt>서버 ID</dt>
                <dd {...stylex.props(styles.identifierValue)}>{row.serverId}</dd>
              </div>
              <div {...stylex.props(styles.identifier)}>
                <dt>캐릭터 ID</dt>
                <dd {...stylex.props(styles.identifierValue)}>{row.characterId}</dd>
              </div>
            </dl>
          </details>
        </li>
      ))}
    </ol>
  )
}
