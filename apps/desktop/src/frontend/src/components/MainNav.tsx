import { Menu, shapes } from '@dfragon/ui'
import * as stylex from '@stylexjs/stylex'
import { windowChromeStyles } from '../constants/window-chrome.style'
import { useSearchModeStore } from '../hooks/useSearchModeStore'
import { ChevronDownIcon } from './ChevronDownIcon'
import type { SearchMode } from '../types/search-mode'
import { styles } from './MainNav.style'

const SEARCH_MODES: readonly SearchMode[] = ['party', 'raid']

const SEARCH_MODE_LABELS: Record<SearchMode, string> = {
  party: '파티',
  raid: '공대'
}

function isSearchMode(value: unknown): value is SearchMode {
  return SEARCH_MODES.some((mode) => mode === value)
}

export function MainNav(): React.JSX.Element {
  const searchMode = useSearchModeStore((state) => state.searchMode)

  return (
    <nav aria-label="주 메뉴" {...stylex.props(windowChromeStyles.noDrag, styles.nav)}>
      <Menu.Root>
        <SearchMenuTrigger modeLabel={SEARCH_MODE_LABELS[searchMode]} />
        <Menu.Popup aria-label="검색">
          <SearchModeRadioGroup />
        </Menu.Popup>
      </Menu.Root>
    </nav>
  )
}

function SearchMenuTrigger({ modeLabel }: { modeLabel: string }): React.JSX.Element {
  return (
    <Menu.Trigger
      aria-current="page"
      render={
        <button
          type="button"
          {...stylex.props(
            styles.item,
            styles.current,
            styles.currentFocus,
            shapes.cutTopRight,
            stylex.defaultMarker()
          )}
        />
      }
    >
      검색
      <span {...stylex.props(styles.sub)}>{modeLabel}</span>
      <ChevronDownIcon width={12} height={12} strokeWidth={2.5} {...stylex.props(styles.chevron)} />
    </Menu.Trigger>
  )
}

function SearchModeRadioGroup(): React.JSX.Element {
  const searchMode = useSearchModeStore((state) => state.searchMode)
  const changeSearchMode = useSearchModeStore((state) => state.changeSearchMode)

  function handleValueChange(value: unknown): void {
    if (isSearchMode(value)) {
      changeSearchMode(value)
    }
  }

  return (
    <Menu.RadioGroup value={searchMode} onValueChange={handleValueChange}>
      {SEARCH_MODES.map((mode) => (
        <Menu.RadioItem key={mode} value={mode} closeOnClick>
          {SEARCH_MODE_LABELS[mode]}
        </Menu.RadioItem>
      ))}
    </Menu.RadioGroup>
  )
}
