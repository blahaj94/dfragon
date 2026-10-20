#!/usr/bin/env node
// 직업별 스킬트리 배치(@dfragon/skill-layouts)와 스킬 아이콘(@dfragon/icons)을 외부 수집본에서 다시 만든다.
// 배치는 dcalc 좌표를 네오플 API로 대조한 수집본(skill-coordinates.json), 아이콘과 각성기 분류는
// dnf-reverse-engineering의 PVF 스킬 데이터 층과 아이콘 층이다. 아이콘은 한 장의 무손실 WebP sprite로 묶는다.
// 사용법은 두 패키지의 README에 있다.
import { writeFileSync } from 'node:fs'
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
const LAYOUTS_FILE = join(ROOT, 'packages/skill-layouts/layouts.json')
const ICONS_DIR = join(ROOT, 'packages/icons')
const SKILL_SPRITE_NAME = 'skills.webp'
const SKILL_SPRITE_FILE = join(ICONS_DIR, SKILL_SPRITE_NAME)
const SKILL_ICON_INDEX_FILE = join(ICONS_DIR, 'skills.json')
// sprite 한 칸의 크기와 한 줄의 칸 수. 스킬 아이콘은 모두 28 × 28이다.
const SPRITE_GRID = { iconSize: 28, columns: 48 }
const COLUMN_COUNT = 11
const PVF_SKILLS_DIR = 'skills/b2725b7c'
// 전직 이름의 `眞`, 띄어쓰기, `:` 같은 구분 기호는 네오플과 PVF 표기가 달라 비교에서 뺀다.
const NAME_NOISE_PATTERN = /[眞\s:\u00B7-]/g

function comparableName(name) {
  return String(name ?? '').replace(NAME_NOISE_PATTERN, '')
}

function readPvfJobs(pvfRoot) {
  const { jobs } = readJson(join(pvfRoot, PVF_SKILLS_DIR, 'JOBS.json'))
  const byName = new Map()
  for (const job of jobs) {
    const skills = readJson(join(pvfRoot, PVF_SKILLS_DIR, 'jobs', `skills_${job.job_id}.json`))
    byName.set(job.display_name_ko, { job, skills })
  }

  return byName
}

function readSkillIcons(pvfRoot) {
  const { entries } = readJson(join(pvfRoot, 'icons/index/skill_icon.json'))
  const icons = new Map()
  for (const entry of entries) {
    if (entry.status === 'ok') {
      icons.set(entry.id, entry)
    }
  }

  return icons
}

// 네오플 전직에서 배울 수 있는 PVF 스킬 번호. 공통 스킬은 전직 전(growtype 0) 목록에 있다.
function learnableSkillIds(pvf, jobGrowName) {
  const target = comparableName(jobGrowName)
  const advancement = pvf.job.advancements.find(
    (entry) => entry.within_max_grow_count && comparableName(entry.name_ko) === target
  )
  if (advancement === undefined) {
    fail(`PVF에서 전직을 찾지 못했습니다: ${jobGrowName}`)
  }
  const lists = new Map(
    pvf.skills.advancement_skills.map((entry) => [entry.growtype, entry.learnable_skill_ids])
  )

  return new Set([...(lists.get(0) ?? []), ...(lists.get(advancement.growtype) ?? [])])
}

// 네오플 스킬과 같은 이름의 PVF 스킬. 같은 이름이 여럿이면 그 전직이 배울 수 있는 것만 남기고, 그래도
// 여럿이면 아이콘이 모두 같을 때만 앞의 것을 쓴다. 대응을 정하지 못하면 생성을 멈춘다.
function matchPvfSkill(pvf, learnable, icons, skill) {
  const name = comparableName(skill.nameKo)
  const named = pvf.skills.skills.filter((entry) => comparableName(entry.name_ko) === name)
  const learned = named.filter((entry) => learnable.has(entry.id))
  const candidates = learned.length > 0 ? learned : named
  const iconHashes = new Set(
    candidates.map((entry) => icons.get(`${pvf.job.job_id}/${entry.id}`)?.sha256)
  )
  if (candidates.length === 0 || iconHashes.size !== 1) {
    fail(`PVF 스킬을 하나로 정하지 못했습니다: ${skill.nameKo} (${skill.skillId})`)
  }

  return candidates[0]
}

function checkLayout(job) {
  const positions = new Set()
  for (const skill of job.skills) {
    const position = `${skill.row}/${skill.column}`
    if (skill.column < 0 || skill.column >= COLUMN_COUNT || skill.row < 0) {
      fail(`11열 밖의 좌표입니다: ${job.jobGrowName} ${skill.name}`)
    }

    if (positions.has(position)) {
      fail(`같은 칸에 스킬이 둘입니다: ${job.jobGrowName} ${position}`)
    }
    positions.add(position)
  }
}

async function importSkillData({ coordinatesPath, pvfRoot }) {
  const coordinates = readJson(coordinatesPath)
  if (coordinates.schemaVersion !== 3) {
    fail('skill-coordinates.json schemaVersion 3만 읽습니다.')
  }
  const pvfJobs = readPvfJobs(pvfRoot)
  const icons = readSkillIcons(pvfRoot)
  const iconIndex = readJson(join(pvfRoot, 'icons/ICON_INDEX.json'))
  const iconHashes = new Map()
  const iconsByHash = new Map()
  const jobs = coordinates.jobs.map((job) => {
    const pvf =
      pvfJobs.get(job.jobNameKo) ?? fail(`PVF에서 직업을 찾지 못했습니다: ${job.jobNameKo}`)
    const learnable = learnableSkillIds(pvf, job.jobGrowNameKo)
    // 네오플 API에 없는 좌표(apiStatus not_found)는 캐릭터 응답과 이을 수 없어 뺀다.
    const listed = job.skills.filter((skill) => skill.apiStatus === 'listed')
    const skills = listed.map((skill) => {
      const pvfSkill = matchPvfSkill(pvf, learnable, icons, skill)
      const icon = icons.get(`${pvf.job.job_id}/${pvfSkill.id}`)
      if (icon !== undefined) {
        iconHashes.set(`${job.jobId}/${skill.skillId}`, icon.sha256)
        iconsByHash.set(icon.sha256, icon)
      }

      return {
        skillId: skill.skillId,
        row: skill.row,
        column: skill.column,
        name: skill.nameKo,
        type: skill.type,
        requiredLevel: skill.requiredLevel,
        awakening: pvfSkill.classification.kind.startsWith('awakening')
      }
    })
    skills.sort((a, b) => a.row - b.row || a.column - b.column)
    const layout = {
      jobId: job.jobId,
      jobGrowId: job.jobGrowId,
      jobName: job.jobNameKo,
      jobGrowName: job.jobGrowNameKo,
      skills
    }
    checkLayout(layout)

    return layout
  })
  jobs.sort((a, b) => a.jobId.localeCompare(b.jobId) || a.jobGrowId.localeCompare(b.jobGrowId))
  const layoutSource = {
    coordinates: coordinates.source,
    metadata: {
      provider: coordinates.metadataSource.provider,
      retrievedDate: coordinates.metadataSource.retrievedDate
    },
    awakening: { pvfSha256Prefix: iconIndex.pvf_sha256_prefix }
  }
  // 내용이 같은 아이콘은 한 칸을 함께 쓰고, 칸 번호는 SHA-256 순서다. 모든 검사를 마친 뒤에 파일을 쓰므로
  // 검사가 실패하면 이전 생성물을 그대로 둔다.
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
  const { sprite, width, height } = encoded
  const cells = new Map(hashes.map((hash, index) => [hash, index]))
  const iconCells = [...iconHashes]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, hash]) => [key, cells.get(hash)])
  const iconSource = {
    pvfSha256Prefix: iconIndex.pvf_sha256_prefix,
    npkIndexSha256: iconIndex.npk_index_sha256
  }
  const spriteInfo = {
    file: SKILL_SPRITE_NAME,
    iconSize: SPRITE_GRID.iconSize,
    columns: SPRITE_GRID.columns,
    width,
    height
  }
  writeJson(LAYOUTS_FILE, { source: layoutSource, jobs })
  writeFileSync(SKILL_SPRITE_FILE, sprite)
  writeJson(SKILL_ICON_INDEX_FILE, {
    source: iconSource,
    sprite: spriteInfo,
    icons: Object.fromEntries(iconCells)
  })
  const skillCount = jobs.reduce((total, job) => total + job.skills.length, 0)

  return {
    jobCount: jobs.length,
    skillCount,
    iconCount: iconHashes.size,
    cellCount: hashes.length,
    spriteBytes: sprite.length
  }
}

const { values } = parseArgs({
  options: { coordinates: { type: 'string' }, pvf: { type: 'string' } }
})
if (values.coordinates === undefined || values.pvf === undefined) {
  console.error(
    '사용법: node scripts/import-skill-data.mjs --coordinates <skill-coordinates.json> --pvf <data_layers 폴더>'
  )
  process.exit(2)
}
const summary = await importSkillData({
  coordinatesPath: resolve(values.coordinates),
  pvfRoot: resolve(values.pvf)
})
console.log(
  `직업 ${summary.jobCount}개, 스킬 ${summary.skillCount}칸, 아이콘 연결 ${summary.iconCount}개, sprite ${summary.cellCount}칸 ${summary.spriteBytes}바이트`
)
