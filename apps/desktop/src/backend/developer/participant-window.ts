import { DEVELOPER_ERROR_CODES } from '../../preload/common/developer-errors'
import { readFileSync } from 'node:fs'
import { PNG } from 'pngjs'
import { flatMap, map } from 'remeda'
import {
  cropDNFPartyParticipantNicknames,
  cropDNFRaidParticipantNicknames,
  type DNFParticipantCropResult,
  type DNFParticipantFrame,
  type DNFRaidParticipantCropResult,
  type DNFRectangle
} from '@dfragon/lib'
import type { CapturedPartyFrame, CapturedPartySlot } from './collection-session'
import referenceHeadingPath from './participant-heading.png?asset'
import raidHeadingPath from './raid-heading.png?asset'

type PopupKind = 'participants' | 'raid'
type PartyRows = Extract<DNFParticipantCropResult, { status: 'found' }>['rows']
type RaidRows = Extract<DNFRaidParticipantCropResult, { status: 'found' }>['rows']
type ParticipantRow = {
  slot: CapturedPartySlot['slot']
  occupied: boolean
  nickname: DNFRectangle
  crop: DNFParticipantFrame | null
}
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
  const rows = normalizeParticipantRows(result.rows)
  const window = result.window
  const rgba = new Uint8Array(window.width * window.height * 4)
  for (let row = 0; row < window.height; row += 1) {
    const start = ((window.y + row) * frame.width + window.x) * 4
    rgba.set(frame.rgba.subarray(start, start + window.width * 4), row * window.width * 4)
  }
  const width = frame.width
  const height = frame.height
  const scale = result.scale
  const originalRgba = Buffer.from(frame.rgba)
  const { crops, slots } = createParticipantSamples(rows)
  const windowWidth = window.width
  const windowHeight = window.height
  const previewRows = createParticipantPreviewRows(rows, window)
  const original = { rgba: originalRgba, crops }
  const participantWindow = { width: windowWidth, height: windowHeight, rgba, rows: previewRows }
  const captured = { width, height, scale, capturedAt, original, slots, participantWindow }

  return {
    coverage: window,
    frame: captured
  }
}

/** Gives both popup kinds a common row shape while retaining their current screen positions. */
function normalizeParticipantRows(rows: PartyRows | RaidRows): ParticipantRow[] {
  const normalized = map(rows, (row) => {
    if ('nicknameCrop' in row) {
      const { row: slot, occupied, nickname, nicknameCrop: crop } = row

      return { slot, occupied, nickname, crop }
    }

    return row
  })

  return normalized
}

/** Builds storage bounds and independent raw crop buffers only for rows with a detected crop. */
function createParticipantSamples(rows: readonly ParticipantRow[]): {
  crops: NonNullable<CapturedPartyFrame['original']>['crops']
  slots: CapturedPartySlot[]
} {
  const crops = flatMap(rows, ({ slot, crop, nickname }) => {
    const bounds = crop == null ? [] : [{ slot, ...nickname }]

    return bounds
  })
  const slots = flatMap(rows, ({ slot, crop }) => {
    const samples: CapturedPartySlot[] = []
    if (crop != null) {
      const width = crop.width
      const height = crop.height
      const rgba = Buffer.from(crop.rgba)
      samples.push({ slot, width, height, rgba })
    }

    return samples
  })

  return { crops, slots }
}

/** Keeps empty rows visible and projects their nickname bounds relative to the detected popup. */
function createParticipantPreviewRows(
  rows: readonly ParticipantRow[],
  window: DNFRectangle
): NonNullable<CapturedPartyFrame['participantWindow']>['rows'] {
  const previewRows = map(rows, ({ slot, occupied, nickname }) => {
    const x = nickname.x - window.x
    const y = nickname.y - window.y

    return { ...nickname, slot, occupied, x, y }
  })

  return previewRows
}
