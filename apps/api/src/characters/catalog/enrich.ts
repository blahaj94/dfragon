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
  const enriched = mapCharacterItems(details, (item) => {
    if (isCatalogId(item.itemId)) {
      const itemDetail = loaded.get(item.itemId) ?? unavailableDetail

      return { ...item, itemDetail }
    }

    return item
  })
  if (isRecord(enriched.skillStyle) && Object.hasOwn(enriched.skillStyle, 'skillDetails')) {
    const skillStyle = { ...enriched.skillStyle }
    delete skillStyle.skillDetails

    return { ...enriched, skillStyle }
  }

  return enriched
}
