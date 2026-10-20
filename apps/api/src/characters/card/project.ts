import { isRecord, textOrNull } from '@dfragon/lib/utils/shape-check'
import { gradeEnchant, isEnchantStatusValue } from './enchant-grades.js'
import type { EnchantGradeTable } from './enchant-grades.js'
import type {
  CharacterBufferStats,
  CharacterCard,
  CharacterDealerStats,
  CharacterInvestment,
  CharacterOathCard,
  CharacterRarityCount,
  CharacterRole,
  CharacterServerRank,
  CharacterSetCard,
  CharacterSetPoint,
  CharacterTownStatName,
  EnchantStatus
} from './types.js'
import { finiteOrNull, records } from './values.js'

// Only the stored sections the card reads; projectCharacterDetails output satisfies this shape.
export interface CharacterCardSource {
  character: Record<string, unknown>
  status: { status: unknown }
  equipment: { equipment: unknown; setItemInfo: unknown }
  oath: unknown
}

const bufferJobs = new Set(['크루세이더', '인챈트리스', '패러메딕', '뮤즈'])
const spiritBufferJobs = new Set(['뮤즈', '패러메딕'])
const maleCrusaderJobName = '프리스트(남)'
const awakeningPrefix = '眞'

// Fixed order of the Desktop investment face (apps/desktop constants/equipment.ts investmentIds).
const investmentSlots = [
  ['WEAPON', '무기'],
  ['JACKET', '상의'],
  ['SHOULDER', '머리어깨'],
  ['PANTS', '하의'],
  ['WAIST', '벨트'],
  ['SHOES', '신발'],
  ['AMULET', '목걸이'],
  ['WRIST', '팔찌'],
  ['RING', '반지'],
  ['SUPPORT', '보조장비'],
  ['MAGIC_STON', '마법석'],
  ['EARRING', '귀걸이']
] as const

const STAT_NUMBER_PATTERN = /^[+-]?\d+(?:\.\d+)?%?$/

// The advancement name without the awakening prefix, e.g. '眞 뮤즈' -> '뮤즈'.
function baseJobGrowName(jobGrowName: unknown): string | null {
  const name = textOrNull(jobGrowName)
  if (name === null) {
    return null
  }

  if (!name.startsWith(awakeningPrefix)) {
    return name
  }

  return name.slice(awakeningPrefix.length).trim()
}

export function characterRole(jobGrowName: unknown): CharacterRole | null {
  const job = baseJobGrowName(jobGrowName)
  if (job === null) {
    return null
  }

  if (bufferJobs.has(job)) {
    return 'buffer'
  }

  return 'dealer'
}

// Neople sends most stats as numbers and some as "48.3%"; anything else is unknown.
export function statNumber(value: unknown): number | null {
  if (typeof value === 'string' && STAT_NUMBER_PATTERN.test(value)) {
    return Number(value.replace('%', ''))
  }

  return finiteOrNull(value)
}

function statusValues(status: unknown): Map<string, number | null> {
  const values = new Map<string, number | null>()
  for (const entry of records(status)) {
    if (typeof entry.name === 'string' && !values.has(entry.name)) {
      values.set(entry.name, statNumber(entry.value))
    }
  }

  return values
}

// Male 크루세이더 shares the advancement name with the female one, so the base job name tells them apart.
function townStatName(
  character: Record<string, unknown>,
  value: (name: string) => number | null
): CharacterTownStatName {
  const job = baseJobGrowName(character.jobGrowName)
  if (job !== null && spiritBufferJobs.has(job)) {
    return '정신력'
  }

  if (job === '크루세이더' && character.jobName === maleCrusaderJobName) {
    const spirit = value('정신력')
    const vitality = value('체력')
    if (vitality !== null && (spirit === null || vitality > spirit)) {
      return '체력'
    }

    return '정신력'
  }

  return '지능'
}

function projectStats(
  role: CharacterRole | null,
  character: Record<string, unknown>,
  status: unknown
): CharacterDealerStats | CharacterBufferStats | null {
  const values = statusValues(status)
  const value = (name: string) => values.get(name) ?? null
  if (role === 'buffer') {
    const name = townStatName(character, value)
    const townStat = value(name)

    return {
      role,
      townStatName: name,
      townStat,
      buff30: null,
      buff50: null,
      switchingLevel: null
    }
  }

  if (role === 'dealer') {
    // The job attack type is not known here, so the larger of physical and magical applies.
    const criticals = [value('물리 크리티컬'), value('마법 크리티컬')].filter((v) => v !== null)
    const critical = criticals.length > 0 ? Math.max(...criticals) : null
    const attackIncrease = value('공격력 증가')
    const amplification = value('공격력 증폭')

    return { role, attackIncrease, amplification, critical, switchingLevel: null }
  }

  return null
}

function setPoint(value: unknown): CharacterSetPoint | null {
  if (!isRecord(value)) {
    return null
  }
  const current = finiteOrNull(value.current)
  const min = finiteOrNull(value.min)
  const max = finiteOrNull(value.max)
  if (current === null || min === null || max === null) {
    return null
  }

  return { current, min, max }
}

// Keeps the first-seen order so the same input always lists rarities the same way.
function rarityCounts(rarities: (string | null)[]): CharacterRarityCount[] {
  const counts = new Map<string, number>()
  for (const rarity of rarities) {
    if (rarity !== null) {
      counts.set(rarity, (counts.get(rarity) ?? 0) + 1)
    }
  }

  return [...counts].map(([rarity, count]) => ({ rarity, count }))
}

function projectSet(equipment: CharacterCardSource['equipment']): CharacterSetCard | null {
  const items = records(equipment.equipment)
  const sets = records(equipment.setItemInfo).flatMap((set) => {
    const setItemId = textOrNull(set.setItemId)
    const name = textOrNull(set.setItemName)
    const slots = records(set.slotInfo).flatMap((slot) => {
      const slotId = textOrNull(slot.slotId)
      if (slotId === null) {
        return []
      }
      const rarity = textOrNull(slot.itemRarity)

      return [{ slotId, rarity }]
    })
    if (setItemId === null || name === null) {
      return []
    }

    return [{ set, setItemId, name, slots }]
  })
  // The set covering the most slots represents the character; ties keep the provider order.
  const chosen = sets.reduce<(typeof sets)[number] | null>((best, candidate) => {
    if (best && best.slots.length >= candidate.slots.length) {
      return best
    }

    return candidate
  }, null)
  if (!chosen) {
    return null
  }
  const { set, setItemId, name, slots } = chosen
  const image = items.find(
    (item) => item.setItemId === setItemId && textOrNull(item.itemId) !== null
  )
  const imageItemId = image ? textOrNull(image.itemId) : null
  const rarityName = textOrNull(set.setItemRarityName)
  const point = setPoint(isRecord(set.active) ? set.active.setPoint : null)
  const slotRarityCounts = rarityCounts(slots.map((slot) => slot.rarity))

  return {
    setItemId,
    name,
    rarityName,
    point,
    imageItemId,
    slots,
    rarityCounts: slotRarityCounts
  }
}

function projectOath(oath: unknown): CharacterOathCard | null {
  if (!isRecord(oath) || !isRecord(oath.info)) {
    return null
  }
  const info = oath.info
  const itemId = textOrNull(info.itemId)
  const name = textOrNull(info.itemName)
  if (itemId === null || name === null) {
    return null
  }
  const setInfo = isRecord(oath.setInfo) ? oath.setInfo : {}
  // oathUpgrade is null until the first 묵언의 진의 step; the step is the provider list position.
  const upgradeOptions = isRecord(info.oathUpgrade) ? info.oathUpgrade.options : null
  const options = Array.isArray(upgradeOptions) ? upgradeOptions : []
  const upgrades = options.flatMap((option, index) => {
    const stepName = isRecord(option) ? textOrNull(option.stepName) : null
    const optionName = isRecord(option) ? textOrNull(option.optionName) : null
    if (stepName === null || optionName === null) {
      return []
    }
    const step = index + 1

    return [{ step, stepName, optionName }]
  })
  const crystals = records(oath.crystal).flatMap((crystal) => {
    const slotNo = finiteOrNull(crystal.slotNo)
    const crystalId = textOrNull(crystal.itemId)
    const crystalName = textOrNull(crystal.itemName)
    if (slotNo === null || crystalId === null || crystalName === null) {
      return []
    }
    const rarity = textOrNull(crystal.itemRarity)
    const tunedPoint = isRecord(crystal.tune) ? finiteOrNull(crystal.tune.setPoint) : null

    return [{ slotNo, itemId: crystalId, name: crystalName, rarity, setPoint: tunedPoint }]
  })
  const rarity = textOrNull(info.itemRarity)
  const point = finiteOrNull(info.setPoint)
  const setName = textOrNull(setInfo.setName)
  const optionName = textOrNull(setInfo.setOptionName)
  const activeSetPoint = setPoint(isRecord(setInfo.active) ? setInfo.active.setPoint : null)
  const crystalRarityCounts = rarityCounts(crystals.map((crystal) => crystal.rarity))

  return {
    itemId,
    name,
    rarity,
    point,
    setName,
    optionName,
    setPoint: activeSetPoint,
    upgrades,
    crystals,
    rarityCounts: crystalRarityCounts
  }
}

function projectEnchant(
  grades: EnchantGradeTable,
  slotId: string,
  enchant: unknown
): CharacterInvestment['enchant'] {
  if (!isRecord(enchant)) {
    return null
  }
  // Skill-level enchants (reinforceSkill) have no status options and stay ungraded.
  const status = records(enchant.status).flatMap((option): EnchantStatus[] => {
    const name = textOrNull(option.name)
    if (name === null || !isEnchantStatusValue(option.value)) {
      return []
    }

    return [{ name, value: option.value }]
  })
  const grade = gradeEnchant(grades, slotId, status)

  return { status, grade }
}

function projectInvestment(equipment: unknown, grades: EnchantGradeTable): CharacterInvestment[] {
  const items = records(equipment)

  return investmentSlots.map(([slotId, slotName]): CharacterInvestment => {
    const item = items.find((candidate) => candidate.slotId === slotId)
    if (!item) {
      return {
        slotId,
        slotName,
        itemId: null,
        itemName: null,
        rarity: null,
        reinforce: null,
        enchant: null
      }
    }
    const value = finiteOrNull(item.reinforce)
    const amplificationName = textOrNull(item.amplificationName)
    const kind: 'reinforce' | 'amplify' = amplificationName === null ? 'reinforce' : 'amplify'
    const reinforce = value === null ? null : { kind, value, amplificationName }
    const itemId = textOrNull(item.itemId)
    const itemName = textOrNull(item.itemName)
    const rarity = textOrNull(item.itemRarity)
    const enchant = projectEnchant(grades, slotId, item.enchant)

    return { slotId, slotName, itemId, itemName, rarity, reinforce, enchant }
  })
}

// Pure normalization of stored Neople sections; the engine-only values stay null for Desktop main.
export function projectCharacterCard(
  details: CharacterCardSource,
  serverRank: CharacterServerRank | null,
  grades: EnchantGradeTable
): CharacterCard {
  const role = characterRole(details.character.jobGrowName)
  const stats = projectStats(role, details.character, details.status.status)
  const set = projectSet(details.equipment)
  const oath = projectOath(details.oath)
  const investment = projectInvestment(details.equipment.equipment, grades)

  return { role, stats, score: null, serverRank, set, oath, investment }
}
