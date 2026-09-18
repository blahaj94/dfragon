import type { SlotState } from '../../types/cards'

export const scenarios: Record<string, SlotState[]> = {
  states: ['success', 'success', 'failure', 'idle'],
  faces: ['success', 'success', 'success', 'success'],
  pending: ['pending', 'empty', 'failure', 'idle'],
  missing: ['success', 'success', 'success', 'success']
}
