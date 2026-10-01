import type { DNFRectangle } from './dnf-party-geometry.js'
import type { DNFParticipantFrame } from './dnf-party-participants.js'

const evidencePolicy = {
  minBrightness: 100,
  minRoleBrightness: 120,
  minRoleChannelDifference: 60,
  minPortraitRatio: 0.12,
  minLevelRatio: 0.035,
  minRoleRatio: 0.1,
  requiredSignals: 2
}

/** Measures pixels outside the nickname column, without changing raw RGBA or alpha. */
export function participantEvidenceRatio(
  frame: DNFParticipantFrame,
  region: DNFRectangle,
  colored = false
): number {
  let count = 0
  for (let y = region.y; y < region.y + region.height; y += 1) {
    for (let x = region.x; x < region.x + region.width; x += 1) {
      const offset = (y * frame.width + x) * 4
      const r = frame.rgba[offset]
      const g = frame.rgba[offset + 1]
      const b = frame.rgba[offset + 2]
      const maximum = Math.max(r, g, b)
      const matches = colored
        ? maximum >= evidencePolicy.minRoleBrightness &&
          maximum - Math.min(r, g, b) >= evidencePolicy.minRoleChannelDifference
        : maximum >= evidencePolicy.minBrightness
      if (matches) {
        count += 1
      }
    }
  }

  return count / (region.width * region.height)
}

/** Both measured layouts require at least two of the three independent occupancy signals. */
export function hasParticipantEvidence(evidence: {
  portrait: number
  level: number
  role: number
}): boolean {
  return (
    Number(evidence.portrait >= evidencePolicy.minPortraitRatio) +
      Number(evidence.level >= evidencePolicy.minLevelRatio) +
      Number(evidence.role >= evidencePolicy.minRoleRatio) >=
    evidencePolicy.requiredSignals
  )
}
