import { CardFrame, NumericText, ProgressCircle, shapes } from '@dfragon/ui'
import type { HTMLAttributes, Ref } from 'react'
import * as stylex from '@stylexjs/stylex'
import { CardImage } from '../components/CardImage'
import { ExternalLinkIcon } from '../components/ExternalLinkIcon'
import { HourglassIcon } from '../components/HourglassIcon'
import { ServerSelect } from '../components/ServerSelect'
import { SnapshotChip } from '../components/SnapshotChip'
import { SnapshotOverlay } from '../components/SnapshotOverlay'
import { useLookupDraft } from '../hooks/useLookupDraft'
import {
  getCharacterCardFrameState,
  getCharacterCardStatus,
  isVacantSlot
} from '../lib/card-presentation'
import { type ScoreView, formatApproximateScore, toCharacterFace } from '../lib/card-faces'
import type { SlotCard } from '../lib/slot-cards'
import { MISSING_VALUE, tierLabels } from '../constants/cards'
import { serverNames } from '../constants/servers'
import { styles } from './RaidCard.style'

/** 카드를 끌거나 키보드로 옮기는 자리 조작. 공대 화면이 자리 배치를 소유하고 카드에 연결한다. */
export type RaidCardMove = Pick<
  HTMLAttributes<HTMLDivElement>,
  'onDragStart' | 'onDragOver' | 'onDragLeave' | 'onDrop' | 'onDragEnd' | 'onKeyDown'
> & {
  /** 지금 끌거나 키보드로 옮길 수 있는지. 공대 캡처가 인식하는 동안은 옮기지 않는다. */
  movable: boolean
  /** 끌고 있는 카드와 놓을 자리로 가리킨 카드 */
  drag?: 'source' | 'target'
  /** 자리가 속한 파티와 키보드 조작 방법을 설명하는 요소들의 id */
  describedBy?: string
  ref?: Ref<HTMLDivElement>
}

/**
 * 공대 화면의 축약 캐릭터 카드(DFragon 디자인 캔버스 공대 보드). 파티 카드처럼 서버와 이름으로 그 자리를
 * 조회하고 상태를 꺾쇠로 보이지만, 면 탭 없이 그림 칸 72, 스탯 한 줄, 명성과 장비 점수만 둔다. 카드 자체가
 * 자리를 옮기는 손잡이라 끌거나 포커스한 뒤 Alt와 방향키로 이웃 자리와 맞바꾼다.
 */
export function RaidCard({
  card,
  slot,
  collapsed = false,
  onDetail,
  onLookup,
  move
}: {
  /** 이 자리에 놓인 검색 슬롯이 그릴 검색 상태, 찾은 캐릭터, 인식한 이름, 안내, 진행과 스냅샷 표시 */
  card: SlotCard
  /** 화면의 자리 번호(1~12) */
  slot: number
  /** 그림 칸, 직업, 스탯 한 줄을 접고 머리, 소속, 이름, 명성, 장비 점수만 남긴다. */
  collapsed?: boolean
  onDetail?: () => void
  onLookup?: (nickname: string, serverId: string) => void
  move: RaidCardMove
}): React.JSX.Element {
  const { state, character, notice, snapshotMark, loading = false } = card
  const characterFound = state === 'success' && character != null
  // 찾은 자리는 공대 캡처가 인식한 이름 대신 찾은 캐릭터 이름으로 이름 칸을 채운다.
  const nickname = characterFound ? undefined : card.nickname
  const draft = useLookupDraft({ character, nickname, onLookup })
  const hasCharacter = characterFound && !draft.editing
  const vacant = isVacantSlot(state)
  const busy = loading || state === 'pending'
  const cardStatus = getCharacterCardStatus(state)
  const status = draft.inputNotice || notice || cardStatus
  // 상태 이름은 꺾쇠와 표시로 보이므로 글자로 다시 쓰지 않는다. 0건과 안내 문구만 화면에 남긴다.
  const message = draft.inputNotice || notice || (state === 'empty' ? cardStatus : '')
  const frameState = getCharacterCardFrameState({
    state,
    editing: draft.active,
    tier: characterFound ? character.tier : undefined
  })
  const tier = frameState === 'top' || frameState === 'ranker' ? frameState : undefined
  const showStats = characterFound && message === ''
  const characterFace = toCharacterFace(characterFound ? character.card : null, 'short')
  const showRow = !collapsed && (message !== '' || showStats)
  const { movable, drag, describedBy, ref, ...handlers } = move

  return (
    <div
      ref={ref}
      aria-label={movable ? `${slot}번 자리, 끌어서 옮기기` : `${slot}번 자리`}
      role="group"
      aria-describedby={describedBy}
      aria-keyshortcuts={
        movable ? 'Alt+ArrowUp Alt+ArrowDown Alt+ArrowLeft Alt+ArrowRight' : undefined
      }
      tabIndex={movable ? 0 : -1}
      draggable={movable}
      {...handlers}
      {...stylex.props(
        styles.seat,
        movable && styles.movable,
        drag === 'source' && styles.dragSource,
        drag === 'target' && styles.dragTarget
      )}
    >
      <CardFrame as="article" state={frameState} aria-busy={busy}>
        <div {...stylex.props(styles.header)}>
          <span
            aria-hidden="true"
            {...stylex.props(
              styles.number,
              shapes.cutTopRight,
              frameState === 'selected' && styles.numberSelected,
              tier === 'top' && styles.numberTop,
              tier === 'ranker' && styles.numberRanker
            )}
          >
            {String(slot).padStart(2, '0')}
          </span>
          {tier !== undefined && (
            <span {...stylex.props(shapes.srOnly)}>{tierLabels[tier]} 단계</span>
          )}
          <div {...stylex.props(styles.server)}>
            <ServerSelect
              label={`${slot}번 서버`}
              value={draft.serverId}
              options={Object.entries(serverNames).map(([id, label]) => ({ id, label }))}
              onValueChange={draft.changeServer}
            />
          </div>
          {snapshotMark !== undefined && <SnapshotChip mark={snapshotMark} size="raid" />}
          <span {...stylex.props(styles.spacer)} />
          {characterFound && frameState !== 'selected' && (
            <span
              {...stylex.props(
                styles.rank,
                tier === 'top' && styles.rankTop,
                tier === 'ranker' && styles.rankRanker,
                tier === 'ranker' && shapes.cutTopRight
              )}
            >
              <span aria-hidden="true">{characterFace.serverRank.text}</span>
              <span {...stylex.props(shapes.srOnly)}>{characterFace.serverRank.label}</span>
            </span>
          )}
          {frameState === 'selected' && (
            <span role="img" aria-label="이름 수정 중" {...stylex.props(styles.dots)}>
              <span {...stylex.props(styles.dot)} />
              <span {...stylex.props(styles.dot, styles.dotSecond)} />
              <span {...stylex.props(styles.dot, styles.dotThird)} />
            </span>
          )}
          {frameState === 'failure' && (
            <span
              role="img"
              aria-label={cardStatus}
              {...stylex.props(styles.mark, shapes.cutTopRight, styles.alert)}
            >
              !
            </span>
          )}
          {frameState === 'waiting' && cardStatus !== '' && (
            <span
              role="img"
              aria-label={cardStatus}
              {...stylex.props(styles.mark, shapes.cutTopRight, styles.waitingMark)}
            >
              <HourglassIcon width="12" height="12" />
            </span>
          )}
          {!vacant && (
            <button
              type="button"
              disabled={!hasCharacter || onDetail == null}
              aria-label={`${slot}번 캐릭터 상세 열기`}
              onClick={onDetail}
              {...stylex.props(styles.detail)}
            >
              <ExternalLinkIcon width="14" height="14" />
            </button>
          )}
        </div>
        <div {...stylex.props(styles.body, collapsed && styles.bodyCollapsed)}>
          <div
            {...stylex.props(
              shapes.gridWell,
              styles.well,
              collapsed && styles.hidden,
              tier === 'top' && styles.wellTop,
              tier === 'ranker' && styles.wellRanker
            )}
          >
            {characterFound && (
              <div {...stylex.props(styles.portrait)}>
                <CardImage src={character.image} label="캐릭터" portrait />
              </div>
            )}
            {busy && (
              <div
                role="status"
                aria-label={`${slot}번 캐릭터 확인 중`}
                {...stylex.props(styles.progress)}
              >
                <ProgressCircle size="24" tone="staticWhite" />
              </div>
            )}
          </div>
          <div {...stylex.props(styles.identity)}>
            <div {...stylex.props(styles.affiliation)}>
              {characterFound ? (
                <>
                  <span {...stylex.props(styles.adventure)}>{character.adventure}</span>
                  <span aria-hidden="true" {...stylex.props(styles.affiliationDivider)} />
                  <span {...stylex.props(styles.guild)}>{character.guild ?? MISSING_VALUE}</span>
                </>
              ) : (
                <span aria-hidden="true" {...stylex.props(styles.affiliationPlaceholder)}>
                  모험단
                </span>
              )}
            </div>
            <input
              aria-label={`${slot}번 캐릭터 이름`}
              value={draft.name}
              placeholder="캐릭터명 입력"
              onFocus={draft.focusName}
              onBlur={draft.blurName}
              onChange={(event) => draft.changeName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
                  draft.submit()
                }
              }}
              {...stylex.props(
                styles.name,
                draft.name === '' && styles.nameEmpty,
                frameState === 'waiting' && styles.nameWaiting,
                frameState === 'failure' && styles.nameFailure,
                frameState === 'selected' && styles.nameSelected
              )}
            />
            {characterFound && (
              <span {...stylex.props(styles.job, collapsed && styles.hidden)}>{character.job}</span>
            )}
          </div>
        </div>
        {showRow && message !== '' && (
          <p title={message} {...stylex.props(styles.notice)}>
            {message}
          </p>
        )}
        {showRow && showStats && (
          <dl {...stylex.props(styles.stats)}>
            {characterFace.stats.map((stat) => (
              <div key={stat.label} {...stylex.props(styles.stat)}>
                <dt {...stylex.props(styles.statLabel)}>{stat.label}</dt>
                <dd {...stylex.props(styles.statValue)}>
                  <span
                    {...stylex.props(
                      styles.statNumber,
                      stat.value === MISSING_VALUE && styles.statMissing
                    )}
                  >
                    {stat.value}
                  </span>
                  {stat.unit !== '' && <span {...stylex.props(styles.statUnit)}>{stat.unit}</span>}
                </dd>
              </div>
            ))}
          </dl>
        )}
        <dl
          {...stylex.props(
            styles.footer,
            showRow && styles.footerAfterRow,
            vacant && styles.footerVacant,
            tier === 'ranker' && styles.footerRanker
          )}
        >
          <div {...stylex.props(styles.footerItem)}>
            <dt {...stylex.props(styles.footerLabel)}>명성</dt>
            <FooterValue
              value={characterFound ? character.fame : null}
              vacant={vacant}
              tone={tier}
            />
          </div>
          <div {...stylex.props(styles.footerItem)}>
            <dt {...stylex.props(styles.footerLabel)}>{characterFace.score.label}</dt>
            <FooterValue
              value={characterFace.score.value}
              vacant={vacant}
              role={characterFace.score.tone}
              approximate={characterFace.score.approximate}
              description={characterFace.score.description}
            />
          </div>
        </dl>
        {snapshotMark?.kind === 'absent' && <SnapshotOverlay />}
        <span aria-live="polite" {...stylex.props(shapes.srOnly)}>
          {hasCharacter ? character?.name : status}
        </span>
      </CardFrame>
    </div>
  )
}

// 명성과 점수 값. 알 수 없으면 같은 크기의 `-`를 흐리게 두고, 값이 있을 때만 숫자를 세어 올린다.
// 상위, 랭커 카드는 명성만 단계 색으로 그리고, 점수는 단계와 상관없이 역할 색(`role`)으로 그린다. 점수는
// 계산값이라는 뜻이나 계산하지 못한 사유를 보조 기술에 덧붙이고, 근사값은 `≈`를 붙여 보인다.
function FooterValue({
  value,
  vacant,
  tone,
  role,
  approximate = false,
  description
}: {
  value: number | null
  vacant: boolean
  tone?: 'top' | 'ranker'
  role?: ScoreView['tone']
  approximate?: boolean
  description?: string
}): React.JSX.Element {
  const note = description !== undefined && (
    <span {...stylex.props(shapes.srOnly)}>{description}</span>
  )
  if (value == null) {
    return (
      <dd
        {...stylex.props(
          styles.footerValue,
          styles.footerMissing,
          vacant && styles.footerVacantValue
        )}
      >
        {MISSING_VALUE}
        {note}
      </dd>
    )
  }

  return (
    <dd
      title={description}
      {...stylex.props(
        styles.footerValue,
        role === 'dealer' && styles.scoreDealer,
        role === 'buffer' && styles.scoreBuffer,
        tone === 'top' && styles.fameTop,
        tone === 'ranker' && styles.fameRanker
      )}
    >
      <NumericText value={value} format={approximate ? formatApproximateScore : undefined} />
      {note}
    </dd>
  )
}
