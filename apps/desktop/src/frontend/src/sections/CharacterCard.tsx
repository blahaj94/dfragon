import { Button, CardFrame, ProgressCircle, Typo, shapes } from '@dfragon/ui'
import {
  type CharacterCardFrameState,
  getCharacterCardFrameState,
  getCharacterCardStatus,
  isVacantSlot
} from '../lib/card-presentation'
import * as stylex from '@stylexjs/stylex'
import { useId, useState } from 'react'
import { NameField, type NameFieldTone } from '../components/NameField'
import { ServerSelect } from '../components/ServerSelect'
import { SnapshotChip } from '../components/SnapshotChip'
import { SnapshotOverlay } from '../components/SnapshotOverlay'
import { useLookupDraft } from '../hooks/useLookupDraft'
import { useServerMenu } from '../hooks/useServerMenu'
import { CardImage } from '../components/CardImage'
import { CandidateWindow } from '../components/CandidateWindow'
import { StatLine } from '../components/StatLine'
import { styles } from './CharacterCard.style'
import { serverNames } from '../constants/servers'
import { MISSING_VALUE, tierLabels } from '../constants/cards'
import type { SlotCard } from '../lib/slot-cards'
import { toScoreView } from '../lib/card-score'
import type { SlotState } from '../types/cards'

const serverOptions = Object.entries(serverNames).map(([id, label]) => ({ id, label }))

export function CharacterCard({
  card,
  slot,
  inputEnabled = false,
  onRetry,
  onLookup,
  onPickCandidate
}: {
  /** 이 슬롯이 그릴 검색 상태, 찾은 캐릭터, 인식한 이름, 안내, 진행과 스냅샷 표시 */
  card: SlotCard
  slot: number
  inputEnabled?: boolean
  onRetry?: () => void
  onLookup?: (nickname: string, serverId: string) => void
  /** 후보 창의 후보를 서버로 누른다. */
  onPickCandidate?: (serverId: string) => void
}): React.JSX.Element {
  const {
    state,
    character,
    notice,
    snapshotMark,
    retryEnabled = false,
    retryPending = false,
    loading = false
  } = card
  const characterFound = state === 'success' && character != null
  // 미리보기 조회가 실패해도 다른 후보를 다시 고를 수 있게 후보 창은 캐릭터를 찾지 못한 동안에도 남긴다.
  const picker = card.picker
  // 후보 창을 닫기 X로 닫았는지. 후보 목록과 미리보기, 확정은 캡처 쪽이 가지고, 열림만 카드가 가진다.
  // 확정해 후보가 사라지면 다음 후보는 다시 열린 창으로 보이고, 다음 회차는 카드를 새로 그려 처음부터 열린다.
  const [candidatesClosed, setCandidatesClosed] = useState(false)
  if (picker === undefined && candidatesClosed) {
    setCandidatesClosed(false)
  }
  const candidatesOpen = picker !== undefined && !candidatesClosed
  const candidateWindowId = useId()
  const previewing = characterFound && picker?.previewServerId != null
  // 찾은 자리는 인식한 이름 대신 찾은 캐릭터 이름으로 이름 칸을 채운다.
  const nickname = characterFound ? undefined : card.nickname
  const draft = useLookupDraft({ character, nickname, onLookup })
  const serverMenu = useServerMenu()
  const { inputNotice, editing } = draft
  const hasCharacter = state === 'success' && character != null && !editing
  const score = toScoreView(characterFound ? character.card : null)
  const vacant = isVacantSlot(state)
  const busy = loading || state === 'pending'
  const cardStatus = getCharacterCardStatus(state)
  const status = inputNotice || notice || cardStatus
  // 상태 이름은 꺾쇠와 표시로 보이므로 글자로 다시 쓰지 않는다. 0건과 안내 문구만 화면에 남긴다.
  const emptyMessage = state === 'empty' ? cardStatus : ''
  const message = inputNotice || notice || emptyMessage
  // 후보 미리보기는 확정 전이라 이름 수정과 같은 선택 상태로 보인다.
  const frameState = getCharacterCardFrameState({
    state,
    editing: draft.active || previewing,
    tier: characterFound ? character.tier : undefined
  })
  const tier = frameState === 'top' || frameState === 'ranker' ? frameState : undefined
  const nameTone = toNameFieldTone(frameState, state)
  const showRetry = state === 'failure' && onRetry != null
  // 찾은 카드의 넷째 줄 직업 뒤에 둘 안내. 고치는 동안 다른 안내가 없으면 조회 방법을 둔다.
  const foundNote = message || (editing ? 'Enter로 조회' : '')

  return (
    <div {...stylex.props(styles.slot)}>
      <CardFrame as="article" state={frameState} aria-label={`${slot}번 슬롯`} aria-busy={busy}>
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
                  tone={nameTone}
                  aria-label={`${slot}번 캐릭터 이름`}
                  value={draft.name}
                  disabled={!inputEnabled}
                  onFocus={draft.focusName}
                  onBlur={draft.blurName}
                  onChange={(event) => draft.changeName(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
                      draft.submit()
                    } else if (inputEnabled) {
                      serverMenu.openOnTab(event)
                    }
                  }}
                  right={
                    (inputEnabled || characterFound) && (
                      <ServerSelect
                        variant="field"
                        label={`${slot}번 서버`}
                        value={draft.serverId}
                        disabled={!inputEnabled}
                        options={serverOptions}
                        open={serverMenu.open}
                        onOpenChange={serverMenu.setOpen}
                        onValueChange={draft.changeServer}
                      />
                    )
                  }
                />
              </div>
              {tier !== undefined && (
                <span {...stylex.props(shapes.srOnly)}>{tierLabels[tier]} 단계</span>
              )}
              {frameState === 'selected' && (
                <span
                  role="img"
                  aria-label={previewing ? '후보 미리보기 중' : '이름 수정 중'}
                  {...stylex.props(styles.dots)}
                >
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
              {picker !== undefined && (
                <button
                  type="button"
                  aria-expanded={candidatesOpen}
                  aria-controls={candidatesOpen ? candidateWindowId : undefined}
                  onClick={() => setCandidatesClosed(candidatesOpen)}
                  {...stylex.props(styles.candidateChip, shapes.cutTopRight)}
                >
                  <Typo.caption as="span">후보 {picker.choices.length}</Typo.caption>
                </button>
              )}
              {snapshotMark !== undefined && <SnapshotChip mark={snapshotMark} size="party" />}
            </div>
            <div {...stylex.props(styles.line)}>
              {characterFound && (
                <>
                  <Typo.caption {...stylex.props(styles.adventure)}>
                    {character.adventure}
                  </Typo.caption>
                  <span aria-hidden="true" {...stylex.props(styles.lineDivider)} />
                  <Typo.caption {...stylex.props(styles.guild)}>
                    {character.guild ?? MISSING_VALUE}
                  </Typo.caption>
                </>
              )}
              {!characterFound && message !== '' && (
                <Typo.caption as="p" title={message} {...stylex.props(styles.message)}>
                  {message}
                </Typo.caption>
              )}
              {!characterFound && message === '' && (
                <Typo.caption aria-hidden="true" {...stylex.props(styles.placeholder)}>
                  모험단
                </Typo.caption>
              )}
            </div>
            <StatLine
              fame={characterFound ? character.fame : null}
              score={score}
              vacant={vacant}
              tier={tier}
            />
            {characterFound && (
              <div {...stylex.props(styles.line)}>
                <Typo.caption {...stylex.props(styles.job)}>
                  {toJobLabel(character.job)}
                </Typo.caption>
                {foundNote !== '' && (
                  <>
                    <span aria-hidden="true" {...stylex.props(styles.lineDivider)} />
                    <Typo.caption as="p" title={foundNote} {...stylex.props(styles.message)}>
                      {foundNote}
                    </Typo.caption>
                  </>
                )}
              </div>
            )}
            {showRetry && (
              <div {...stylex.props(styles.line)}>
                <Button
                  variant="primary"
                  size="sm"
                  disabled={!retryEnabled}
                  loading={retryPending}
                  onClick={onRetry}
                  {...stylex.props(styles.retry)}
                >
                  <Typo.caption as="span">다시 시도</Typo.caption>
                </Button>
              </div>
            )}
          </div>
        </div>
        {snapshotMark?.kind === 'absent' && <SnapshotOverlay />}
        <span aria-live="polite" {...stylex.props(shapes.srOnly)}>
          {hasCharacter ? character?.name : status}
        </span>
      </CardFrame>
      {candidatesOpen && (
        <CandidateWindow
          id={candidateWindowId}
          slot={slot}
          picker={picker}
          onPick={onPickCandidate}
          onClose={() => setCandidatesClosed(true)}
        />
      )}
    </div>
  )
}

// 직업 이름의 각성 표시(`眞 `). 카드에는 직업 이름만 둔다.
const AWAKENING_PREFIX = /^眞\s*/u

function toJobLabel(job: string): string {
  return job.replace(AWAKENING_PREFIX, '')
}

// 이름 칸 테두리. 수정 중, 실패는 카드 상태를 따르고, 대기 카드는 얼굴, 식별을 기다리는 자리면 회색,
// 아직 아무 회차도 채우지 않은 빈 자리면 점선이다.
function toNameFieldTone(frameState: CharacterCardFrameState, state: SlotState): NameFieldTone {
  if (frameState === 'selected' || frameState === 'failure') {
    return frameState
  }

  if (frameState !== 'waiting') {
    return 'default'
  }

  if (state === 'idle') {
    return 'vacant'
  }

  return 'waiting'
}
