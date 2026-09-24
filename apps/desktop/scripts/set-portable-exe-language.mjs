import { readFile, rename, rm, writeFile } from 'node:fs/promises'
import { NtExecutable, NtExecutableResource, Resource } from 'resedit'

const PORTABLE_EXE_PATTERN = /-portable\.exe$/i
const KOREAN_TRANSLATION = { lang: 0x0412, codepage: 1200 }

/** @param {{ artifactPaths: Array<string> }} context @returns {Promise<Array<string>>} */
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- JSDoc carries the JavaScript return type.
export default async function setPortableExecutableLanguage({ artifactPaths }) {
  for (const artifactPath of artifactPaths) {
    if (PORTABLE_EXE_PATTERN.test(artifactPath)) {
      await setKoreanTranslation(artifactPath)
    }
  }

  return []
}

/** @param {string} executablePath @returns {Promise<void>} */
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- JSDoc carries the JavaScript return type.
async function setKoreanTranslation(executablePath) {
  const original = await readFile(executablePath)
  // NtExecutable.from rejects signed files unless explicitly told to edit them.
  const executable = NtExecutable.from(original)
  const originalExtraData = toBuffer(executable.getExtraData())
  if (originalExtraData.length === 0) {
    throw new Error('Portable executable has no embedded NSIS payload.')
  }
  const resources = NtExecutableResource.from(executable)
  const versionInfoList = Resource.VersionInfo.fromEntries(resources.entries)

  if (versionInfoList.length !== 1) {
    throw new Error('Portable executable must contain exactly one version resource.')
  }

  const versionInfo = versionInfoList[0]
  const originalVersionResource = resources.entries.find(
    (entry) => entry.type === 16 && entry.id === 1 && entry.lang === versionInfo.lang
  )
  if (originalVersionResource == null) {
    throw new Error('Portable executable version resource could not be located.')
  }

  const stringLanguages = versionInfo.getAllLanguagesForStringValues()
  if (stringLanguages.length === 0) {
    throw new Error('Portable executable version resource has no string language.')
  }

  const stringValues = Object.assign(
    {},
    ...stringLanguages.map((language) => versionInfo.getStringValues(language))
  )
  for (const language of stringLanguages) {
    versionInfo.removeAllStringValues(language, false)
  }

  versionInfo.setStringValues(KOREAN_TRANSLATION, stringValues, false)
  versionInfo.replaceAvailableLanguages([KOREAN_TRANSLATION])
  versionInfo.lang = KOREAN_TRANSLATION.lang
  resources.entries.splice(resources.entries.indexOf(originalVersionResource), 1)
  versionInfo.outputToResourceEntries(resources.entries)
  resources.outputResource(executable)

  const updated = Buffer.from(executable.generate())
  verifyPortableExecutable(updated, original.byteLength, originalExtraData)
  await replaceFile(executablePath, updated)
}

/** @param {Buffer} binary @param {number} originalLength @param {Buffer} expectedExtraData @returns {void} */
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- JSDoc carries the JavaScript return type.
function verifyPortableExecutable(binary, originalLength, expectedExtraData) {
  const executable = NtExecutable.from(binary)
  const extraData = toBuffer(executable.getExtraData())
  const trailingData = binary.subarray(binary.byteLength - extraData.byteLength)
  const originalExtraDataOffset = originalLength - expectedExtraData.byteLength
  const updatedExtraDataOffset = binary.byteLength - extraData.byteLength
  const offsetShift = updatedExtraDataOffset - originalExtraDataOffset
  if (
    !extraData.equals(expectedExtraData) ||
    !trailingData.equals(expectedExtraData) ||
    offsetShift % 512 !== 0
  ) {
    throw new Error('Portable executable resource editing changed the embedded NSIS payload.')
  }

  const resources = NtExecutableResource.from(executable)
  const versionInfoList = Resource.VersionInfo.fromEntries(resources.entries)
  if (versionInfoList.length !== 1) {
    throw new Error('Portable executable version resource changed unexpectedly.')
  }

  const versionInfo = versionInfoList[0]
  const languages = versionInfo.getAllLanguagesForStringValues()
  const translations = versionInfo.getAvailableLanguages()
  if (
    versionInfo.lang !== KOREAN_TRANSLATION.lang ||
    languages.length !== 1 ||
    languages[0].lang !== KOREAN_TRANSLATION.lang ||
    languages[0].codepage !== KOREAN_TRANSLATION.codepage ||
    translations.length !== 1 ||
    translations[0].lang !== KOREAN_TRANSLATION.lang ||
    translations[0].codepage !== KOREAN_TRANSLATION.codepage
  ) {
    throw new Error('Portable executable version resource is not Korean (Korea).')
  }
}

/** @param {ArrayBuffer | ArrayBufferView | null} data @returns {Buffer} */
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- JSDoc carries the JavaScript return type.
function toBuffer(data) {
  return data == null ? Buffer.alloc(0) : Buffer.from(data)
}

/** @param {string} filePath @param {Buffer} content @returns {Promise<void>} */
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- JSDoc carries the JavaScript return type.
async function replaceFile(filePath, content) {
  const temporaryPath = `${filePath}.${process.pid}.tmp`
  try {
    await writeFile(temporaryPath, content)
    await rename(temporaryPath, filePath)
  } catch (error) {
    await rm(temporaryPath, { force: true })
    throw error
  }
}
