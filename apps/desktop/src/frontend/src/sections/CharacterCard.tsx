import { Typo, typographyVariants } from '@ldb/ui'
import { ExternalLinkIcon } from '../components/ExternalLinkIcon'
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
  const status = getCharacterCardStatus(state)

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
              <Typo.caption {...stylex.props(styles.adventure)}>{character.adventure}</Typo.caption>
              <Typo.caption {...stylex.props(styles.muted)}>{character.job}</Typo.caption>
              <Typo.caption {...stylex.props(styles.fame)}>
                ♙ {character.fame.toLocaleString('ko-KR')}
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
            {...stylex.props(styles.status, state === 'failure' && styles.error)}
          >
            {status}
          </Typo.txtS>
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
          <Typo.txtM
            as="input"
            weight={700}
            aria-label={`${slot}번 캐릭터 이름`}
            value={nickname ?? name}
            disabled={!inputEnabled}
            readOnly={nickname != null}
            placeholder="캐릭터명 입력"
            style={(nickname ?? name) ? undefined : typographyVariants.txtS}
            onChange={(event) => setName(event.target.value)}
            {...stylex.props(styles.input)}
          />
        </>
      )}
      {editing && state === 'success' && (
        <Typo.caption {...stylex.props(styles.editing)}>
          이름·서버 수정 중 · 조회 연결 예정
        </Typo.caption>
      )}
      {state !== 'idle' && (
        <button
          type="button"
          disabled={!canTurn || onDetail == null}
          aria-label={`${slot}번 캐릭터 상세 열기`}
          onClick={onDetail}
          {...stylex.props(styles.detail)}
        >
          <ExternalLinkIcon width="16" height="16" />
        </button>
      )}
      <span aria-live="polite" {...stylex.props(styles.srOnly)}>
        {canTurn ? cardFaces[face] : status}
      </span>
    </article>
  )
}
