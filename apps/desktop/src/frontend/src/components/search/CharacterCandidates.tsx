import * as stylex from '@stylexjs/stylex'
import { SupportingText } from '@ldb/ui'
import type { CharacterSearchRow } from '../../../../preload/common/types/search'

const fameFormat = new Intl.NumberFormat('ko-KR', { maximumSignificantDigits: 21 })

const styles = stylex.create({
  list: {
    listStyle: 'none',
    padding: 0,
    marginTop: 'var(--seed-dimension-x3)',
    marginBottom: 0,
    marginInline: 0,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: 'var(--seed-color-stroke-neutral-muted)',
    borderRadius: 'var(--seed-radius-r3)',
    backgroundColor: 'var(--seed-color-bg-layer-default)'
  },
  item: {
    padding: 'var(--seed-dimension-x4)',
    overflowWrap: 'anywhere'
  },
  separator: {
    borderTopWidth: 1,
    borderTopStyle: 'solid',
    borderTopColor: 'var(--seed-color-stroke-neutral-muted)'
  },
  overview: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'baseline',
    rowGap: 'var(--seed-dimension-x3)',
    columnGap: 'var(--seed-dimension-x6)'
  },
  identity: {
    flex: '1 1 10rem',
    minWidth: 0
  },
  name: {
    color: 'var(--seed-color-fg-neutral)',
    fontSize: 'var(--seed-font-size-t4)',
    lineHeight: 'var(--seed-line-height-t4)'
  },
  fame: {
    flex: '0 1 auto',
    maxWidth: '100%',
    marginBlock: 0,
    marginLeft: 'auto',
    marginRight: 0,
    textAlign: 'right',
    fontVariantNumeric: 'tabular-nums'
  },
  supporting: {
    color: 'var(--seed-color-fg-neutral-subtle)',
    fontSize: 'var(--seed-font-size-t2)',
    lineHeight: 'var(--seed-line-height-t2)'
  },
  fameValue: {
    margin: 0,
    fontSize: 'var(--seed-font-size-t4)',
    lineHeight: 'var(--seed-line-height-t4)',
    fontWeight: 600
  },
  details: {
    marginTop: 'var(--seed-dimension-x2)'
  },
  summary: {
    width: 'fit-content',
    maxWidth: '100%',
    cursor: 'pointer',
    borderRadius: 'var(--seed-radius-r1)',
    outline: {
      default: null,
      ':focus-visible': '2px solid var(--seed-color-stroke-focus-ring)'
    },
    outlineOffset: { default: null, ':focus-visible': 2 }
  },
  identifiers: {
    marginTop: 'var(--seed-dimension-x2)',
    marginBottom: 0,
    marginInline: 0
  },
  identifier: {
    display: 'flex',
    flexWrap: 'wrap',
    rowGap: 0,
    columnGap: 'var(--seed-dimension-x2)'
  },
  identifierValue: {
    minWidth: 0,
    margin: 0,
    color: 'var(--seed-color-fg-neutral)'
  }
})

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
