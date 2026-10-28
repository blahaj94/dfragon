import { create } from 'zustand'
import type { SearchMode } from '../types/search-mode'

export const useSearchModeStore = create<{
  searchMode: SearchMode
  changeSearchMode: (searchMode: SearchMode) => void
}>()((set) => ({
  searchMode: 'party',
  changeSearchMode: (searchMode) => set({ searchMode })
}))
