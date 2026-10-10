import { ActionButton, ProgressCircle, Typo, typographyVariants } from '@dfragon/ui'
import { ExternalLinkIcon } from '../components/ExternalLinkIcon'
import { UserIcon } from '../components/UserIcon'
import { getCharacterCardStatus } from '../lib/card-presentation'
import { useState } from 'react'
import * as stylex from '@stylexjs/stylex'
import { ServerSelect } from '../components/ServerSelect'
import { CardImage } from '../components/CardImage'
import { EquipmentGrid } from './EquipmentGrid'
import { InvestmentTable } from '../components/InvestmentTable'
import { styles } from './CharacterCard.style'
import { serverNames } from '../constants/servers'
import { cardFaces } from '../constants/cards'
import type { CardCharacter, SlotState } from '../types/cards'

export function CharacterCard({
  character,
  state,
  slot,
  initialFace = 0,
  inputEnabled = false,
  basicOnly = false,
  nickname,
  onDetail,
  notice,
  onRetry,
  retryEnabled = false,
  retryPending = false,
  loading = false,
  onLookup
}: {
  character?: CardCharacter
  state: SlotState
  slot: number
  initialFace?: number
  inputEnabled?: boolean
  basicOnly?: boolean
  nickname?: string
  onDetail?: () => void
  notice?: string
  onRetry?: () => void
  retryEnabled?: boolean
  retryPending?: boolean
  loading?: boolean
  onLookup?: (nickname: string, serverId: string) => void
}): React.JSX.Element {
  const [face, setFace] = useState(initialFace)
  const [name, setName] = useState(nickname ?? character?.name ?? '')
  const [serverId, setServerId] = useState<string>(character?.serverId ?? '')
  const [dirty, setDirty] = useState(false)
  const [submitted, setSubmitted] = useState<{ nickname: string; serverId: string } | null>(null)
  const [inputNotice, setInputNotice] = useState('')
  const incomingName = character?.name ?? nickname
  const incomingServerId = character?.serverId
  const [previousSource, setPreviousSource] = useState({
    name: incomingName,
    serverId: incomingServerId
  })
  const acceptsSource =
    submitted === null ||
    (character?.name === submitted.nickname && character?.serverId === submitted.serverId)
  if (previousSource.name !== incomingName || previousSource.serverId !== incomingServerId) {
    setPreviousSource({ name: incomingName, serverId: incomingServerId })
    if (!dirty && acceptsSource) {
      if (incomingName !== undefined) {
        setName(incomingName)
      }

      if (incomingServerId !== undefined) {
        setServerId(incomingServerId)
      }
    }
  }
  const editing = character != null && (name !== character.name || serverId !== character.serverId)
  const hasCharacter = state === 'success' && character != null && !editing
  const canTurn = hasCharacter && !basicOnly
  const showCharacter = face === 0 || !canTurn
  const busy = loading || state === 'pending'
  const status = inputNotice || notice || getCharacterCardStatus(state)

  function submit(nextServerId = serverId): void {
    if (nextServerId.length === 0) {
      setInputNotice('서버를 선택해 주세요.')

      return
    }

    if (name.trim().length === 0) {
      setInputNotice('캐릭터 이름을 입력해 주세요.')

      return
    }
    const nickname = name.trim()
    setDirty(false)
    setName(nickname)
    setSubmitted({ nickname, serverId: nextServerId })
    setInputNotice('')
    onLookup?.(nickname, nextServerId)
  }

  return (
    <article
      aria-label={`${slot}번 슬롯`}
      aria-busy={busy}
      {...stylex.props(styles.card, state === 'failure' && styles.failure)}
    >
      {canTurn && (
        <button
          type="button"
          aria-label={`${slot}번 ${cardFaces[face]} 카드, 다음 면 보기`}
          onClick={() => setFace((face + 1) % cardFaces.length)}
          {...stylex.props(styles.turn)}
        />
      )}
      <div {...stylex.props(styles.content)}>
        {busy && (
          <div
            role="status"
            aria-label={`${slot}번 캐릭터 확인 중`}
            {...stylex.props(styles.progress)}
          >
            <ProgressCircle size="24" tone="staticWhite" />
          </div>
        )}
        {state === 'success' && character != null && showCharacter && (
          <>
            <div {...stylex.props(styles.portrait)}>
              <CardImage src={character.image} label="캐릭터" portrait />
            </div>
            <div {...stylex.props(styles.identity)}>
              <Typo.caption {...stylex.props(styles.adventure)}>{character.adventure}</Typo.caption>
              <Typo.caption {...stylex.props(styles.muted)}>{character.job}</Typo.caption>
              <Typo.caption weight={700} {...stylex.props(styles.fame)}>
                <UserIcon width="16" height="16" />
                <span {...stylex.props(styles.srOnly)}>명성 </span>
                {character.fame?.toLocaleString('ko-KR') ?? '—'}
              </Typo.caption>
            </div>
          </>
        )}
        {canTurn && (face === 1 || face === 2) && (
          <div {...stylex.props(styles.equipment)}>
            <EquipmentGrid character={character} oath={face === 2} />
          </div>
        )}
        {canTurn && face === 3 && (
          <div {...stylex.props(styles.investment)}>
            <InvestmentTable equipment={character.equipment} />
          </div>
        )}
        {status && (
          <Typo.txtS
            as="span"
            role="status"
            {...stylex.props(
              styles.status,
              busy && styles.statusWhileLoading,
              state === 'success' && styles.selectedNotice,
              state === 'failure' && styles.error,
              state === 'failure' && onRetry != null && styles.statusWithRetry
            )}
          >
            {status}
          </Typo.txtS>
        )}
      </div>
      {state === 'failure' && onRetry != null && (
        <div {...stylex.props(styles.retry)}>
          <ActionButton
            size="small"
            disabled={!retryEnabled}
            loading={retryPending}
            onClick={onRetry}
          >
            다시 시도
          </ActionButton>
        </div>
      )}
      {showCharacter && (
        <>
          {(inputEnabled || (state === 'success' && character != null)) && (
            <div {...stylex.props(styles.serverAnchor)}>
              <ServerSelect
                label={`${slot}번 서버`}
                value={serverId}
                disabled={!inputEnabled}
                options={Object.entries(serverNames).map(([id, label]) => ({ id, label }))}
                onValueChange={(value) => {
                  setDirty(true)
                  setServerId(value)
                  submit(value)
                }}
              />
            </div>
          )}
          <Typo.txtM
            as="input"
            weight={700}
            aria-label={`${slot}번 캐릭터 이름`}
            value={name}
            disabled={!inputEnabled}
            placeholder="캐릭터명 입력"
            style={name ? undefined : typographyVariants.txtS}
            onChange={(event) => {
              setDirty(true)
              setName(event.target.value)
              setInputNotice('')
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
                submit()
              }
            }}
            {...stylex.props(styles.input)}
          />
        </>
      )}
      {editing && state === 'success' && (
        <Typo.caption {...stylex.props(styles.editing)}>Enter로 조회</Typo.caption>
      )}
      {state !== 'idle' && (
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
      <span aria-live="polite" {...stylex.props(styles.srOnly)}>
        {hasCharacter ? character?.name : status}
      </span>
    </article>
  )
}
