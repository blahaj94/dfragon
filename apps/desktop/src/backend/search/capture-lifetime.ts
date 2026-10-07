import { matchesDNFSearchNicknamePolicy } from '@dfragon/lib'
import { SEARCH_ACTIONS, SEARCH_COMMAND_ERRORS } from '../../preload/common/types/search'
import { randomUUID } from 'node:crypto'
import { createActor } from 'xstate'
import type { SearchOutcome, SearchRuntime } from './request'
import {
  slotLifetimeMachine,
  type SearchRequest,
  type RequestIdentity,
  type RateWait
} from './slot-lifetime-machine'
import { sameOcrSearchInput } from '../../preload/common/search/ocr-input'
import type { CharacterDetails } from '../../preload/common/types/character'
import { remainingRetryAfter, type RetryAfter } from './retry-after'
import { SEARCH_ERRORS } from '../../preload/common/types/search'
import type {
  SearchCommandError,
  SearchCommandResult,
  SearchControl,
  SearchObservation,
  OcrSearchObservation,
  OcrSearchInput,
  SearchSlot,
  SearchSnapshot
} from '../../preload/common/types/search'

export type CaptureBinding = Readonly<{
  captureId: string
  windowGeneration: number
  sourceGeneration: number
}>

type Options = {
  publish: (snapshot: SearchSnapshot) => void
  isCurrent: (binding: CaptureBinding) => boolean
  runtime?: SearchRuntime
}

function idleSlot({
  slot,
  observationRevision = 0
}: {
  slot: number
  observationRevision?: number
}): SearchSlot {
  return {
    slot,
    observationRevision,
    requestId: null,
    nickname: null,
    state: 'idle',
    rows: [],
    error: null
  }
}

function validNickname(nickname: string): boolean {
  const matchesPolicy = matchesDNFSearchNicknamePolicy(nickname)
  const isWellFormed = nickname.isWellFormed()
  const isValid = matchesPolicy && isWellFormed

  return isValid
}

function retryAfterForFailure(
  result: Extract<SearchOutcome, { kind: 'failure' }>
): Pick<RetryAfter, 'seconds' | 'receivedAt'> | null {
  const seconds = result.error.retryAfterSeconds
  const receivedAt = result.retryAfterReceivedAt
  const isRateLimited = result.error.code === 'SEARCH_RATE_LIMITED'
  const hasRetryAfter = seconds != null
  const hasReceivedAt = receivedAt != null
  let retryAfter: { seconds: number; receivedAt: number } | null = null
  if (hasRetryAfter) {
    const hasPositiveRetryAfter = seconds > 0
    const hasWait = hasPositiveRetryAfter && hasReceivedAt
    if (hasWait) {
      retryAfter = { seconds, receivedAt }
    }
  }

  if (!isRateLimited) {
    return null
  }

  return retryAfter
}

export type CaptureSearchLifetime = {
  readonly current: CaptureBinding | null
  snapshot: () => SearchSnapshot
  result: (code?: SearchCommandError) => SearchCommandResult
  begin: (binding: Omit<CaptureBinding, 'captureId'>) => SearchCommandResult
  end: (captureId: string) => SearchCommandResult
  invalidate: () => void
  observe: (input: SearchObservation) => SearchCommandResult
  observeOcr: (input: OcrSearchObservation) => SearchCommandResult
  selection: (input: RequestIdentity) => CharacterDetails | null
  clear: (
    input: Extract<SearchControl, { action: typeof SEARCH_ACTIONS.CLEAR }>
  ) => SearchCommandResult
  retry: (
    input: Extract<SearchControl, { action: typeof SEARCH_ACTIONS.RETRY }>
  ) => SearchCommandResult
}

export function createCaptureSearchLifetime(options: Options): CaptureSearchLifetime {
  const runId = randomUUID()
  let revision = 0
  let binding: CaptureBinding | null = null
  let slots = [0, 1, 2, 3].map((slot) => idleSlot({ slot }))
  const ocrInputs: Array<OcrSearchInput | null> = [null, null, null, null]
  const selectedDetails: Array<CharacterDetails | null> = [null, null, null, null]
  const actors = [0, 1, 2, 3].map(() =>
    createActor(slotLifetimeMachine, {
      input: { canComplete, complete, ready: finishRateWait }
    }).start()
  )

  function snapshot(): SearchSnapshot {
    const snapshotRevision = revision
    const captureId = binding?.captureId ?? null
    const snapshotSlots = slots.map((slot) => {
      const error = slot.error
      const hasError = error != null
      const copiedSlot = { ...slot }
      const rows = slot.rows.map((row) => ({ ...row }))
      copiedSlot.rows = rows
      if (slot.selected !== undefined) {
        copiedSlot.selected = { ...slot.selected }
      }
      let copiedError: SearchSlot['error'] = null
      if (hasError) {
        copiedError = { ...error }
      }
      copiedSlot.error = copiedError

      return copiedSlot
    })

    return { runId, revision: snapshotRevision, captureId, slots: snapshotSlots }
  }

  function result(code?: SearchCommandError): SearchCommandResult {
    const currentSnapshot = snapshot()
    const hasError = code != null

    if (hasError) {
      return { ok: false, error: { code }, snapshot: currentSnapshot }
    }

    return { ok: true, snapshot: currentSnapshot }
  }

  function begin(nextBinding: Omit<CaptureBinding, 'captureId'>): SearchCommandResult {
    binding = { ...nextBinding, captureId: randomUUID() }
    emit()

    return result()
  }

  function end(captureId: string): SearchCommandResult {
    const isCurrentCapture = binding?.captureId === captureId
    if (isCurrentCapture) {
      invalidate()
    }

    return result()
  }

  function invalidate(): void {
    const hasCapture = binding != null
    if (!hasCapture) {
      return
    }
    binding = null
    for (const slot of [0, 1, 2, 3]) {
      cancelSlot(slot)
    }
    slots = [0, 1, 2, 3].map((slot) => idleSlot({ slot }))
    emit()
  }

  function observe(input: SearchObservation): SearchCommandResult {
    const isCurrentCapture = binding?.captureId === input.captureId
    if (!isCurrentCapture) {
      return result(SEARCH_COMMAND_ERRORS.STALE_SEARCH)
    }
    const previous = slots[input.slot]
    const isNewerObservation = input.observationRevision > previous.observationRevision
    if (!isNewerObservation) {
      return result()
    }
    const hasSameNickname = ocrInputs[input.slot] === null && input.nickname === previous.nickname
    if (hasSameNickname) {
      return promoteObservation(input)
    }

    const runtime = options.runtime
    if (runtime == null) {
      cancelSlot(input.slot)
      slots[input.slot] = {
        slot: input.slot,
        observationRevision: input.observationRevision,
        requestId: randomUUID(),
        nickname: input.nickname,
        state: 'failure',
        rows: [],
        error: {
          code: validNickname(input.nickname) ? 'NEOPLE_UNAVAILABLE' : 'INVALID_SEARCH_QUERY',
          retryAfterSeconds: null
        }
      }
      emit()

      return result()
    }

    return startRequest({ input, runtime })
  }

  function promoteObservation(input: SearchObservation): SearchCommandResult {
    slots[input.slot] = { ...slots[input.slot], observationRevision: input.observationRevision }
    actors[input.slot].send({ type: 'PROMOTE', observationRevision: input.observationRevision })
    emit()

    return result()
  }

  function observeOcr(input: OcrSearchObservation): SearchCommandResult {
    if (binding?.captureId !== input.captureId || !options.isCurrent(binding)) {
      return result(SEARCH_COMMAND_ERRORS.STALE_SEARCH)
    }
    const previous = slots[input.slot]
    if (input.observationRevision <= previous.observationRevision) {
      return result()
    }
    const previousInput = ocrInputs[input.slot]
    if (previousInput !== null && sameOcrSearchInput(previousInput, input)) {
      return promoteObservation(input)
    }

    return startOcrRequest(input)
  }

  function startOcrRequest(input: OcrSearchObservation): SearchCommandResult {
    const runtime = options.runtime
    if (input.portrait !== null && runtime?.identify !== undefined) {
      return startRequest({ input, runtime })
    }
    cancelSlot(input.slot)
    ocrInputs[input.slot] = cloneOcrInput(input)
    const state = input.portrait === null ? 'waiting-portrait' : 'waiting-policy'
    slots[input.slot] = {
      slot: input.slot,
      observationRevision: input.observationRevision,
      requestId: randomUUID(),
      nickname: input.nickname,
      state,
      rows: [],
      error: null
    }
    emit()

    return result()
  }

  function selection(input: RequestIdentity): CharacterDetails | null {
    if (
      !Number.isSafeInteger(input.slot) ||
      input.slot < 0 ||
      input.slot >= slots.length ||
      !isCurrentSlot(input)
    ) {
      return null
    }

    return selectedDetails[input.slot]
  }

  function clear(
    input: Extract<SearchControl, { action: typeof SEARCH_ACTIONS.CLEAR }>
  ): SearchCommandResult {
    const isCurrentCapture = binding?.captureId === input.captureId
    if (!isCurrentCapture) {
      return result(SEARCH_COMMAND_ERRORS.STALE_SEARCH)
    }
    const isNewer = input.observationRevision > slots[input.slot].observationRevision
    if (isNewer) {
      cancelSlot(input.slot)
      slots[input.slot] = idleSlot(input)
      emit()
    }

    return result()
  }

  function retry(
    input: Extract<SearchControl, { action: typeof SEARCH_ACTIONS.RETRY }>
  ): SearchCommandResult {
    const slot = slots[input.slot]
    const isCurrent = isCurrentSlot(input)
    if (!isCurrent) {
      return result(SEARCH_COMMAND_ERRORS.STALE_SEARCH)
    }
    const error = slot.error
    const isFailure = slot.state === 'failure'
    const hasError = error != null
    if (!isFailure) {
      return result(SEARCH_COMMAND_ERRORS.SEARCH_RETRY_NOT_READY)
    }

    if (!hasError) {
      return result(SEARCH_COMMAND_ERRORS.SEARCH_RETRY_NOT_READY)
    }
    const isRetryable = SEARCH_ERRORS[error.code].retryable
    if (!isRetryable) {
      return result(SEARCH_COMMAND_ERRORS.SEARCH_RETRY_NOT_READY)
    }
    const wait = actors[input.slot].getSnapshot().context.wait
    const hasWait = wait != null
    let isWaiting = false
    if (hasWait) {
      const remaining = remainingRetryAfter(wait)
      isWaiting = remaining > 0
    }

    if (isWaiting) {
      return result(SEARCH_COMMAND_ERRORS.SEARCH_RETRY_NOT_READY)
    }
    const runtime = options.runtime
    const nickname = slot.nickname
    const hasRuntime = runtime != null
    const hasNickname = nickname != null
    const canStart = hasRuntime && hasNickname
    if (!canStart) {
      return result(SEARCH_COMMAND_ERRORS.SEARCH_NOT_ALLOWED)
    }

    const ocrInput = ocrInputs[input.slot]
    if (ocrInput !== null) {
      return startOcrRequest({
        captureId: input.captureId,
        slot: input.slot,
        observationRevision: slot.observationRevision,
        nickname,
        ...ocrInput
      })
    }

    return startRequest({
      input: {
        captureId: input.captureId,
        slot: input.slot,
        observationRevision: slot.observationRevision,
        nickname
      },
      runtime
    })
  }

  function startRequest({
    input,
    runtime
  }: {
    input: SearchObservation | OcrSearchObservation
    runtime: SearchRuntime
  }): SearchCommandResult {
    const startedAt = runtime.clock.read().monotonicMs
    const ocrInput = 'candidateNicknames' in input ? cloneOcrInput(input) : null
    cancelSlot(input.slot)
    const currentBinding = binding
    const hasBinding = currentBinding != null
    if (!hasBinding) {
      return result(SEARCH_COMMAND_ERRORS.STALE_SEARCH)
    }
    const hasSameCapture = currentBinding.captureId === input.captureId
    if (!hasSameCapture) {
      return result(SEARCH_COMMAND_ERRORS.STALE_SEARCH)
    }
    const hasPermission = options.isCurrent(currentBinding)
    if (!hasPermission) {
      return result(SEARCH_COMMAND_ERRORS.STALE_SEARCH)
    }
    const requestId = randomUUID()
    const isValidInput = ocrInput !== null || validNickname(input.nickname)
    ocrInputs[input.slot] = ocrInput
    slots[input.slot] = {
      slot: input.slot,
      observationRevision: input.observationRevision,
      requestId,
      nickname: input.nickname,
      state: isValidInput ? 'pending' : 'failure',
      rows: [],
      error: isValidInput ? null : { code: 'INVALID_SEARCH_QUERY', retryAfterSeconds: null }
    }
    const request: SearchRequest = {
      captureId: input.captureId,
      slot: input.slot,
      nickname: input.nickname,
      observationRevision: input.observationRevision,
      requestId,
      startedAt,
      runtime,
      ocrInput: ocrInput ?? undefined
    }
    if (isValidInput) {
      actors[input.slot].send({ type: 'PREPARE', request })
    }
    emit()
    if (isValidInput) {
      actors[input.slot].send({ type: 'EXECUTE', request })
    }

    return result()
  }

  function cancelSlot(slot: number): void {
    actors[slot].send({ type: 'CANCEL' })
    ocrInputs[slot] = null
    selectedDetails[slot] = null
  }

  function isCurrentSlot(request: RequestIdentity): boolean {
    const currentBinding = binding
    const hasBinding = currentBinding != null
    let hasPermission = false
    if (hasBinding) {
      hasPermission = options.isCurrent(currentBinding)
    }
    let hasSameCapture = false
    if (hasBinding) {
      hasSameCapture = currentBinding.captureId === request.captureId
    }
    const hasSameRequestId = slots[request.slot].requestId === request.requestId
    const isCurrent = hasPermission && hasSameCapture && hasSameRequestId

    return isCurrent
  }

  function canComplete(request: SearchRequest): boolean {
    const currentSlotMatches = isCurrentSlot(request)
    const hasSameRequest = actors[request.slot].getSnapshot().context.request === request
    const hasSameObservation =
      slots[request.slot].observationRevision === request.observationRevision
    const canComplete = currentSlotMatches && hasSameRequest && hasSameObservation

    return canComplete
  }

  function complete(request: SearchRequest, outcome: SearchOutcome): void {
    const result = outcome
    const isCurrentRequest = canComplete(request)
    const hasOutcome = result != null
    const canPublish = isCurrentRequest && hasOutcome
    if (!canPublish) {
      return
    }
    const isSuccess = result.kind === 'success'
    const completedSlot = { ...slots[request.slot] }
    delete completedSlot.selected
    selectedDetails[request.slot] = null
    if (isSuccess) {
      const hasRows = result.rows.length > 0
      slots[request.slot] = {
        ...completedSlot,
        state: hasRows ? 'success' : 'empty',
        rows: result.rows,
        error: null
      }
      if (result.selected !== undefined) {
        slots[request.slot] = { ...slots[request.slot], selected: result.selected.summary }
        selectedDetails[request.slot] = result.selected.details
      }
    } else {
      slots[request.slot] = {
        ...completedSlot,
        state: 'failure',
        rows: [],
        error: result.error
      }
    }
    actors[request.slot].send({ type: 'FINISH', request })
    emit()
    if (!isSuccess) {
      const retryAfter = retryAfterForFailure(result)
      if (retryAfter == null) {
        return
      }
      const currentSlotMatches = isCurrentSlot(request)
      if (!currentSlotMatches) {
        return
      }
      startRateWait(request, { clock: request.runtime.clock, ...retryAfter })
    }
  }

  function startRateWait(request: RequestIdentity, retryAfter: RetryAfter): void {
    const wait: RateWait = {
      slot: request.slot,
      captureId: request.captureId,
      requestId: request.requestId,
      ...retryAfter
    }
    actors[request.slot].send({ type: 'WAIT', wait })
  }

  function finishRateWait(wait: RateWait): void {
    const isCurrentWait = actors[wait.slot].getSnapshot().context.wait === wait
    const canPublish = isCurrentWait && isCurrentSlot(wait)
    if (!canPublish) {
      return
    }
    actors[wait.slot].send({ type: 'FINISH_WAIT', wait })
    slots[wait.slot] = {
      ...slots[wait.slot],
      error: { code: 'SEARCH_RATE_LIMITED', retryAfterSeconds: 0 }
    }
    emit()
  }

  function emit(): void {
    const currentBinding = binding
    const hasBinding = currentBinding != null
    if (hasBinding) {
      const hasPermission = options.isCurrent(currentBinding)
      const isInvalidated = !hasPermission
      if (isInvalidated) {
        invalidate()

        return
      }
    }
    revision += 1
    options.publish(snapshot())
  }

  return {
    get current(): CaptureBinding | null {
      return binding
    },
    snapshot,
    result,
    begin,
    end,
    invalidate,
    observe,
    observeOcr,
    selection,
    clear,
    retry
  }
}

/** IPC 픽셀 참조를 복사해 수동 재시도까지 동일한 관측을 보관한다. */
function cloneOcrInput(input: OcrSearchInput): OcrSearchInput {
  const candidateNicknames = [...input.candidateNicknames]
  if (input.portrait === null) {
    return { candidateNicknames, portrait: null }
  }
  const { image, rasterScale, validMask } = input.portrait
  const rgba = new Uint8Array(image.rgba)
  const portrait = { image: { width: image.width, height: image.height, rgba }, rasterScale }
  if (validMask === undefined) {
    return { candidateNicknames, portrait }
  }
  const copiedMask = new Uint8Array(validMask)

  return { candidateNicknames, portrait: { ...portrait, validMask: copiedMask } }
}
