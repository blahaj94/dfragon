import { CardFrame, shapes } from '@dfragon/ui'
import * as stylex from '@stylexjs/stylex'
import { CardAnnouncer } from '../components/CardAnnouncer'
import { FailureMark } from '../components/FailureMark'
import { LookupField } from '../components/LookupField'
import { LookupProgress } from '../components/LookupProgress'
import { Portrait } from '../components/Portrait'
import { PortraitWell } from '../components/PortraitWell'
import { SnapshotAdventureField } from '../components/SnapshotAdventureField'
import { SnapshotChip } from '../components/SnapshotChip'
import { SnapshotOverlay } from '../components/SnapshotOverlay'
import { StatLine } from '../components/StatLine'
import { useLookupDraft } from '../hooks/useLookupDraft'
import type { SlotCardKey } from '../hooks/useSlotCardStore'
import {
  getCharacterCardFrameState,
  getCharacterCardStatus,
  getLookupStep,
  isVacantSlot,
  toJobLabel
} from '../lib/card-presentation'
import { toScoreView } from '../lib/card-score'
import { toNameFieldTone } from '../lib/name-field-tone'
import { toRaidSeat } from '../lib/raid-seat'
import type { SlotCard } from '../lib/slot-cards'
import type { CharacterTier } from '../types/cards'
import { MISSING_VALUE, tierLabels } from '../constants/cards'
import { styles } from './RaidCard.style'

export function RaidCard({
  cardKey,
  card,
  slot,
  onLookup,
  onChangeSnapshotAdventure
}: {
  cardKey: SlotCardKey
  card: SlotCard
  slot: number
  onLookup: (nickname: string, serverId: string) => void
  onChangeSnapshotAdventure: (value: string) => void
}): React.JSX.Element {
  const { state, character, notice, snapshotMark, snapshotAdventureInput, loading = false } = card
  const characterFound = state === 'success' && character != null
  const nickname = characterFound ? undefined : card.nickname
  const draft = useLookupDraft({ cardKey, character, nickname, onLookup })
  const busy = loading || state === 'pending'
  const lookupStep = getLookupStep(card)
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
    <CardFrame as="article" state={frameState} aria-busy={busy}>
      <div {...stylex.props(styles.body)}>
        <PortraitWell tier={tier} size="raid">
          {characterFound && <Portrait src={character.image} face={character.face} />}
          {lookupStep !== null && <LookupProgress slot={slot} step={lookupStep} size="raid" />}
        </PortraitWell>
        <div {...stylex.props(styles.column)}>
          <div {...stylex.props(styles.header)}>
            <LookupField slot={slot} tone={toNameFieldTone(frameState)} draft={draft} size="raid" />
            {tier !== undefined && (
              <span {...stylex.props(shapes.srOnly)}>{tierLabels[tier]} 단계</span>
            )}
            {frameState === 'failure' && <FailureMark label={cardStatus} size="raid" />}
            {snapshotMark !== undefined && <SnapshotChip mark={snapshotMark} size="raid" />}
            <SlotNumber selected={frameState === 'selected'} tier={tier}>
              {toRaidSeat(slot).label}
            </SlotNumber>
          </div>
          {characterFound && (
            <AffiliationLine adventure={character.adventure} guild={character.guild}>
              {message}
            </AffiliationLine>
          )}
          {!characterFound && snapshotAdventureInput !== undefined && (
            <div {...stylex.props(styles.affiliation)}>
              <SnapshotAdventureField
                slot={slot}
                value={snapshotAdventureInput}
                notice={message}
                onChange={onChangeSnapshotAdventure}
              />
            </div>
          )}
          {!characterFound && snapshotAdventureInput === undefined && (
            <NoticeLine>{message}</NoticeLine>
          )}
          <div {...stylex.props(styles.statRow)}>
            <StatLine
              fame={characterFound ? character.fame : null}
              score={score}
              vacant={isVacantSlot(state)}
              tier={tier}
            />
            {characterFound && <JobLabel job={character.job} />}
          </div>
        </div>
      </div>
      {snapshotMark?.kind === 'absent' && <SnapshotOverlay />}
      <CardAnnouncer>
        {characterFound && !draft.editing ? character.name : slotNotice || cardStatus}
      </CardAnnouncer>
    </CardFrame>
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

function JobLabel({ job }: { job: string }): React.JSX.Element {
  const label = toJobLabel(job)

  return (
    <span {...stylex.props(styles.jobGroup)}>
      <span aria-hidden="true" {...stylex.props(styles.divider)} />
      <span title={label} {...stylex.props(styles.job)}>
        {label}
      </span>
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
      <span aria-hidden="true" {...stylex.props(styles.divider)} />
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
