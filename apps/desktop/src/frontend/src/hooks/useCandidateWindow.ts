import { useEffect } from 'react'
import { type SlotCardKey, useSlotCardState, useSlotCardStore } from './useSlotCardStore'

export function useCandidateWindow(
  cardKey: SlotCardKey,
  hasCandidates: boolean
): { open: boolean; toggle: () => void; close: () => void } {
  const { candidatesClosed = false } = useSlotCardState(cardKey)
  const updateSlotCard = useSlotCardStore((state) => state.updateSlotCard)

  useEffect(() => {
    if (!hasCandidates && candidatesClosed) {
      updateSlotCard(cardKey, { candidatesClosed: false })
    }
  })
  const open = hasCandidates && !candidatesClosed

  return {
    open,
    toggle: () => updateSlotCard(cardKey, { candidatesClosed: open }),
    close: () => updateSlotCard(cardKey, { candidatesClosed: true })
  }
}
