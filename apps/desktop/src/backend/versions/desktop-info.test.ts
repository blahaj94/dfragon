import { afterEach, expect, it, vi } from 'vitest'
import { readDesktopBuildInfo } from './desktop-info'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

it('shows the installed package version and preserves the bundled commit despite runtime variables', () => {
  vi.stubGlobal('__DFRAGON_DESKTOP_BUILD__', { commit: 'a'.repeat(40), dirty: false })
  vi.stubEnv('SOURCE_COMMIT', 'b'.repeat(40))
  expect(readDesktopBuildInfo('0.0.7')).toEqual({
    version: '0.0.7',
    commit: 'a'.repeat(40),
    dirty: false
  })
})

it('honestly reports missing source metadata in a nonbundled test or development environment', () => {
  expect(readDesktopBuildInfo('1.0.0')).toEqual({ version: '1.0.0', commit: null, dirty: null })
})
