import { useCallback, useEffect, useRef, useState } from 'react'
import { parseBuildVersions } from '../../../preload/common/build-versions'
import type { BuildVersions, BuildVersionsApi } from '../../../preload/common/types/build-versions'

type VersionState =
  | { status: 'loading' | 'unavailable' | 'error'; snapshot: BuildVersions | null }
  | { status: 'ready'; snapshot: BuildVersions }

function readBridge(): BuildVersionsApi | null {
  const candidate = typeof window === 'undefined' ? undefined : window.versions

  if (candidate != null && typeof candidate.getBuildVersions === 'function') {
    return candidate
  }

  return null
}

/** Own metadata request lifetime without coupling it to capture or login state. */
export function useBuildVersions(): VersionState & { refresh: () => void } {
  const [state, setState] = useState<VersionState>({ status: 'loading', snapshot: null })
  const request = useRef(0)

  const refresh = useCallback(() => {
    const revision = ++request.current
    const bridge = readBridge()
    void Promise.resolve()
      .then(() => {
        if (request.current !== revision) {
          return null
        }
        if (bridge == null) {
          setState({ status: 'unavailable', snapshot: null })

          return null
        }
        setState((previous) => ({ status: 'loading', snapshot: previous.snapshot }))

        return bridge.getBuildVersions()
      })
      .then((value: unknown) => {
        if (request.current !== revision || bridge == null) {
          return
        }
        const snapshot = parseBuildVersions(value)
        if (snapshot == null) {
          throw new Error('Invalid version metadata')
        }
        setState({ status: 'ready', snapshot })
      })
      .catch(() => {
        if (request.current === revision) {
          setState((previous) => ({ status: 'error', snapshot: previous.snapshot }))
        }
      })
  }, [])

  useEffect(() => {
    refresh()

    return () => {
      request.current += 1
    }
  }, [refresh])

  return { ...state, refresh }
}
