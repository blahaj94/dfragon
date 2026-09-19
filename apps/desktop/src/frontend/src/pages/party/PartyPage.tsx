import { CameraIcon } from '../../components/CameraIcon'
import { Typo, ActionButton } from '@ldb/ui'
import type { ReactNode } from 'react'
import * as stylex from '@stylexjs/stylex'
import { CharacterCard } from '../../sections/CharacterCard'
import type { CardCharacter, SlotState } from '../../types/cards'
import { styles } from './PartyPage.style'
import { useColorTheme } from '../../hooks/useColorTheme'
import { SettingsSection } from '../../sections/SettingsSection'

export function PartyPage({
  character,
  slots,
  resetKey = 'party',
  compareFaces = false,
  inputEnabled = false,
  account,
  capture,
  nicknames,
  onDetail
}: {
  character?: CardCharacter
  slots: SlotState[]
  resetKey?: string
  compareFaces?: boolean
  inputEnabled?: boolean
  account?: ReactNode
  capture?: ReactNode
  nicknames?: readonly (string | null)[]
  onDetail?: () => void
}): React.JSX.Element {
  const { light, toggleTheme } = useColorTheme()

  return (
    <>
      <header {...stylex.props(styles.header)}>
        {capture ?? (
          <ActionButton size="small" variant="ghost" disabled aria-label="캡처 연결 예정">
            <CameraIcon width="20" height="20" />
          </ActionButton>
        )}
        <div {...stylex.props(styles.actions)}>
          <ActionButton
            size="small"
            variant="ghost"
            aria-label={light ? '다크 테마' : '라이트 테마'}
            onClick={toggleTheme}
          >
            <span {...stylex.props(styles.themeIcon)}>{light ? '☾' : '☀'}</span>
          </ActionButton>
          {account ?? (
            <ActionButton size="small" variant="ghost" disabled>
              <Typo.txtS as="span" weight={700}>
                로그인
              </Typo.txtS>
            </ActionButton>
          )}
          <SettingsSection />
        </div>
      </header>
      <section aria-label="파티 캐릭터" {...stylex.props(styles.grid)}>
        {slots.map((state, index) => (
          <CharacterCard
            key={`${resetKey}-${index}`}
            slot={index + 1}
            character={character}
            state={state}
            nickname={nicknames?.[index] ?? undefined}
            inputEnabled={inputEnabled}
            initialFace={compareFaces ? index : 0}
            onDetail={onDetail}
          />
        ))}
      </section>
    </>
  )
}
