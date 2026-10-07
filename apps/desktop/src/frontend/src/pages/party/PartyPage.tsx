import { CameraIcon } from '../../components/CameraIcon'
import { Typo, ActionButton } from '@dfragon/ui'
import type { ReactNode } from 'react'
import * as stylex from '@stylexjs/stylex'
import { CharacterCard } from '../../sections/CharacterCard'
import type { CardCharacter, SlotState } from '../../types/cards'
import { styles } from './PartyPage.style'
import { useColorTheme } from '../../hooks/useColorTheme'
import { SettingsSection } from '../../sections/SettingsSection'

export function PartyPage({
  character,
  characters,
  slots,
  resetKey = 'party',
  compareFaces = false,
  inputEnabled = false,
  basicOnly = false,
  account,
  capture,
  settings = <SettingsSection />,
  nicknames,
  onDetail,
  onSlotDetail,
  slotNotices,
  onRetry,
  retryEnabled,
  retryPending
}: {
  character?: CardCharacter
  characters?: readonly (CardCharacter | null)[]
  slots: SlotState[]
  resetKey?: string
  compareFaces?: boolean
  inputEnabled?: boolean
  basicOnly?: boolean
  account?: ReactNode
  capture?: ReactNode
  settings?: ReactNode
  nicknames?: readonly (string | null)[]
  onDetail?: () => void
  onSlotDetail?: (slot: number) => void
  slotNotices?: readonly (string | undefined)[]
  onRetry?: (slot: number) => void
  retryEnabled?: readonly boolean[]
  retryPending?: readonly boolean[]
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
          {settings}
        </div>
      </header>
      <section aria-label="파티 캐릭터" {...stylex.props(styles.grid)}>
        {slots.map((state, index) => {
          const selected = characters == null ? character : (characters[index] ?? undefined)
          const identity =
            selected == null ? '' : `${selected.serverId}:${selected.characterId ?? selected.name}`
          const observedNickname = nicknames?.[index] ?? undefined
          const displayedNickname =
            state === 'success' && selected != null ? undefined : observedNickname
          let detailAction = onDetail
          if (onSlotDetail !== undefined) {
            detailAction =
              state === 'success' && selected != null ? () => onSlotDetail(index) : undefined
          }

          return (
            <CharacterCard
              key={`${resetKey}-${index}-${identity}`}
              slot={index + 1}
              character={selected}
              state={state}
              nickname={displayedNickname}
              inputEnabled={inputEnabled}
              basicOnly={basicOnly}
              initialFace={compareFaces ? index : 0}
              onDetail={detailAction}
              notice={slotNotices?.[index]}
              onRetry={onRetry == null ? undefined : () => onRetry(index)}
              retryEnabled={retryEnabled?.[index]}
              retryPending={retryPending?.[index]}
            />
          )
        })}
      </section>
    </>
  )
}
