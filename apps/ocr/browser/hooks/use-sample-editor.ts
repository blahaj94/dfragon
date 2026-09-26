import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { Sample, Split } from '../../src/model.js'
import { OCR_ERROR_CODE } from '../../src/errors.js'
import { requestOcr, OcrApiError, errorMessage } from '../client.js'
import { OCR_MESSAGES } from '../constants.js'
import { invalidateDataset } from '../query.js'

export function useSampleEditor(sample: Sample) {
  const client = useQueryClient()
  const [text, setText] = useState(sample.text ?? '')
  const [message, setMessage] = useState('')
  const save = useMutation({
    mutationFn: async (excluded: boolean) => {
      setMessage('')
      const body = { text: text === '' ? null : text, excluded }
      try {
        await requestOcr(`/api/samples/${sample.id}`, 'PATCH', body)
      } catch (error) {
        if (
          !(error instanceof OcrApiError) ||
          error.code !== OCR_ERROR_CODE.LABEL_SPLIT_CHANGE ||
          !window.confirm(OCR_MESSAGES.confirmLabelChange)
        ) {
          throw error
        }
        await requestOcr(`/api/samples/${sample.id}`, 'PATCH', {
          ...body,
          confirmSplitChange: true
        })
      }
    },
    onSuccess: async () => {
      setMessage(OCR_MESSAGES.saved)
      await invalidateDataset(client)
    },
    onError: (error) => setMessage(errorMessage(error))
  })
  const assign = useMutation({
    mutationFn: (split: Split) => requestOcr('/api/splits', 'PUT', { text: sample.text, split }),
    onSuccess: async () => {
      setMessage(OCR_MESSAGES.splitAssigned)
      await invalidateDataset(client)
    },
    onError: (error) => setMessage(errorMessage(error))
  })
  function assignNicknameSplit(split: Split) {
    if (sample.text === null || sample.text.length === 0 || split === sample.split) {
      return
    }
    if (window.confirm(OCR_MESSAGES.confirmSplit(split))) {
      assign.mutate(split)
    }
  }
  return {
    text,
    setText,
    message,
    busy: save.isPending || assign.isPending,
    saveSample: save.mutate,
    assignNicknameSplit
  }
}
