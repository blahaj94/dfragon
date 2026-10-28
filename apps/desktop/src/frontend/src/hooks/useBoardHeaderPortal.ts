import type { ReactNode, ReactPortal } from 'react'
import { createPortal } from 'react-dom'
import { create } from 'zustand'

const useBoardHeaderSlotStore = create<{ slot: HTMLElement | null }>()(() => ({ slot: null }))

export function attachBoardHeaderSlot(slot: HTMLElement | null): void {
  useBoardHeaderSlotStore.setState({ slot })
}

export function useBoardHeaderPortal(): {
  renderBoardHeader: (header: ReactNode) => ReactPortal | null
} {
  const slot = useBoardHeaderSlotStore((state) => state.slot)
  const renderBoardHeader = (header: ReactNode): ReactPortal | null => {
    if (slot == null) {
      return null
    }

    return createPortal(header, slot)
  }

  return { renderBoardHeader }
}
