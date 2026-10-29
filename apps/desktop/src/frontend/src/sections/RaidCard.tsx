import { CardFrame, ProgressCircle, shapes } from '@dfragon/ui'
import type { ChangeEvent, HTMLAttributes, KeyboardEvent, ReactNode, Ref } from 'react'
import * as stylex from '@stylexjs/stylex'
import { CardImage } from '../components/CardImage'
import { NameField } from '../components/NameField'
import { ServerSelect } from '../components/ServerSelect'
import { SnapshotChip } from '../components/SnapshotChip'
import { SnapshotOverlay } from '../components/SnapshotOverlay'
import { StatLine } from '../components/StatLine'
import { type LookupDraft, useLookupDraft } from '../hooks/useLookupDraft'
import { useServerMenu } from '../hooks/useServerMenu'
import type { SlotCardKey } from '../hooks/useSlotCardStore'
import {
  getCharacterCardFrameState,
  getCharacterCardStatus,
  isVacantSlot
} from '../lib/card-presentation'
import { toScoreView } from '../lib/card-score'
import { toNameFieldTone, type NameFieldTone } from '../lib/name-field-tone'
import type { SlotCard } from '../lib/slot-cards'
import type { CharacterTier } from '../types/cards'
import { MISSING_VALUE, tierLabels } from '../constants/cards'
import { serverOptions } from '../constants/server-options'
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
  onLookup?: (nickname: string, serverId: string) => void
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
          <PortraitWell tier={tier}>
            {characterFound && <Portrait src={character.image} />}
            {busy && <LookupProgress slot={slot} />}
          </PortraitWell>
          <div {...stylex.props(styles.column)}>
            <div {...stylex.props(styles.header)}>
              <LookupField slot={slot} tone={toNameFieldTone(frameState)} draft={draft} />
              {tier !== undefined && (
                <span {...stylex.props(shapes.srOnly)}>{tierLabels[tier]} 단계</span>
              )}
              {frameState === 'selected' && <EditingDots label="이름 수정 중" />}
              {frameState === 'failure' && <FailureMark label={cardStatus} />}
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

function PortraitWell({
  tier,
  children
}: {
  tier: CharacterTier | undefined
  children: ReactNode
}): React.JSX.Element {
  return (
    <div
      {...stylex.props(
        shapes.gridWell,
        styles.well,
        tier === 'top' && styles.wellTop,
        tier === 'ranker' && styles.wellRanker
      )}
    >
      {children}
    </div>
  )
}

function Portrait({ src }: { src: string | undefined }): React.JSX.Element {
  return (
    <div {...stylex.props(styles.portrait)}>
      <CardImage src={src} label="캐릭터" />
    </div>
  )
}

function LookupProgress({ slot }: { slot: number }): React.JSX.Element {
  return (
    <div role="status" aria-label={`${slot}번 캐릭터 확인 중`} {...stylex.props(styles.progress)}>
      <ProgressCircle size="24" tone="staticWhite" />
    </div>
  )
}

function LookupField({
  slot,
  tone,
  draft
}: {
  slot: number
  tone: NameFieldTone
  draft: LookupDraft
}): React.JSX.Element {
  const serverMenu = useServerMenu()
  const handleNameChange = (event: ChangeEvent<HTMLInputElement>): void => {
    draft.changeName(event.target.value)
  }
  const handleNameKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
      draft.submit()

      return
    }

    serverMenu.openOnTab(event)
  }

  return (
    <div {...stylex.props(styles.nameField)}>
      <NameField
        aria-label={`${slot}번 캐릭터 이름`}
        tone={tone}
        value={draft.name}
        onFocus={draft.focusName}
        onBlur={draft.blurName}
        onChange={handleNameChange}
        onKeyDown={handleNameKeyDown}
        end={
          <ServerSelect
            variant="field"
            label={`${slot}번 서버`}
            value={draft.serverId}
            options={serverOptions}
            open={serverMenu.open}
            onOpenChange={serverMenu.setOpen}
            onValueChange={draft.changeServer}
          />
        }
      />
    </div>
  )
}

function EditingDots({ label }: { label: string }): React.JSX.Element {
  return (
    <span role="img" aria-label={label} {...stylex.props(styles.dots)}>
      <span {...stylex.props(styles.dot)} />
      <span {...stylex.props(styles.dot, styles.dotSecond)} />
      <span {...stylex.props(styles.dot, styles.dotThird)} />
    </span>
  )
}

function FailureMark({ label }: { label: string }): React.JSX.Element {
  return (
    <span
      role="img"
      aria-label={label}
      {...stylex.props(styles.mark, shapes.cutTopRight, styles.alert)}
    >
      !
    </span>
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

function CardAnnouncer({ children }: { children: string }): React.JSX.Element {
  return (
    <span aria-live="polite" {...stylex.props(shapes.srOnly)}>
      {children}
    </span>
  )
}
