import type { DNFRectangle } from './dnf-party-geometry.js'
import { roundParticipantPixel, type ParticipantHeading } from './dnf-party-participant-matching.js'

export type ParticipantBounds = Readonly<{
  left: number
  top: number
  right: number
  bottom: number
}>

/** Projects each edge independently with participant raster rounding, without clipping. */
export function projectParticipantRectangle(
  heading: Pick<ParticipantHeading, 'x' | 'y' | 'scale'>,
  bounds: ParticipantBounds
): DNFRectangle {
  const x = roundParticipantPixel(heading.x + bounds.left * heading.scale)
  const y = roundParticipantPixel(heading.y + bounds.top * heading.scale)
  const width = roundParticipantPixel(heading.x + bounds.right * heading.scale) - x
  const height = roundParticipantPixel(heading.y + bounds.bottom * heading.scale) - y

  return { x, y, width, height }
}
