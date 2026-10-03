import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdir, writeFile, readFile, readlink, readdir, symlink, lstat } from 'node:fs/promises'
import { join, relative } from 'node:path'
import extract from 'extract-zip'
import { createZipFixture } from './fixtures/zip.mjs'

test('ZIP symlink 대상은 추출 root 밖으로 탈출하거나 외부 디렉터리를 만들지 못한다', async (t) => {
  const { root, archive, directory } = await createZipFixture(t, [
    { name: 'escape', content: '../outside', link: true },
    { name: 'escape/child/marker', content: 'changed' }
  ])
  await mkdir(join(root, 'outside'))
  await writeFile(join(root, 'outside', 'marker'), 'original')
  await assert.rejects(extract(archive, { dir: directory }), /escapes/)
  assert.equal(await readFile(join(root, 'outside', 'marker'), 'utf8'), 'original')
  await assert.rejects(lstat(join(root, 'outside', 'child')), { code: 'ENOENT' })
})

test('ZIP의 중복 파일 이름은 앞서 만든 내부 symlink를 통해 원본 파일을 덮어쓰지 못한다', async (t) => {
  const { archive, directory } = await createZipFixture(t, [
    { name: 'victim', content: 'original' },
    { name: 'alias', content: 'victim', link: true },
    { name: 'alias', content: 'changed' }
  ])
  await assert.rejects(extract(archive, { dir: directory }), /symbolic link/)
  assert.equal(await readFile(join(directory, 'victim'), 'utf8'), 'original')
  assert.equal(await readlink(join(directory, 'alias')), 'victim')
})

test('기존 상위 경로와 leaf의 symlink를 통해 외부 경로를 만들거나 파일을 쓰지 못한다', async (t) => {
  const { root, archive, directory } = await createZipFixture(t, [
    { name: 'escape/new/marker', content: 'changed' }
  ])
  const outside = join(root, 'outside')
  await mkdir(outside)
  await symlink(outside, join(directory, 'escape'), 'dir')
  await assert.rejects(extract(archive, { dir: directory }), /escapes/)
  await assert.rejects(lstat(join(outside, 'new')), { code: 'ENOENT' })

  const leaf = await createZipFixture(t, [{ name: 'marker', content: 'changed' }])
  const victim = join(leaf.root, 'victim')
  await writeFile(victim, 'original')
  await symlink(victim, join(leaf.directory, 'marker'))
  await assert.rejects(extract(leaf.archive, { dir: leaf.directory }), /symbolic link/)
  assert.equal(await readFile(victim, 'utf8'), 'original')
})

test('Electron framework의 내부 symlink와 일반 파일 덮어쓰기는 유지한다', async (t) => {
  const { archive, directory } = await createZipFixture(t, [
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
  assert.equal(await readlink(join(directory, 'Framework/Versions/Current')), 'A')
  assert.equal(await readlink(join(directory, 'Framework/Resources')), 'Versions/Current/Resources')
})

test('절대 경로와 상위 경로 및 root 이름이 겹치는 이웃으로 향하는 symlink는 거절한다', async (t) => {
  const targets = [
    { name: '절대 경로', target: ({ root }) => join(root, 'outside') },
    { name: '여러 단계 상위 경로', target: () => '../../outside', nested: true },
    { name: 'root와 접두어가 같은 이웃', target: () => '../unpacked-neighbor' }
  ]
  for (const { name, target, nested } of targets) {
    await t.test(name, async (t) => {
      const linkName = nested ? 'nested/escape' : 'escape'
      const { root, archive, directory } = await createZipFixture(t, (paths) => [
        { name: linkName, content: target(paths), link: true },
        { name: `${linkName}/marker`, content: 'changed' }
      ])
      const outside = join(root, 'outside')
      const neighbor = join(root, 'unpacked-neighbor')
      await mkdir(outside)
      await mkdir(neighbor)
      await writeFile(join(outside, 'marker'), 'outside-original')
      await writeFile(join(neighbor, 'marker'), 'neighbor-original')

      await assert.rejects(extract(archive, { dir: directory }), /escapes/)
      assert.equal(await readFile(join(outside, 'marker'), 'utf8'), 'outside-original')
      assert.equal(await readFile(join(neighbor, 'marker'), 'utf8'), 'neighbor-original')
      await assert.rejects(lstat(join(directory, linkName)), { code: 'ENOENT' })
    })
  }
})

test('기존 내부 parent symlink로 추출해도 실제 내부 디렉터리에만 파일을 만든다', async (t) => {
  const { archive, directory } = await createZipFixture(t, [
    { name: 'alias/nested/', directory: true },
    { name: 'alias/nested/file', content: 'internal' }
  ])
  await mkdir(join(directory, 'real'))
  await symlink('real', join(directory, 'alias'), 'dir')

  await extract(archive, { dir: directory })
  assert.equal(await readlink(join(directory, 'alias')), 'real')
  assert.equal(await readFile(join(directory, 'real/nested/file'), 'utf8'), 'internal')
  assert.deepEqual(await readdir(join(directory, 'real/nested')), ['file'])
})

test('기존 외부 parent symlink를 가리키는 새 symlink도 만들기 전에 거절한다', async (t) => {
  const cases = [
    { name: '존재하는 외부 파일', target: 'pivot/marker', outsideExists: true },
    {
      name: '외부 ancestor 아래 아직 없는 파일',
      target: 'pivot/missing/marker',
      outsideExists: true
    },
    {
      name: 'symlink 뒤의 ..로 외부 상위 파일 참조',
      target: 'pivot/../marker',
      outsideExists: true
    },
    { name: '외부 target이 없는 dangling parent', target: 'pivot/marker', outsideExists: false }
  ]
  for (const { name, target, outsideExists } of cases) {
    await t.test(name, async (t) => {
      const { root, archive, directory } = await createZipFixture(t, [
        { name: 'alias', content: target, link: true }
      ])
      const outside = join(root, 'outside')
      if (outsideExists) {
        await mkdir(outside)
        await writeFile(join(outside, 'marker'), 'original')
        await writeFile(join(root, 'marker'), 'parent-original')
      }
      await symlink(outside, join(directory, 'pivot'), 'dir')

      await assert.rejects(extract(archive, { dir: directory }), /escapes/)
      if (outsideExists) {
        assert.equal(await readFile(join(outside, 'marker'), 'utf8'), 'original')
        assert.equal(await readFile(join(root, 'marker'), 'utf8'), 'parent-original')
        await assert.rejects(lstat(join(outside, 'missing')), { code: 'ENOENT' })
      } else {
        await assert.rejects(lstat(outside), { code: 'ENOENT' })
      }
      await assert.rejects(lstat(join(directory, 'alias')), { code: 'ENOENT' })
      assert.equal(await readlink(join(directory, 'pivot')), outside)
    })
  }
})

test('내부 forward symlink chain은 뒤에서 만들어지는 파일까지 연결된다', async (t) => {
  const { archive, directory } = await createZipFixture(t, [
    { name: 'first', content: 'second', link: true },
    { name: 'second', content: 'future/file', link: true },
    { name: 'future/file', content: 'internal' }
  ])

  await extract(archive, { dir: directory })
  assert.equal(await readlink(join(directory, 'first')), 'second')
  assert.equal(await readlink(join(directory, 'second')), 'future/file')
  assert.equal(await readFile(join(directory, 'first'), 'utf8'), 'internal')
  assert.equal(await readFile(join(directory, 'future/file'), 'utf8'), 'internal')
})

test('중복 symlink 항목은 먼저 만든 링크와 두 원본 파일을 변경하지 못한다', async (t) => {
  const { archive, directory } = await createZipFixture(t, [
    { name: 'first', content: 'first-original' },
    { name: 'second', content: 'second-original' },
    { name: 'alias', content: 'first', link: true },
    { name: 'alias', content: 'second', link: true }
  ])

  await assert.rejects(extract(archive, { dir: directory }), { code: 'EEXIST' })
  assert.equal(await readlink(join(directory, 'alias')), 'first')
  assert.equal(await readFile(join(directory, 'first'), 'utf8'), 'first-original')
  assert.equal(await readFile(join(directory, 'second'), 'utf8'), 'second-original')
})

test('4096자를 넘는 ASCII symlink는 거절하고 뒤의 항목을 추출하지 않는다', async (t) => {
  const { archive, directory } = await createZipFixture(t, [
    { name: 'before', content: 'preserved' },
    { name: 'oversized', content: 'a'.repeat(4097), link: true },
    { name: 'after', content: 'must-not-write' }
  ])

  await assert.rejects(extract(archive, { dir: directory }), /maxBuffer exceeded/)
  assert.equal(await readFile(join(directory, 'before'), 'utf8'), 'preserved')
  await assert.rejects(lstat(join(directory, 'oversized')), { code: 'ENOENT' })
  await assert.rejects(lstat(join(directory, 'after')), { code: 'ENOENT' })
  assert.deepEqual(await readdir(directory), ['before'])
})

test('유해한 항목에서 중단하면 앞선 내부 파일과 외부 원본을 보존하고 후속 항목은 쓰지 않는다', async (t) => {
  const { root, archive, directory } = await createZipFixture(t, [
    { name: 'before', content: 'preserved' },
    { name: 'escape', content: '../outside', link: true },
    { name: 'escape/marker', content: 'changed' },
    { name: 'after', content: 'must-not-write' }
  ])
  await mkdir(join(root, 'outside'))
  await writeFile(join(root, 'outside/marker'), 'original')

  await assert.rejects(extract(archive, { dir: directory }), /escapes/)
  assert.equal(await readFile(join(directory, 'before'), 'utf8'), 'preserved')
  assert.equal(await readFile(join(root, 'outside/marker'), 'utf8'), 'original')
  await assert.rejects(lstat(join(directory, 'escape')), { code: 'ENOENT' })
  await assert.rejects(lstat(join(directory, 'after')), { code: 'ENOENT' })
  assert.deepEqual(await readdir(directory), ['before'])
})

test('상대 추출 경로와 손상된 ZIP은 파일을 만들기 전에 거절한다', async (t) => {
  const { root, archive, directory } = await createZipFixture(t, [
    { name: 'marker', content: 'changed' }
  ])
  const relativeDirectory = relative(process.cwd(), join(root, 'relative-directory'))
  await assert.rejects(extract(archive, { dir: relativeDirectory }), /expected to be absolute/)
  await assert.rejects(lstat(join(root, 'relative-directory')), { code: 'ENOENT' })
  const bytes = await readFile(archive)
  await writeFile(archive, bytes.subarray(0, bytes.length - 22))
  await assert.rejects(extract(archive, { dir: directory }), /end of central directory/)
  assert.deepEqual(await readdir(directory), [])
})

test('뒤에 추출되는 내부 링크가 미확정 경로 뒤의 ..를 외부로 돌리지 못한다', async (t) => {
  const { root, archive, directory } = await createZipFixture(t, [
    { name: 'alias', content: 'sub/pivot/../marker', link: true },
    { name: 'sub/pivot', content: '..', link: true },
    { name: 'after', content: 'must-not-write' }
  ])
  await writeFile(join(root, 'marker'), 'external-original')

  await assert.rejects(extract(archive, { dir: directory }), /unresolved archive link/)
  assert.equal(await readFile(join(root, 'marker'), 'utf8'), 'external-original')
  await assert.rejects(lstat(join(directory, 'alias')), { code: 'ENOENT' })
  await assert.rejects(lstat(join(directory, 'sub')), { code: 'ENOENT' })
  await assert.rejects(lstat(join(directory, 'after')), { code: 'ENOENT' })
})

test('기존 부모에서 ..로 이동한 뒤의 내부 forward link는 계속 허용한다', async (t) => {
  const { archive, directory } = await createZipFixture(t, [
    { name: 'sub/alias', content: '../future/file', link: true },
    { name: 'future/file', content: 'internal' }
  ])

  await extract(archive, { dir: directory })
  assert.equal(await readlink(join(directory, 'sub/alias')), '../future/file')
  assert.equal(await readFile(join(directory, 'sub/alias'), 'utf8'), 'internal')
})
