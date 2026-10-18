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
  collapsed = false,
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
  /** 파티 머리의 접기. 그림 칸, 직업, 면 탭을 접고 머리, 소속, 이름, 명성, 장비 점수만 남긴다. */
  collapsed?: boolean
  onLookup?: (nickname: string, serverId: string) => void
}): React.JSX.Element {
  const [face, setFace] = useState(initialFace)
  const [name, setName] = useState(nickname ?? character?.name ?? '')
  const [serverId, setServerId] = useState<string>(character?.serverId ?? '')
  const [dirty, setDirty] = useState(false)
  const [nameFocused, setNameFocused] = useState(false)
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
  // 접힌 카드는 캐릭터 면만 보이고, 펼치면 고른 면으로 돌아온다.
  const shownFace = collapsed || !canTurn ? 0 : face
  const showCharacter = shownFace === 0
  const characterFound = state === 'success' && character != null
  const vacant = isVacantSlot(state)
  const busy = loading || state === 'pending'
  const cardStatus = getCharacterCardStatus(state)
  const status = inputNotice || notice || cardStatus
  // 상태 이름은 꺾쇠와 표시로 보이므로 글자로 다시 쓰지 않는다. 0건과 안내 문구만 화면에 남긴다.
  const emptyMessage = state === 'empty' ? cardStatus : ''
  const message = inputNotice || notice || emptyMessage
  const frameState = getCharacterCardFrameState({
    state,
    editing: nameFocused || dirty || editing
  })
  const showRetry = state === 'failure' && onRetry != null

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
    <div {...stylex.props(styles.slot)}>
      <CardFrame as="article" state={frameState} aria-label={`${slot}번 슬롯`} aria-busy={busy}>
        <div {...stylex.props(styles.header)}>
          <span
            aria-hidden="true"
            {...stylex.props(
              styles.number,
              shapes.cutTopRight,
              frameState === 'selected' && styles.numberSelected,
              frameState === 'waiting' && styles.numberWaiting
            )}
          >
            {String(slot).padStart(2, '0')}
          </span>
          {showCharacter && (inputEnabled || characterFound) && (
            <div {...stylex.props(styles.server)}>
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
          <span {...stylex.props(styles.spacer)} />
          {characterFound && character.serverRank != null && (
            <span {...stylex.props(styles.rank)}>
              <span aria-hidden="true">#{character.serverRank}</span>
              <span {...stylex.props(shapes.srOnly)}>서버 순위 {character.serverRank}위</span>
            </span>
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
                frameState === 'failure' && shapes.hazardStripes,
                styles.well,
                collapsed && styles.wellCollapsed
              )}
            >
              {characterFound && (
                <div {...stylex.props(styles.portrait)}>
                  <CardImage src={character.image} label="캐릭터" portrait />
                </div>
              )}
              {characterFound && message && (
                <Typo.caption as="p" {...stylex.props(styles.topNotice)}>
                  {message}
                </Typo.caption>
              )}
              {(busy || (!characterFound && message) || showRetry) && (
                <div {...stylex.props(styles.center)}>
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
                    {character.guild && (
                      <>
                        <span aria-hidden="true" {...stylex.props(styles.affiliationDivider)} />
                        <Typo.caption weight={600} {...stylex.props(styles.guild)}>
                          {character.guild}
                        </Typo.caption>
                      </>
                    )}
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
                  onFocus={() => setNameFocused(true)}
                  onBlur={() => setNameFocused(false)}
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
                  {...stylex.props(
                    styles.name,
                    frameState === 'waiting' && styles.nameWaiting,
                    frameState === 'failure' && styles.nameFailure,
                    frameState === 'selected' && styles.nameSelected
                  )}
                />
              </div>
              {((editing && state === 'success') || characterFound) && (
                <div {...stylex.props(styles.collapsible, collapsed && styles.collapsibleHidden)}>
                  {editing && state === 'success' && (
                    <Typo.caption {...stylex.props(styles.hint)}>Enter로 조회</Typo.caption>
                  )}
                  {characterFound && (
                    <Typo.txtS {...stylex.props(styles.job)}>{character.job}</Typo.txtS>
                  )}
                </div>
              )}
            </div>
          </Tabs.Panel>
          {canTurn && (
            <>
              <Tabs.Panel value={1} {...stylex.props(styles.face)}>
                <EquipmentGrid character={character} />
              </Tabs.Panel>
              <Tabs.Panel value={2} {...stylex.props(styles.face)}>
                <EquipmentGrid character={character} oath />
              </Tabs.Panel>
              <Tabs.Panel value={3} {...stylex.props(styles.face, styles.investment)}>
                <InvestmentTable equipment={character.equipment} />
              </Tabs.Panel>
            </>
          )}
          <dl {...stylex.props(styles.stats, vacant && styles.statsVacant)}>
            <div {...stylex.props(styles.statRow)}>
              <Typo.caption as="dt" {...stylex.props(styles.statLabel)}>
                명성
              </Typo.caption>
              <StatValue value={characterFound ? character.fame : null} vacant={vacant} />
            </div>
            <div
              {...stylex.props(
                styles.statRow,
                styles.statRowDivided,
                vacant && styles.statRowDividedVacant
              )}
            >
              <Typo.caption as="dt" {...stylex.props(styles.statLabel)}>
                장비 점수
              </Typo.caption>
              <StatValue
                value={characterFound ? (character.equipmentScore ?? null) : null}
                vacant={vacant}
              />
            </div>
          </dl>
          <div {...stylex.props(styles.faces, collapsed && styles.collapsibleHidden)}>
            {vacant ? (
              <div aria-hidden="true" {...stylex.props(styles.facesVacant)} />
            ) : (
              <Tabs.List surface="card" aria-label={`${slot}번 카드 면`}>
                {cardFaces.map((label, index) => (
                  <Tabs.Tab key={label} value={index} disabled={index > 0 && !canTurn}>
                    {label}
                  </Tabs.Tab>
                ))}
              </Tabs.List>
            )}
          </div>
        </Tabs.Root>
        <span aria-live="polite" {...stylex.props(shapes.srOnly)}>
          {hasCharacter ? character?.name : status}
        </span>
      </CardFrame>
    </div>
  )
}

// 명성과 장비 점수 값. 0과 알 수 없음을 구분하고 알 수 없으면 같은 크기의 `—`를 흐리게 둔다.
function StatValue({
  value,
  vacant
}: {
  value: number | null
  vacant: boolean
}): React.JSX.Element {
  if (value == null) {
    return (
      <dd {...stylex.props(styles.statValue, styles.statMissing, vacant && styles.statVacant)}>
        —
      </dd>
    )
  }

  return (
    <dd {...stylex.props(styles.statValue)}>
      <NumericText value={value} />
    </dd>
  )
}
