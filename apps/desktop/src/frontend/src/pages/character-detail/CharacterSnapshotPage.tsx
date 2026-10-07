import { ActionButton, Typo } from '@dfragon/ui'
import * as stylex from '@stylexjs/stylex'
import { CardImage } from '../../components/CardImage'
import { lightTheme } from '../../constants/theme.stylex'
import { useCharacterDetail } from '../../hooks/useCharacterDetail'
import { useColorTheme } from '../../hooks/useColorTheme'
import { styles } from './CharacterSnapshotPage.style'

const localDateTime = new Intl.DateTimeFormat('ko-KR', {
  dateStyle: 'medium',
  timeStyle: 'short'
})
const numberFormat = new Intl.NumberFormat('ko-KR')

function displayValue(value: string | number | null): string {
  if (value == null) {
    return '정보 없음'
  }

  if (typeof value === 'number') {
    return numberFormat.format(value)
  }

  return value
}

export function CharacterSnapshotPage(): React.JSX.Element {
  const detail = useCharacterDetail()
  const { light } = useColorTheme()
  let body: React.JSX.Element
  if (detail.status === 'loading') {
    body = <Typo.txtM role="status">캐릭터 정보를 불러오는 중입니다.</Typo.txtM>
  } else if (detail.status === 'error') {
    body = (
      <Typo.txtM role="alert">
        캐릭터 정보를 불러오지 못했습니다. 이 창을 닫고 캐릭터 카드를 다시 선택해 주세요.
      </Typo.txtM>
    )
  } else {
    const { character, freshness } = detail.snapshot
    const fields = [
      ['서버', character.serverName],
      ['모험단', character.adventureName],
      ['직업', character.jobName],
      ['전직', character.jobGrowName],
      ['레벨', character.level],
      ['명성', character.fame]
    ] as const
    const fetchedAt = localDateTime.format(new Date(freshness.lastSuccessfulFetchAt))
    const expiresAt = localDateTime.format(new Date(freshness.expiresAt))
    body = (
      <section aria-label="캐릭터 기본 정보" {...stylex.props(styles.body)}>
        <div {...stylex.props(styles.identity)}>
          <div {...stylex.props(styles.image)}>
            <CardImage src={character.imageUrl} label={character.characterName} />
          </div>
          <Typo.h2 {...stylex.props(styles.name)}>{character.characterName}</Typo.h2>
        </div>
        <dl {...stylex.props(styles.fields)}>
          {fields.map(([label, value]) => (
            <div key={label} {...stylex.props(styles.field)}>
              <Typo.caption as="dt" {...stylex.props(styles.label)}>
                {label}
              </Typo.caption>
              <Typo.txtM as="dd" {...stylex.props(styles.value)}>
                {displayValue(value)}
              </Typo.txtM>
            </div>
          ))}
        </dl>
        <div {...stylex.props(styles.freshness)}>
          <Typo.caption>
            마지막 조회: <time dateTime={freshness.lastSuccessfulFetchAt}>{fetchedAt}</time>
          </Typo.caption>
          <Typo.caption>
            정보 유효 시각: <time dateTime={freshness.expiresAt}>{expiresAt}</time>
          </Typo.caption>
        </div>
        <Typo.caption {...stylex.props(styles.notice)}>
          창을 열 때의 정보를 표시합니다. 이 창에서는 정보를 새로 조회하지 않습니다.
        </Typo.caption>
      </section>
    )
  }

  return (
    <main {...stylex.props(styles.page, light && lightTheme)}>
      <header {...stylex.props(styles.header)}>
        <Typo.h1>캐릭터 상세</Typo.h1>
        <ActionButton size="small" variant="ghost" onClick={() => window.close()}>
          닫기
        </ActionButton>
      </header>
      {body}
    </main>
  )
}
