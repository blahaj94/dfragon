import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useBoardHeaderSlot } from '../hooks/useBoardHeaderSlot'

export function BoardHeaderPortal({ children }: { children: ReactNode }): React.ReactPortal | null {
  const slot = useBoardHeaderSlot()

  if (slot == null) {
    return null
  }

  return createPortal(children, slot)
}
