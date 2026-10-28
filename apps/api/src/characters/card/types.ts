export type CharacterRole = 'dealer' | 'buffer'

/**
 * Released Desktop builds validate the whole card strictly, so the retired stats, rank, set, oath and
 * investment fields stay as empty values until those builds are retired.
 */
export interface CharacterCard {
  role: CharacterRole | null
  stats: null
  score: null
  serverRank: null
  set: null
  oath: null
  investment: []
}
