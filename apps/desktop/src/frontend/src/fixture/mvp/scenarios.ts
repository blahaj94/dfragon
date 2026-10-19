import type { SlotState } from '../../types/cards'

export const scenarios: Record<string, SlotState[]> = {
  states: ['success', 'success', 'failure', 'idle'],
  faces: ['success', 'success', 'success', 'success'],
  pending: ['pending', 'empty', 'failure', 'idle'],
  missing: ['success', 'success', 'success', 'success'],
  identification: ['success', 'waiting-portrait', 'waiting-policy', 'failure'],
  tiers: ['success', 'success', 'success', 'idle'],
  roles: ['success', 'success', 'success', 'success'],
  snapshot: ['success', 'success', 'success', 'success']
}
