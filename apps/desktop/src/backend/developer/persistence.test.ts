import { promises as fs } from 'node:fs'
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, expect, it, vi } from 'vitest'
import { createDeveloperStore } from './persistence'

const directories: string[] = []

function png(width = 2, height = 1): Buffer {
  const result = Buffer.alloc(33)
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(result, 0)
  result.writeUInt32BE(13, 8)
  result.write('IHDR', 12)
  result.writeUInt32BE(width, 16)
  result.writeUInt32BE(height, 20)
  result[24] = 8
  result[25] = 6
  return result
}

async function createStore(): Promise<{
  rootDir: string
  store: ReturnType<typeof createDeveloperStore>
}> {
  const rootDir = await mkdtemp(join(tmpdir(), 'dfragon-developer-'))
  directories.push(rootDir)
  return {
    rootDir,
    store: createDeveloperStore({
      rootDir,
      decodePng: (value) => ({ width: value.readUInt32BE(16), height: value.readUInt32BE(20) })
    })
  }
}

afterEach(async () => {
  vi.restoreAllMocks()
  await Promise.all(
    directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true }))
  )
})

it('defaults to disabled, persists the flag, and blocks sample operations until enabled', async () => {
  const { rootDir, store } = await createStore()

  expect(await store.getSettings()).toEqual({ enabled: false })
  await expect(store.listSamples()).rejects.toThrow('DEVELOPER_DISABLED')
  expect(await store.setEnabled(true)).toEqual({ enabled: true })

  const reopened = createDeveloperStore({
    rootDir,
    decodePng: (value) => ({ width: value.readUInt32BE(16), height: value.readUInt32BE(20) })
  })
  expect(await reopened.getSettings()).toEqual({ enabled: true })
  expect(await reopened.listSamples()).toEqual([])
  expect(await reopened.setEnabled(false)).toEqual({ enabled: false })
  await expect(reopened.readImage('../settings.json')).rejects.toThrow('DEVELOPER_INVALID_COMMAND')
})

it('stores original PNG bytes and distinguishes unlabeled, empty, and nonempty labels', async () => {
  const { rootDir, store } = await createStore()
  const originalPng = png()
  const pngDataUrl = `data:image/png;base64,${originalPng.toString('base64')}`
  await store.setEnabled(true)

  const sample = await store.addSample(pngDataUrl)
  expect(sample).toMatchObject({ width: 2, height: 1, text: null })
  expect(sample.id).toMatch(/^[\da-f-]{36}$/i)
  expect(await store.listSamples()).toEqual([sample])
  expect(await store.readImage(sample.id)).toBe(pngDataUrl)
  expect(await readFile(join(rootDir, 'developer-mode', 'samples', `${sample.id}.png`))).toEqual(
    originalPng
  )

  const emptyLabel = await store.saveLabel(sample.id, '')
  expect(emptyLabel.text).toBe('')
  expect((await store.readImage(sample.id)).startsWith('data:image/png;base64,')).toBe(true)
  expect((await store.saveLabel(sample.id, '가나다')).text).toBe('가나다')
  expect((await store.saveLabel(sample.id, null)).text).toBeNull()
})

it('serializes concurrent label updates and leaves the last submitted value', async () => {
  const { store } = await createStore()
  await store.setEnabled(true)
  const sample = await store.addSample(`data:image/png;base64,${png().toString('base64')}`)

  const first = store.saveLabel(sample.id, 'first')
  const second = store.saveLabel(sample.id, 'second')
  await Promise.all([first, second])

  expect((await store.listSamples())[0].text).toBe('second')
})

it('keeps the previous label when the atomic metadata replacement fails', async () => {
  const { store } = await createStore()
  await store.setEnabled(true)
  const sample = await store.addSample(`data:image/png;base64,${png().toString('base64')}`)
  await store.saveLabel(sample.id, 'previous')
  const rename = vi.spyOn(fs, 'rename').mockRejectedValueOnce(new Error('simulated disk failure'))

  await expect(store.saveLabel(sample.id, 'replacement')).rejects.toThrow(
    'DEVELOPER_STORAGE_UNAVAILABLE'
  )
  rename.mockRestore()

  expect((await store.listSamples())[0].text).toBe('previous')
})

it('removes a staged PNG when writing new sample metadata fails', async () => {
  const { rootDir, store } = await createStore()
  await store.setEnabled(true)
  const originalRename = fs.rename.bind(fs)
  let renameCount = 0
  const rename = vi.spyOn(fs, 'rename').mockImplementation(async (source, destination) => {
    renameCount += 1
    if (renameCount === 2) {
      throw new Error('simulated sidecar write failure')
    }
    await originalRename(source, destination)
  })

  await expect(
    store.addSample(`data:image/png;base64,${png().toString('base64')}`)
  ).rejects.toThrow('DEVELOPER_STORAGE_UNAVAILABLE')
  rename.mockRestore()

  expect(await readdir(join(rootDir, 'developer-mode', 'samples'))).toEqual([])
})

it('rejects malformed or oversized PNGs and labels beyond the contract limit', async () => {
  const { store } = await createStore()
  await store.setEnabled(true)

  await expect(store.addSample('data:image/png;base64,not-png')).rejects.toThrow(
    'DEVELOPER_INVALID_COMMAND'
  )
  await expect(
    store.addSample(`data:image/png;base64,${png(8193, 1).toString('base64')}`)
  ).rejects.toThrow('DEVELOPER_INVALID_COMMAND')
  await expect(
    store.addSample(`data:image/png;base64,${png(8192, 4096).toString('base64')}`)
  ).rejects.toThrow('DEVELOPER_INVALID_COMMAND')

  const sample = await store.addSample(`data:image/png;base64,${png().toString('base64')}`)
  await expect(store.saveLabel(sample.id, 'x'.repeat(501))).rejects.toThrow(
    'DEVELOPER_INVALID_COMMAND'
  )
})

it('fails closed for corrupt settings and permits an explicit disabled repair', async () => {
  const { rootDir, store } = await createStore()
  const settingsPath = join(rootDir, 'developer-mode', 'settings.json')
  await mkdir(join(rootDir, 'developer-mode'), { recursive: true })
  await writeFile(settingsPath, '{"enabled":"true"}')

  expect(await store.getSettings()).toEqual({ enabled: false })
  await expect(store.setEnabled(true)).rejects.toThrow('DEVELOPER_STORAGE_UNAVAILABLE')
  await expect(
    store.addSample(`data:image/png;base64,${png().toString('base64')}`)
  ).rejects.toThrow('DEVELOPER_DISABLED')
  expect(await store.setEnabled(false)).toEqual({ enabled: false })
  expect(await store.getSettings()).toEqual({ enabled: false })
})

it('fails closed when persisted sample metadata disagrees with its image', async () => {
  const { rootDir, store } = await createStore()
  await store.setEnabled(true)
  const sample = await store.addSample(`data:image/png;base64,${png().toString('base64')}`)
  const metadataPath = join(rootDir, 'developer-mode', 'samples', `${sample.id}.json`)
  await writeFile(metadataPath, JSON.stringify({ ...sample, width: 3 }))

  expect(await store.listSamples()).toEqual([{ ...sample, width: 3 }])
  await expect(store.readImage(sample.id)).rejects.toThrow('DEVELOPER_STORAGE_UNAVAILABLE')
  await expect(store.saveLabel(sample.id, 'should not write')).rejects.toThrow(
    'DEVELOPER_STORAGE_UNAVAILABLE'
  )
  expect(await store.listSamples()).toEqual([{ ...sample, width: 3 }])
})
