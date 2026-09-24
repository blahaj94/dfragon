import { useEffect, useRef, useState } from 'react'
import type {
  DeveloperPartyCollectionStatus,
  DeveloperPartyPreviewFrame,
  DeveloperPartySlotNumber,
  DeveloperPartyPreviewSlotWithDataUrl
} from '../lib/developer-party'
import { developerPartySlotDataUrl } from '../lib/developer-party'

type PreviewFrame = Omit<DeveloperPartyPreviewFrame, 'slots'> & {
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
  onDisarmed: () => void
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
      void window.developer
        .setPartyCollectionSlots(nextSlots)
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
        const response = await window.developer.previewParty()
        if (!session.active) {
          return
        }

        const nextFrame = response.frame
          ? {
              ...response.frame,
              slots: response.frame.slots.map((slot) => ({
                ...slot,
                dataUrl: developerPartySlotDataUrl(slot)
              }))
            }
          : null
        setFrame(nextFrame)
        setPreviewError(response.previewError ?? '')
        if (commandRevision === session.commandRevision) {
          setCollection(response.collection)
        }
      } catch {
        if (session.active) {
          setFrame(null)
          setPreviewError('preview-failed')
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
  }, [active])

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
      void window.developer
        .setPartyCollectionSlots(nextSlots)
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

  return { frame, slots, collection, previewError, commandError, setSlotIncluded }
}
