import { readFile } from 'node:fs/promises'
import { isAbsolute } from 'node:path'
import { parseArgs } from 'node:util'
import { loadSkillPackage } from './skill-calculation.mjs'
import {
  SkillMeasurementFailure,
  calculateSnapshotMeasurement,
  measurementError
} from './skill-measurement.mjs'

try {
  let values
  try {
    const parsed = parseArgs({
      options: {
        'package-directory': { type: 'string' },
        snapshot: { type: 'string' },
        observations: { type: 'string' }
      },
      strict: true,
      allowPositionals: false
    })
    values = parsed.values
    if (
      ![values['package-directory'], values.snapshot, values.observations].every(
        (value) => typeof value === 'string' && isAbsolute(value)
      )
    ) {
      throw new Error()
    }
  } catch {
    throw new SkillMeasurementFailure('INVALID_MEASUREMENT')
  }
  const skillPackage = await loadSkillPackage(values['package-directory'])
  const snapshot = JSON.parse(await readFile(values.snapshot, 'utf8'))
  const observations = JSON.parse(await readFile(values.observations, 'utf8'))
  const summary = calculateSnapshotMeasurement(snapshot, observations, skillPackage)
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`)
} catch (error) {
  process.stderr.write(`${JSON.stringify(measurementError(error))}\n`)
  process.exitCode = 1
}
