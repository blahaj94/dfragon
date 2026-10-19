import { CardFrame, NumericText, Tabs, Typo, shapes } from '@dfragon/ui'
import * as stylex from '@stylexjs/stylex'
import { CardImage } from '../components/CardImage'
import { CloseIcon } from '../components/CloseIcon'
import { DetailItemList } from '../components/DetailItemList'
import { DetailSummaryHead } from '../components/DetailSummaryHead'
import { MISSING_VALUE } from '../constants/cards'
import { useElapsedTime } from '../hooks/useElapsedTime'
import { type ScoreView, toCharacterFace, toEquipmentFace } from '../lib/card-faces'
import { toDetailEquipmentGroups, toDetailOathGroups } from '../lib/character-detail'
import type { CharacterCard } from '../types/cards'
import { styles } from './CharacterDetailPanel.style'

/** 상세 창 머리와 이름 칸에 보일 캐릭터 정보. 응답에 없으면 null이다. */
export type CharacterDetailIdentity = Readonly<{
  characterName: string
  serverName: string
  adventureName: string | null
  guildName: string | null
  jobGrowName: string | null
  fame: number | null
  imageUrl: string | undefined
}>

const localDateTime = new Intl.DateTimeFormat('ko-KR', { dateStyle: 'medium', timeStyle: 'short' })

/**
 * 상세 창의 다크 카드 패널(DFragon 디자인 캔버스 상세 창 보드). 머리에 서버, 서버 순위, 조회 시각과 닫기를,
 * 그 아래 캐릭터 그림과 소속, 이름, 명성과 장비 점수를 두고 장비와 스킬 탭으로 나눈다. 장비 탭은 세트와 장비
 * 12줄, 서약 본체와 결정 12줄이다. 스킬 탭은 스킬 정보를 연결하기 전이라 안내만 둔다. 머리의 빈 곳을 끌면 창을
 * 옮긴다. `itemImages`는 합성 미리보기의 로컬 그림이다.
 */
export function CharacterDetailPanel({
  character,
  card,
  fetchedAt,
  itemImages,
  onClose
}: {
  character: CharacterDetailIdentity
  card: CharacterCard | null
  fetchedAt: string
  itemImages?: Readonly<Record<string, string>>
  onClose: () => void
}): React.JSX.Element {
  const face = toCharacterFace(card, 'long')
  const equipment = toEquipmentFace(card, itemImages)

  return (
    <div {...stylex.props(styles.panel)}>
      <CardFrame as="article" aria-label={`${character.characterName} 상세`}>
        <header {...stylex.props(styles.header)}>
          <div aria-hidden="true" {...stylex.props(styles.dragArea)} />
          <span {...stylex.props(styles.server)}>{character.serverName}</span>
          <span aria-hidden="true" {...stylex.props(styles.rank)}>
            {face.serverRank.text}
          </span>
          <span {...stylex.props(shapes.srOnly)}>{face.serverRank.label}</span>
          <span {...stylex.props(styles.spacer)} />
          <FetchedTime key={fetchedAt} at={fetchedAt} />
          <button type="button" aria-label="닫기" onClick={onClose} {...stylex.props(styles.close)}>
            <CloseIcon width={16} height={16} strokeWidth={2.5} />
          </button>
        </header>
        <section aria-label="캐릭터" {...stylex.props(styles.profile)}>
          <div {...stylex.props(shapes.gridWell, styles.portrait)}>
            <CardImage src={character.imageUrl} label={character.characterName} portrait />
          </div>
          <div {...stylex.props(styles.identity)}>
            <span {...stylex.props(styles.affiliation)}>
              <span
                {...stylex.props(
                  styles.adventure,
                  character.adventureName == null && styles.affiliationMissing
                )}
              >
                {character.adventureName ?? MISSING_VALUE}
                <span {...stylex.props(shapes.srOnly)}> 모험단</span>
              </span>
              <span aria-hidden="true" {...stylex.props(styles.affiliationDivider)} />
              <span
                {...stylex.props(
                  styles.guild,
                  character.guildName == null && styles.affiliationMissing
                )}
              >
                {character.guildName ?? MISSING_VALUE}
                <span {...stylex.props(shapes.srOnly)}> 길드</span>
              </span>
            </span>
            <span {...stylex.props(styles.nameLine)}>
              <Typo.h3
                as="h1"
                weight={700}
                title={character.characterName}
                {...stylex.props(styles.name)}
              >
                {character.characterName}
              </Typo.h3>
              <span {...stylex.props(styles.job)}>{character.jobGrowName ?? MISSING_VALUE}</span>
            </span>
            <dl {...stylex.props(styles.stats)}>
              <div {...stylex.props(styles.stat)}>
                <dt {...stylex.props(styles.statLabel)}>명성</dt>
                <StatValue value={character.fame} />
              </div>
              <div {...stylex.props(styles.stat)}>
                <dt {...stylex.props(styles.statLabel)}>장비 점수</dt>
                <StatValue value={face.score.value} description={face.score.description} />
              </div>
            </dl>
          </div>
        </section>
        <Tabs.Root defaultValue={0} {...stylex.props(styles.tabs)}>
          <Tabs.List aria-label="상세 면" {...stylex.props(styles.tabList)}>
            <Tabs.Tab value={0}>장비</Tabs.Tab>
            <Tabs.Tab value={1}>스킬</Tabs.Tab>
          </Tabs.List>
          <Tabs.Panel value={0} {...stylex.props(styles.tabPanel, styles.equipment)}>
            <section aria-label="세트와 장비" {...stylex.props(styles.column)}>
              <DetailSummaryHead summary={equipment.set} />
              <DetailItemList
                label="장비"
                groups={toDetailEquipmentGroups(card, itemImages)}
                align="start"
              />
            </section>
            <section aria-label="서약" {...stylex.props(styles.column)}>
              <DetailSummaryHead summary={equipment.oath} upgrades={equipment.oath.upgrades} />
              <DetailItemList
                label="서약과 결정"
                groups={toDetailOathGroups(card, itemImages)}
                align="end"
              />
            </section>
          </Tabs.Panel>
          <Tabs.Panel value={1} {...stylex.props(styles.tabPanel, styles.skills)}>
            <Typo.txtS {...stylex.props(styles.pending)}>
              스킬 정보는 아직 연결하지 않았습니다.
            </Typo.txtS>
          </Tabs.Panel>
        </Tabs.Root>
      </CardFrame>
    </div>
  )
}

// 창을 열 때 받은 정보의 조회 시각. `12초 전`처럼 상대 시간이고 마우스 설명에 날짜와 시각을 둔다.
function FetchedTime({ at }: { at: string }): React.JSX.Element {
  const time = Date.parse(at)
  const elapsed = useElapsedTime(time)
  const label = `마지막 조회 ${localDateTime.format(time)}`

  return (
    <time dateTime={at} title={label} {...stylex.props(styles.fetched)}>
      <span {...stylex.props(shapes.srOnly)}>마지막 조회 </span>
      {elapsed === null ? MISSING_VALUE : `${elapsed.value}${elapsed.unit} 전`}
    </time>
  )
}

// 명성과 장비 점수 값. 값이 없으면 `-`이고, 점수의 성격이나 계산하지 못한 사유는 보조 기술과 마우스 설명에 둔다.
function StatValue({
  value,
  description
}: {
  value: number | null
  description?: ScoreView['description']
}): React.JSX.Element {
  const note = description !== undefined && (
    <span {...stylex.props(shapes.srOnly)}>{description}</span>
  )
  if (value == null) {
    return (
      <dd {...stylex.props(styles.statValue, styles.statMissing)}>
        {MISSING_VALUE}
        {note}
      </dd>
    )
  }

  return (
    <dd title={description} {...stylex.props(styles.statValue)}>
      <NumericText value={value} countUp={false} />
      {note}
    </dd>
  )
}
