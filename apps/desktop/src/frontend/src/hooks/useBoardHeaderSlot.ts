import { create } from 'zustand'

const useBoardHeaderSlotStore = create<{ slot: HTMLElement | null }>()(() => ({ slot: null }))

export function attachBoardHeaderSlot(slot: HTMLElement | null): void {
  useBoardHeaderSlotStore.setState({ slot })
}

export function useBoardHeaderSlot(): HTMLElement | null {
  return useBoardHeaderSlotStore((state) => state.slot)
}
