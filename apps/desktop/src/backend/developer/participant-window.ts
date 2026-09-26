import { DEVELOPER_ERROR_CODES } from '../../preload/common/developer-errors'
import { readFileSync } from 'node:fs'
import { PNG } from 'pngjs'
import {
  cropDNFPartyParticipantNicknames,
  cropDNFRaidParticipantNicknames,
  type DNFParticipantFrame
} from '@dfragon/lib'
import type { CapturedPartyFrame } from './collection-session'
import referenceHeadingPath from './participant-heading.png?asset'
import raidHeadingPath from './raid-heading.png?asset'

type PopupKind = 'participants' | 'raid'
const headings = new Map<PopupKind, DNFParticipantFrame>()

// Decode the bundled, lossless UI-0% column headings once, without gamma/alpha conversion.
function getParticipantHeading(kind: PopupKind): DNFParticipantFrame {
  let heading = headings.get(kind)
  if (heading == null) {
    const path = kind === 'raid' ? raidHeadingPath : referenceHeadingPath
    const { width, height, data } = PNG.sync.read(readFileSync(path))
    heading = { width, height, rgba: data }
    headings.set(kind, heading)
  }
  return heading
}

/** Copies a detected dialog and occupied nicknames from the very same client frame. */
export function captureParticipantWindow(
  frame: DNFParticipantFrame,
  capturedAt: string,
  kind: PopupKind = 'participants'
): {
  frame: CapturedPartyFrame
  coverage: { x: number; y: number; width: number; height: number }
} {
  const heading = getParticipantHeading(kind)
  const result =
    kind === 'raid'
      ? cropDNFRaidParticipantNicknames(frame, heading)
      : cropDNFPartyParticipantNicknames(frame, heading)
  if (result.status !== 'found') {
    const notFound =
      kind === 'raid'
        ? DEVELOPER_ERROR_CODES.RAID_WINDOW_NOT_FOUND
        : DEVELOPER_ERROR_CODES.PARTICIPANT_WINDOW_NOT_FOUND
    const uncertain =
      kind === 'raid'
        ? DEVELOPER_ERROR_CODES.RAID_WINDOW_UNCERTAIN
        : DEVELOPER_ERROR_CODES.PARTICIPANT_WINDOW_UNCERTAIN
    throw new Error(result.status === 'not-found' ? notFound : uncertain)
  }
  const rows = result.rows.map((row) =>
    'nicknameCrop' in row
      ? { slot: row.row, occupied: row.occupied, nickname: row.nickname, crop: row.nicknameCrop }
      : row
  )
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
      original: {
        rgba: Buffer.from(frame.rgba),
        crops: rows.flatMap(({ slot, crop, nickname }) =>
          crop == null ? [] : [{ slot, ...nickname }]
        )
      },
      slots: rows.flatMap(({ slot, crop }) =>
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
        rows: rows.map(({ slot, occupied, nickname }) => ({
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
