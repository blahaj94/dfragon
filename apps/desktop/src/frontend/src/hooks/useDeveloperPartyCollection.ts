import { DEVELOPER_ERRORS } from '../constants/developer'
import { DEVELOPER_ERROR_CODES } from '../../../preload/common/developer-errors'
import { useEffect, useRef, useState } from 'react'
import type { DeveloperCollectionKind } from '../../../preload/common/types/developer'
import type {
  DeveloperPartyCollectionStatus,
  DeveloperPartyPreviewFrame,
  DeveloperPartySlotNumber,
  DeveloperPartyPreviewSlotWithDataUrl
} from '../lib/developer-party'
import { developerPartySlotDataUrl } from '../lib/developer-party'

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
  interval: number | null
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
  kind: DeveloperCollectionKind = 'hud'
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
      interval: null,
      disarmPromise: null
    }
    sessionRef.current = session

    const applySlots = (nextSlots: DeveloperPartySlotNumber[]): void => {
      session.commandRevision += 1
      const commandRevision = session.commandRevision
      const request =
        kind === 'hud'
          ? window.developer.setPartyCollectionSlots(nextSlots)
          : window.developer.setPartyCollectionSlots(nextSlots, kind)
      void request
        .then((status) => {
          if (session.active && commandRevision === session.commandRevision) {
            setCollection(status)
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
      try {
        const response = await (kind === 'hud'
          ? window.developer.previewParty()
          : window.developer.previewParty(kind))
        if (!session.active) {
          return
        }

        const nextFrame = response.frame
          ? {
              ...response.frame,
              kind,
              participantWindow: response.frame.participantWindow
                ? {
                    ...response.frame.participantWindow,
                    dataUrl: developerPartySlotDataUrl(response.frame.participantWindow)
                  }
                : undefined,
              slots: response.frame.slots.map((slot) => ({
                ...slot,
                dataUrl: developerPartySlotDataUrl(slot)
              }))
            }
          : null
        setFrame(nextFrame)
        setPreviewError(response.previewError ?? '')
        // The game may start after the tab opened. Retry only a recoverable capture/access check,
        // and reuse the normal command generation so leaving the tab still cancels this arm.
        if (
          kind === 'participants' &&
          response.frame?.participantWindow &&
          !response.collection.armed &&
          response.collection.error === DEVELOPER_ERROR_CODES.CAPTURE_UNAVAILABLE &&
          commandRevision === session.commandRevision
        ) {
          applySlots(slotsRef.current)
        }
        if (commandRevision === session.commandRevision) {
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
    session.interval = window.setInterval(() => void refreshPreview(), 1000)

    return () => {
      disarmPromiseRef.current = disarmCollectionSession(session)
      if (sessionRef.current === session) {
        sessionRef.current = null
      }
    }
  }, [active, kind])

  function setSlotIncluded(slot: DeveloperPartySlotNumber, included: boolean): void {
    const nextSlots = included
      ? [...slotsRef.current, slot].sort((left, right) => left - right)
      : slotsRef.current.filter((selected) => selected !== slot)
    slotsRef.current = nextSlots
    onSlotsChange(nextSlots)

    const session = sessionRef.current
    if (session?.active) {
      session.commandRevision += 1
      const commandRevision = session.commandRevision
      const request =
        kind === 'hud'
          ? window.developer.setPartyCollectionSlots(nextSlots)
          : window.developer.setPartyCollectionSlots(nextSlots, kind)
      void request
        .then((status) => {
          if (session.active && commandRevision === session.commandRevision) {
            setCollection(status)
            setCommandError('')
          }
        })
        .catch(() => {
          if (session.active && commandRevision === session.commandRevision) {
            setCommandError('수집 설정을 저장하지 못했습니다.')
          }
        })
    }
  }

  return {
    frame: frame?.kind === kind ? frame : null,
    slots,
    collection,
    previewError,
    commandError,
    setSlotIncluded
  }
}
