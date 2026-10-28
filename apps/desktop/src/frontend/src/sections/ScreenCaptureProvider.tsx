import type { ReactNode } from 'react'
import { useScreenCapture } from '../hooks/useScreenCapture'
import { ScreenCaptureContext } from '../hooks/useScreenCaptureContext'

export function ScreenCaptureProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const screenCapture = useScreenCapture()

  return <ScreenCaptureContext value={screenCapture}>{children}</ScreenCaptureContext>
}
