import { CardFrame, NumericText, Typo, shapes } from '@dfragon/ui'
import * as stylex from '@stylexjs/stylex'
import { tierLabels } from '../constants/cards'
import { serverNames } from '../constants/servers'
import { getCharacterCardFrameState } from '../lib/card-presentation'
import type { CardCharacter } from '../types/cards'
import { styles } from './RaidCard.style'

/**
 * 공대 화면의 축약 카드. 파티 카드에서 그림 칸, 면 탭, 입력을 빼고 머리(번호, 서버, 순위), 소속, 이름,
 * 직업, 명성만 남긴다. 접힌 동안은 번호, 이름, 명성 한 줄이다. 빈 자리는 꺾쇠 없는 대기 카드다.
 */
export function RaidCard({
  slot,
  character,
  collapsed = false
}: {
  slot: number
  character: CardCharacter | null
  collapsed?: boolean
}): React.JSX.Element {
  const frameState = getCharacterCardFrameState({
    state: character == null ? 'idle' : 'success',
    editing: false,
    tier: character?.tier
  })
  const tier = frameState === 'top' || frameState === 'ranker' ? frameState : undefined
  const vacant = character == null

  return (
    <div {...stylex.props(styles.slot, collapsed && styles.slotCollapsed)}>
      <CardFrame as="article" state={frameState} aria-label={`${slot}번 슬롯`}>
        <div {...stylex.props(styles.header)}>
          <span
            aria-hidden="true"
            {...stylex.props(
              styles.number,
              shapes.cutTopRight,
              vacant && styles.numberVacant,
              tier === 'top' && styles.numberTop,
              tier === 'ranker' && styles.numberRanker
            )}
          >
            {String(slot).padStart(2, '0')}
          </span>
          {tier !== undefined && (
            <span {...stylex.props(shapes.srOnly)}>{tierLabels[tier]} 단계</span>
          )}
          {vacant && <span {...stylex.props(shapes.srOnly)}>비어 있음</span>}
          {character != null && collapsed && (
            <Typo.txtM as="span" weight={700} {...stylex.props(styles.inlineName)}>
              {character.name}
            </Typo.txtM>
          )}
          {character != null && !collapsed && (
            <span {...stylex.props(styles.server)}>{serverNames[character.serverId]}</span>
          )}
          <span {...stylex.props(styles.spacer)} />
          {character != null && collapsed && (
            <span {...stylex.props(styles.inlineFame, tier !== undefined && styles[tier])}>
              <span {...stylex.props(shapes.srOnly)}>명성</span>
              <FameValue value={character.fame} />
            </span>
          )}
          {character?.serverRank != null && !collapsed && (
            <span
              {...stylex.props(
                styles.rank,
                tier === 'top' && styles.rankTop,
                tier === 'ranker' && styles.rankRanker,
                tier === 'ranker' && shapes.cutTopRight
              )}
            >
              <span aria-hidden="true">#{character.serverRank}</span>
              <span {...stylex.props(shapes.srOnly)}>서버 순위 {character.serverRank}위</span>
            </span>
          )}
        </div>
        {!collapsed && (
          <>
            <div {...stylex.props(styles.identity)}>
              {character == null ? (
                <>
                  <Typo.caption aria-hidden="true" weight={600} {...stylex.props(styles.vacant)}>
                    모험단
                  </Typo.caption>
                  <Typo.h5
                    as="span"
                    aria-hidden="true"
                    weight={700}
                    {...stylex.props(styles.vacant)}
                  >
                    캐릭터
                  </Typo.h5>
                </>
              ) : (
                <>
                  <span {...stylex.props(styles.affiliation)}>
                    <Typo.caption weight={600} {...stylex.props(styles.adventure)}>
                      {character.adventure}
                    </Typo.caption>
                    {character.guild && (
                      <>
                        <span aria-hidden="true" {...stylex.props(styles.divider)} />
                        <Typo.caption weight={600} {...stylex.props(styles.guild)}>
                          {character.guild}
                        </Typo.caption>
                      </>
                    )}
                  </span>
                  <Typo.h5 as="span" weight={700} {...stylex.props(styles.name)}>
                    {character.name}
                  </Typo.h5>
                  <Typo.txtS as="span" {...stylex.props(styles.job)}>
                    {character.job}
                  </Typo.txtS>
                </>
              )}
            </div>
            <dl
              {...stylex.props(
                styles.stats,
                vacant && styles.statsVacant,
                tier === 'ranker' && styles.statsRanker
              )}
            >
              <Typo.caption as="dt" {...stylex.props(styles.statLabel)}>
                명성
              </Typo.caption>
              <dd
                {...stylex.props(
                  styles.statValue,
                  character?.fame == null && styles.statMissing,
                  vacant && styles.statVacant,
                  tier !== undefined && styles[tier]
                )}
              >
                <FameValue value={character?.fame ?? null} />
              </dd>
            </dl>
          </>
        )}
      </CardFrame>
    </div>
  )
}

// 명성 값. 0과 알 수 없음을 구분하고 알 수 없으면 `—`를 둔다.
function FameValue({ value }: { value: number | null }): React.JSX.Element {
  if (value == null) {
    return <>—</>
  }

  return <NumericText value={value} />
}
