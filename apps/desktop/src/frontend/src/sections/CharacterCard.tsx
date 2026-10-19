import {
  Button,
  CardFrame,
  NumericText,
  ProgressCircle,
  Tabs,
  Typo,
  shapes,
  typographyVariants
} from '@dfragon/ui'
import { ExternalLinkIcon } from '../components/ExternalLinkIcon'
import { HourglassIcon } from '../components/HourglassIcon'
import {
  getCharacterCardFrameState,
  getCharacterCardStatus,
  isVacantSlot
} from '../lib/card-presentation'
import { useState } from 'react'
import * as stylex from '@stylexjs/stylex'
import { ServerSelect } from '../components/ServerSelect'
import { SnapshotChip } from '../components/SnapshotChip'
import { SnapshotOverlay } from '../components/SnapshotOverlay'
import { useLookupDraft } from '../hooks/useLookupDraft'
import { CardImage } from '../components/CardImage'
import { CandidateStrip } from '../components/CandidateStrip'
import { styles as stripStyles } from '../components/CandidateStrip.style'
import { EquipmentSummary } from '../components/EquipmentSummary'
import { InvestmentTable } from '../components/InvestmentTable'
import { styles } from './CharacterCard.style'
import { serverNames } from '../constants/servers'
import { MISSING_VALUE, cardFaces, tierLabels } from '../constants/cards'
import type { SlotCard } from '../lib/slot-cards'
import {
  type ScoreView,
  toCharacterFace,
  toEquipmentFace,
  toInvestmentRows
} from '../lib/card-faces'
import type { CardCharacter, CharacterTier } from '../types/cards'

export function CharacterCard({
  card,
  slot,
  initialFace = 0,
  inputEnabled = false,
  collapsed = false,
  onDetail,
  onRetry,
  onLookup,
  onPickCandidate
}: {
  /** 이 슬롯이 그릴 검색 상태, 찾은 캐릭터, 인식한 이름, 안내, 진행과 스냅샷 표시 */
  card: SlotCard
  slot: number
  initialFace?: number
  inputEnabled?: boolean
  /** 파티 머리의 접기. 그림 칸, 직업, 면 탭을 접고 머리, 소속, 이름, 명성, 점수만 남긴다. */
  collapsed?: boolean
  onDetail?: () => void
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
  // 찾은 자리는 인식한 이름 대신 찾은 캐릭터 이름으로 이름 칸을 채운다.
  const nickname = characterFound ? undefined : card.nickname
  const [face, setFace] = useState(initialFace)
  const draft = useLookupDraft({ character, nickname, onLookup })
  const { name, serverId, inputNotice, editing } = draft
  const hasCharacter = state === 'success' && character != null && !editing
  // 접힌 카드는 캐릭터 면만 보이고, 펼치면 고른 면으로 돌아온다.
  const shownFace = collapsed || !hasCharacter ? 0 : face
  const characterFace = toCharacterFace(characterFound ? character.card : null, 'long')
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
  const showRetry = state === 'failure' && onRetry != null

  return (
    <div {...stylex.props(styles.slot)}>
      <CardFrame as="article" state={frameState} aria-label={`${slot}번 슬롯`} aria-busy={busy}>
        <div {...stylex.props(styles.header)}>
          <span
            aria-hidden="true"
            {...stylex.props(
              styles.number,
              shapes.cutTopRight,
              frameState === 'selected' && styles.numberSelected,
              frameState === 'waiting' && styles.numberWaiting,
              tier === 'top' && styles.numberTop,
              tier === 'ranker' && styles.numberRanker
            )}
          >
            {String(slot).padStart(2, '0')}
          </span>
          {tier !== undefined && (
            <span {...stylex.props(shapes.srOnly)}>{tierLabels[tier]} 단계</span>
          )}
          {(inputEnabled || characterFound) && (
            <div {...stylex.props(styles.server)}>
              <ServerSelect
                label={`${slot}번 서버`}
                value={serverId}
                disabled={!inputEnabled}
                options={Object.entries(serverNames).map(([id, label]) => ({ id, label }))}
                onValueChange={draft.changeServer}
              />
            </div>
          )}
          {snapshotMark !== undefined && <SnapshotChip mark={snapshotMark} size="party" />}
          <span {...stylex.props(styles.spacer)} />
          {characterFound && (
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
          {collapsed && picker !== undefined && (
            <span
              role="img"
              aria-label={`외형으로 확정하지 못함, 후보 ${picker.choices.length}명`}
              {...stylex.props(styles.pickMark, shapes.cutTopRight)}
            >
              <span aria-hidden="true" {...stylex.props(styles.pickMarkDot)} />
              <span aria-hidden="true">{picker.choices.length}</span>
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
              <HourglassIcon width="14" height="14" />
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
              <ExternalLinkIcon width="16" height="16" />
            </button>
          )}
        </div>
        <Tabs.Root
          value={shownFace}
          onValueChange={(value: unknown) => {
            if (typeof value === 'number') {
              setFace(value)
            }
          }}
          {...stylex.props(styles.body)}
        >
          <Tabs.Panel value={0} {...stylex.props(styles.characterFace)}>
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
              <div {...stylex.props(styles.affiliation)}>
                {characterFound ? (
                  <>
                    <Typo.caption weight={600} {...stylex.props(styles.adventure)}>
                      {character.adventure}
                    </Typo.caption>
                    <span aria-hidden="true" {...stylex.props(styles.affiliationDivider)} />
                    <Typo.caption weight={600} {...stylex.props(styles.guild)}>
                      {character.guild ?? MISSING_VALUE}
                    </Typo.caption>
                    <span {...stylex.props(styles.spacer)} />
                    <Typo.caption
                      weight={500}
                      {...stylex.props(styles.job, collapsed && styles.jobHidden)}
                    >
                      {character.job}
                    </Typo.caption>
                  </>
                ) : (
                  <Typo.caption
                    aria-hidden="true"
                    weight={600}
                    {...stylex.props(styles.affiliationPlaceholder)}
                  >
                    모험단
                  </Typo.caption>
                )}
              </div>
              <div {...stylex.props(styles.nameBox)}>
                <Typo.h5
                  as="input"
                  weight={700}
                  aria-label={`${slot}번 캐릭터 이름`}
                  value={name}
                  disabled={!inputEnabled}
                  placeholder="캐릭터명 입력"
                  style={name ? undefined : typographyVariants.h6}
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
                    frameState === 'waiting' && styles.nameWaiting,
                    frameState === 'failure' && styles.nameFailure,
                    draft.active && styles.nameSelected
                  )}
                />
              </div>
              {((editing && state === 'success') || characterFound) && (
                <div {...stylex.props(styles.collapsible, collapsed && styles.collapsibleHidden)}>
                  {editing && state === 'success' && (
                    <Typo.caption {...stylex.props(styles.hint)}>Enter로 조회</Typo.caption>
                  )}
                  {characterFound && (
                    <dl {...stylex.props(styles.statLine)}>
                      {characterFace.stats.map((stat) => (
                        <div key={stat.label} {...stylex.props(styles.statItem)}>
                          <Typo.caption as="dt" {...stylex.props(styles.statItemLabel)}>
                            {stat.label}
                          </Typo.caption>
                          <dd {...stylex.props(styles.statItemValue)}>
                            <span
                              {...stylex.props(
                                styles.statItemNumber,
                                stat.value === MISSING_VALUE && styles.statItemMissing
                              )}
                            >
                              {stat.value}
                            </span>
                            {stat.unit !== '' && (
                              <Typo.caption {...stylex.props(styles.statItemUnit)}>
                                {stat.unit}
                              </Typo.caption>
                            )}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  )}
                </div>
              )}
            </div>
          </Tabs.Panel>
          {hasCharacter && (
            <>
              <Tabs.Panel value={1} {...stylex.props(styles.face)}>
                <FaceTitle name={character.name} job={character.job} />
                <EquipmentFace character={character} />
              </Tabs.Panel>
              <Tabs.Panel value={2} {...stylex.props(styles.face)}>
                <FaceTitle name={character.name} job={character.job} />
                <div {...stylex.props(styles.investment)}>
                  <InvestmentTable rows={toInvestmentRows(character.card, character.itemImages)} />
                </div>
              </Tabs.Panel>
            </>
          )}
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
                {characterFace.score.label}
              </Typo.caption>
              <StatValue
                value={characterFace.score.value}
                vacant={vacant}
                tier={tier}
                role={characterFace.score.tone}
                description={characterFace.score.description}
              />
            </div>
          </dl>
          <div {...stylex.props(styles.faces, collapsed && styles.collapsibleHidden)}>
            {vacant ? (
              <div aria-hidden="true" {...stylex.props(styles.facesVacant)} />
            ) : (
              <Tabs.List surface="card" aria-label={`${slot}번 카드 면`}>
                {cardFaces.map((label, index) => (
                  <Tabs.Tab key={label} value={index} disabled={index > 0 && !hasCharacter}>
                    {label}
                  </Tabs.Tab>
                ))}
              </Tabs.List>
            )}
          </div>
        </Tabs.Root>
        {snapshotMark?.kind === 'absent' && <SnapshotOverlay />}
        <span aria-live="polite" {...stylex.props(shapes.srOnly)}>
          {hasCharacter ? character?.name : status}
        </span>
      </CardFrame>
    </div>
  )
}

// 장비와 기타 면 맨 위의 이름과 직업 한 줄. 이름 입력과 서버 선택은 캐릭터 면과 머리에만 둔다.
function FaceTitle({ name, job }: { name: string; job: string }): React.JSX.Element {
  return (
    <div {...stylex.props(styles.faceTitle)}>
      <span {...stylex.props(styles.faceName)}>{name}</span>
      <span {...stylex.props(styles.spacer)} />
      <Typo.caption {...stylex.props(styles.faceJob)}>{job}</Typo.caption>
    </div>
  )
}

// 장비 면의 세트와 서약 섹션.
function EquipmentFace({ character }: { character: CardCharacter }): React.JSX.Element {
  const { set, oath } = toEquipmentFace(character.card, character.itemImages)

  return (
    <div {...stylex.props(styles.equipment)}>
      <EquipmentSummary label="세트" summary={set} />
      <div aria-hidden="true" {...stylex.props(styles.equipmentDivider)} />
      <EquipmentSummary label="서약" summary={oath} upgrades={oath.upgrades} />
    </div>
  )
}

// 명성과 점수 값. 0과 알 수 없음을 구분하고 알 수 없으면 같은 크기의 `-`를 흐리게 둔다.
// 값이 있을 때만 숫자를 세어 올린다. 상위, 랭커 카드는 값을 단계 색으로 그리고, 단계가 없는 카드의 점수는
// 역할 색(`role`)으로 그린다. 점수는 계산값이라는 뜻이나 계산하지 못한 사유를 보조 기술에 덧붙인다.
function StatValue({
  value,
  vacant,
  tier,
  role,
  description
}: {
  value: number | null
  vacant: boolean
  tier?: CharacterTier
  role?: ScoreView['tone']
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
      <NumericText value={value} />
      {note}
    </dd>
  )
}
