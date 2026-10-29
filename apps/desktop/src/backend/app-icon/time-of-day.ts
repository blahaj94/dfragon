export type TimeOfDay = 'night' | 'dawn' | 'day' | 'afternoon'

export function readTimeOfDay(hour: number): TimeOfDay {
  if (hour < 4) {
    return 'night'
  }

  if (hour < 6) {
    return 'dawn'
  }

  if (hour < 12) {
    return 'day'
  }

  if (hour < 18) {
    return 'afternoon'
  }

  if (hour < 22) {
    return 'dawn'
  }

  return 'night'
}
