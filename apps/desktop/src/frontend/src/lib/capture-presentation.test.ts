import { describe, expect, it } from 'vitest'
import { formatPartyCaptureStatus } from './capture-presentation'

describe('formatPartyCaptureStatus', () => {
  it('omits an empty status without separators for empty slots', () => {
    expect(
      formatPartyCaptureStatus({ status: '', stableNicknames: [null, '', 'Alice', null] })
    ).toBe('슬롯 3: Alice')
    expect(formatPartyCaptureStatus({ status: '', stableNicknames: [null, ''] })).toBe('')
  })

  it('preserves whitespace and embedded newlines in status and nicknames', () => {
    expect(
      formatPartyCaptureStatus({
        status: ' Capture\nready. ',
        stableNicknames: [' ', null, 'Alice\nBob', '']
      })
    ).toBe(' Capture\nready. \n슬롯 1:  \n슬롯 3: Alice\nBob')
  })
})
