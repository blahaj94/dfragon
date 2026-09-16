import { isObject } from '../details/neople.js'
import type { projectCharacterDetails } from '../details/project.js'
import type { CharacterPayload } from '../details/sections.js'

type CharacterDetails = ReturnType<typeof projectCharacterDetails>

// Visit only equipped items and their known attachments. Catalog set members are not equipment.
export function mapCharacterItems(
  details: CharacterDetails,
  mapItem: (item: CharacterPayload) => CharacterPayload
): CharacterDetails {
  const leaf = (value: unknown): unknown => (isObject(value) ? mapItem(value) : value)
  const list = (value: unknown, map: (item: unknown) => unknown): unknown =>
    Array.isArray(value) ? value.map(map) : value
  const item = (value: unknown): unknown => {
    if (!isObject(value)) {
      return value
    }
    const result = { ...mapItem(value) }
    if (Object.hasOwn(value, 'clone')) {
      result.clone = leaf(value.clone)
    }
    if (Object.hasOwn(value, 'emblems')) {
      result.emblems = list(value.emblems, leaf)
    }
    if (Object.hasOwn(value, 'artifact')) {
      result.artifact = list(value.artifact, leaf)
    }
    return result
  }
  const buff = Object.fromEntries(
    Object.entries(details.buff).map(([section, value]) => [
      section,
      isObject(value) && Object.hasOwn(value, section)
        ? { ...value, [section]: list(value[section], item) }
        : value
    ])
  ) as CharacterDetails['buff']
  const oath = details.oath
  return {
    ...details,
    equipment: { ...details.equipment, equipment: list(details.equipment.equipment, item) },
    avatar: list(details.avatar, item),
    creature: item(details.creature),
    oath: isObject(oath)
      ? {
          ...oath,
          ...(Object.hasOwn(oath, 'info') ? { info: item(oath.info) } : {}),
          ...(Object.hasOwn(oath, 'crystal') ? { crystal: list(oath.crystal, item) } : {})
        }
      : oath,
    buff
  }
}
