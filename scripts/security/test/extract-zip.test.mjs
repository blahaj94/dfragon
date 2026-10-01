import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdtemp, mkdir, writeFile, readFile, symlink, lstat, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pipeline } from 'node:stream/promises'
import { createWriteStream } from 'node:fs'
import extract from 'extract-zip'
import { ZipFile } from 'yazl'

async function fixture(t, entries) {
  const root = await mkdtemp(join(tmpdir(), 'dfragon-zip-security-'))
  t.after(() => rm(root, { recursive: true, force: true }))
  const archive = join(root, 'fixture.zip')
  const directory = join(root, 'unpacked')
  const zip = new ZipFile()
  for (const entry of entries) {
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

test('ZIP symlink targets cannot escape the extraction root', async (t) => {
  const { root, archive, directory } = await fixture(t, [
    { name: 'escape', content: '../outside', link: true },
    { name: 'escape/child/marker', content: 'changed' }
  ])
  await mkdir(join(root, 'outside'))
  await writeFile(join(root, 'outside', 'marker'), 'original')
  await assert.rejects(extract(archive, { dir: directory }), /escapes/)
  assert.equal(await readFile(join(root, 'outside', 'marker'), 'utf8'), 'original')
  await assert.rejects(lstat(join(root, 'outside', 'child')), { code: 'ENOENT' })
})

test('a repeated ZIP filename cannot overwrite through an earlier in-tree symlink', async (t) => {
  const { archive, directory } = await fixture(t, [
    { name: 'victim', content: 'original' },
    { name: 'alias', content: 'victim', link: true },
    { name: 'alias', content: 'changed' }
  ])
  await assert.rejects(extract(archive, { dir: directory }), /symbolic link/)
  assert.equal(await readFile(join(directory, 'victim'), 'utf8'), 'original')
})

test('pre-existing parent and leaf symlinks cannot create directories or write outside the root', async (t) => {
  const { root, archive, directory } = await fixture(t, [
    { name: 'escape/new/marker', content: 'changed' }
  ])
  const outside = join(root, 'outside')
  await mkdir(outside)
  await symlink(outside, join(directory, 'escape'), 'dir')
  await assert.rejects(extract(archive, { dir: directory }), /escapes/)
  await assert.rejects(lstat(join(outside, 'new')), { code: 'ENOENT' })

  const leaf = await fixture(t, [{ name: 'marker', content: 'changed' }])
  const victim = join(leaf.root, 'victim')
  await writeFile(victim, 'original')
  await symlink(victim, join(leaf.directory, 'marker'))
  await assert.rejects(extract(leaf.archive, { dir: leaf.directory }), /symbolic link/)
  assert.equal(await readFile(victim, 'utf8'), 'original')
})

test('Electron-style internal framework links and ordinary file replacement remain supported', async (t) => {
  const { archive, directory } = await fixture(t, [
    { name: 'Framework/Versions/A/Resources/file', content: 'original' },
    { name: 'Framework/Versions/Current', content: 'A', link: true },
    { name: 'Framework/Resources', content: 'Versions/Current/Resources', link: true },
    { name: 'Framework/Resources/new/file', content: 'new' },
    { name: 'Framework/Versions/A/Resources/file', content: 'updated' }
  ])
  await extract(archive, { dir: directory })
  assert.equal(await readFile(join(directory, 'Framework/Resources/file'), 'utf8'), 'updated')
  assert.equal(
    await readFile(join(directory, 'Framework/Versions/A/Resources/new/file'), 'utf8'),
    'new'
  )
})
