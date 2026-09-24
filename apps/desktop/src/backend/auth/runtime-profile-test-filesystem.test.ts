import * as fs from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { createRuntimeProfileTestFilesystem } from './runtime-profile-test-filesystem'

describe('POSIX profile filesystem test model', () => {
  it('tracks creation and chmod without leaking metadata into another fixture', () => {
    const root = fs.realpathSync(fs.mkdtempSync(join(tmpdir(), 'dfragon-profile-model-')))
    const directory = join(root, 'profile')
    const fixture = createRuntimeProfileTestFilesystem(true)
    fixture.registerRoot(root)
    try {
      fixture.mkdirSync(directory, { mode: 0o755 })
      expect(fixture.lstatSync(directory).mode & 0o7777).toBe(0o755)
      expect(fixture.lstatSync(directory).uid).toBe(process.getuid?.() ?? 0)
      expect(fixture.lstatSync(directory).isDirectory()).toBe(true)
      const originalUid = fixture.lstatSync(directory).uid
      const uidDescriptor = Object.getOwnPropertyDescriptor(process, 'getuid')
      try {
        Object.defineProperty(process, 'getuid', {
          configurable: true,
          value: () => originalUid + 1
        })
        fixture.chmodSync(directory, 0o700)
      } finally {
        if (uidDescriptor == null) {
          Reflect.deleteProperty(process, 'getuid')
        } else {
          Object.defineProperty(process, 'getuid', uidDescriptor)
        }
      }
      expect(fixture.lstatSync(directory).uid).toBe(originalUid)
      expect(fixture.lstatSync(directory).mode & 0o7777).toBe(0o700)
      const otherFixture = createRuntimeProfileTestFilesystem(true)
      expect(() => otherFixture.lstatSync(directory)).toThrow('metadata was not registered')
      fs.rmdirSync(directory)
      expect(() => fixture.lstatSync(directory)).toThrow()
      fixture.mkdirSync(directory, { mode: 0o770 })
      expect(fixture.lstatSync(directory).mode & 0o7777).toBe(0o770)
    } finally {
      fs.rmSync(root, { recursive: true, force: true })
    }
  })

  it('preserves actual file and directory link types while rejecting directory handles', () => {
    const root = fs.realpathSync(fs.mkdtempSync(join(tmpdir(), 'dfragon-profile-model-')))
    const fixture = createRuntimeProfileTestFilesystem(true)
    fixture.registerRoot(root)
    const target = join(root, 'target')
    const alias = join(root, 'alias')
    const file = join(root, 'file')
    try {
      fixture.mkdirSync(target, { mode: 0o700 })
      fixture.symlinkSync(target, alias)
      fs.writeFileSync(file, 'synthetic sentinel')
      expect(fixture.lstatSync(alias).isSymbolicLink()).toBe(true)
      expect(fs.realpathSync(alias)).toBe(fs.realpathSync(target))
      expect(fixture.lstatSync(file).isFile()).toBe(true)
      expect(() => fixture.openSync(alias, fs.constants.O_RDONLY)).toThrow('real directory')
      expect(() => fixture.openSync(file, fs.constants.O_RDONLY)).toThrow('real directory')
      expect(fs.readFileSync(file, 'utf8')).toBe('synthetic sentinel')
    } finally {
      fs.rmSync(root, { recursive: true, force: true })
    }
  })

  it('rejects closed or foreign directory descriptors', () => {
    const root = fs.realpathSync(fs.mkdtempSync(join(tmpdir(), 'dfragon-profile-model-')))
    const fixture = createRuntimeProfileTestFilesystem(true)
    fixture.registerRoot(root)
    try {
      const handle = fixture.openSync(root, fs.constants.O_RDONLY)
      expect(() => fixture.fsyncSync(handle)).not.toThrow()
      expect(() => createRuntimeProfileTestFilesystem(true).fsyncSync(handle)).toThrow('not open')
      fixture.closeSync(handle)
      expect(() => fixture.fsyncSync(handle)).toThrow('not open')
      expect(() => fixture.closeSync(handle)).toThrow('not open')
    } finally {
      fs.rmSync(root, { recursive: true, force: true })
    }
  })
})
