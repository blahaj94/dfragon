import { Button, CardFrame, NumericText, Typo, shapes } from '@dfragon/ui'
import * as stylex from '@stylexjs/stylex'
import { CardImage } from '../../components/CardImage'
import { WindowBar } from '../../components/WindowBar'
import { useCharacterDetail } from '../../hooks/useCharacterDetail'
import { styles } from './CharacterSnapshotPage.style'

const localDateTime = new Intl.DateTimeFormat('ko-KR', {
  dateStyle: 'medium',
  timeStyle: 'short'
})

const MISSING = '정보 없음'

// 글자 값. 응답에 없으면 정보 없음으로 둔다.
function TextValue({ value }: { value: string | null }): React.JSX.Element {
  return (
    <Typo.txtM as="dd" {...stylex.props(styles.value, value == null && styles.missing)}>
      {value ?? MISSING}
    </Typo.txtM>
  )
}

// 숫자 값. 0과 응답에 없는 값을 구분하고, 있으면 Barlow 숫자로 둔다.
function NumberValue({ value }: { value: number | null }): React.JSX.Element {
  if (value == null) {
    return <TextValue value={null} />
  }

  return (
    <dd {...stylex.props(styles.value, styles.number)}>
      <NumericText value={value} countUp={false} />
    </dd>
  )
}

export function CharacterSnapshotPage(): React.JSX.Element {
  const detail = useCharacterDetail()
  let body: React.JSX.Element
  if (detail.status === 'loading') {
    body = <Typo.txtM role="status">캐릭터 정보를 불러오는 중입니다.</Typo.txtM>
  } else if (detail.status === 'error') {
    body = (
      <div {...stylex.props(styles.error)}>
        <Typo.txtM role="alert">
          캐릭터 정보를 불러오지 못했습니다. 이 창을 닫고 캐릭터 카드를 다시 선택해 주세요.
        </Typo.txtM>
        <Button size="sm" onClick={() => window.close()}>
          닫기
        </Button>
      </div>
    )
  } else {
    const { character, freshness } = detail.snapshot
    const textFields = [
      ['서버', character.serverName],
      ['모험단', character.adventureName],
      ['직업', character.jobName],
      ['전직', character.jobGrowName]
    ] as const
    const numberFields = [
      ['레벨', character.level],
      ['명성', character.fame]
    ] as const
    const fetchedAt = localDateTime.format(new Date(freshness.lastSuccessfulFetchAt))
    const expiresAt = localDateTime.format(new Date(freshness.expiresAt))
    body = (
      <section aria-label="캐릭터 기본 정보" {...stylex.props(styles.body)}>
        <div {...stylex.props(styles.card)}>
          <CardFrame>
            <div {...stylex.props(shapes.gridWell, styles.well)}>
              <CardImage src={character.imageUrl} label={character.characterName} portrait />
            </div>
            <div {...stylex.props(styles.identity)}>
              {character.adventureName != null && (
                <Typo.caption weight={600} {...stylex.props(styles.adventure)}>
                  {character.adventureName}
                </Typo.caption>
              )}
              <Typo.h3 as="h2" {...stylex.props(styles.name)}>
                {character.characterName}
              </Typo.h3>
              {character.jobGrowName != null && (
                <Typo.txtS {...stylex.props(styles.job)}>{character.jobGrowName}</Typo.txtS>
              )}
            </div>
          </CardFrame>
        </div>
        <div {...stylex.props(styles.panel)}>
          <dl {...stylex.props(styles.fields)}>
            {textFields.map(([label, value]) => (
              <div key={label} {...stylex.props(styles.field)}>
                <Typo.caption as="dt" {...stylex.props(styles.label)}>
                  {label}
                </Typo.caption>
                <TextValue value={value} />
              </div>
            ))}
            {numberFields.map(([label, value]) => (
              <div key={label} {...stylex.props(styles.field)}>
                <Typo.caption as="dt" {...stylex.props(styles.label)}>
                  {label}
                </Typo.caption>
                <NumberValue value={value} />
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
            <Typo.caption>
              창을 열 때의 정보를 표시합니다. 이 창에서는 정보를 새로 조회하지 않습니다.
            </Typo.caption>
          </div>
        </div>
      </section>
    )
  }

  return (
    <div {...stylex.props(styles.page)}>
      <WindowBar title="캐릭터 상세" />
      <main {...stylex.props(styles.content)}>{body}</main>
    </div>
  )
}
