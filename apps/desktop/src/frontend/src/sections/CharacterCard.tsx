import { Button, CardFrame, NumericText, ProgressCircle, Typo, shapes } from '@dfragon/ui'
import {
  type CharacterCardFrameState,
  getCharacterCardFrameState,
  getCharacterCardStatus,
  isVacantSlot
} from '../lib/card-presentation'
import * as stylex from '@stylexjs/stylex'
import { NameField, type NameFieldTone } from '../components/NameField'
import { ServerSelect } from '../components/ServerSelect'
import { SnapshotChip } from '../components/SnapshotChip'
import { SnapshotOverlay } from '../components/SnapshotOverlay'
import { useLookupDraft } from '../hooks/useLookupDraft'
import { CardImage } from '../components/CardImage'
import { CandidateStrip } from '../components/CandidateStrip'
import { styles as stripStyles } from '../components/CandidateStrip.style'
import { styles } from './CharacterCard.style'
import { serverNames } from '../constants/servers'
import { MISSING_VALUE, tierLabels } from '../constants/cards'
import type { SlotCard } from '../lib/slot-cards'
import { type ScoreView, formatApproximateScore, toScoreView } from '../lib/card-score'
import type { CharacterTier, SlotState } from '../types/cards'

const serverOptions = Object.entries(serverNames).map(([id, label]) => ({ id, label }))

export function CharacterCard({
  card,
  slot,
  inputEnabled = false,
  collapsed = false,
  onRetry,
  onLookup,
  onPickCandidate
}: {
  /** 이 슬롯이 그릴 검색 상태, 찾은 캐릭터, 인식한 이름, 안내, 진행과 스냅샷 표시 */
  card: SlotCard
  slot: number
  inputEnabled?: boolean
  /** 파티 머리의 접기. 그림 칸과 직업을 접고 머리, 소속, 이름, 명성, 점수만 남긴다. */
  collapsed?: boolean
  onRetry?: () => void
  onLookup?: (nickname: string, serverId: string) => void
  /** 후보 줄의 후보를 서버로 누른다. */
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
  // 미리보기 조회가 실패해도 다른 후보를 다시 고를 수 있게 후보 줄은 캐릭터를 찾지 못한 동안에도 남긴다.
  const picker = card.picker
  const previewing = characterFound && picker?.previewServerId != null
  // 접힌 카드는 그림 칸이 없어 이름 오른쪽에 작은 후보 타일을 둔다.
  const compactPicker = collapsed && picker !== undefined
  // 찾은 자리는 인식한 이름 대신 찾은 캐릭터 이름으로 이름 칸을 채운다.
  const nickname = characterFound ? undefined : card.nickname
  const draft = useLookupDraft({ character, nickname, onLookup })
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
  // 모험단과 길드. 접힌 카드에서 후보 타일과 함께 놓이면 흐르는 상자에 담는다.
  const affiliation = characterFound && (
    <>
      <Typo.caption weight={600} {...stylex.props(styles.adventure)}>
        {character.adventure}
      </Typo.caption>
      <span aria-hidden="true" {...stylex.props(styles.affiliationDivider)} />
      <Typo.caption weight={600} {...stylex.props(styles.guild)}>
        {character.guild ?? MISSING_VALUE}
      </Typo.caption>
    </>
  )
  const showRetry = state === 'failure' && onRetry != null

  return (
    <div {...stylex.props(styles.slot)}>
      <CardFrame as="article" state={frameState} aria-label={`${slot}번 슬롯`} aria-busy={busy}>
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
          {snapshotMark !== undefined && <SnapshotChip mark={snapshotMark} size="party" />}
        </div>
        <div {...stylex.props(styles.body)}>
          <div {...stylex.props(styles.characterFace)}>
            <div
              {...stylex.props(
                shapes.gridWell,
                styles.well,
                collapsed && styles.wellCollapsed,
                tier === 'top' && styles.wellTop,
                tier === 'ranker' && styles.wellRanker
              )}
            >
              {characterFound && (
                <div
                  {...stylex.props(styles.portrait, picker !== undefined && stripStyles.aboveStrip)}
                >
                  <CardImage src={character.image} label="캐릭터" portrait />
                </div>
              )}
              {picker !== undefined && !collapsed && (
                <CandidateStrip slot={slot} picker={picker} onPick={onPickCandidate} />
              )}
              {characterFound && message && (
                <Typo.caption as="p" {...stylex.props(styles.topNotice)}>
                  {message}
                </Typo.caption>
              )}
              {(busy || (!characterFound && message) || showRetry) && (
                <div
                  {...stylex.props(styles.center, picker !== undefined && stripStyles.aboveStrip)}
                >
                  {busy && (
                    <div role="status" aria-label={`${slot}번 캐릭터 확인 중`}>
                      <ProgressCircle size="24" tone="staticWhite" />
                    </div>
                  )}
                  {!characterFound && message && (
                    <Typo.txtS as="p" {...stylex.props(styles.message)}>
                      {message}
                    </Typo.txtS>
                  )}
                  {showRetry && (
                    <Button
                      variant="primary"
                      size="sm"
                      disabled={!retryEnabled}
                      loading={retryPending}
                      onClick={onRetry}
                    >
                      다시 시도
                    </Button>
                  )}
                </div>
              )}
            </div>
            <div {...stylex.props(styles.identity)}>
              <div {...stylex.props(styles.identityRow)}>
                <div {...stylex.props(styles.identityText)}>
                  <div {...stylex.props(styles.affiliation)}>
                    {characterFound && compactPicker && (
                      <span {...stylex.props(styles.marqueeBox)}>
                        <span {...stylex.props(styles.marqueeText)}>{affiliation}</span>
                      </span>
                    )}
                    {characterFound && !compactPicker && (
                      <>
                        {affiliation}
                        <span {...stylex.props(styles.spacer)} />
                        <Typo.caption
                          weight={500}
                          {...stylex.props(styles.job, collapsed && styles.jobHidden)}
                        >
                          {character.job}
                        </Typo.caption>
                      </>
                    )}
                    {!characterFound && (
                      <Typo.caption
                        aria-hidden="true"
                        weight={600}
                        {...stylex.props(styles.affiliationPlaceholder)}
                      >
                        모험단
                      </Typo.caption>
                    )}
                  </div>
                </div>
                {compactPicker && (
                  <CandidateStrip slot={slot} picker={picker} onPick={onPickCandidate} compact />
                )}
              </div>
              {editing && state === 'success' && (
                <div {...stylex.props(styles.collapsible, collapsed && styles.collapsibleHidden)}>
                  <Typo.caption {...stylex.props(styles.hint)}>Enter로 조회</Typo.caption>
                </div>
              )}
            </div>
          </div>
          <dl
            {...stylex.props(
              styles.stats,
              vacant && styles.statsVacant,
              tier === 'ranker' && styles.statsRanker
            )}
          >
            <div {...stylex.props(styles.statRow)}>
              <Typo.caption as="dt" {...stylex.props(styles.statLabel)}>
                명성
              </Typo.caption>
              <StatValue
                value={characterFound ? character.fame : null}
                vacant={vacant}
                tier={tier}
              />
            </div>
            <div
              {...stylex.props(
                styles.statRow,
                styles.statRowDivided,
                vacant && styles.statRowDividedVacant
              )}
            >
              <Typo.caption as="dt" {...stylex.props(styles.statLabel)}>
                {score.label}
              </Typo.caption>
              <StatValue
                value={score.value}
                vacant={vacant}
                tier={tier}
                role={score.tone}
                approximate={score.approximate}
                description={score.description}
              />
            </div>
          </dl>
        </div>
        {snapshotMark?.kind === 'absent' && <SnapshotOverlay />}
        <span aria-live="polite" {...stylex.props(shapes.srOnly)}>
          {hasCharacter ? character?.name : status}
        </span>
      </CardFrame>
    </div>
  )
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

// 명성과 점수 값. 0과 알 수 없음을 구분하고 알 수 없으면 같은 크기의 `-`를 흐리게 둔다.
// 값이 있을 때만 숫자를 세어 올린다. 상위, 랭커 카드는 값을 단계 색으로 그리고, 단계가 없는 카드의 점수는
// 역할 색(`role`)으로 그린다. 점수는 계산값이라는 뜻이나 계산하지 못한 사유를 보조 기술에 덧붙이고, 근사값은
// `≈`를 붙여 보인다.
function StatValue({
  value,
  vacant,
  tier,
  role,
  approximate = false,
  description
}: {
  value: number | null
  vacant: boolean
  tier?: CharacterTier
  role?: ScoreView['tone']
  approximate?: boolean
  description?: string
}): React.JSX.Element {
  const note = description !== undefined && (
    <span {...stylex.props(shapes.srOnly)}>{description}</span>
  )
  if (value == null) {
    return (
      <dd {...stylex.props(styles.statValue, styles.statMissing, vacant && styles.statVacant)}>
        {MISSING_VALUE}
        {note}
      </dd>
    )
  }

  return (
    <dd
      title={description}
      {...stylex.props(
        styles.statValue,
        role === 'dealer' && styles.statDealer,
        role === 'buffer' && styles.statBuffer,
        tier === 'top' && styles.statTop,
        tier === 'ranker' && styles.statRanker
      )}
    >
      <NumericText value={value} format={approximate ? formatApproximateScore : undefined} />
      {note}
    </dd>
  )
}
