import { RAID_PARTY_SIZE } from '../constants/cards'

const raidParties = ['R', 'Y', 'G'] as const

export type RaidParty = (typeof raidParties)[number]

export function toRaidSeat(seat: number): { party: RaidParty; label: string } {
  const index = seat - 1
  const party = raidParties[Math.floor(index / RAID_PARTY_SIZE)]
  const label = `${party}${(index % RAID_PARTY_SIZE) + 1}`

  return { party, label }
}
