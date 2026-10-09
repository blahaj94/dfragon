import { describe, expect, it } from 'vitest'
import { findSelectedSource } from './capture-policy'

describe('캡처 정책', () => {
  it('현재 window source 목록에 있는 source만 반환한다', () => {
    const sources = [
      { id: 'window:1:0', name: 'Game' },
      { id: 'window:2:0', name: 'Other app' }
    ]

    expect(findSelectedSource(sources, 'window:1:0')).toEqual({ id: 'window:1:0', name: 'Game' })
    expect(findSelectedSource(sources, 'screen:0:0')).toBeNull()
  })
})
