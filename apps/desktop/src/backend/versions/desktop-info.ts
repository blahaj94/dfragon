import type { BuildVersions } from '../../preload/common/types/build-versions'

declare const __DFRAGON_DESKTOP_BUILD__: Pick<BuildVersions['desktop'], 'commit' | 'dirty'>

/** Installed package version comes from Electron; source identity is fixed in the main bundle. */
export function readDesktopBuildInfo(version: string): BuildVersions['desktop'] {
  const source =
    typeof __DFRAGON_DESKTOP_BUILD__ === 'undefined'
      ? { commit: null, dirty: null }
      : __DFRAGON_DESKTOP_BUILD__

  return { version, ...source }
}
