import { MAIN_WINDOW_SIZE } from '../../../preload/common/window-chrome'
import type { SearchMode } from '../components/MainNav'

/** 보이는 화면별 메인 창 내용 높이. 화면이 늘면 타입 검사가 빈 높이를 잡는다. */
export const MAIN_WINDOW_HEIGHTS: Record<SearchMode, number> = {
  party: MAIN_WINDOW_SIZE.partyHeight,
  raid: MAIN_WINDOW_SIZE.raidHeight
}
