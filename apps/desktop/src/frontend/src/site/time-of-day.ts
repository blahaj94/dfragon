import type { TimeOfDay } from '../../../backend/app-icon/time-of-day'
import afternoon from '../../../../resources/time-of-day/afternoon.png'
import dawn from '../../../../resources/time-of-day/dawn.png'
import day from '../../../../resources/time-of-day/day.png'
import night from '../../../../resources/time-of-day/night.png'

export const timeOfDayImages: Record<TimeOfDay, string> = { night, dawn, day, afternoon }

export { readTimeOfDay, type TimeOfDay } from '../../../backend/app-icon/time-of-day'
