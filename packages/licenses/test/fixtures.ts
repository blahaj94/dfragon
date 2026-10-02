import { mkdtempSync, mkdirSync, writeFileSync, rmSync, realpathSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, relative } from 'node:path'
import type { TestContext } from 'node:test'

export function createPackageFixture(t: Pick<TestContext, 'after'>) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'dfragon-notices-test-')))
  t.after(() => rmSync(root, { recursive: true, force: true }))

  function writeFile(relativePath: string, text: string): string {
    const file = join(root, relativePath)
    mkdirSync(dirname(file), { recursive: true })
    writeFileSync(file, text)

    return file
  }

  function writeManifest(relativePath: string, manifest: object): string {
    return writeFile(join(relativePath, 'package.json'), JSON.stringify(manifest))
  }

  function pkg(
    name: string,
    {
      manifest = {},
      documents = { LICENSE: 'Fixture license text\r\n' },
      from = root
    }: {
      manifest?: object
      documents?: Record<string, string>
      from?: string
    } = {}
  ): string {
    const directory = join(from, 'node_modules', name)
    const packagePath = relative(root, directory)
    writeManifest(packagePath, {
      name,
      version: '1.0.0',
      license: 'MIT',
      main: 'index.js',
      ...manifest
    })
    writeFile(join(packagePath, 'index.js'), '')
    for (const [path, text] of Object.entries(documents)) {
      writeFile(join(packagePath, path), text)
    }

    return directory
  }

  return { root, pkg, writeFile, writeManifest }
}
