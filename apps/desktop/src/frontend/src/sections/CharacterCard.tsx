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
  nickname,
  onDetail
}: {
  character?: CardCharacter
  state: SlotState
  slot: number
  initialFace?: number
  inputEnabled?: boolean
  nickname?: string
  onDetail?: () => void
}): React.JSX.Element {
  const [face, setFace] = useState(initialFace)
  const [name, setName] = useState(state === 'idle' ? '' : (character?.name ?? ''))
  const [serverId, setServerId] = useState<string>(character?.serverId ?? '')
  const editing = character != null && (name !== character.name || serverId !== character.serverId)
  const canTurn = state === 'success' && character != null && !editing
  const showCharacter = face === 0 || !canTurn
  const status =
    state === 'failure'
      ? '검색 실패'
      : state === 'empty'
        ? '검색 결과가 없습니다'
        : state === 'pending'
          ? '검색 중…'
          : ''

  return (
    <article
      aria-label={`${slot}번 슬롯`}
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
        {state === 'success' && character != null && showCharacter && (
          <>
            <div {...stylex.props(styles.portrait)}>
              <CardImage src={character.image} label="캐릭터" portrait />
            </div>
            <div {...stylex.props(styles.identity)}>
              <span {...stylex.props(styles.adventure)}>{character.adventure}</span>
              <span {...stylex.props(styles.muted)}>{character.job}</span>
              <span {...stylex.props(styles.fame)}>♙ {character.fame.toLocaleString('ko-KR')}</span>
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
          <span role="status" {...stylex.props(styles.status, state === 'failure' && styles.error)}>
            {status}
          </span>
        )}
      </div>
      {showCharacter && (
        <>
          {state === 'success' && character != null && (
            <div {...stylex.props(styles.serverAnchor)}>
              <ServerSelect
                label={`${slot}번 서버`}
                value={serverId}
                disabled={!inputEnabled}
                options={Object.entries(serverNames).map(([id, label]) => ({ id, label }))}
                onValueChange={setServerId}
              />
            </div>
          )}
          <input
            aria-label={`${slot}번 캐릭터 이름`}
            value={nickname ?? name}
            disabled={!inputEnabled}
            readOnly={nickname != null}
            placeholder="캐릭터명 입력"
            onChange={(event) => setName(event.target.value)}
            {...stylex.props(styles.input)}
          />
        </>
      )}
      {editing && state === 'success' && (
        <span {...stylex.props(styles.editing)}>이름·서버 수정 중 · 조회 연결 예정</span>
      )}
      {state !== 'idle' && (
        <button
          type="button"
          disabled={!canTurn || onDetail == null}
          aria-label={`${slot}번 캐릭터 상세 열기`}
          onClick={onDetail}
          {...stylex.props(styles.detail)}
        >
          <svg
            aria-hidden="true"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M15 3h6v6m-11 5L21 3" />
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
          </svg>
        </button>
      )}
      <span aria-live="polite" {...stylex.props(styles.srOnly)}>
        {canTurn ? cardFaces[face] : status}
      </span>
    </article>
  )
}
