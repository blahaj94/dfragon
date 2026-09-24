import { inflateSync } from 'node:zlib'
import { cropDNFPartyParticipantNicknames, type DNFParticipantFrame } from '@dfragon/lib'
import type { CapturedPartyFrame } from './collection-session'
import referenceHeading from './participant-heading.json'

// Lossless UI-0% column headings only; see the developer-mode asset provenance note.
const heading: DNFParticipantFrame = {
  width: referenceHeading.width,
  height: referenceHeading.height,
  rgba: inflateSync(Buffer.from(referenceHeading.rgbaDeflateBase64, 'base64'))
}

/** Copies a detected dialog and occupied nicknames from the very same client frame. */
export function captureParticipantWindow(
  frame: DNFParticipantFrame,
  capturedAt: string
): {
  frame: CapturedPartyFrame
  coverage: { x: number; y: number; width: number; height: number }
} {
  const result = cropDNFPartyParticipantNicknames(frame, heading)
  if (result.status !== 'found') {
    throw new Error(
      result.status === 'not-found'
        ? 'DEVELOPER_PARTICIPANT_WINDOW_NOT_FOUND'
        : 'DEVELOPER_PARTICIPANT_WINDOW_UNCERTAIN'
    )
  }
  const window = result.window
  const rgba = new Uint8Array(window.width * window.height * 4)
  for (let row = 0; row < window.height; row += 1) {
    const start = ((window.y + row) * frame.width + window.x) * 4
    rgba.set(frame.rgba.subarray(start, start + window.width * 4), row * window.width * 4)
  }
  return {
    coverage: window,
    frame: {
      width: frame.width,
      height: frame.height,
      scale: result.scale,
      capturedAt,
      slots: result.rows.flatMap(({ slot, crop }) =>
        crop == null
          ? []
          : [
              {
                slot,
                width: crop.width,
                height: crop.height,
                rgba: Buffer.from(crop.rgba)
              }
            ]
      ),
      participantWindow: {
        width: window.width,
        height: window.height,
        rgba,
        rows: result.rows.map(({ slot, occupied, nickname }) => ({
          ...nickname,
          slot,
          occupied,
          x: nickname.x - window.x,
          y: nickname.y - window.y
        }))
      }
    }
  }
}
