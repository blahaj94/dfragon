import { isRecord } from '@dfragon/lib/utils/shape-check'
import type { projectCharacterDetails } from '../details/project.js'
import { mapCharacterItems } from './items.js'
import type { CatalogService } from './service.js'
import { catalogKey, isCatalogId, unavailableDetail } from './types.js'
import type { CatalogKey } from './types.js'

type CharacterDetails = ReturnType<typeof projectCharacterDetails>

export async function enrichCharacterDetails(
  details: CharacterDetails,
  catalog: CatalogService,
  signal: AbortSignal
) {
  const references: CatalogKey[] = []
  mapCharacterItems(details, (item) => {
    if (isCatalogId(item.itemId)) {
      references.push({ kind: 'item', itemId: item.itemId })
    }

    return item
  })
  const loaded = await catalog.load(references, signal)
  const enriched = mapCharacterItems(details, (item) => {
    if (isCatalogId(item.itemId)) {
      const itemDetail =
        loaded.get(catalogKey({ kind: 'item', itemId: item.itemId }))?.detail ?? unavailableDetail

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
