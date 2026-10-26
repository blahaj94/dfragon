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

// 이름 칸 테두리. 이름 수정 중은 다른 상태보다 앞서고, 아무것도 인식하지 못한 빈 자리는 점선, 인식 대기는
// 회색, 검색 실패와 0건은 노랑이다. 찾은 카드는 상위, 랭커 단계도 테두리가 없다.
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
 * 조회하고 상태를 꺾쇠로 보이지만, 그림 칸 40 오른쪽에 이름 칸, 소속 줄, 명성과 점수 한 줄만 둔다. 상태,
 * 스냅샷 순번, 자리 번호는 이름 칸 오른쪽 끝에 둔다. 카드 자체가 자리를 옮기는 손잡이라 끌거나 포커스한
 * 뒤 Alt와 방향키로 이웃 자리와 맞바꾼다.
 */
export function RaidCard({
  card,
  slot,
  onLookup,
  move
}: {
  /** 이 자리에 놓인 검색 슬롯이 그릴 검색 상태, 찾은 캐릭터, 인식한 이름, 안내, 진행과 스냅샷 표시 */
  card: SlotCard
  /** 화면의 자리 번호(1~12) */
  slot: number
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
  const score = toScoreView(characterFound ? character.card : null)
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
                    }
                  }}
                  right={
                    <ServerSelect
                      variant="field"
                      label={`${slot}번 서버`}
                      value={draft.serverId}
                      options={serverOptions}
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
                  {/* 한 줄에는 소속만 보이므로 찾은 카드의 안내는 보조 기술에만 전한다. */}
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
