import { useRef, useState } from 'react'
import type { SetStateAction } from 'react'
import type { Capture, CaptureKind, Crop } from '../../src/model.js'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { requestOcr, errorMessage } from '../client.js'
import { OCR_MESSAGES, UI_SCALE_PERCENT } from '../constants.js'
import { assertUploadFile, readPngBase64, UploadInputError } from '../upload-input.js'
import { invalidateDataset } from '../query.js'

type Notice = { message: string; failed: boolean }
const EMPTY_NOTICE: Notice = { message: '', failed: false }
type CaptureSubmission = {
  id: string
  capturedAt: string
  kind: CaptureKind
  uiScale: number | null
  uiScaleSource: Capture['uiScaleSource']
  crops: Crop[]
  originalPng: string
}

export function useCaptureUpload() {
  const client = useQueryClient()
  const [file, setFileState] = useState<File | null>(null)
  const [kind, setKind] = useState<CaptureKind>('hud')
  const [scale, setScale] = useState('')
  const [source, setSourceState] = useState<'game' | 'estimated'>('game')
  const [cropsByKind, setCropsByKind] = useState<Record<CaptureKind, Crop[]>>({
    hud: [{ slot: 1, x: 0, y: 0, width: 1, height: 1 }],
    participants: [{ slot: 1, x: 0, y: 0, width: 1, height: 1 }],
    raid: [{ slot: 1, x: 0, y: 0, width: 1, height: 1 }]
  })
  const crops = cropsByKind[kind]
  const setCrops = (update: SetStateAction<Crop[]>) =>
    setCropsByKind((current) => {
      const nextCropsByKind = { ...current }
      const nextCrops = typeof update === 'function' ? update(current[kind]) : update
      nextCropsByKind[kind] = nextCrops

      return nextCropsByKind
    })
  const [submission, setSubmission] = useState<CaptureSubmission | null>(null)
  const previous = useRef<CaptureSubmission | null>(null)
  const pending = useRef(false)
  const [notice, setNotice] = useState<Notice>(EMPTY_NOTICE)
  const upload = useMutation({
    mutationFn: async (retry: CaptureSubmission | null) => {
      setNotice(EMPTY_NOTICE)
      let body = retry
      if (body === null) {
        assertUploadFile(file)
        const selectedCrops = crops.map((crop) => ({ ...crop }))
        const originalPng = await readPngBase64(file)
        const uiScale = scale === '' ? null : Number(scale) / UI_SCALE_PERCENT
        const uiScaleSource = scale === '' ? 'unknown' : source
        body = {
          id: crypto.randomUUID(),
          capturedAt: new Date().toISOString(),
          kind,
          uiScale,
          uiScaleSource,
          crops: selectedCrops,
          originalPng
        }
        previous.current = body
        setSubmission(body)
      }
      await requestOcr('/api/captures', 'POST', body)
    },
    onSuccess: async () => {
      previous.current = null
      setSubmission(null)
      setNotice({ message: OCR_MESSAGES.uploaded, failed: false })
      await invalidateDataset(client)
    },
    onError: (error) =>
      setNotice({
        message: error instanceof UploadInputError ? error.message : errorMessage(error),
        failed: true
      }),
    onSettled: () => {
      pending.current = false
    }
  })
  const busy = upload.isPending

  function setFile(value: File | null) {
    setFileState(value)
    previous.current = null
    setSubmission(null)
  }
  function setSource(value: string) {
    if (value === 'game' || value === 'estimated') {
      setSourceState(value)
    }
  }
  function uploadNew() {
    if (pending.current) {
      return
    }
    pending.current = true
    upload.mutate(null)
  }
  function retryPrevious() {
    if (pending.current || previous.current === null) {
      return
    }
    pending.current = true
    upload.mutate(previous.current)
  }

  return {
    file,
    setFile,
    kind,
    setKind,
    scale,
    setScale,
    source,
    setSource,
    crops,
    setCrops,
    submission,
    message: notice.message,
    failed: notice.failed,
    busy,
    uploadNew,
    retryPrevious
  }
}
