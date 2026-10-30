import { SEARCH_SLOT_COUNTS } from '../../../preload/common/types/search'
import type { SeatLayout } from '../lib/seats'
import type { CharacterTier } from '../types/cards'

export const tierLabels: Readonly<Record<CharacterTier, string>> = { top: '상위', ranker: '랭커' }

export const RAID_PARTY_COUNT = 3
export const RAID_PARTY_SIZE = 4
export const RAID_SEAT_LAYOUT: SeatLayout = { rows: RAID_PARTY_COUNT, columns: RAID_PARTY_SIZE }
export const PARTY_SEAT_LAYOUT: SeatLayout = { rows: 1, columns: SEARCH_SLOT_COUNTS.party }

export const MISSING_VALUE = '-'
