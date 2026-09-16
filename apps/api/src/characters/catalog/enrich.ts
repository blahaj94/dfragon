import { isObject } from '../details/neople.js'
import type { projectCharacterDetails } from '../details/project.js'
import type { CatalogService } from './service.js'
import { catalogKey, isCatalogId, unavailableDetail } from './types.js'
import type { CatalogKey } from './types.js'

type CharacterDetails = ReturnType<typeof projectCharacterDetails>

export async function enrichCharacterDetails(
  details: CharacterDetails,
  catalog: CatalogService,
  signal: AbortSignal
): Promise<CharacterDetails> {
  const references: CatalogKey[] = []
  const jobId = details.character.jobId
  const equipment = details.equipment.equipment
  const buffEquipment = isObject(details.buff.equipment) ? details.buff.equipment.equipment : null
  for (const list of [equipment, buffEquipment]) {
    if (!Array.isArray(list)) {
      continue
    }
    for (const item of list) {
      if (isObject(item) && isCatalogId(item.itemId)) {
        references.push({ kind: 'item', itemId: item.itemId })
      }
    }
  }
  const skills = new Set<string>()
  const style =
    isObject(details.skillStyle) && isObject(details.skillStyle.style)
      ? details.skillStyle.style
      : null
  if (style) {
    for (const key of ['active', 'passive', 'evolution', 'enhancement']) {
      const list = style[key]
      if (!Array.isArray(list)) {
        continue
      }
      for (const skill of list) {
        if (isObject(skill) && isCatalogId(skill.skillId)) {
          skills.add(skill.skillId)
        }
      }
    }
    if (isObject(style.chain) && Array.isArray(style.chain.skills)) {
      for (const id of style.chain.skills) {
        if (isCatalogId(id)) {
          skills.add(id)
        }
      }
    }
  }
  for (const buff of Object.values(details.buff)) {
    if (isObject(buff) && isObject(buff.skillInfo) && isCatalogId(buff.skillInfo.skillId)) {
      skills.add(buff.skillInfo.skillId)
    }
  }
  if (isCatalogId(jobId)) {
    for (const skillId of skills) {
      references.push({ kind: 'skill', jobId, skillId })
    }
  }
  const loaded = await catalog.load(references, signal)
  const itemList = (list: unknown) =>
    Array.isArray(list)
      ? list.map((item) => {
          if (!isObject(item)) {
            return item
          }
          const itemDetail = isCatalogId(item.itemId)
            ? (loaded.get(catalogKey({ kind: 'item', itemId: item.itemId })) ?? unavailableDetail)
            : unavailableDetail
          return { ...item, itemDetail }
        })
      : list
  const buff = Object.fromEntries(
    Object.entries(details.buff).map(([section, value]) => [
      section,
      section === 'equipment' && isObject(value) && Object.hasOwn(value, 'equipment')
        ? { ...value, equipment: itemList(value.equipment) }
        : value
    ])
  ) as CharacterDetails['buff']
  // Details are indexed once, since selected evolution/enhancement/chain entries refer to the same skills.
  const skillDetails = Object.fromEntries(
    [...skills].map((skillId) => [
      skillId,
      isCatalogId(jobId)
        ? (loaded.get(catalogKey({ kind: 'skill', jobId, skillId })) ?? unavailableDetail)
        : unavailableDetail
    ])
  )
  return {
    ...details,
    equipment: { ...details.equipment, equipment: itemList(equipment) },
    buff,
    skillStyle: isObject(details.skillStyle)
      ? { ...details.skillStyle, skillDetails }
      : details.skillStyle
  }
}
