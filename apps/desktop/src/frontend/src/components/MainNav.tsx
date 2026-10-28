import { useState } from 'react'
import { Menu, shapes } from '@dfragon/ui'
import * as stylex from '@stylexjs/stylex'
import { windowChromeStyles } from '../constants/window-chrome.style'
import { useSearchModeStore } from '../hooks/useSearchModeStore'
import { ChevronDownIcon } from './ChevronDownIcon'
import type { SearchMode } from '../types/search-mode'
import { styles } from './MainNav.style'

const SEARCH_MODES: readonly { value: SearchMode; label: string }[] = [
  { value: 'party', label: '파티' },
  { value: 'raid', label: '공대' }
]

function isSearchMode(value: unknown): value is SearchMode {
  return SEARCH_MODES.some((mode) => mode.value === value)
}

export function MainNav(): React.JSX.Element {
  const searchMode = useSearchModeStore((state) => state.searchMode)
  const changeSearchMode = useSearchModeStore((state) => state.changeSearchMode)
  const [open, setOpen] = useState(false)
  const current = SEARCH_MODES.find((mode) => mode.value === searchMode)

  return (
    <nav aria-label="주 메뉴" {...stylex.props(windowChromeStyles.noDrag, styles.nav)}>
      <Menu.Root open={open} onOpenChange={(next) => setOpen(next)}>
        <Menu.Trigger
          aria-current="page"
          render={
            <button
              type="button"
              {...stylex.props(
                styles.item,
                styles.current,
                styles.currentFocus,
                open && styles.open,
                shapes.cutTopRight
              )}
            />
          }
        >
          검색
          <span {...stylex.props(styles.sub, open && styles.onSignal)}>{current?.label}</span>
          <ChevronDownIcon
            width={12}
            height={12}
            strokeWidth={2.5}
            {...stylex.props(styles.chevron, open && styles.onSignal, open && styles.chevronOpen)}
          />
        </Menu.Trigger>
        <Menu.Popup aria-label="검색">
          <Menu.RadioGroup
            value={searchMode}
            onValueChange={(value) => {
              if (isSearchMode(value)) {
                changeSearchMode(value)
              }
            }}
          >
            {SEARCH_MODES.map((mode) => (
              <Menu.RadioItem key={mode.value} value={mode.value} closeOnClick>
                {mode.label}
              </Menu.RadioItem>
            ))}
          </Menu.RadioGroup>
        </Menu.Popup>
      </Menu.Root>
    </nav>
  )
}
