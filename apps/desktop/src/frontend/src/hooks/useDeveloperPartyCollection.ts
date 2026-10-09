import { DEFAULT_DEVELOPER_PREVIEW_INTERVAL_MS, DEVELOPER_ERRORS } from '../constants/developer'
import { DEVELOPER_ERROR_CODES } from '../../../preload/common/developer-errors'
import { useEffect, useRef, useState } from 'react'
import type { DeveloperCollectionKind } from '../../../preload/common/types/developer'
import type {
  DeveloperPartyCollectionStatus,
  DeveloperPartyPreviewFrame,
  DeveloperPartySlotNumber,
  DeveloperPartyPreviewSlotWithDataUrl
} from '../lib/developer-party'
import { developerPartyModelInputDataUrl, developerPartySlotDataUrl } from '../lib/developer-party'

type PreviewFrame = Omit<DeveloperPartyPreviewFrame, 'slots' | 'participantWindow'> & {
  kind: DeveloperCollectionKind
  participantWindow?: NonNullable<DeveloperPartyPreviewFrame['participantWindow']> & {
    dataUrl: string
  }
  slots: DeveloperPartyPreviewSlotWithDataUrl[]
}

type CollectionSession = {
  active: boolean
  polling: boolean
  commandRevision: number
  statusEventRevision: number
  interval: number | null
  refreshPreview: () => Promise<void>
  applySlots: (slots: DeveloperPartySlotNumber[]) => void
  disarmPromise: Promise<void> | null
}

function disarmCollectionSession(session: CollectionSession): Promise<void> {
  if (session.disarmPromise != null) {
    return session.disarmPromise
  }

  session.active = false
  session.commandRevision += 1
  if (session.interval != null) {
    window.clearInterval(session.interval)
    session.interval = null
  }

  session.disarmPromise = window.developer.setPartyCollectionSlots(null).then(
    () => undefined,
    () => undefined
  )

  return session.disarmPromise
}

export function useDeveloperPartyCollection(
  slots: DeveloperPartySlotNumber[],
  onSlotsChange: (slots: DeveloperPartySlotNumber[]) => void,
  active: boolean,
  onDisarmed: () => void,
  kind: DeveloperCollectionKind = 'hud',
  previewIntervalMs = DEFAULT_DEVELOPER_PREVIEW_INTERVAL_MS
): {
  frame: PreviewFrame | null
  slots: DeveloperPartySlotNumber[]
  collection: DeveloperPartyCollectionStatus | null
  previewError: string
  commandError: string
  setSlotIncluded: (slot: DeveloperPartySlotNumber, included: boolean) => void
} {
  const [frame, setFrame] = useState<PreviewFrame | null>(null)
  const [collection, setCollection] = useState<DeveloperPartyCollectionStatus | null>(null)
  const [previewError, setPreviewError] = useState('')
  const [commandError, setCommandError] = useState('')
  const [context, setContext] = useState({ active, kind })
  // Reset in the render for changed inputs so an old mode never paints before an effect.
  if (context.active !== active || context.kind !== kind) {
    setContext({ active, kind })
    setFrame(null)
    setCollection(null)
    setPreviewError('')
    setCommandError('')
  }
  const slotsRef = useRef(slots)
  const sessionRef = useRef<CollectionSession | null>(null)
  const disarmPromiseRef = useRef<Promise<void> | null>(null)
  const lifecycleRevisionRef = useRef(0)
  const onDisarmedRef = useRef(onDisarmed)

  useEffect(() => {
    slotsRef.current = slots
  }, [slots])

  useEffect(() => {
    onDisarmedRef.current = onDisarmed
  }, [onDisarmed])

  useEffect(
    () => () => {
      lifecycleRevisionRef.current += 1
    },
    []
  )

  useEffect(() => {
    lifecycleRevisionRef.current += 1
    const lifecycleRevision = lifecycleRevisionRef.current
    if (!active) {
      const pendingDisarm = disarmPromiseRef.current
      if (pendingDisarm != null) {
        void pendingDisarm.then(() => {
          if (lifecycleRevision === lifecycleRevisionRef.current) {
            onDisarmedRef.current()
          }
        })
      }

      return
    }

    disarmPromiseRef.current = null
    const session: CollectionSession = {
      active: true,
      polling: false,
      commandRevision: 0,
      statusEventRevision: 0,
      interval: null,
      refreshPreview,
      applySlots,
      disarmPromise: null
    }
    sessionRef.current = session
    const unsubscribe = window.developer.onPartyCollectionStatus((update) => {
      if (session.active && update.kind === kind) {
        session.statusEventRevision += 1
        setCollection(update.status)
      }
    })

    function applySlots(nextSlots: DeveloperPartySlotNumber[]): void {
      session.commandRevision += 1
      const commandRevision = session.commandRevision
      const statusEventRevision = session.statusEventRevision
      const request =
        kind === 'hud'
          ? window.developer.setPartyCollectionSlots(nextSlots)
          : window.developer.setPartyCollectionSlots(nextSlots, kind)
      void request
        .then((status) => {
          if (session.active && commandRevision === session.commandRevision) {
            if (statusEventRevision === session.statusEventRevision) {
              setCollection(status)
            }
            setCommandError('')
          }
        })
        .catch(() => {
          if (session.active && commandRevision === session.commandRevision) {
            setCommandError('수집 설정을 저장하지 못했습니다.')
          }
        })
    }

    applySlots(slotsRef.current)

    async function refreshPreview(): Promise<void> {
      if (!session.active || session.polling) {
        return
      }

      session.polling = true
      const commandRevision = session.commandRevision
      const statusEventRevision = session.statusEventRevision
      try {
        const response = await (kind === 'hud'
          ? window.developer.previewParty()
          : window.developer.previewParty(kind))
        if (!session.active) {
          return
        }

        let nextFrame: PreviewFrame | null = null
        if (response.frame) {
          const frameFields = { ...response.frame }
          let participantWindow: PreviewFrame['participantWindow']
          if (response.frame.participantWindow) {
            const windowFields = { ...response.frame.participantWindow }
            const dataUrl = developerPartySlotDataUrl(response.frame.participantWindow)
            participantWindow = { ...windowFields, dataUrl }
          }
          const slots = response.frame.slots.map((slot) => {
            const slotFields = { ...slot }
            // HUD crops show the OCR model input; participant and raid tabs keep raw crops.
            const dataUrl =
              kind === 'hud'
                ? developerPartyModelInputDataUrl(slot)
                : developerPartySlotDataUrl(slot)

            return { ...slotFields, dataUrl }
          })
          nextFrame = { ...frameFields, kind, participantWindow, slots }
        }
        setFrame(nextFrame)
        setPreviewError(response.previewError ?? '')
        // The game may start after the tab opened. Retry only a recoverable capture/access check,
        // and reuse the normal command generation so leaving the tab still cancels this arm.
        if (
          kind !== 'hud' &&
          response.frame?.participantWindow &&
          !response.collection.armed &&
          response.collection.error === DEVELOPER_ERROR_CODES.CAPTURE_UNAVAILABLE &&
          commandRevision === session.commandRevision &&
          statusEventRevision === session.statusEventRevision
        ) {
          applySlots(slotsRef.current)
        }

        if (
          commandRevision === session.commandRevision &&
          statusEventRevision === session.statusEventRevision
        ) {
          setCollection(response.collection)
        }
      } catch {
        if (session.active) {
          setFrame(null)
          setPreviewError(DEVELOPER_ERRORS.PREVIEW_FAILED)
        }
      } finally {
        session.polling = false
      }
    }

    void refreshPreview()

    return () => {
      unsubscribe()
      disarmPromiseRef.current = disarmCollectionSession(session)
      if (sessionRef.current === session) {
        sessionRef.current = null
      }
    }
  }, [active, kind])

  useEffect(() => {
    const session = sessionRef.current
    if (!session?.active) {
      return
    }

    // Changing the cadence must preserve in-flight capture and Print Screen registration.
    const interval = window.setInterval(() => void session.refreshPreview(), previewIntervalMs)
    session.interval = interval

    return () => window.clearInterval(interval)
  }, [active, kind, previewIntervalMs])

  function setSlotIncluded(slot: DeveloperPartySlotNumber, included: boolean): void {
    const nextSlots = included
      ? [...slotsRef.current, slot].sort((left, right) => left - right)
      : slotsRef.current.filter((selected) => selected !== slot)
    slotsRef.current = nextSlots
    onSlotsChange(nextSlots)

    const session = sessionRef.current
    if (session?.active) {
      session.applySlots(nextSlots)
    }
  }

  const currentFrame = frame?.kind === kind ? frame : null

  return {
    frame: currentFrame,
    slots,
    collection,
    previewError,
    commandError,
    setSlotIncluded
  }
}
