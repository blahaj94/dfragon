export type Observation = Readonly<{
  runId: string
  caseId: string
  sequence: number
  cutpoint: string
  phase: string
  outcome: string
  detail?: unknown
}>
type Point = Pick<Observation, 'cutpoint' | 'phase' | 'outcome' | 'detail'>
export type Observer = { observe(point: Point): Promise<void>; assertActive(): void }

function matchesAck(event: Observation, ack: unknown): boolean {
  const isObject = ack != null && typeof ack === 'object'
  if (!isObject) {
    return false
  }
  const actual = ack as Record<string, unknown>
  const isSameRun = actual.runId === event.runId
  const isSameCase = actual.caseId === event.caseId
  const isSameSequence = actual.sequence === event.sequence
  const isSameCutpoint = actual.cutpoint === event.cutpoint
  const isSamePhase = actual.phase === event.phase
  const isSameOutcome = actual.outcome === event.outcome
  return isSameRun && isSameCase && isSameSequence && isSameCutpoint && isSamePhase && isSameOutcome
}

export function createObserver({
  runId,
  caseId,
  exchange,
  timeoutMs
}: {
  runId: string
  caseId: string
  exchange(event: Observation, signal: AbortSignal): Promise<unknown>
  timeoutMs: number
}): Observer {
  let sequence = 0
  let blocked = false
  let pending = false
  const assertActive = (): void => {
    const cannotMutate = blocked || pending
    if (cannotMutate) {
      throw new Error('ACK gate is closed.')
    }
  }
  const observe = async (point: Point): Promise<void> => {
    assertActive()
    pending = true
    const event = { runId, caseId, sequence: ++sequence, ...point }
    const controller = new AbortController()
    let timer: ReturnType<typeof setTimeout> | undefined
    const deadline = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error('ACK timeout.')), timeoutMs)
    })
    try {
      const ack = await Promise.race([exchange(event, controller.signal), deadline])
      const isMatching = matchesAck(event, ack)
      if (!isMatching) {
        throw new Error('ACK identity mismatch.')
      }
    } catch (error) {
      blocked = true
      throw error
    } finally {
      clearTimeout(timer)
      controller.abort()
      pending = false
    }
  }
  return { observe, assertActive }
}

export async function observeBeforeRecovery<T>({
  observer,
  snapshot,
  inspect
}: {
  observer: Observer
  snapshot(): Promise<unknown>
  inspect(): Promise<T>
}): Promise<T> {
  const original = await snapshot()
  await observer.observe({
    cutpoint: 'original-disk',
    phase: 'before-recovery',
    outcome: 'observed',
    detail: original
  })
  observer.assertActive()
  return inspect()
}
