#!/usr/bin/env node
// 네오플 이미지 API가 주지 않는 서약 아이콘과 115 세트의 세트 아이콘(@dfragon/icons equipment)을 외부
// 수집본에서 다시 만든다. 아이콘은 dnf-reverse-engineering의 PVF 아이콘 층이고, 세트 아이콘을 네오플
// setItemId에 잇는 데는 네오플 캐릭터 장착 장비 응답 표본의 세트 이름을 쓴다. 사용법은 @dfragon/icons README에 있다.
import { readdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import {
  checkSprite,
  encodeSprite,
  fail,
  readIconPixels,
  readJson,
  writeJson
} from './icon-sprite.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const ICONS_DIR = join(ROOT, 'packages/icons')
const SPRITE_NAME = 'equipment.webp'
const SPRITE_FILE = join(ICONS_DIR, SPRITE_NAME)
const INDEX_FILE = join(ICONS_DIR, 'equipment.json')
const SPRITE_GRID = { iconSize: 28, columns: 16 }
const PVF_VERSION_DIR = 'b2725b7c'
// PVF 아이템 `[rarity]` 값과 네오플 응답의 희귀도 이름. 같은 이름의 서약이 희귀도마다 따로 있다. 4와 6은
// 네오플 응답 표본에서 이름이 한 희귀도에만 있는 서약의 `itemRarity`로 확인했다(4 에픽, 6 레전더리).
const RARITY_NAMES = new Map([
  [2, '레어'],
  [3, '유니크'],
  [4, '에픽'],
  [6, '레전더리'],
  [8, '태초']
])
// 장착하지 않고 버프 아이콘 표시에만 쓰는 서약 아이템(100430002~049)의 PVF 역할. 이름이 서약 그룹 이름과 같아
// 장착 서약(예: 태초 근원에 닿은 자연 서약 100610059)과 이름, 희귀도가 겹치므로 아이콘 후보에서 뺀다.
const BUFF_ICON_ROLE = 'group_buff_icon'

function readIconEntries(pvfRoot, name) {
  const { entries } = readJson(join(pvfRoot, 'icons/index', `${name}.json`))

  return new Map(entries.filter((entry) => entry.status === 'ok').map((entry) => [entry.id, entry]))
}

// `<희귀도 이름>/<서약 이름>`별 서약 아이콘. 같은 이름과 희귀도의 서약이 여럿이고 아이콘이 다르면 어느 것인지
// 정할 수 없어 뺀다.
function collectOathIcons(pvfRoot) {
  const icons = readIconEntries(pvfRoot, 'oath_icon')
  const { entries } = readJson(join(pvfRoot, 'oaths', PVF_VERSION_DIR, 'oaths_items.json'))
  const byKey = new Map()
  for (const entry of entries.filter((item) => item.system_role.value !== BUFF_ICON_ROLE)) {
    const rarity = entry.header.rarity.value
    const rarityName = RARITY_NAMES.get(rarity) ?? fail(`모르는 서약 희귀도입니다: ${rarity}`)
    const icon = icons.get(entry.id) ?? fail(`서약 아이콘이 없습니다: ${entry.id}`)
    const key = `${rarityName}/${entry.name.value.ko}`
    byKey.set(key, [...(byKey.get(key) ?? []), icon])
  }
  const result = new Map()
  const skipped = []
  for (const [key, candidates] of byKey) {
    if (new Set(candidates.map((icon) => icon.sha256)).size === 1) {
      result.set(key, candidates[0])
    } else {
      skipped.push(key)
    }
  }

  return { icons: result, skipped }
}

// 표본 응답의 장착 장비 줄에서 세트 이름과 setItemId를 모은다. 장비 줄의 세트 이름은 희귀도와 관계없는 기본
// 이름(예: 소울 페어리 세트)이고, 세트 정보(`setItemInfo`)의 이름은 희귀도마다 다르다(예: 로열 페어리 세트).
function collectNeopleSetIds(samplesDir) {
  const ids = new Map()
  const visit = (value) => {
    if (Array.isArray(value)) {
      value.forEach(visit)

      return
    }

    if (value === null || typeof value !== 'object') {
      return
    }
    const { setItemId, setItemName } = value
    if (
      typeof setItemId === 'string' &&
      typeof setItemName === 'string' &&
      !('setItemRarityName' in value)
    ) {
      const known = ids.get(setItemName)
      if (known !== undefined && known !== setItemId) {
        fail(`같은 세트 이름에 setItemId가 둘입니다: ${setItemName}`)
      }
      ids.set(setItemName, setItemId)
    }
    Object.values(value).forEach(visit)
  }
  const files = readdirSync(samplesDir).filter((file) => file.endsWith('.json'))
  for (const file of files) {
    visit(readJson(join(samplesDir, file)))
  }

  return ids
}

// 네오플 setItemId별 세트 아이콘. 아이콘이 있는 모든 세트를 표본의 setItemId에 이어야 한다.
function collectSetIcons(pvfRoot, samplesDir) {
  const icons = readIconEntries(pvfRoot, 'set_icon')
  const { sets } = readJson(join(pvfRoot, 'equipment115', PVF_VERSION_DIR, 'sets.json'))
  const names = new Map(sets.map((set) => [set.part_set_index, set.name_ko]))
  const setIds = collectNeopleSetIds(samplesDir)
  const result = new Map()
  for (const [id, icon] of icons) {
    const name = names.get(id) ?? fail(`PVF 세트 이름이 없습니다: ${id}`)
    const setItemId = setIds.get(name) ?? fail(`표본에 없는 세트입니다: ${name}`)
    result.set(setItemId, icon)
  }

  return result
}

async function importEquipmentIcons({ pvfRoot, samplesDir }) {
  const oaths = collectOathIcons(pvfRoot)
  const sets = collectSetIcons(pvfRoot, samplesDir)
  const iconIndex = readJson(join(pvfRoot, 'icons/ICON_INDEX.json'))
  // 내용이 같은 아이콘은 한 칸을 함께 쓰고, 칸 번호는 SHA-256 순서다. 모든 검사를 마친 뒤에 파일을 쓰므로
  // 검사가 실패하면 이전 생성물을 그대로 둔다.
  const iconsByHash = new Map()
  for (const icon of [...oaths.icons.values(), ...sets.values()]) {
    iconsByHash.set(icon.sha256, icon)
  }
  const hashes = [...iconsByHash.keys()].sort()
  const pixels = []
  for (const hash of hashes) {
    const icon = iconsByHash.get(hash)
    pixels.push(
      await readIconPixels(join(pvfRoot, 'icons', icon.file), icon.sha256, SPRITE_GRID.iconSize)
    )
  }
  const encoded = await encodeSprite(pixels, SPRITE_GRID)
  await checkSprite(encoded, pixels, SPRITE_GRID)
  const cells = new Map(hashes.map((hash, index) => [hash, index]))
  const toCells = (icons) =>
    Object.fromEntries(
      [...icons]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, icon]) => [key, cells.get(icon.sha256)])
    )
  writeFileSync(SPRITE_FILE, encoded.sprite)
  writeJson(INDEX_FILE, {
    source: {
      pvfSha256Prefix: iconIndex.pvf_sha256_prefix,
      npkIndexSha256: iconIndex.npk_index_sha256
    },
    sprite: {
      file: SPRITE_NAME,
      iconSize: SPRITE_GRID.iconSize,
      columns: SPRITE_GRID.columns,
      width: encoded.width,
      height: encoded.height
    },
    oaths: toCells(oaths.icons),
    sets: toCells(sets)
  })

  return {
    oathCount: oaths.icons.size,
    skipped: oaths.skipped,
    setCount: sets.size,
    cellCount: hashes.length,
    spriteBytes: encoded.sprite.length
  }
}

const { values } = parseArgs({
  options: { pvf: { type: 'string' }, samples: { type: 'string' } }
})
if (values.pvf === undefined || values.samples === undefined) {
  console.error(
    '사용법: node scripts/import-equipment-icons.mjs --pvf <data_layers 폴더> --samples <네오플 캐릭터 응답 표본 폴더>'
  )
  process.exit(2)
}
const summary = await importEquipmentIcons({
  pvfRoot: resolve(values.pvf),
  samplesDir: resolve(values.samples)
})
console.log(
  `서약 ${summary.oathCount}개, 세트 ${summary.setCount}개, sprite ${summary.cellCount}칸 ${summary.spriteBytes}바이트`
)
if (summary.skipped.length > 0) {
  console.log(`아이콘이 서로 달라 뺀 서약: ${summary.skipped.join(', ')}`)
}
