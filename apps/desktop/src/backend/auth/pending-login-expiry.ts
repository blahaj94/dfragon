import { fromCallback, type CallbackActorLogic } from 'xstate'
import type { AuthClock, ClockReading } from './types'

const LOGIN_REQUEST_MAX_AGE_MS = 600_000

type PendingExpiryState = Readonly<{
  startedAt: ClockReading
  lastAcceptedAt: ClockReading
  expiresAtMs: number | null
}>

// Keep the clock reads in their original order, including the optional server comparison.
export function isPendingLoginExpired(
  { startedAt, lastAcceptedAt, expiresAtMs }: PendingExpiryState,
  checkedAt: ClockReading
): boolean {
  const isWallClockReversed = checkedAt.wallMs < lastAcceptedAt.wallMs
  const isMonotonicReversed = checkedAt.monotonicMs < lastAcceptedAt.monotonicMs
  const hasReachedMonotonicLimit =
    checkedAt.monotonicMs - startedAt.monotonicMs >= LOGIN_REQUEST_MAX_AGE_MS
  if (expiresAtMs != null) {
    const hasReachedServerExpiry = checkedAt.wallMs >= expiresAtMs
    const hasExpiredClock =
      startedAt.discontinuous ||
      checkedAt.discontinuous ||
      isWallClockReversed ||
      isMonotonicReversed ||
      hasReachedMonotonicLimit
    return hasExpiredClock || hasReachedServerExpiry
  }
  return (
    startedAt.discontinuous ||
    checkedAt.discontinuous ||
    isWallClockReversed ||
    isMonotonicReversed ||
    hasReachedMonotonicLimit
  )
}

export function pendingLoginExpiryDelay(
  { startedAt, expiresAtMs }: PendingExpiryState,
  checkedAt: ClockReading
): number {
  const monotonicRemaining =
    startedAt.monotonicMs + LOGIN_REQUEST_MAX_AGE_MS - checkedAt.monotonicMs
  const wallRemaining = expiresAtMs != null ? expiresAtMs - checkedAt.wallMs : monotonicRemaining
  return Math.max(0, Math.min(monotonicRemaining, wallRemaining))
}

// The active pending state invokes this watcher and owns its timer cleanup.
export function createPendingExpiry(
  clock: AuthClock,
  isExpired: (checkedAt: ClockReading) => boolean,
  getDelay: (checkedAt: ClockReading) => number
): CallbackActorLogic<{ type: 'RESCHEDULE' }> {
  return fromCallback<{ type: 'RESCHEDULE' }>(({ receive, sendBack }) => {
    let stopped = false
    let cancel: (() => void) | undefined
    const schedule = (): void => {
      cancel?.()
      cancel = undefined
      const checkedAt = clock.read()
      if (isExpired(checkedAt)) {
        sendBack({ type: 'EXPIRE' })
        return
      }
      const delayMs = getDelay(checkedAt)
      const scheduled = clock.schedule(delayMs, () => {
        if (stopped) {
          return
        }
        if (isExpired(clock.read())) {
          sendBack({ type: 'EXPIRE' })
        } else {
          schedule()
        }
      })
      // A synchronous clock callback can dispose the owner before schedule returns.
      if (stopped) {
        scheduled()
      } else {
        cancel = scheduled
      }
    }
    receive(schedule)
    schedule()
    return () => {
      stopped = true
      cancel?.()
    }
  })
}
