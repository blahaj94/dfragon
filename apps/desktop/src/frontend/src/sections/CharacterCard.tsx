import { Button, CardFrame, ProgressCircle, Typo, shapes } from '@dfragon/ui'
import {
  getCharacterCardFrameState,
  getCharacterCardStatus,
  isVacantSlot
} from '../lib/card-presentation'
import * as stylex from '@stylexjs/stylex'
import { type ChangeEvent, type KeyboardEvent, type ReactNode, useId } from 'react'
import { NameField } from '../components/NameField'
import { ServerSelect } from '../components/ServerSelect'
import { SnapshotChip } from '../components/SnapshotChip'
import { SnapshotOverlay } from '../components/SnapshotOverlay'
import { type LookupDraft, useLookupDraft } from '../hooks/useLookupDraft'
import { useServerMenu } from '../hooks/useServerMenu'
import { useCandidateWindow } from '../hooks/useCandidateWindow'
import type { SlotCardKey } from '../hooks/useSlotCardStore'
import { CardImage } from '../components/CardImage'
import { CandidateWindow } from '../components/CandidateWindow'
import { StatLine } from '../components/StatLine'
import { styles } from './CharacterCard.style'
import { serverOptions } from '../constants/server-options'
import { MISSING_VALUE, tierLabels } from '../constants/cards'
import { toNameFieldTone, type NameFieldTone } from '../lib/name-field-tone'
import type { SlotCard } from '../lib/slot-cards'
import { toScoreView } from '../lib/card-score'
import type { CharacterTier } from '../types/cards'

export function CharacterCard({
  cardKey,
  card,
  slot,
  inputEnabled = false,
  onRetry,
  onLookup,
  onPickCandidate
}: {
  cardKey: SlotCardKey
  card: SlotCard
  slot: number
  inputEnabled?: boolean
  onRetry?: () => void
  onLookup?: (nickname: string, serverId: string) => void
  onPickCandidate?: (serverId: string) => void
}): React.JSX.Element {
  const {
    state,
    character,
    notice,
    picker,
    snapshotMark,
    retryEnabled = false,
    retryPending = false,
    loading = false
  } = card
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
          <PortraitWell tier={tier}>
            {characterFound && <Portrait src={character.image} />}
            {busy && <LookupProgress slot={slot} />}
          </PortraitWell>
          <div {...stylex.props(styles.column)}>
            <div {...stylex.props(styles.header)}>
              <LookupField
                slot={slot}
                tone={toNameFieldTone(frameState)}
                draft={draft}
                inputEnabled={inputEnabled}
                showServer={inputEnabled || characterFound}
              />
              {tier !== undefined && (
                <span {...stylex.props(shapes.srOnly)}>{tierLabels[tier]} 단계</span>
              )}
              {frameState === 'selected' && (
                <EditingDots label={previewing ? '후보 미리보기 중' : '이름 수정 중'} />
              )}
              {frameState === 'failure' && <FailureMark label={cardStatus} />}
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
            {state === 'failure' && onRetry != null && (
              <RetryButton disabled={!retryEnabled} loading={retryPending} onClick={onRetry} />
            )}
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
  draft,
  inputEnabled,
  showServer
}: {
  slot: number
  tone: NameFieldTone
  draft: Pick<
    LookupDraft,
    'name' | 'serverId' | 'changeName' | 'changeServer' | 'focusName' | 'blurName' | 'submit'
  >
  inputEnabled: boolean
  showServer: boolean
}): React.JSX.Element {
  const serverMenu = useServerMenu()

  const handleNameChange = (event: ChangeEvent<HTMLInputElement>): void => {
    draft.changeName(event.target.value)
  }

  const handleNameKeyDown = (event: KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
      draft.submit()
    } else if (inputEnabled) {
      serverMenu.openOnTab(event)
    }
  }

  return (
    <div {...stylex.props(styles.nameField)}>
      <NameField
        tone={tone}
        aria-label={`${slot}번 캐릭터 이름`}
        value={draft.name}
        disabled={!inputEnabled}
        onFocus={draft.focusName}
        onBlur={draft.blurName}
        onChange={handleNameChange}
        onKeyDown={handleNameKeyDown}
        end={
          showServer && (
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

function RetryButton({
  disabled,
  loading,
  onClick
}: {
  disabled: boolean
  loading: boolean
  onClick: () => void
}): React.JSX.Element {
  return (
    <div {...stylex.props(styles.line)}>
      <Button
        variant="primary"
        size="sm"
        disabled={disabled}
        loading={loading}
        onClick={onClick}
        {...stylex.props(styles.retry)}
      >
        <Typo.caption as="span">다시 시도</Typo.caption>
      </Button>
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

const AWAKENING_PREFIX = /^眞\s*/u

function toJobLabel(job: string): string {
  return job.replace(AWAKENING_PREFIX, '')
}
