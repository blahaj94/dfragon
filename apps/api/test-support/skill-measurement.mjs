import { buildSkillSelection } from './skill-calculation.mjs'

const messages = {
  INVALID_MEASUREMENT: '측정 조건·스킬·데미지·보정값을 확인해 주세요.',
  MEASUREMENT_CONTEXT_MISMATCH: '두 측정의 환경 식별자와 대상 레벨이 같아야 합니다.',
  INVALID_SKILL_SNAPSHOT: '스냅샷의 직업·무기·스킬 상세와 선택을 확인해 주세요.',
  SKILL_NOT_CALCULATED: '비교할 두 스킬의 유효한 계산 결과가 필요합니다.',
  MEASUREMENT_FAILED: '오프라인 스킬 비교를 완료하지 못했습니다.'
}

export class SkillMeasurementFailure extends Error {
  constructor(code) {
    super(messages[code])
    this.code = code
  }
}

export function measurementError(error) {
  const code = error instanceof SkillMeasurementFailure ? error.code : 'MEASUREMENT_FAILED'
  const message = messages[code]

  return { error: { code, message } }
}

function nonempty(value) {
  return typeof value === 'string' && value.trim().length > 0
}

function positive(value) {
  return Number.isFinite(value) && value > 0
}

function validateObservations({ context, reference, comparison } = {}) {
  if (
    !nonempty(context?.id) ||
    context.target?.kind !== 'sandbag' ||
    !Number.isInteger(context.target.level) ||
    context.target.level < 1 ||
    !Array.isArray(context.conditions) ||
    !context.conditions.length ||
    !context.conditions.every(nonempty) ||
    !reference ||
    !comparison ||
    reference.skillId === comparison.skillId
  ) {
    throw new SkillMeasurementFailure('INVALID_MEASUREMENT')
  }
  for (const measurement of [reference, comparison]) {
    if (
      !nonempty(measurement.skillId) ||
      !positive(measurement.damage) ||
      !Number.isInteger(measurement.level) ||
      measurement.level < 1 ||
      !positive(measurement.multiplier?.value) ||
      !nonempty(measurement.multiplier.source)
    ) {
      throw new SkillMeasurementFailure('INVALID_MEASUREMENT')
    }

    if (measurement.contextId !== context.id || measurement.targetLevel !== context.target.level) {
      throw new SkillMeasurementFailure('MEASUREMENT_CONTEXT_MISMATCH')
    }
  }
}

function measuredSkill(skills, measurement) {
  const matches = skills.filter((skill) => skill.skillId === measurement.skillId)
  const skill = matches[0]
  if (
    matches.length !== 1 ||
    skill.status !== 'calculated' ||
    skill.effectiveLevel !== measurement.level ||
    !positive(skill.effectiveCoefficient)
  ) {
    throw new SkillMeasurementFailure('SKILL_NOT_CALCULATED')
  }
  const { value, source } = measurement.multiplier
  const multiplier = { value, source }
  const adjustedCoefficient = skill.effectiveCoefficient * multiplier.value
  if (!positive(adjustedCoefficient)) {
    throw new SkillMeasurementFailure('INVALID_MEASUREMENT')
  }
  const { skillId, selectedLevel, effectiveLevel, coefficient, effectiveCoefficient } = skill
  const observedDamage = measurement.damage

  return {
    skillId,
    selectedLevel,
    effectiveLevel,
    coefficient,
    effectiveCoefficient,
    multiplier,
    adjustedCoefficient,
    observedDamage
  }
}

/** The comparison observation never contributes to the calibration or prediction. */
export function compareSkillDamage({ skills, ...observations }) {
  validateObservations(observations)
  if (!Array.isArray(skills)) {
    throw new SkillMeasurementFailure('SKILL_NOT_CALCULATED')
  }
  const reference = measuredSkill(skills, observations.reference)
  const comparison = measuredSkill(skills, observations.comparison)
  const calibrationScale = reference.observedDamage / reference.adjustedCoefficient
  const predictedDamage = comparison.adjustedCoefficient * calibrationScale
  const residualDamage = predictedDamage - comparison.observedDamage
  const relativeErrorPercent = (residualDamage / comparison.observedDamage) * 100
  const coefficientRatio = comparison.adjustedCoefficient / reference.adjustedCoefficient
  const observedRatio = comparison.observedDamage / reference.observedDamage
  if (
    ![calibrationScale, predictedDamage, coefficientRatio, observedRatio].every(positive) ||
    !Number.isFinite(residualDamage) ||
    !Number.isFinite(relativeErrorPercent)
  ) {
    throw new SkillMeasurementFailure('INVALID_MEASUREMENT')
  }

  return {
    method: 'empirical-single-skill-calibration',
    basis: 'effectiveCoefficient',
    reference,
    comparison,
    calibrationScale,
    predictedDamage,
    residualDamage,
    relativeErrorPercent,
    coefficientRatio,
    observedRatio
  }
}

function snapshotDataset(snapshot, job, requirements) {
  const character = snapshot?.details?.character
  const equipment = snapshot?.details?.equipment?.equipment
  if (
    character?.jobId !== job.jobId ||
    !job.jobGrowId ||
    character?.jobGrowId !== job.jobGrowId ||
    !Array.isArray(equipment) ||
    !Array.isArray(snapshot.catalog)
  ) {
    throw new SkillMeasurementFailure('INVALID_SKILL_SNAPSHOT')
  }
  const weapons = equipment.filter((item) => item?.slotId === 'WEAPON')
  const weapon = weapons[0]?.itemTypeDetail
  if (weapons.length !== 1 || !job.weapons.some((item) => item.value === weapon)) {
    throw new SkillMeasurementFailure('INVALID_SKILL_SNAPSHOT')
  }
  const skills = {}
  for (const skillId of requirements.skillIds) {
    const matches = snapshot.catalog.filter(
      (entry) =>
        entry?.key?.kind === 'skill' &&
        entry.key.skillId === skillId &&
        entry.key.jobId === requirements.jobId
    )
    if (matches.length !== 1 || !matches[0].payload) {
      throw new SkillMeasurementFailure('INVALID_SKILL_SNAPSHOT')
    }
    skills[skillId] = matches[0].payload
  }
  const jobId = requirements.jobId
  const dataset = { jobId, skills }

  return { weapon, dataset }
}

function applyObservedLevels(request, metadata, overrides) {
  if (!Array.isArray(overrides)) {
    throw new SkillMeasurementFailure('INVALID_MEASUREMENT')
  }
  const known = new Map(metadata.skills.map((skill) => [skill.skillId, skill]))
  const seen = new Set()

  return overrides.map(({ skillId, level, source }) => {
    const definition = known.get(skillId)
    if (
      !definition ||
      !Number.isInteger(level) ||
      level < 0 ||
      level > definition.maxLevel ||
      !nonempty(source) ||
      seen.has(skillId)
    ) {
      throw new SkillMeasurementFailure('INVALID_MEASUREMENT')
    }
    seen.add(skillId)
    const originalLevel = request.levels[skillId] ?? 0
    const name = definition.nameKo
    request.levels[skillId] = level

    return { skillId, name, originalLevel, level, source }
  })
}

function statusComparison(snapshot, observed) {
  const snapshotStatus = snapshot?.details?.status?.status
  if (!Array.isArray(snapshotStatus) || !Array.isArray(observed)) {
    throw new SkillMeasurementFailure('INVALID_MEASUREMENT')
  }
  const seen = new Set()

  return observed.map(({ name, value }) => {
    if (!nonempty(name) || !Number.isFinite(value) || value < 0 || seen.has(name)) {
      throw new SkillMeasurementFailure('INVALID_MEASUREMENT')
    }
    seen.add(name)
    const matches = snapshotStatus.filter((entry) => entry?.name === name)
    if (matches.length !== 1 || !Number.isFinite(matches[0].value)) {
      throw new SkillMeasurementFailure('INVALID_SKILL_SNAPSHOT')
    }
    const snapshotValue = matches[0].value
    const observedValue = value

    return { name, snapshotValue, observedValue }
  })
}

export function calculateSnapshotMeasurement(snapshot, observations, skillPackage) {
  validateObservations(observations)
  const profile = skillPackage.rules.job.job
  const requirements = skillPackage.registry.getNeopleRequirements(profile)
  const { weapon, dataset } = snapshotDataset(snapshot, skillPackage.rules.job, requirements)
  let calculator
  let metadata
  let input
  try {
    calculator = skillPackage.registry.createCalculator(profile, dataset)
    metadata = calculator.getMetadata()
    input = buildSkillSelection(snapshot.details.skillStyle?.style, weapon, metadata)
  } catch {
    throw new SkillMeasurementFailure('INVALID_SKILL_SNAPSHOT')
  }
  const levelOverrides = applyObservedLevels(input.request, metadata, observations.levelOverrides)
  const statusValues = statusComparison(snapshot, observations.context.status)
  const result = calculator.calculate(input.request)
  for (const override of levelOverrides) {
    const skill = result.skills.find((item) => item.skillId === override.skillId)
    if (!skill || !Number.isInteger(skill.effectiveLevel)) {
      throw new SkillMeasurementFailure('INVALID_SKILL_SNAPSHOT')
    }
    override.effectiveLevel = skill.effectiveLevel
  }
  const comparison = compareSkillDamage({ ...observations, skills: result.skills })
  const { id, target, conditions } = observations.context
  const context = { id, target: { kind: target.kind, level: target.level }, conditions }
  const packageVersion = skillPackage.version
  const excluded = input.excluded
  const selectedSkills = [comparison.reference, comparison.comparison].map(({ skillId }) => {
    const name = metadata.skills.find((skill) => skill.skillId === skillId).nameKo
    const options = input.request.overrides[skillId] ?? {}
    const skill = result.skills.find((item) => item.skillId === skillId)
    const {
      coefficient,
      effectiveCoefficient,
      damageMultiplier,
      panelMultiplier,
      components,
      warnings
    } = skill

    return {
      skillId,
      name,
      options,
      coefficient,
      effectiveCoefficient,
      damageMultiplier,
      panelMultiplier,
      components,
      warnings
    }
  })
  const warnings = [
    ...new Set([
      ...metadata.warnings,
      ...result.warnings,
      '기준 스킬의 실측으로 공통 배율을 보정한 비교이며 절대 데미지 공식이나 전체 장비 산식을 검증하지 않습니다.',
      '상태 수치는 비교 문맥으로 표시하며 보정값에 다시 곱하지 않습니다. 장비 보정은 명시한 레벨과 스킬 배율만 적용합니다.',
      '패키지의 기본 모드와 현재 개화·강화 모델을 사용합니다. 같은 장비·버프·대상·전체 명중 조건은 관측 입력의 전제입니다.',
      '맹룡 개화의 추가 회오리와 모델의 타수 대응은 검증되지 않았으며 감전 피해는 별도로 포함하지 않습니다.'
    ])
  ]

  return {
    packageVersion,
    profile,
    weapon,
    context,
    statusValues,
    levelOverrides,
    selectedSkills,
    comparison,
    excluded,
    warnings
  }
}
