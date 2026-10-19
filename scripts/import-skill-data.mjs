#!/usr/bin/env node
// 직업별 스킬트리 배치(@dfragon/skill-layouts)와 스킬 아이콘(@dfragon/icons)을 외부 수집본에서 다시 만든다.
// 배치는 dcalc 좌표를 네오플 API로 대조한 수집본(skill-coordinates.json), 아이콘과 각성기 분류는
// dnf-reverse-engineering의 PVF 스킬 데이터 층과 아이콘 층이다. 사용법은 두 패키지의 README에 있다.
import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const LAYOUTS_FILE = join(ROOT, 'packages/skill-layouts/layouts.json')
const ICONS_DIR = join(ROOT, 'packages/icons')
const SKILL_ICONS_DIR = join(ICONS_DIR, 'skills')
const SKILL_ICON_INDEX_FILE = join(ICONS_DIR, 'skills.json')
const COLUMN_COUNT = 11
const PVF_SKILLS_DIR = 'skills/b2725b7c'
// 전직 이름의 `眞`, 띄어쓰기, `:` 같은 구분 기호는 네오플과 PVF 표기가 달라 비교에서 뺀다.
const NAME_NOISE_PATTERN = /[眞\s:\u00B7-]/g
const ICON_FILE_HASH_LENGTH = 16

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'))
}

function comparableName(name) {
  return String(name ?? '').replace(NAME_NOISE_PATTERN, '')
}

function fail(message) {
  throw new Error(message)
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

// Biome JSON 포맷과 같은 모양(두 칸 들여쓰기, 끝 줄바꿈)으로 쓴다.
function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`)
}

function importSkillData({ coordinatesPath, pvfRoot }) {
  const coordinates = readJson(coordinatesPath)
  if (coordinates.schemaVersion !== 3) {
    fail('skill-coordinates.json schemaVersion 3만 읽습니다.')
  }
  const pvfJobs = readPvfJobs(pvfRoot)
  const icons = readSkillIcons(pvfRoot)
  const iconIndex = readJson(join(pvfRoot, 'icons/ICON_INDEX.json'))
  const iconFiles = new Map()
  const pngFiles = new Map()
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
        const file = `${icon.sha256.slice(0, ICON_FILE_HASH_LENGTH)}.png`
        iconFiles.set(`${job.jobId}/${skill.skillId}`, file)
        pngFiles.set(file, icon)
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
  // 모든 PNG를 색인의 SHA-256과 대조한 뒤에 파일을 쓴다. 검사가 실패하면 이전 생성물을 그대로 둔다.
  const pngs = [...pngFiles].map(([file, icon]) => {
    const bytes = readFileSync(join(pvfRoot, 'icons', icon.file))
    const hash = createHash('sha256').update(bytes).digest('hex')
    if (hash !== icon.sha256) {
      fail(`아이콘 색인과 PNG의 SHA-256이 다릅니다: ${icon.file}`)
    }

    return [file, bytes]
  })
  writeJson(LAYOUTS_FILE, { source: layoutSource, jobs })
  rmSync(SKILL_ICONS_DIR, { recursive: true, force: true })
  mkdirSync(SKILL_ICONS_DIR, { recursive: true })
  for (const [file, bytes] of pngs) {
    writeFileSync(join(SKILL_ICONS_DIR, file), bytes)
  }
  const sortedIconFiles = [...iconFiles].sort(([a], [b]) => a.localeCompare(b))
  const iconSource = {
    pvfSha256Prefix: iconIndex.pvf_sha256_prefix,
    npkIndexSha256: iconIndex.npk_index_sha256
  }
  writeJson(SKILL_ICON_INDEX_FILE, {
    source: iconSource,
    icons: Object.fromEntries(sortedIconFiles)
  })
  const skillCount = jobs.reduce((total, job) => total + job.skills.length, 0)
  const pngCount = readdirSync(SKILL_ICONS_DIR).length

  return {
    jobCount: jobs.length,
    skillCount,
    iconCount: iconFiles.size,
    pngCount
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
const summary = importSkillData({
  coordinatesPath: resolve(values.coordinates),
  pvfRoot: resolve(values.pvf)
})
console.log(
  `직업 ${summary.jobCount}개, 스킬 ${summary.skillCount}칸, 아이콘 연결 ${summary.iconCount}개, PNG ${summary.pngCount}개`
)
