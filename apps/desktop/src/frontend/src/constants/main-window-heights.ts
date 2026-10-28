import { MAIN_WINDOW_SIZE } from '../../../preload/common/window-chrome'
import type { SearchMode } from '../types/search-mode'

export const MAIN_WINDOW_HEIGHTS: Record<SearchMode, number> = {
  party: MAIN_WINDOW_SIZE.partyHeight,
  raid: MAIN_WINDOW_SIZE.raidHeight
}
