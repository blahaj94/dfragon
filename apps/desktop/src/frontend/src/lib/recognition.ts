import type { Rgb, SlotStability } from '../types/capture'

type SerialLoopOptions = {
  signal: AbortSignal
  getIntervalMs: () => number
  runCycle: () => Promise<void>
}

/** 각 RGB 채널이 목표 색상의 허용 오차 안에 들어오는 픽셀이 하나라도 있는지 확인한다. */
export function hasColorMatch(pixels: Iterable<Rgb>, target: Rgb, tolerance: number): boolean {
  for (const pixel of pixels) {
    const hasMatchingRed = Math.abs(pixel[0] - target[0]) <= tolerance
    if (!hasMatchingRed) {
      continue
    }

    const hasMatchingGreen = Math.abs(pixel[1] - target[1]) <= tolerance
    if (!hasMatchingGreen) {
      continue
    }

    const hasMatchingBlue = Math.abs(pixel[2] - target[2]) <= tolerance
    if (hasMatchingBlue) {
      return true
    }
  }

  return false
}

/** OCR 문자열에서 한글·영문·숫자만 남겨 닉네임 비교에 사용할 값으로 정리한다. */
export function normalizeNickname(text: string): string {
  return text.replace(/[^\p{Script=Hangul}A-Za-z0-9]/gu, '')
}

/** 같은 닉네임이 두 번 연속 관측되면 안정된 이름으로 확정하고, 빈 관측이면 누적 상태를 초기화한다. */
export function updateSlotStability(
  previous: SlotStability | null,
  nickname: string | null
): SlotStability {
  const hasNickname = nickname != null
  if (!hasNickname) {
    return { candidate: null, consecutiveCount: 0, stableNickname: null }
  }

  const isNicknameEmpty = nickname.length === 0
  if (isNicknameEmpty) {
    return { candidate: null, consecutiveCount: 0, stableNickname: null }
  }

  const hasPrevious = previous != null
  if (!hasPrevious) {
    return { candidate: nickname, consecutiveCount: 1, stableNickname: null }
  }

  const previousCandidate = previous.candidate
  const hasSameCandidate = previousCandidate === nickname
  if (hasSameCandidate) {
    const consecutiveCount = previous.consecutiveCount + 1
    const isStable = consecutiveCount >= 2
    return {
      candidate: nickname,
      consecutiveCount,
      stableNickname: isStable ? nickname : null
    }
  }

  return { candidate: nickname, consecutiveCount: 1, stableNickname: null }
}

/** 작업 완료 후 지정 간격을 기다려 다음 작업을 직렬 실행하며, 중단 신호를 받으면 반복을 끝낸다. */
export async function runSerialLoop({
  signal,
  getIntervalMs,
  runCycle
}: SerialLoopOptions): Promise<void> {
  while (!signal.aborted) {
    await runCycle()
    if (signal.aborted) {
      return
    }
    await wait(getIntervalMs(), signal)
  }
}

/** 지정 시간이 지나거나 중단 신호를 받으면 대기를 끝낸다. 중단도 정상 완료로 처리한다. */
function wait(milliseconds: number, signal: AbortSignal): Promise<void> {
  if (signal.aborted) {
    return Promise.resolve()
  }

  return new Promise((resolve) => {
    const timeout = setTimeout(finish, milliseconds)

    /** 타이머와 중단 리스너를 함께 해제하고 대기 Promise를 완료한다. */
    function finish(): void {
      clearTimeout(timeout)
      signal.removeEventListener('abort', finish)
      resolve()
    }

    signal.addEventListener('abort', finish, { once: true })
  })
}
