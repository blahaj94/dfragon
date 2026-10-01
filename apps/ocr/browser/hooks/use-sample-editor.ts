import { useLayoutEffect, useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { Sample, Split } from '../../src/model.js'
import type { SampleUpdate } from '../../src/sample-update.js'
import { OCR_ERROR_CODE } from '../../src/errors.js'
import { requestOcr, OcrApiError, errorMessage } from '../client.js'
import { OCR_MESSAGES } from '../constants.js'
import { invalidateDataset } from '../query.js'

type EditSession = { active: boolean; pending: boolean; confirmation: SaveRequest | null }
type SaveRequest = {
  id: string
  body: SampleUpdate
  session: EditSession
}

export function useSampleEditor(sample: Sample) {
  const client = useQueryClient()
  const sessionRef = useRef<EditSession>({ active: false, pending: false, confirmation: null })
  useLayoutEffect(() => {
    const session: EditSession = { active: true, pending: false, confirmation: null }
    sessionRef.current = session

    return () => {
      session.active = false
      session.confirmation = null
    }
  }, [sample.id])
  const [draft, setDraft] = useState({ saved: sample.text, text: sample.text ?? '' })
  if (draft.saved !== sample.text) {
    const text = draft.text === (draft.saved ?? '') ? (sample.text ?? '') : draft.text
    setDraft({ saved: sample.text, text })
  }
  const text = draft.text
  function setText(value: string) {
    setDraft((current) => ({ ...current, text: value }))
  }
  const [message, setMessage] = useState('')
  const save = useMutation({
    mutationFn: ({ id, body }: SaveRequest) => requestOcr(`/api/samples/${id}`, 'PATCH', body),
    onSuccess: async (_, request) => {
      if (request.session.active) {
        setMessage(OCR_MESSAGES.saved)
      }
      await invalidateDataset(client)
    },
    onError: (error, request) => {
      if (request.session.active) {
        setMessage(errorMessage(error))
      }
    }
  })
  const assign = useMutation({
    mutationFn: (split: Split) => requestOcr('/api/splits', 'PUT', { text: sample.text, split }),
    onSuccess: async () => {
      setMessage(OCR_MESSAGES.splitAssigned)
      await invalidateDataset(client)
    },
    onError: (error) => setMessage(errorMessage(error))
  })
  async function performSave(request: SaveRequest): Promise<SaveRequest | null> {
    const session = request.session
    if (!session.active || session !== sessionRef.current || session.pending) {
      return null
    }
    session.pending = true
    session.confirmation = null
    setMessage('')
    try {
      await save.mutateAsync(request)

      return null
    } catch (error) {
      if (
        session.active &&
        error instanceof OcrApiError &&
        error.code === OCR_ERROR_CODE.LABEL_SPLIT_CHANGE &&
        request.body.confirmSplitChange !== true
      ) {
        session.confirmation = request

        return request
      }

      return null
    } finally {
      session.pending = false
    }
  }
  function saveSample() {
    const answer = text === '' ? null : text
    const request = { id: sample.id, body: { text: answer }, session: sessionRef.current }

    return performSave(request)
  }
  async function setSampleExcluded(excluded: boolean) {
    await performSave({ id: sample.id, body: { excluded }, session: sessionRef.current })
  }
  function isSaveConfirmationCurrent(request: SaveRequest): boolean {
    const session = request.session

    return session.active && session === sessionRef.current && session.confirmation === request
  }
  async function resolveSaveConfirmation(request: SaveRequest, confirmed: boolean) {
    if (!isSaveConfirmationCurrent(request)) {
      return
    }
    request.session.confirmation = null
    if (confirmed) {
      await performSave({ ...request, body: { ...request.body, confirmSplitChange: true } })
    }
  }
  function assignNicknameSplit(split: Split) {
    if (sample.text === null || sample.text.length === 0 || split === sample.split) {
      return
    }

    assign.mutate(split)
  }
  const busy = save.isPending || assign.isPending

  return {
    text,
    setText,
    message,
    busy,
    saveSample,
    setSampleExcluded,
    isSaveConfirmationCurrent,
    resolveSaveConfirmation,
    assignNicknameSplit
  }
}
