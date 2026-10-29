import { isRecord } from '@dfragon/lib/utils/shape-check'
import ky from 'ky'
import { readSecretInput } from '../dist/secret-input.js'
import { createNeopleCharacterSearch } from '../dist/characters/neople-character-search.js'
import { createNeopleCharacterDetails } from '../dist/characters/details/neople.js'
import { NEOPLE_ORIGIN } from '../dist/constants/neople-character-search.js'
import { isCatalogId } from '../dist/characters/catalog/types.js'
import {
  SkillVerificationFailure,
  loadSkillPackage,
  parseVerificationArguments,
  verificationError,
  verifyCharacterSkills
} from './skill-calculation.mjs'

function createSkillLookup(apiKey) {
  const neople = ky.create({
    baseUrl: NEOPLE_ORIGIN,
    headers: { apikey: apiKey },
    redirect: 'error',
    retry: 0
  })

  return async ([key], signal) => {
    if (!key || !isCatalogId(key.jobId) || !isCatalogId(key.skillId)) {
      throw new Error('Invalid skill request')
    }
    const path = `/df/skills/${encodeURIComponent(key.jobId)}/${encodeURIComponent(key.skillId)}`
    let body
    try {
      body = await neople.get(path, { signal }).json()
    } catch {
      throw new Error('Skill lookup failed')
    }
    if (
      !isRecord(body) ||
      body.jobId !== key.jobId ||
      typeof body.name !== 'string' ||
      !body.name.trim() ||
      (Object.hasOwn(body, 'skillId') && body.skillId !== key.skillId)
    ) {
      throw new Error('Invalid skill identity')
    }

    return [{ key, payload: body }]
  }
}

try {
  const options = parseVerificationArguments(process.argv.slice(2))
  const skillPackage = await loadSkillPackage(options.packageDirectory)
  let apiKey
  try {
    apiKey = readSecretInput(process.env.NEOPLE_API_KEY, process.env.NEOPLE_API_KEY_FILE)
    if (!apiKey) {
      throw new Error()
    }
  } catch {
    throw new SkillVerificationFailure('INVALID_SECRET')
  }
  const providers = {
    searchCharacters: createNeopleCharacterSearch(apiKey),
    fetchDetails: createNeopleCharacterDetails(apiKey),
    fetchCatalog: createSkillLookup(apiKey)
  }
  const summary = await verifyCharacterSkills(options, skillPackage, providers)
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`)
} catch (error) {
  process.stderr.write(`${JSON.stringify(verificationError(error))}\n`)
  process.exitCode = 1
}
