import tar from 'tar-stream'
import type { Response } from 'express'
import { pipeline } from 'node:stream/promises'
import { cropPng, decodePng } from './images.js'
import type { OcrStore } from './store.js'

export async function downloadDataset(store: OcrStore, response: Response) {
  const manifest = store.exportManifest()
  const archive = tar.pack()
  response.setHeader('Content-Type', 'application/x-tar')
  response.setHeader('Content-Disposition', 'attachment; filename="ocr-data.tar"')
  const transfer = pipeline(archive, response)
  // Observe cancellation immediately while the producer is between entries.
  void transfer.catch(() => undefined)
  const writeEntry = (name: string, bytes: Buffer) =>
    new Promise<void>((resolve, reject) => {
      if (archive.destroyed) {
        reject(new Error('Download closed'))
        return
      }
      archive.entry({ name, size: bytes.length, mode: 0o600 }, bytes, (error) =>
        error != null ? reject(error) : resolve()
      )
    })
  try {
    await writeEntry('manifest.json', Buffer.from(JSON.stringify(manifest, null, 2)))
    for (const capture of manifest.captures) {
      const { png } = store.capture(capture.id)
      await writeEntry(`originals/${capture.id}.png`, png)
      const decoded = decodePng(png)
      for (const crop of capture.crops) {
        await writeEntry(`crops/${capture.id}-${crop.slot}.png`, cropPng(decoded, crop))
      }
    }
    archive.finalize()
    await transfer
  } catch (error) {
    archive.destroy()
    await transfer.catch(() => undefined)
    throw error
  }
}
