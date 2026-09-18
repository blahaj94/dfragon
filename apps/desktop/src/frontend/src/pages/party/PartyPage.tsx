import { ActionButton } from '@ldb/ui'
import * as stylex from '@stylexjs/stylex'
import { CharacterCard } from '../../components/cards/CharacterCard'
import type { CardCharacter, SlotState } from '../../components/cards/types'
import { styles } from './PartyPage.style'

export function PartyPage({
  character,
  slots,
  resetKey,
  compareFaces,
  light,
  onToggleTheme,
  onDetail
}: {
  character: CardCharacter
  slots: SlotState[]
  resetKey: string
  compareFaces: boolean
  light: boolean
  onToggleTheme: () => void
  onDetail: () => void
}): React.JSX.Element {
  return (
    <>
      <header {...stylex.props(styles.header)}>
        <ActionButton size="small" variant="ghost" disabled aria-label="캡처 연결 예정">
          <svg
            aria-hidden="true"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3z" />
            <circle cx="12" cy="13" r="3" />
          </svg>
        </ActionButton>
        <div {...stylex.props(styles.actions)}>
          <ActionButton
            size="small"
            variant="ghost"
            aria-label={light ? '다크 테마' : '라이트 테마'}
            onClick={() => onToggleTheme()}
          >
            <span {...stylex.props(styles.themeIcon)}>{light ? '☾' : '☀'}</span>
          </ActionButton>
          <ActionButton size="small" variant="ghost" disabled>
            로그인
          </ActionButton>
        </div>
      </header>
      <section aria-label="파티 캐릭터" {...stylex.props(styles.grid)}>
        {slots.map((state, index) => (
          <CharacterCard
            key={`${resetKey}-${index}`}
            slot={index + 1}
            character={character}
            state={state}
            initialFace={compareFaces ? index : 0}
            onDetail={onDetail}
          />
        ))}
      </section>
    </>
  )
}
