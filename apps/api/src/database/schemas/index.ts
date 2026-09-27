import { CharacterApiResponseSchema } from './character-api-responses.js'
import { CharacterSchema } from './characters.js'
import { ItemCatalogSchema } from './item-catalog.js'
import { SetItemCatalogSchema } from './set-item-catalog.js'
import { SkillCatalogSchema } from './skill-catalog.js'

export const databaseSchemas = [
  CharacterApiResponseSchema,
  CharacterSchema,
  ItemCatalogSchema,
  SetItemCatalogSchema,
  SkillCatalogSchema
]
