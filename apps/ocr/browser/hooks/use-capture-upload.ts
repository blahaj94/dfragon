import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { requestOcr, errorMessage } from '../client.js'
import { OCR_MESSAGES } from '../constants.js'
import { assertUploadFile, readPngBase64, UploadInputError } from '../upload-input.js'
import { invalidateDataset } from '../query.js'

export function useCaptureUpload() {
  const client = useQueryClient()
  const [file, setFile] = useState<File | null>(null)
  const [kind, setKind] = useState('hud')
  const [scale, setScale] = useState('')
  const [source, setSource] = useState('game')
  const [crops, setCrops] = useState([{ slot: 1, x: 0, y: 0, width: 1, height: 1 }])
  const [pending, setPending] = useState<unknown>(null)
  const [message, setMessage] = useState('')
  const upload = useMutation({
    mutationFn: async ({ retry }: { retry: boolean }) => {
      setMessage('')
      let body = pending
      if (!retry) {
        assertUploadFile(file)
        const originalPng = await readPngBase64(file)
        body = {
          id: crypto.randomUUID(),
          capturedAt: new Date().toISOString(),
          kind,
          uiScale: scale === '' ? null : Number(scale) / 100,
          uiScaleSource: scale === '' ? 'unknown' : source,
          crops,
          originalPng
        }
        setPending(body)
      }
      await requestOcr('/api/captures', 'POST', body)
    },
    onSuccess: async () => {
      setPending(null)
      setMessage(OCR_MESSAGES.uploaded)
      await invalidateDataset(client)
    },
    onError: (error) =>
      setMessage(error instanceof UploadInputError ? error.message : errorMessage(error))
  })
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
    pending,
    setPending,
    message,
    busy: upload.isPending,
    uploadCapture: upload.mutate
  }
}
