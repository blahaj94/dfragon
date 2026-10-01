import { isObject } from '../details/neople.js'
import type { projectCharacterDetails } from '../details/project.js'
import type { CharacterPayload } from '../details/sections.js'

type CharacterDetails = ReturnType<typeof projectCharacterDetails>

// Visit only equipped items and their known attachments. Catalog set members are not equipment.
export function mapCharacterItems(
  details: CharacterDetails,
  mapItem: (item: CharacterPayload) => CharacterPayload
): CharacterDetails {
  const leaf = (value: unknown): unknown => {
    if (isObject(value)) {
      return mapItem(value)
    }

    return value
  }
  const list = (value: unknown, map: (item: unknown) => unknown): unknown => {
    if (Array.isArray(value)) {
      return value.map(map)
    }

    return value
  }
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
    Object.entries(details.buff).map(([section, value]) => {
      if (isObject(value) && Object.hasOwn(value, section)) {
        const snapshot = { ...value }
        const mapped = list(value[section], item)
        const mappedSection = { ...snapshot, [section]: mapped }

        return [section, mappedSection]
      }

      return [section, value]
    })
  ) as CharacterDetails['buff']
  const oath = details.oath
  const snapshot = { ...details }
  const equipmentSnapshot = { ...details.equipment }
  const equipmentItems = list(details.equipment.equipment, item)
  const equipment = { ...equipmentSnapshot, equipment: equipmentItems }
  const avatar = list(details.avatar, item)
  const creature = item(details.creature)
  let mappedOath = oath
  if (isObject(oath)) {
    const oathSnapshot = { ...oath }
    const info = Object.hasOwn(oath, 'info') ? { info: item(oath.info) } : {}
    const crystal = Object.hasOwn(oath, 'crystal') ? { crystal: list(oath.crystal, item) } : {}
    mappedOath = { ...oathSnapshot, ...info, ...crystal }
  }

  return {
    ...snapshot,
    equipment,
    avatar,
    creature,
    oath: mappedOath,
    buff
  }
}
