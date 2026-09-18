import { useState } from 'react'
import * as stylex from '@stylexjs/stylex'
import { CardImage, EquipmentGrid, InvestmentTable } from './CardContent'
import { colors } from './theme.stylex'
import { serverNames } from './servers'
import { cardFaces, type CardCharacter, type SlotState } from './types'

const styles = stylex.create({
  card: {
    position: 'relative',
    height: 280,
    boxSizing: 'border-box',
    minWidth: 0,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: colors.card,
    color: colors.text,
    overflow: 'hidden'
  },
  failure: { borderWidth: 2, borderStyle: 'solid', borderColor: '#ff535b' },
  turn: {
    position: 'absolute',
    inset: 0,
    borderWidth: 0,
    borderRadius: 11,
    backgroundColor: 'transparent',
    cursor: 'pointer',
    outlineOffset: -4,
    ':focus-visible': { outline: `2px solid ${colors.accent}` },
    ':hover': { boxShadow: 'inset 0 0 0 1px #8795a8' }
  },
  content: { position: 'absolute', inset: 0, pointerEvents: 'none' },
  portrait: { position: 'absolute', inset: '10px 12px 50px', opacity: 1 },
  identity: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    right: 12,
    textAlign: 'center',
    display: 'grid',
    gap: 4,
    fontSize: 11
  },
  adventure: { color: colors.adventure, marginBottom: 27 },
  fame: { color: colors.accent, fontSize: 12 },
  muted: { color: colors.muted },
  equipment: {
    position: 'absolute',
    inset: '48px 11px 48px',
    display: 'grid',
    alignItems: 'center'
  },
  investment: { position: 'absolute', inset: '42px 5px 6px' },
  input: {
    position: 'absolute',
    bottom: 44,
    left: 11,
    width: 'calc(100% - 22px)',
    boxSizing: 'border-box',
    height: 22,
    textAlign: 'center',
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: colors.border,
    borderRadius: 4,
    backgroundColor: colors.input,
    color: colors.text,
    fontFamily: 'inherit',
    fontSize: 13,
    outlineOffset: 2,
    ':focus-visible': { outline: '2px solid #f57424' }
  },
  select: {
    position: 'absolute',
    top: 11,
    left: 11,
    maxWidth: 'calc(100% - 60px)',
    height: 22,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: '#f57424',
    borderRadius: 4,
    backgroundColor: '#4a3025',
    color: '#ffad78',
    fontFamily: 'inherit',
    fontSize: 10
  },
  detail: {
    position: 'absolute',
    top: 7,
    right: 7,
    width: 32,
    height: 32,
    display: 'grid',
    placeItems: 'center',
    borderWidth: 0,
    borderRadius: 6,
    backgroundColor: colors.control,
    color: colors.text,
    cursor: 'pointer',
    ':focus-visible': { outline: `2px solid ${colors.accent}` },
    ':disabled': { opacity: 0.35, cursor: 'default' }
  },
  status: {
    position: 'absolute',
    top: '43%',
    left: 10,
    right: 10,
    textAlign: 'center',
    fontSize: 12,
    color: colors.muted
  },
  error: { color: '#ff8888' },
  editing: {
    position: 'absolute',
    top: 45,
    left: 12,
    right: 12,
    color: colors.muted,
    fontSize: 11,
    textAlign: 'center'
  },
  srOnly: {
    position: 'absolute',
    width: 1,
    height: 1,
    padding: 0,
    overflow: 'hidden',
    clipPath: 'inset(50%)',
    whiteSpace: 'nowrap'
  }
})

export function CharacterCard({
  character,
  state,
  slot,
  initialFace = 0,
  onDetail
}: {
  character: CardCharacter
  state: SlotState
  slot: number
  initialFace?: number
  onDetail: () => void
}): React.JSX.Element {
  const [face, setFace] = useState(initialFace)
  const [name, setName] = useState(state === 'idle' ? '' : character.name)
  const [serverId, setServerId] = useState<string>(character.serverId)
  const editing = name !== character.name || serverId !== character.serverId
  const canTurn = state === 'success' && !editing
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
        {state === 'success' && showCharacter && (
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
          {state === 'success' && (
            <select
              aria-label={`${slot}번 서버`}
              value={serverId}
              onChange={(event) => setServerId(event.target.value)}
              {...stylex.props(styles.select)}
            >
              {Object.entries(serverNames).map(([id, label]) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </select>
          )}
          <input
            aria-label={`${slot}번 캐릭터 이름`}
            value={name}
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
          disabled={!canTurn}
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
