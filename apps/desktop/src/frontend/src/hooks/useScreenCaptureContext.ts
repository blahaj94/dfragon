import { createContext, useContext } from 'react'
import type { ScreenCapture } from './useScreenCapture'

export const ScreenCaptureContext = createContext<ScreenCapture | null>(null)

export function useScreenCaptureContext(): ScreenCapture {
  const screenCapture = useContext(ScreenCaptureContext)
  if (screenCapture == null) {
    throw new Error('useScreenCaptureContext는 ScreenCaptureProvider 안에서만 쓸 수 있습니다.')
  }

  return screenCapture
}
