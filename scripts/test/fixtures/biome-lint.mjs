import { execFile } from 'node:child_process'
import { cp, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'

const run = promisify(execFile)
const root = fileURLToPath(new URL('../../../', import.meta.url))
const biome = createRequire(join(root, 'package.json')).resolve('@biomejs/biome/bin/biome')

async function lintReport(directory) {
  const args = [biome, 'lint', '--vcs-enabled=false', '--reporter=json', '--max-diagnostics=none']

  try {
    const { stdout } = await run(process.execPath, args, { cwd: directory })

    return stdout
  } catch (error) {
    // Biome exits non-zero when it reports errors; the JSON report is still the result.
    if (error.stdout) {
      return error.stdout
    }

    throw error
  }
}

export async function lintSamples(sources) {
  const directory = await mkdtemp(join(tmpdir(), 'dfragon-biome-lint-'))

  try {
    await cp(join(root, 'biome.json'), join(directory, 'biome.json'))
    await cp(join(root, 'scripts/biome'), join(directory, 'scripts/biome'), { recursive: true })

    for (const [path, source] of Object.entries(sources)) {
      await mkdir(dirname(join(directory, path)), { recursive: true })
      await writeFile(join(directory, path), source)
    }

    const report = JSON.parse(await lintReport(directory))
    const diagnostics = new Map(Object.keys(sources).map((path) => [path, []]))

    for (const diagnostic of report.diagnostics) {
      const sample = diagnostics.get(diagnostic.location?.path)

      if (sample == null) {
        throw new Error(`Unexpected Biome diagnostic: ${JSON.stringify(diagnostic)}`)
      }

      sample.push(diagnostic)
    }

    return diagnostics
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
}
