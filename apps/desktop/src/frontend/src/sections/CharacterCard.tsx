import { CardFrame, Typo, shapes } from '@dfragon/ui'
import {
  getCharacterCardFrameState,
  getCharacterCardStatus,
  getLookupStep,
  isVacantSlot
} from '../lib/card-presentation'
import * as stylex from '@stylexjs/stylex'
import { useId } from 'react'
import { CardAnnouncer } from '../components/CardAnnouncer'
import { FailureMark } from '../components/FailureMark'
import { LookupField } from '../components/LookupField'
import { LookupProgress } from '../components/LookupProgress'
import { Portrait } from '../components/Portrait'
import { PortraitWell } from '../components/PortraitWell'
import { SnapshotChip } from '../components/SnapshotChip'
import { SnapshotOverlay } from '../components/SnapshotOverlay'
import { useLookupDraft } from '../hooks/useLookupDraft'
import { useCandidateWindow } from '../hooks/useCandidateWindow'
import type { SlotCardKey } from '../hooks/useSlotCardStore'
import { CandidateWindow } from '../components/CandidateWindow'
import { StatLine } from '../components/StatLine'
import { styles } from './CharacterCard.style'
import { MISSING_VALUE, tierLabels } from '../constants/cards'
import { toNameFieldTone } from '../lib/name-field-tone'
import type { SlotCard } from '../lib/slot-cards'
import { toScoreView } from '../lib/card-score'

export function CharacterCard({
  cardKey,
  card,
  slot,
  onLookup,
  onPickCandidate
}: {
  cardKey: SlotCardKey
  card: SlotCard
  slot: number
  onLookup: (nickname: string, serverId: string) => void
  onPickCandidate: (serverId: string) => void
}): React.JSX.Element {
  const { state, character, notice, picker, snapshotMark, loading = false } = card
  const characterFound = state === 'success' && character != null
  const candidates = useCandidateWindow(cardKey, picker !== undefined)
  const candidateWindowId = useId()
  const previewing = characterFound && picker?.previewServerId != null
  const draft = useLookupDraft({
    cardKey,
    character,
    nickname: characterFound ? undefined : card.nickname,
    onLookup
  })
  const { editing } = draft
  const score = toScoreView(characterFound ? character.card : null, card.scorePending)
  const busy = loading || state === 'pending'
  // 미리보기 조회 동안은 처음 누를 때의 카드 사본을 보이므로, 그 사본에 남은 상세 대기로 진행 점을 그리지 않는다.
  const lookupStep = previewing ? null : getLookupStep(card)
  const cardStatus = getCharacterCardStatus(state)
  const slotNotice = draft.inputNotice || notice
  const emptyMessage = state === 'empty' ? cardStatus : ''
  const foundNote = slotNotice || (editing ? 'Enter로 조회' : '')
  const frameState = getCharacterCardFrameState({
    state,
    editing: draft.active || previewing,
    tier: characterFound ? character.tier : undefined
  })
  const tier = frameState === 'top' || frameState === 'ranker' ? frameState : undefined

  return (
    <div {...stylex.props(styles.slot)}>
      <CardFrame as="article" state={frameState} aria-label={`${slot}번 슬롯`} aria-busy={busy}>
        <div {...stylex.props(styles.body)}>
          <PortraitWell tier={tier} size="party">
            {characterFound && <Portrait src={character.image} />}
            {lookupStep !== null && <LookupProgress slot={slot} step={lookupStep} size="party" />}
          </PortraitWell>
          <div {...stylex.props(styles.column)}>
            <div {...stylex.props(styles.header)}>
              <LookupField
                slot={slot}
                tone={toNameFieldTone(frameState)}
                draft={draft}
                size="party"
              />
              {tier !== undefined && (
                <span {...stylex.props(shapes.srOnly)}>{tierLabels[tier]} 단계</span>
              )}
              {frameState === 'failure' && <FailureMark label={cardStatus} size="party" />}
              {picker !== undefined && (
                <CandidateChip
                  expanded={candidates.open}
                  controls={candidates.open ? candidateWindowId : undefined}
                  onClick={candidates.toggle}
                >
                  {`후보 ${picker.choices.length}`}
                </CandidateChip>
              )}
              {snapshotMark !== undefined && <SnapshotChip mark={snapshotMark} size="party" />}
            </div>
            {characterFound ? (
              <AffiliationLine adventure={character.adventure} guild={character.guild} />
            ) : (
              <NoticeLine>{slotNotice || emptyMessage}</NoticeLine>
            )}
            <StatLine
              fame={characterFound ? character.fame : null}
              score={score}
              vacant={isVacantSlot(state)}
              tier={tier}
            />
            {characterFound && <JobLine job={character.job} note={foundNote} />}
          </div>
        </div>
        {snapshotMark?.kind === 'absent' && <SnapshotOverlay />}
        <CardAnnouncer>
          {characterFound && !editing ? character.name : slotNotice || cardStatus}
        </CardAnnouncer>
      </CardFrame>
      {picker !== undefined && candidates.open && (
        <CandidateWindow
          id={candidateWindowId}
          slot={slot}
          picker={picker}
          onPick={onPickCandidate}
          onClose={candidates.close}
        />
      )}
    </div>
  )
}

function CandidateChip({
  expanded,
  controls,
  onClick,
  children
}: {
  expanded: boolean
  controls: string | undefined
  onClick: () => void
  children: string
}): React.JSX.Element {
  return (
    <button
      type="button"
      aria-expanded={expanded}
      aria-controls={controls}
      onClick={onClick}
      {...stylex.props(styles.candidateChip, shapes.cutTopRight)}
    >
      <Typo.caption as="span">{children}</Typo.caption>
    </button>
  )
}

function AffiliationLine({
  adventure,
  guild
}: {
  adventure: string
  guild: string | null | undefined
}): React.JSX.Element {
  return (
    <div {...stylex.props(styles.line)}>
      <Typo.caption {...stylex.props(styles.adventure)}>{adventure}</Typo.caption>
      <LineDivider />
      <Typo.caption {...stylex.props(styles.guild)}>{guild ?? MISSING_VALUE}</Typo.caption>
    </div>
  )
}

function NoticeLine({ children }: { children: string }): React.JSX.Element {
  return (
    <div {...stylex.props(styles.line)}>
      {children === '' ? (
        <Typo.caption aria-hidden="true" {...stylex.props(styles.placeholder)}>
          모험단
        </Typo.caption>
      ) : (
        <LineMessage>{children}</LineMessage>
      )}
    </div>
  )
}

function JobLine({ job, note }: { job: string; note: string }): React.JSX.Element {
  return (
    <div {...stylex.props(styles.line)}>
      <Typo.caption {...stylex.props(styles.job)}>{toJobLabel(job)}</Typo.caption>
      {note !== '' && (
        <>
          <LineDivider />
          <LineMessage>{note}</LineMessage>
        </>
      )}
    </div>
  )
}

function LineDivider(): React.JSX.Element {
  return <span aria-hidden="true" {...stylex.props(styles.lineDivider)} />
}

function LineMessage({ children }: { children: string }): React.JSX.Element {
  return (
    <Typo.caption as="p" title={children} {...stylex.props(styles.message)}>
      {children}
    </Typo.caption>
  )
}

const AWAKENING_PREFIX = /^眞\s*/u

function toJobLabel(job: string): string {
  return job.replace(AWAKENING_PREFIX, '')
}
