import { readSecretInput } from '../dist/secret-input.js'
import { createNeopleCharacterSearch } from '../dist/characters/neople-character-search.js'
import { createNeopleCharacterDetails } from '../dist/characters/details/neople.js'
import { NEOPLE_ORIGIN } from '../dist/constants/neople-character-search.js'
import { isObject } from '../dist/characters/details/neople.js'
import { isCatalogId } from '../dist/characters/catalog/types.js'
import {
  SkillVerificationFailure,
  loadSkillPackage,
  parseVerificationArguments,
  verificationError,
  verifyCharacterSkills
} from './skill-calculation.mjs'

function createSkillLookup(apiKey) {
  return async ([key], requestSignal) => {
    if (!key || !isCatalogId(key.jobId) || !isCatalogId(key.skillId)) {
      throw new Error('Invalid skill request')
    }
    const path = `/df/skills/${encodeURIComponent(key.jobId)}/${encodeURIComponent(key.skillId)}`
    const signal = AbortSignal.any([requestSignal, AbortSignal.timeout(5000)])
    const response = await fetch(new URL(path, NEOPLE_ORIGIN), {
      headers: { apikey: apiKey },
      redirect: 'error',
      signal
    })
    if (!response.ok) {
      await response.body?.cancel()
      throw new Error('Skill lookup failed')
    }
    const body = await response.json()
    signal.throwIfAborted()
    if (
      !isObject(body) ||
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
