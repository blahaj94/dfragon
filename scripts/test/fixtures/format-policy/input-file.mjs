import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

export async function createFormatInputFile(
  t,
  filename,
  source,
  prefix = 'dfragon-format-policy-'
) {
  const directory = await mkdtemp(join(tmpdir(), prefix))
  t.after(() => rm(directory, { recursive: true, force: true }))
  const filepath = join(directory, filename)
  await writeFile(filepath, source)

  return filepath
}
