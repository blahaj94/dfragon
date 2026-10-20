import equipmentIcons from '@dfragon/icons/equipment.json'
import spriteUrl from '@dfragon/icons/equipment.webp?no-inline'

/**
 * sprite 한 장의 아이콘 칸. `x`, `y`는 칸의 왼쪽 위 픽셀이고 `size`는 칸 한 변, `sheetWidth`, `sheetHeight`는
 * sprite 전체 크기다. 그리는 쪽은 이 값으로 칸 하나를 어떤 크기의 상자에도 꽉 차게 자른다.
 */
export type SpriteIcon = Readonly<{
  sprite: string
  x: number
  y: number
  size: number
  sheetWidth: number
  sheetHeight: number
}>

/** 아이템 그림. 네오플 이미지 URL이나 로컬 그림 URL, 또는 번들한 sprite의 칸이다. */
export type ItemPicture = string | SpriteIcon

const { iconSize, columns, width, height } = equipmentIcons.sprite
const oathCells: Readonly<Record<string, number>> = equipmentIcons.oaths
const setCells: Readonly<Record<string, number>> = equipmentIcons.sets

function toSpriteIcon(
  cells: Readonly<Record<string, number>>,
  key: string
): SpriteIcon | undefined {
  if (!Object.hasOwn(cells, key)) {
    return undefined
  }
  const index = cells[key]
  const x = (index % columns) * iconSize
  const y = Math.floor(index / columns) * iconSize

  return {
    sprite: spriteUrl,
    x,
    y,
    size: iconSize,
    sheetWidth: width,
    sheetHeight: height
  }
}

/**
 * 서약 아이콘. 네오플 이미지 API에는 서약 그림이 없어 번들한 PVF 아이콘을 서약 이름과 희귀도로 찾는다. 같은
 * 이름의 서약이 희귀도마다 따로 있고, 아이콘을 정하지 못한 서약이면 undefined다.
 */
export function oathIcon(rarity: string | null, name: string): SpriteIcon | undefined {
  if (rarity === null) {
    return undefined
  }

  return toSpriteIcon(oathCells, `${rarity}/${name}`)
}

/** 네오플 setItemId의 세트 아이콘. 115 세트만 있고 다른 세트면 undefined다. */
export function setIcon(setItemId: string): SpriteIcon | undefined {
  return toSpriteIcon(setCells, setItemId)
}
