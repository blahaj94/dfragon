import { createWriteStream } from 'node:fs'
import { mkdtemp, mkdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pipeline } from 'node:stream/promises'
import { ZipFile } from 'yazl'

export async function createZipFixture(t, entries) {
  const root = await mkdtemp(join(tmpdir(), 'dfragon-zip-security-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  const archive = join(root, 'fixture.zip')
  const directory = join(root, 'unpacked')
  const zip = new ZipFile()
  const fixtureEntries = typeof entries === 'function' ? entries({ root, directory }) : entries
  for (const entry of fixtureEntries) {
    if (entry.directory) {
      zip.addEmptyDirectory(entry.name)
      continue
    }
    zip.addBuffer(Buffer.from(entry.content), entry.name, {
      mode: entry.link ? 0o120777 : 0o100644
    })
  }
  const written = pipeline(zip.outputStream, createWriteStream(archive))
  zip.end()
  await written
  await mkdir(directory)

  return { root, archive, directory }
}
