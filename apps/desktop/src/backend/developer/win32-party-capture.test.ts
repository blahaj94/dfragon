import { describe, expect, it } from 'vitest'
import { isDnfExecutablePath, partySlotCoverageIntersectsWindow } from './win32-party-capture'

const coverage = { x: 42, y: 27, width: 99, height: 9 }
const client = { x: 300, y: 200, width: 1920, height: 1080 }

describe('Win32 party capture geometry guards', () => {
  it('identifies only DNF.exe-owned windows across Windows path casing', () => {
    expect(isDnfExecutablePath('C:\\Games\\DNF.exe')).toBe(true)
    expect(isDnfExecutablePath('D:\\Games\\d n f.exe')).toBe(false)
    expect(isDnfExecutablePath('C:\\Games\\launcher.exe')).toBe(false)
  })

  it('uses explicit client-space coverage with exclusive right and bottom edges', () => {
    expect(
      partySlotCoverageIntersectsWindow(client, coverage, {
        left: 440,
        top: 235,
        right: 441,
        bottom: 236
      })
    ).toBe(true)
    expect(
      partySlotCoverageIntersectsWindow(client, coverage, {
        left: 441,
        top: 236,
        right: 450,
        bottom: 245
      })
    ).toBe(false)
    expect(
      partySlotCoverageIntersectsWindow(client, coverage, {
        left: 900,
        top: 500,
        right: 1200,
        bottom: 700
      })
    ).toBe(false)
  })
})
