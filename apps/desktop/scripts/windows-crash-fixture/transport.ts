import { open, readFile, rename } from 'node:fs/promises'
import { join } from 'node:path'
import { setTimeout } from 'node:timers/promises'
import type { Observation } from './observer'

export async function publishEvidence(path: string, value: unknown): Promise<void> {
  const temporary = `${path}.pending`
  const handle = await open(temporary, 'wx')
  try {
    await handle.writeFile(JSON.stringify(value))
    await handle.sync()
  } finally {
    await handle.close()
  }
  // Every destination is unique in a newly claimed evidence directory.
  await rename(temporary, path)
}

export function fileExchange(directory: string) {
  return async (event: Observation, signal: AbortSignal): Promise<unknown> => {
    const name = String(event.sequence).padStart(6, '0')
    await publishEvidence(join(directory, `${name}.request.json`), event)
    const ackPath = join(directory, `${name}.ack.json`)
    while (!signal.aborted) {
      try {
        return JSON.parse(await readFile(ackPath, 'utf8'))
      } catch (error) {
        const isMissing = (error as NodeJS.ErrnoException).code === 'ENOENT'
        if (!isMissing) {
          throw new Error('ACK artifact is unreadable or invalid.')
        }
      }
      await setTimeout(100, undefined, { signal })
    }
    throw new Error('ACK transport stopped.')
  }
}
