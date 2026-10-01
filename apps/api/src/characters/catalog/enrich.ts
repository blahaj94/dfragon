import { filter, map, pipe, unique } from 'remeda'
import { isObject } from '../details/neople.js'
import type { projectCharacterDetails } from '../details/project.js'
import { mapCharacterItems } from './items.js'
import type { CatalogService } from './service.js'
import { catalogKey, isCatalogId, unavailableDetail } from './types.js'
import type { CatalogDetail, CatalogKey } from './types.js'

type CharacterDetails = ReturnType<typeof projectCharacterDetails>

export async function enrichCharacterDetails(
  details: CharacterDetails,
  catalog: CatalogService,
  signal: AbortSignal
) {
  const { references, jobId, skillIds } = collectCharacterCatalogReferences(details)
  const loaded = await catalog.load(references, signal)
  const enriched = mapCharacterItems(details, (item) => {
    if (isCatalogId(item.itemId)) {
      const properties = { ...item }
      const itemDetail =
        loaded.get(catalogKey({ kind: 'item', itemId: item.itemId })) ?? unavailableDetail

      return { ...properties, itemDetail }
    }

    return item
  })
  const { setDetails, skillDetails } = projectCharacterCatalogDetails(loaded, skillIds, jobId)
  const skillStyle = isObject(details.skillStyle)
    ? { ...details.skillStyle, skillDetails }
    : details.skillStyle

  return { ...enriched, setDetails, skillStyle }
}

// Keep the item traversal and optional payload guards before normalizing repeated skill IDs.
function collectCharacterCatalogReferences(details: CharacterDetails) {
  let references: CatalogKey[] = []
  const jobId = details.character.jobId
  mapCharacterItems(details, (item) => {
    if (isCatalogId(item.itemId)) {
      references.push({ kind: 'item', itemId: item.itemId })
    }

    if (isCatalogId(item.setItemId)) {
      references.push({ kind: 'set', setItemId: item.setItemId })
    }

    return item
  })
  if (Array.isArray(details.equipment.setItemInfo)) {
    for (const set of details.equipment.setItemInfo) {
      if (isObject(set) && isCatalogId(set.setItemId)) {
        references.push({ kind: 'set', setItemId: set.setItemId })
      }
    }
  }
  const skills: string[] = []
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
          skills.push(skill.skillId)
        }
      }
    }
    if (isObject(style.chain) && Array.isArray(style.chain.skills)) {
      for (const id of style.chain.skills) {
        if (isCatalogId(id)) {
          skills.push(id)
        }
      }
    }
  }
  for (const buff of Object.values(details.buff)) {
    if (isObject(buff) && isObject(buff.skillInfo) && isCatalogId(buff.skillInfo.skillId)) {
      skills.push(buff.skillInfo.skillId)
    }
  }
  const skillIds = unique(skills)
  if (isCatalogId(jobId)) {
    const skillReferences = map(skillIds, (skillId): CatalogKey => ({
      kind: 'skill',
      jobId,
      skillId
    }))
    references = [...references, ...skillReferences]
  }

  return { references, jobId, skillIds }
}

// Index shared details once, since evolution/enhancement/chain entries select the same skills.
function projectCharacterCatalogDetails(
  loaded: ReadonlyMap<string, CatalogDetail>,
  skillIds: readonly string[],
  jobId: unknown
) {
  const setDetails = Object.fromEntries(
    pipe(
      [...loaded],
      filter(([key]) => key.startsWith('set:')),
      map(([key, detail]) => {
        const setItemId = key.slice(4)

        return [setItemId, detail] as const
      })
    )
  )
  const skillDetails = Object.fromEntries(
    map(skillIds, (skillId) => {
      const detail = isCatalogId(jobId)
        ? (loaded.get(catalogKey({ kind: 'skill', jobId, skillId })) ?? unavailableDetail)
        : unavailableDetail

      return [skillId, detail] as const
    })
  )

  return { setDetails, skillDetails }
}
