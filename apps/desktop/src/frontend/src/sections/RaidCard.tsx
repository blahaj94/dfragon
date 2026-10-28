import { CardFrame, ProgressCircle, shapes } from '@dfragon/ui'
import type { HTMLAttributes, Ref } from 'react'
import * as stylex from '@stylexjs/stylex'
import { CardImage } from '../components/CardImage'
import { HourglassIcon } from '../components/HourglassIcon'
import { NameField, type NameFieldTone } from '../components/NameField'
import { ServerSelect } from '../components/ServerSelect'
import { SnapshotChip } from '../components/SnapshotChip'
import { SnapshotOverlay } from '../components/SnapshotOverlay'
import { StatLine } from '../components/StatLine'
import { useLookupDraft } from '../hooks/useLookupDraft'
import { useServerMenu } from '../hooks/useServerMenu'
import type { SlotCardKey } from '../hooks/useSlotCardStore'
import {
  type CharacterCardFrameState,
  getCharacterCardFrameState,
  getCharacterCardStatus,
  isVacantSlot
} from '../lib/card-presentation'
import { toScoreView } from '../lib/card-score'
import type { SlotCard } from '../lib/slot-cards'
import type { SlotState } from '../types/cards'
import { MISSING_VALUE, tierLabels } from '../constants/cards'
import { serverNames } from '../constants/servers'
import { styles } from './RaidCard.style'

const serverOptions = Object.entries(serverNames).map(([id, label]) => ({ id, label }))

function nameFieldTone(frameState: CharacterCardFrameState, state: SlotState): NameFieldTone {
  if (frameState === 'selected' || frameState === 'failure') {
    return frameState
  }

  if (state === 'idle') {
    return 'vacant'
  }

  if (frameState === 'waiting') {
    return 'waiting'
  }

  return 'default'
}

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
  const serverMenu = useServerMenu()
  const hasCharacter = characterFound && !draft.editing
  const vacant = isVacantSlot(state)
  const busy = loading || state === 'pending'
  const cardStatus = getCharacterCardStatus(state)
  const status = draft.inputNotice || notice || cardStatus
  const message = draft.inputNotice || notice || (state === 'empty' ? cardStatus : '')
  const frameState = getCharacterCardFrameState({
    state,
    editing: draft.active,
    tier: characterFound ? character.tier : undefined
  })
  const tier = frameState === 'top' || frameState === 'ranker' ? frameState : undefined
  const score = toScoreView(characterFound ? character.card : null, card.scorePending)
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
        <div {...stylex.props(styles.body)}>
          <div
            {...stylex.props(
              shapes.gridWell,
              styles.well,
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
          <div {...stylex.props(styles.column)}>
            <div {...stylex.props(styles.header)}>
              <div {...stylex.props(styles.nameField)}>
                <NameField
                  aria-label={`${slot}번 캐릭터 이름`}
                  tone={nameFieldTone(frameState, state)}
                  value={draft.name}
                  onFocus={draft.focusName}
                  onBlur={draft.blurName}
                  onChange={(event) => draft.changeName(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
                      draft.submit()
                    } else {
                      serverMenu.openOnTab(event)
                    }
                  }}
                  right={
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
              {tier !== undefined && (
                <span {...stylex.props(shapes.srOnly)}>{tierLabels[tier]} 단계</span>
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
              {snapshotMark !== undefined && <SnapshotChip mark={snapshotMark} size="raid" />}
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
            </div>
            <div title={message || undefined} {...stylex.props(styles.affiliation)}>
              {characterFound && (
                <>
                  <span {...stylex.props(styles.adventure)}>{character.adventure}</span>
                  <span aria-hidden="true" {...stylex.props(styles.affiliationDivider)} />
                  <span {...stylex.props(styles.guild)}>{character.guild ?? MISSING_VALUE}</span>
                  {message !== '' && <span {...stylex.props(shapes.srOnly)}>{message}</span>}
                </>
              )}
              {!characterFound && message !== '' && (
                <p {...stylex.props(styles.notice)}>{message}</p>
              )}
              {!characterFound && message === '' && (
                <span aria-hidden="true" {...stylex.props(styles.affiliationPlaceholder)}>
                  모험단
                </span>
              )}
            </div>
            <StatLine
              fame={characterFound ? character.fame : null}
              score={score}
              vacant={vacant}
              tier={tier}
            />
          </div>
        </div>
        {snapshotMark?.kind === 'absent' && <SnapshotOverlay />}
        <span aria-live="polite" {...stylex.props(shapes.srOnly)}>
          {hasCharacter ? character?.name : status}
        </span>
      </CardFrame>
    </div>
  )
}
