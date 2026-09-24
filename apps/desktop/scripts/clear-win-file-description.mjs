import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { NtExecutable, NtExecutableResource, Resource } from 'resedit'

/**
 * @param {{ appOutDir: string, electronPlatformName: string, packager: { appInfo: { productFilename: string } } }} context
 * @returns {Promise<void>}
 */
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- JSDoc carries the JavaScript return type.
export default async function clearWinFileDescription(context) {
  if (context.electronPlatformName !== 'win32') {
    return
  }

  // electron-builder rewrites this PE field after afterPack, so clear the final app executable here.
  const executablePath = join(context.appOutDir, `${context.packager.appInfo.productFilename}.exe`)
  const executable = NtExecutable.from(await readFile(executablePath))
  const resources = NtExecutableResource.from(executable)
  const versionInfos = Resource.VersionInfo.fromEntries(resources.entries)

  if (versionInfos.length === 0) {
    throw new Error('Windows executable has no version info resource')
  }

  for (const versionInfo of versionInfos) {
    const languages = versionInfo.getAllLanguagesForStringValues()

    if (languages.length === 0) {
      throw new Error('Windows executable has no version info string language')
    }

    for (const language of languages) {
      versionInfo.setStringValue(language, 'FileDescription', '', false)

      if (versionInfo.getStringValues(language).FileDescription !== '') {
        throw new Error('Windows executable file description was not cleared')
      }
    }

    versionInfo.outputToResourceEntries(resources.entries)
  }

  resources.outputResource(executable)
  await writeFile(executablePath, Buffer.from(executable.generate()))
}
