import { CardFrame, shapes } from '@dfragon/ui'
import type { HTMLAttributes, ReactNode, Ref } from 'react'
import * as stylex from '@stylexjs/stylex'
import { CardAnnouncer } from '../components/CardAnnouncer'
import { FailureMark } from '../components/FailureMark'
import { LookupField } from '../components/LookupField'
import { LookupProgress } from '../components/LookupProgress'
import { Portrait } from '../components/Portrait'
import { PortraitWell } from '../components/PortraitWell'
import { SnapshotChip } from '../components/SnapshotChip'
import { SnapshotOverlay } from '../components/SnapshotOverlay'
import { StatLine } from '../components/StatLine'
import { useLookupDraft } from '../hooks/useLookupDraft'
import type { SlotCardKey } from '../hooks/useSlotCardStore'
import {
  getCharacterCardFrameState,
  getCharacterCardStatus,
  isVacantSlot
} from '../lib/card-presentation'
import { toScoreView } from '../lib/card-score'
import { toNameFieldTone } from '../lib/name-field-tone'
import type { SlotCard } from '../lib/slot-cards'
import type { CharacterTier } from '../types/cards'
import { MISSING_VALUE, tierLabels } from '../constants/cards'
import { styles } from './RaidCard.style'

export type RaidCardMove = Pick<
  HTMLAttributes<HTMLDivElement>,
  'onDragStart' | 'onDragOver' | 'onDragLeave' | 'onDrop' | 'onDragEnd' | 'onKeyDown'
> & {
  movable: boolean
  drag?: 'source' | 'target'
  describedBy?: string
  ref?: Ref<HTMLDivElement>
}

export function RaidCard({
  cardKey,
  card,
  slot,
  onLookup,
  move
}: {
  cardKey: SlotCardKey
  card: SlotCard
  slot: number
  onLookup: (nickname: string, serverId: string) => void
  move: RaidCardMove
}): React.JSX.Element {
  const { state, character, notice, snapshotMark, loading = false } = card
  const characterFound = state === 'success' && character != null
  const nickname = characterFound ? undefined : card.nickname
  const draft = useLookupDraft({ cardKey, character, nickname, onLookup })
  const busy = loading || state === 'pending'
  const cardStatus = getCharacterCardStatus(state)
  const slotNotice = draft.inputNotice || notice
  const message = slotNotice || (state === 'empty' ? cardStatus : '')
  const frameState = getCharacterCardFrameState({
    state,
    editing: draft.active,
    tier: characterFound ? character.tier : undefined
  })
  const tier = frameState === 'top' || frameState === 'ranker' ? frameState : undefined
  const score = toScoreView(characterFound ? character.card : null, card.scorePending)

  return (
    <Seat slot={slot} move={move}>
      <CardFrame as="article" state={frameState} aria-busy={busy}>
        <div {...stylex.props(styles.body)}>
          <PortraitWell tier={tier} size="raid">
            {characterFound && <Portrait src={character.image} />}
            {busy && <LookupProgress slot={slot} />}
          </PortraitWell>
          <div {...stylex.props(styles.column)}>
            <div {...stylex.props(styles.header)}>
              <LookupField
                slot={slot}
                tone={toNameFieldTone(frameState)}
                draft={draft}
                size="raid"
              />
              {tier !== undefined && (
                <span {...stylex.props(shapes.srOnly)}>{tierLabels[tier]} 단계</span>
              )}
              {frameState === 'failure' && <FailureMark label={cardStatus} size="raid" />}
              {snapshotMark !== undefined && <SnapshotChip mark={snapshotMark} size="raid" />}
              <SlotNumber selected={frameState === 'selected'} tier={tier}>
                {String(slot).padStart(2, '0')}
              </SlotNumber>
            </div>
            {characterFound ? (
              <AffiliationLine adventure={character.adventure} guild={character.guild}>
                {message}
              </AffiliationLine>
            ) : (
              <NoticeLine>{message}</NoticeLine>
            )}
            <StatLine
              fame={characterFound ? character.fame : null}
              score={score}
              vacant={isVacantSlot(state)}
              tier={tier}
            />
          </div>
        </div>
        {snapshotMark?.kind === 'absent' && <SnapshotOverlay />}
        <CardAnnouncer>
          {characterFound && !draft.editing ? character.name : slotNotice || cardStatus}
        </CardAnnouncer>
      </CardFrame>
    </Seat>
  )
}

function Seat({
  slot,
  move,
  children
}: {
  slot: number
  move: RaidCardMove
  children: ReactNode
}): React.JSX.Element {
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
      {children}
    </div>
  )
}

function SlotNumber({
  selected,
  tier,
  children
}: {
  selected: boolean
  tier: CharacterTier | undefined
  children: string
}): React.JSX.Element {
  return (
    <span
      aria-hidden="true"
      {...stylex.props(
        styles.number,
        shapes.cutTopRight,
        selected && styles.numberSelected,
        tier === 'top' && styles.numberTop,
        tier === 'ranker' && styles.numberRanker
      )}
    >
      {children}
    </span>
  )
}

function AffiliationLine({
  adventure,
  guild,
  children
}: {
  adventure: string
  guild: string | null | undefined
  children: string
}): React.JSX.Element {
  return (
    <div title={children || undefined} {...stylex.props(styles.affiliation)}>
      <span {...stylex.props(styles.adventure)}>{adventure}</span>
      <span aria-hidden="true" {...stylex.props(styles.affiliationDivider)} />
      <span {...stylex.props(styles.guild)}>{guild ?? MISSING_VALUE}</span>
      {children !== '' && <span {...stylex.props(shapes.srOnly)}>{children}</span>}
    </div>
  )
}

function NoticeLine({ children }: { children: string }): React.JSX.Element {
  if (children === '') {
    return (
      <div {...stylex.props(styles.affiliation)}>
        <span aria-hidden="true" {...stylex.props(styles.affiliationPlaceholder)}>
          모험단
        </span>
      </div>
    )
  }

  return (
    <div title={children} {...stylex.props(styles.affiliation)}>
      <p {...stylex.props(styles.notice)}>{children}</p>
    </div>
  )
}
