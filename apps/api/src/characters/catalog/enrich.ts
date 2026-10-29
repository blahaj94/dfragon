import { isRecord } from '@dfragon/lib/utils/shape-check'
import type { projectCharacterDetails } from '../details/project.js'
import { mapCharacterItems } from './items.js'
import type { CatalogService } from './service.js'
import { isCatalogId, unavailableDetail } from './types.js'

type CharacterDetails = ReturnType<typeof projectCharacterDetails>

export async function enrichCharacterDetails(
  details: CharacterDetails,
  catalog: CatalogService,
  signal: AbortSignal
) {
  const itemIds: string[] = []
  mapCharacterItems(details, (item) => {
    if (isCatalogId(item.itemId)) {
      itemIds.push(item.itemId)
    }

    return item
  })
  const loaded = await catalog.load(itemIds, signal)

  return mapCharacterItems(details, (item) => {
    if (isCatalogId(item.itemId)) {
      const itemDetail = loaded.get(item.itemId) ?? unavailableDetail

      return { ...item, itemDetail }
    }

    return item
  })
}

export function hasUnavailableItemDetail(details: CharacterDetails): boolean {
  let unavailable = false
  mapCharacterItems(details, (item) => {
    if (isRecord(item.itemDetail) && item.itemDetail.status === unavailableDetail.status) {
      unavailable = true
    }

    return item
  })

  return unavailable
}
