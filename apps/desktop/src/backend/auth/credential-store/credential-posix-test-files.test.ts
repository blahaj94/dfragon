import * as fs from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  createPosixTestFiles,
  POSIX_TEST_FILE_CONSTANTS as constants
} from './credential-posix-test-files'
import { createStoreFixture } from './credential-store-test-fixture'

// 실제 host와 관계없이 합성 경계 자체를 검사하며 OS 보안 지원을 검증하지 않는다.
describe('credential POSIX 테스트 filesystem 경계', () => {
  let root: string
  let files: typeof fs
  const uid = 12345

  beforeEach(async () => {
    root = await fs.mkdtemp(join(tmpdir(), 'dfragon-posix-test-'))
    files = createPosixTestFiles({ root, uid })
  })

  afterEach(async () => {
    await fs.rm(root, { recursive: true, force: true })
  })

  it('생성 mode와 변경 mode를 path 및 열린 handle에 보존하고 교체·삭제에 반영한다', async () => {
    const from = join(root, 'temporary')
    const to = join(root, 'record')
    const handle = await files.open(
      from,
      constants.O_CREAT | constants.O_EXCL | constants.O_RDWR,
      0o600
    )
    try {
      await handle.writeFile('synthetic record')
      await files.chmod(from, 0o640)
      expect((await handle.stat()).mode & 0o777).toBe(0o640)
      expect((await handle.stat()).uid).toBe(uid)
      expect((await handle.stat()).isFile()).toBe(true)
      await files.writeFile(to, 'previous', { mode: 0o600 })
      await files.rename(from, to)
      expect((await files.lstat(to)).mode & 0o777).toBe(0o640)
      expect((await files.lstat(to)).uid).toBe(uid)
      expect(await fs.readFile(to, 'utf8')).toBe('synthetic record')
      await expect(files.lstat(from)).rejects.toMatchObject({ code: 'ENOENT' })
    } finally {
      await handle.close()
    }
    await files.unlink(to)
    await files.writeFile(to, 'new', { mode: 0o644 })
    expect((await files.lstat(to)).mode & 0o777).toBe(0o644)
  })

  it('직접 write의 생성 mode를 보존하고 기존 file을 exclusive open으로 덮어쓰지 않는다', async () => {
    const path = join(root, 'record')
    await files.writeFile(path, 'original', { mode: 0o644 })
    await files.writeFile(path, 'updated', { mode: 0o600 })
    expect((await files.lstat(path)).mode & 0o777).toBe(0o644)
    await expect(
      files.open(path, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL, 0o600)
    ).rejects.toMatchObject({ code: 'EEXIST' })
    expect(await fs.readFile(path, 'utf8')).toBe('updated')
  })

  it('symlink type과 target을 보존하며 nofollow open은 target을 읽거나 수정하지 않는다', async () => {
    const target = join(root, 'target')
    const link = join(root, 'link')
    await files.writeFile(target, 'sentinel', { mode: 0o600 })
    await files.symlink(target, link)
    const stat = await files.lstat(link)
    expect(stat.isSymbolicLink()).toBe(true)
    expect(stat.isFile()).toBe(false)
    expect(stat.isDirectory()).toBe(false)
    await expect(
      files.open(link, constants.O_WRONLY | constants.O_TRUNC | constants.O_NOFOLLOW)
    ).rejects.toMatchObject({ code: 'ELOOP' })
    const followed = await files.open(link, constants.O_RDONLY)
    try {
      expect(await followed.readFile('utf8')).toBe('sentinel')
    } finally {
      await followed.close()
    }
    expect(await fs.readFile(target, 'utf8')).toBe('sentinel')
  })

  it('directory handle은 실제 type과 변경 mode를 확인하고 close 뒤 sync를 거절한다', async () => {
    const directory = join(root, 'directory')
    const record = join(root, 'record')
    await files.mkdir(directory, { mode: 0o700 })
    await files.writeFile(record, 'synthetic', { mode: 0o600 })
    const flags = constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW
    await expect(files.open(record, flags)).rejects.toMatchObject({ code: 'ENOTDIR' })
    const handle = await files.open(directory, flags)
    try {
      await files.chmod(directory, 0o755)
      expect((await handle.stat()).mode & 0o777).toBe(0o755)
      expect((await handle.stat()).uid).toBe(uid)
      expect((await handle.stat()).isDirectory()).toBe(true)
      await handle.sync()
    } finally {
      await handle.close()
    }
    await expect(handle.sync()).rejects.toMatchObject({ code: 'EBADF' })
  })
})

describe('credential fixture의 합성 POSIX 상태 격리', () => {
  it.each([true, false])(
    '기존 getuid 존재=%s에서 owner 검사를 유지하고 descriptor를 복원한다',
    async (hasUid) => {
      const original = Object.getOwnPropertyDescriptor(process, 'getuid')
      if (!hasUid) {
        Reflect.deleteProperty(process, 'getuid')
      }
      const before = Object.getOwnPropertyDescriptor(process, 'getuid')
      const fixture = await createStoreFixture({ modelPosix: true })
      try {
        await fixture.seedReady()
        expect(await fixture.createStore().inspect()).toMatchObject({ status: 'ready' })
        Object.defineProperty(process, 'getuid', { configurable: true, value: () => 54321 })
        expect(await fixture.createStore().inspect()).toEqual({ status: 'unavailable' })
      } finally {
        await fixture.cleanup()
        try {
          expect(Object.getOwnPropertyDescriptor(process, 'getuid')).toEqual(before)
        } finally {
          const hadOriginal = original != null
          if (hadOriginal) {
            Object.defineProperty(process, 'getuid', original)
          } else {
            Reflect.deleteProperty(process, 'getuid')
          }
        }
      }
    }
  )

  it('rename과 unlink의 after 오류 시 실제 mutation과 metadata가 이미 반영된다', async () => {
    const fixture = await createStoreFixture({ modelPosix: true })
    try {
      await fixture.seedReady()
      const temporary = join(fixture.directory, 'temporary')
      const record = join(fixture.directory, 'credential.v1')
      await fixture.files.writeFile(temporary, 'synthetic replacement', { mode: 0o640 })
      fixture.failures.set('rename:credential.v1', ['after'])
      await expect(fixture.files.rename(temporary, record)).rejects.toMatchObject({ code: 'EIO' })
      expect(await fs.readFile(record, 'utf8')).toBe('synthetic replacement')
      expect((await fixture.files.lstat(record)).mode & 0o777).toBe(0o640)
      await expect(fixture.files.lstat(temporary)).rejects.toMatchObject({ code: 'ENOENT' })
      expect(await fixture.createStore().inspect()).toEqual({ status: 'unavailable' })
      fixture.failures.set('unlink:credential.v1', ['after'])
      await expect(fixture.files.unlink(record)).rejects.toMatchObject({ code: 'EIO' })
      await expect(fixture.files.lstat(record)).rejects.toMatchObject({ code: 'ENOENT' })
      await fixture.files.writeFile(record, 'new synthetic record', { mode: 0o600 })
      expect((await fixture.files.lstat(record)).mode & 0o777).toBe(0o600)
      expect(fixture.openHandles.size).toBe(0)
    } finally {
      await fixture.cleanup()
    }
  })
})
