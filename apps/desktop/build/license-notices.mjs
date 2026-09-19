import { rmSync } from 'node:fs'
import { join } from 'node:path'
import { packageDesktopNotices } from '@ldb/licenses/packaging'

/** @param {import('electron-builder').AfterPackContext} context @returns {Promise<void>} */
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- JSDoc describes the builder hook.
export default async function afterPack(context) {
  packageDesktopNotices({
    sourceDirectory: join(context.packager.projectDir, 'out/frontend/notices'),
    electronDirectory: join(context.appOutDir, '.runtime-notices'),
    resourcesDirectory: context.packager.getResourcesDir(context.appOutDir)
  })
  rmSync(join(context.appOutDir, '.runtime-notices'), { recursive: true })
}
