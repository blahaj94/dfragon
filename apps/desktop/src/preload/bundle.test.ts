import { runInNewContext } from 'node:vm'
import { build } from 'vite'
import { resolveConfig } from 'electron-vite'
import { expect, it, vi } from 'vitest'

it.each(['electron.vite.config.ts', 'scripts/auth-capture-fixture.config.ts'])(
  '%s의 실제 preload 산출물은 외부 package require 없이 feature API를 노출한다',
  async (configFile) => {
    const resolved = await resolveConfig({ configFile, logLevel: 'silent' }, 'build', 'production')
    const preload = resolved.config?.preload
    expect(preload).toBeDefined()
    const output = await build({
      ...preload,
      logLevel: 'silent',
      build: { ...preload!.build, write: false }
    })
    const isOutputArray = Array.isArray(output)
    const bundles = isOutputArray ? output : [output]
    const chunks = new Map<string, string>()
    for (const bundle of bundles) {
      const hasOutput = 'output' in bundle
      if (!hasOutput) {
        throw new Error('Expected completed preload build')
      }
      for (const item of bundle.output) {
        const isChunk = item.type === 'chunk'
        if (isChunk) {
          chunks.set(item.fileName, item.code)
        }
      }
    }
    const expectedBundles =
      configFile === 'electron.vite.config.ts'
        ? ['character-detail.js', 'index.js']
        : ['preload.cjs']
    expect([...chunks.keys()].sort()).toEqual(expectedBundles)
    const expose = vi.fn()
    // Native sandbox 전체 대신 이 preload가 필요로 하는 require 경계와 실행을 검사한다.
    const requireModule = (name: string): unknown => {
      const isElectron = name === 'electron'
      if (!isElectron) {
        throw new Error(`Sandbox preload cannot require ${name}`)
      }

      const invoke = vi.fn()
      const on = vi.fn()
      const removeListener = vi.fn()

      return {
        contextBridge: { exposeInMainWorld: expose },
        ipcRenderer: { invoke, on, removeListener }
      }
    }
    for (const [fileName, code] of chunks) {
      expose.mockClear()
      expect(() => runInNewContext(code, { require: requireModule, exports: {} })).not.toThrow()
      const expectedApis =
        fileName === 'character-detail.js'
          ? ['characterDetail']
          : ['api', 'auth', 'search', 'manualSearch', 'developer', 'versions']
      expect(expose.mock.calls.map(([name]) => name)).toEqual(expectedApis)
      if (fileName === 'character-detail.js') {
        expect(Object.keys(expose.mock.calls[0][1])).toEqual(['read'])
      }
    }
  }
)
