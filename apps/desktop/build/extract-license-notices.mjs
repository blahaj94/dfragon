import { copyFileSync, existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

/** Preserve the target originals before electron-builder removes them on macOS.
 * @param {import('electron-builder').AfterPackContext} context
 * @returns {Promise<void>}
 */
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- JSDoc describes the builder hook.
export default async function afterExtract(context) {
  const destination = join(context.appOutDir, '.runtime-notices')
  mkdirSync(destination, { recursive: true })
  const license = existsSync(join(context.appOutDir, 'LICENSE.electron.txt'))
    ? 'LICENSE.electron.txt'
    : 'LICENSE'
  copyFileSync(join(context.appOutDir, license), join(destination, 'LICENSE'))
  copyFileSync(
    join(context.appOutDir, 'LICENSES.chromium.html'),
    join(destination, 'LICENSES.chromium.html')
  )
}
