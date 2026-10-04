import { readSecretInput } from '../dist/secret-input.js'
import { createNeopleCharacterSearch } from '../dist/characters/neople-character-search.js'
import { createNeopleCharacterDetails } from '../dist/characters/details/neople.js'
import { createNeopleCatalog } from '../dist/characters/catalog/neople.js'
import {
  SkillVerificationFailure,
  loadSkillPackage,
  parseVerificationArguments,
  verificationError,
  verifyCharacterSkills
} from './skill-calculation.mjs'

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
    fetchCatalog: createNeopleCatalog(apiKey)
  }
  const summary = await verifyCharacterSkills(options, skillPackage, providers)
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`)
} catch (error) {
  process.stderr.write(`${JSON.stringify(verificationError(error))}\n`)
  process.exitCode = 1
}
