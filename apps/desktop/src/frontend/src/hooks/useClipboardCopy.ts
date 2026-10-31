import { useEffect, useRef, useState } from 'react'

export type ClipboardCopyStatus = 'idle' | 'copied' | 'failed'

const COPIED_FEEDBACK_MS = 1500

function writeDesktopClipboard(text: string): Promise<void> {
  return window.desktopClipboard.writeText(text)
}

export function useClipboardCopy(
  text: string,
  writeText: (text: string) => Promise<void> = writeDesktopClipboard
): {
  status: ClipboardCopyStatus
  copy: () => void
} {
  // 체크 표시 중 다시 복사하면 체크 시간을 처음부터 다시 재도록, 같은 상태여도 새 객체로 effect를 다시 돌린다.
  const [result, setResult] = useState<{ status: ClipboardCopyStatus }>({ status: 'idle' })
  const latestAttempt = useRef(0)

  useEffect(() => {
    if (result.status !== 'copied') {
      return
    }
    const timer = window.setTimeout(() => setResult({ status: 'idle' }), COPIED_FEEDBACK_MS)

    return () => window.clearTimeout(timer)
  }, [result])

  function copy(): void {
    latestAttempt.current += 1
    const attempt = latestAttempt.current
    // 연달아 누르면 마지막 복사의 결과만 보인다.
    function settle(status: ClipboardCopyStatus): void {
      if (attempt === latestAttempt.current) {
        setResult({ status })
      }
    }
    writeText(text).then(
      () => settle('copied'),
      () => settle('failed')
    )
  }

  return { status: result.status, copy }
}
