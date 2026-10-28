import { create } from 'zustand'
import type { SearchMode } from '../types/search-mode'

export const useSearchModeStore = create<{
  searchMode: SearchMode
  changeSearchMode: (searchMode: SearchMode) => void
}>()((set) => ({
  searchMode: 'party',
  changeSearchMode: (searchMode) => set({ searchMode })
}))

export function useIsPartyMode(): boolean {
  return useSearchModeStore((state) => state.searchMode === 'party')
}

export function useIsRaidMode(): boolean {
  return useSearchModeStore((state) => state.searchMode === 'raid')
}
