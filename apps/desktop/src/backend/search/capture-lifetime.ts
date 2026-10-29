import { isCharacterSearchNickname } from './identify'
import { SEARCH_ACTIONS, SEARCH_COMMAND_ERRORS } from '../../preload/common/types/search'
import { randomUUID } from 'node:crypto'
import { createActor } from 'xstate'
import {
  runDetailsRequest,
  type DetailsOutcome,
  type SearchOutcome,
  type SearchRuntime
} from './request'
import {
  slotLifetimeMachine,
  type SearchRequest,
  type RequestIdentity
} from './slot-lifetime-machine'
import { sameOcrSearchInput } from '../../preload/common/search/ocr-input'
import { SEARCH_ERRORS, SEARCH_SLOT_COUNTS } from '../../preload/common/types/search'
import type {
  SearchCommandError,
  SearchCommandResult,
  SearchControl,
  ManualCharacterLookup,
  OcrSearchObservation,
  OcrSearchInput,
  SearchSlot,
  SearchSlotCount,
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
  slotCount?: SearchSlotCount
  /**
   * OCR 관측과 그 요청에만 더 요구하는 유효성. 공대 카드 수명은 회차를 시작한 게임 창 선택이 그대로인지 본다.
   * 서버를 고른 조회는 이 조건과 무관하다. 없으면 `isCurrent`만 본다.
   */
  isCurrentOcr?: (binding: CaptureBinding) => boolean
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

/** 이름과 서버를 정한 슬롯 하나의 상세 조회. 수명마다 한 번에 하나만 실행한다. */
type DetailsJob = RequestIdentity & { controller: AbortController }

export type CaptureSearchLifetime = {
  readonly current: CaptureBinding | null
  snapshot: () => SearchSnapshot
  result: (code?: SearchCommandError) => SearchCommandResult
  begin: (binding: Omit<CaptureBinding, 'captureId'>) => SearchCommandResult
  end: (captureId: string) => SearchCommandResult
  invalidate: () => void
  /** 진행 중인 OCR에서 시작한 요청을 취소하고 그 슬롯을 비운다. 끝난 슬롯과 서버를 고른 조회는 유지한다. */
  cancelOcrRequests: () => void
  observeOcr: (input: OcrSearchObservation) => SearchCommandResult
  lookup: (input: ManualCharacterLookup) => SearchCommandResult
  retry: (
    input: Extract<SearchControl, { action: typeof SEARCH_ACTIONS.RETRY }>
  ) => SearchCommandResult
}

export function createCaptureSearchLifetime(options: Options): CaptureSearchLifetime {
  let revision = 0
  let binding: CaptureBinding | null = null
  const slotIndexes = Array.from(
    { length: options.slotCount ?? SEARCH_SLOT_COUNTS.party },
    (_, slot) => slot
  )
  let slots = slotIndexes.map((slot) => idleSlot({ slot }))
  const ocrInputs: Array<OcrSearchInput | null> = slotIndexes.map(() => null)
  const manualServers: Array<string | null> = slotIndexes.map(() => null)
  const actors = slotIndexes.map(() =>
    createActor(slotLifetimeMachine, {
      input: { canComplete, complete }
    }).start()
  )
  let detailsJob: DetailsJob | null = null

  function snapshot(): SearchSnapshot {
    const snapshotRevision = revision
    const captureId = binding?.captureId ?? null
    const snapshotSlots = slots.map((slot) => {
      const error = slot.error
      const copiedSlot = { ...slot }
      const rows = slot.rows.map((row) => ({ ...row }))
      copiedSlot.rows = rows
      if (slot.selected !== undefined) {
        copiedSlot.selected = { ...slot.selected }
      }

      if (slot.choices !== undefined) {
        copiedSlot.choices = slot.choices.map((choice) => {
          const face = choice.face !== null ? { ...choice.face } : null

          return { ...choice, face }
        })
      }
      copiedSlot.error = error != null ? { ...error } : null

      return copiedSlot
    })

    return { revision: snapshotRevision, captureId, slots: snapshotSlots }
  }

  function result(code?: SearchCommandError): SearchCommandResult {
    const currentSnapshot = snapshot()
    if (code != null) {
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
    if (binding?.captureId === captureId) {
      invalidate()
    }

    return result()
  }

  function invalidate(): void {
    if (binding == null) {
      return
    }
    binding = null
    for (const slot of slotIndexes) {
      cancelSlot(slot)
    }
    detailsJob?.controller.abort()
    detailsJob = null
    slots = slotIndexes.map((slot) => idleSlot({ slot }))
    emit()
  }

  function promoteObservation(input: OcrSearchObservation): SearchCommandResult {
    slots[input.slot] = { ...slots[input.slot], observationRevision: input.observationRevision }
    actors[input.slot].send({ type: 'PROMOTE', observationRevision: input.observationRevision })
    emit()

    return result()
  }

  function isCurrentOcrBinding(currentBinding: CaptureBinding): boolean {
    const isCurrentOcr = options.isCurrentOcr
    if (isCurrentOcr === undefined) {
      return true
    }

    return isCurrentOcr(currentBinding)
  }

  function cancelOcrRequests(): void {
    let changed = false
    for (const slot of slotIndexes) {
      if (ocrInputs[slot] !== null && slots[slot].state === 'pending') {
        cancelSlot(slot)
        slots[slot] = idleSlot({ slot, observationRevision: slots[slot].observationRevision })
        changed = true
      }
    }
    // 이전 창에서 정한 슬롯의 상세도 받지 않는다. 고른 이름과 서버는 남기고 점수만 비운다.
    const failedDetails = failPendingDetails((slot) => ocrInputs[slot] !== null)

    if (changed || failedDetails) {
      emit()
    }
  }

  function failPendingDetails(matches: (slot: number) => boolean): boolean {
    if (detailsJob !== null && matches(detailsJob.slot)) {
      detailsJob.controller.abort()
      detailsJob = null
    }
    let changed = false
    for (const slot of slotIndexes) {
      if (slots[slot].details === 'pending' && matches(slot)) {
        slots[slot] = { ...slots[slot], details: 'failed' }
        changed = true
      }
    }

    return changed
  }

  function observeOcr(input: OcrSearchObservation): SearchCommandResult {
    if (
      binding?.captureId !== input.captureId ||
      !options.isCurrent(binding) ||
      !isCurrentOcrBinding(binding)
    ) {
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

    return startCharacterRequest(input)
  }

  function lookup(input: ManualCharacterLookup): SearchCommandResult {
    if (binding?.captureId !== input.captureId || !options.isCurrent(binding)) {
      return result(SEARCH_COMMAND_ERRORS.STALE_SEARCH)
    }

    if (input.observationRevision <= slots[input.slot].observationRevision) {
      return result()
    }

    return startCharacterRequest(input)
  }

  function startCharacterRequest(
    input: OcrSearchObservation | ManualCharacterLookup
  ): SearchCommandResult {
    const runtime = options.runtime
    if (runtime !== undefined) {
      return startRequest({ input, runtime })
    }
    cancelSlot(input.slot)
    if ('candidateNicknames' in input) {
      ocrInputs[input.slot] = cloneOcrInput(input)
    } else {
      manualServers[input.slot] = input.serverId
    }
    const code = isCharacterSearchNickname(input.nickname)
      ? 'NEOPLE_UNAVAILABLE'
      : 'INVALID_SEARCH_QUERY'
    slots[input.slot] = {
      slot: input.slot,
      observationRevision: input.observationRevision,
      requestId: randomUUID(),
      nickname: input.nickname,
      state: 'failure',
      rows: [],
      error: { code }
    }
    emit()

    return result()
  }

  function retry(
    input: Extract<SearchControl, { action: typeof SEARCH_ACTIONS.RETRY }>
  ): SearchCommandResult {
    const slot = slots[input.slot]
    if (!isCurrentSlot(input)) {
      return result(SEARCH_COMMAND_ERRORS.STALE_SEARCH)
    }
    const error = slot.error
    if (slot.state !== 'failure' || error == null || !SEARCH_ERRORS[error.code].retryable) {
      return result(SEARCH_COMMAND_ERRORS.SEARCH_RETRY_NOT_READY)
    }
    const nickname = slot.nickname
    if (options.runtime == null || nickname == null) {
      return result(SEARCH_COMMAND_ERRORS.SEARCH_NOT_ALLOWED)
    }

    const ocrInput = ocrInputs[input.slot]
    if (ocrInput !== null) {
      return startCharacterRequest({
        captureId: input.captureId,
        slot: input.slot,
        observationRevision: slot.observationRevision,
        nickname,
        ...ocrInput
      })
    }

    const serverId = manualServers[input.slot]
    if (serverId === null) {
      return result(SEARCH_COMMAND_ERRORS.SEARCH_NOT_ALLOWED)
    }

    return startCharacterRequest({
      captureId: input.captureId,
      slot: input.slot,
      observationRevision: slot.observationRevision,
      nickname,
      serverId
    })
  }

  function startRequest({
    input,
    runtime
  }: {
    input: OcrSearchObservation | ManualCharacterLookup
    runtime: SearchRuntime
  }): SearchCommandResult {
    const startedAt = runtime.clock.read().monotonicMs
    const ocrInput = 'candidateNicknames' in input ? cloneOcrInput(input) : null
    const manualServerId = 'serverId' in input ? input.serverId : undefined
    // 이전 창으로 시작한 OCR 입력은 슬롯을 지우기 전에 거절해 OCR에서 시작했다는 사실을 잃은 채 다시 시도되지 않게 한다.
    if (ocrInput !== null && binding !== null && !isCurrentOcrBinding(binding)) {
      return result(SEARCH_COMMAND_ERRORS.STALE_SEARCH)
    }
    cancelSlot(input.slot)
    if (binding?.captureId !== input.captureId || !options.isCurrent(binding)) {
      return result(SEARCH_COMMAND_ERRORS.STALE_SEARCH)
    }

    const requestId = randomUUID()
    const isValidInput = isCharacterSearchNickname(input.nickname)
    ocrInputs[input.slot] = ocrInput
    manualServers[input.slot] = manualServerId ?? null
    slots[input.slot] = {
      slot: input.slot,
      observationRevision: input.observationRevision,
      requestId,
      nickname: input.nickname,
      state: isValidInput ? 'pending' : 'failure',
      rows: [],
      error: isValidInput ? null : { code: 'INVALID_SEARCH_QUERY' }
    }
    const request: SearchRequest = {
      captureId: input.captureId,
      slot: input.slot,
      nickname: input.nickname,
      observationRevision: input.observationRevision,
      requestId,
      startedAt,
      runtime,
      ocrInput: ocrInput ?? undefined,
      manualServerId
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
    if (detailsJob?.slot === slot) {
      detailsJob.controller.abort()
      detailsJob = null
    }
    ocrInputs[slot] = null
    manualServers[slot] = null
  }

  function isCurrentSlot(request: RequestIdentity): boolean {
    return (
      binding != null &&
      options.isCurrent(binding) &&
      binding.captureId === request.captureId &&
      slots[request.slot].requestId === request.requestId
    )
  }

  function canComplete(request: SearchRequest): boolean {
    return (
      isCurrentSlot(request) &&
      actors[request.slot].getSnapshot().context.request === request &&
      slots[request.slot].observationRevision === request.observationRevision
    )
  }

  function complete(request: SearchRequest, outcome: SearchOutcome): void {
    const result = outcome
    if (!canComplete(request) || result == null) {
      return
    }
    const isSuccess = result.kind === 'success'
    const completedSlot = { ...slots[request.slot] }
    delete completedSlot.selected
    delete completedSlot.selectionMethod
    delete completedSlot.choices
    delete completedSlot.details
    if (isSuccess) {
      slots[request.slot] = {
        ...completedSlot,
        state: result.rows.length > 0 ? 'success' : 'empty',
        rows: result.rows,
        error: null
      }
      if (result.selected !== undefined) {
        slots[request.slot] = {
          ...slots[request.slot],
          selected: result.selected.summary,
          selectionMethod: result.selected.selectionMethod
        }
        if (result.selected.choices !== undefined) {
          slots[request.slot] = { ...slots[request.slot], choices: result.selected.choices }
        }

        if (result.selected.details !== undefined) {
          slots[request.slot] = { ...slots[request.slot], details: result.selected.details }
        }
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
    // 후보 검색이 호출 제한을 받아도 남은 상세를 받지 않는다.
    if (!isSuccess && result.error.code === 'SEARCH_RATE_LIMITED') {
      failPendingDetails(() => true)
    }
    emit()
  }

  /**
   * 어느 슬롯이든 조회 중이면 시작하지 않아, 회차의 모든 슬롯이 이름과 서버를 먼저 정한 뒤 상세를 받는다.
   */
  function startNextDetails(): void {
    const runtime = options.runtime
    const captureId = binding?.captureId
    if (detailsJob !== null || runtime === undefined || captureId === undefined) {
      return
    }

    if (slots.some((slot) => slot.state === 'pending')) {
      return
    }
    const next = slots.find((slot) => slot.details === 'pending')
    if (next?.selected === undefined || next.requestId === null) {
      return
    }
    const job: DetailsJob = {
      slot: next.slot,
      captureId,
      requestId: next.requestId,
      controller: new AbortController()
    }
    detailsJob = job
    runDetailsRequest({
      runtime,
      summary: next.selected,
      startedAt: runtime.clock.read().monotonicMs,
      signal: job.controller.signal,
      isCurrent: () => isCurrentDetails(job)
    })
      .catch((): DetailsOutcome => ({ kind: 'failure', error: { code: 'SEARCH_NETWORK_ERROR' } }))
      .then((outcome) => finishDetails(job, outcome))
  }

  function isCurrentDetails(job: DetailsJob): boolean {
    return detailsJob === job && isCurrentSlot(job) && slots[job.slot].details === 'pending'
  }

  function finishDetails(job: DetailsJob, outcome: DetailsOutcome): void {
    const isCurrent = isCurrentDetails(job)
    if (detailsJob === job) {
      detailsJob = null
    }

    if (!isCurrent || outcome === null) {
      startNextDetails()

      return
    }

    if (outcome.kind === 'failure') {
      slots[job.slot] = { ...slots[job.slot], details: 'failed' }
      // 호출 제한을 받으면 남은 상세도 받지 않아 제한 중에 요청을 더 보내지 않는다.
      if (outcome.error.code === 'SEARCH_RATE_LIMITED') {
        failPendingDetails(() => true)
      }
    } else {
      const completedSlot = { ...slots[job.slot], selected: outcome.summary }
      delete completedSlot.details
      slots[job.slot] = completedSlot
    }
    emit()
  }

  function emit(): void {
    if (binding != null && !options.isCurrent(binding)) {
      invalidate()

      return
    }
    revision += 1
    options.publish(snapshot())
    startNextDetails()
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
    cancelOcrRequests,
    observeOcr,
    lookup,
    retry
  }
}

/** IPC 픽셀 참조를 복사해 수동 재시도까지 동일한 관측을 보관한다. 공대 행의 값은 그대로 함께 둔다. */
function cloneOcrInput(input: OcrSearchInput): OcrSearchInput {
  const candidateNicknames = input.candidateNicknames.slice(0, 1)
  const raidRow = input.raidRow !== undefined ? { raidRow: { ...input.raidRow } } : {}
  if (input.portrait === null) {
    return { candidateNicknames, portrait: null, ...raidRow }
  }
  const { image, rasterScale, validMask } = input.portrait
  const rgba = new Uint8Array(image.rgba)
  const portrait = { image: { width: image.width, height: image.height, rgba }, rasterScale }
  if (validMask === undefined) {
    return { candidateNicknames, portrait, ...raidRow }
  }
  const copiedMask = new Uint8Array(validMask)

  return { candidateNicknames, portrait: { ...portrait, validMask: copiedMask }, ...raidRow }
}
