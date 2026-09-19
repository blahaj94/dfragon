import { copyFileSync, cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { renderNotices } from './viewer.ts'

/** Use the target Electron distribution's originals, including during cross-platform packaging. */
export function packageDesktopNotices({ sourceDirectory, electronDirectory, resourcesDirectory }) {
  const destination = join(resourcesDirectory, 'licenses')
  const electronLicense = ['LICENSE.electron.txt', 'LICENSE']
    .map((file) => join(electronDirectory, file))
    .find((file) => existsSync(file))
  if (!electronLicense) {
    throw new Error('Target Electron license is missing')
  }
  const electronText = readFileSync(electronLicense, 'utf8')
  const entries = JSON.parse(readFileSync(join(sourceDirectory, 'licenses.json'), 'utf8'))
  const electron = entries.find((entry) => entry.name === 'Electron')
  if (!electron) {
    throw new Error('Electron entry is missing from the generated notices')
  }
  electron.documents = [{ name: 'LICENSE', text: electronText }]
  // The parent Koffi notice covers its platform binaries and their bundled Node headers.
  // Avoid describing the build host's optional binary as the packaged target binary.
  const targetEntries = entries.filter((entry) => !entry.name.startsWith('@koromix/koffi-'))
  mkdirSync(destination, { recursive: true })
  cpSync(sourceDirectory, destination, { recursive: true })
  copyFileSync(
    join(electronDirectory, 'LICENSES.chromium.html'),
    join(destination, 'LICENSES.chromium.html')
  )
  writeFileSync(join(destination, 'LICENSE'), electronText)
  writeFileSync(join(destination, 'licenses.json'), JSON.stringify(targetEntries, null, 2))
  writeFileSync(join(destination, 'index.html'), renderNotices(targetEntries, true))
}
