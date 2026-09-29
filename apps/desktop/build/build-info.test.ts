import { expect, it, vi } from 'vitest'
import { readDesktopSourceInfo } from './build-info'

it('embeds the checked-out commit, including a detached release tag, without runtime overrides', () => {
  const git = vi
    .fn()
    .mockReturnValueOnce(`${'a'.repeat(40)}\n`)
    .mockReturnValueOnce('')
  const result = readDesktopSourceInfo('/synthetic/source', git)
  expect(result).toEqual({ commit: 'a'.repeat(40), dirty: false })
  expect(git.mock.calls).toEqual([
    [['rev-parse', '--verify', 'HEAD^{commit}']],
    [['status', '--porcelain', '--untracked-files=normal']]
  ])
})

it('marks a modified checkout instead of claiming that its commit exactly describes the build', () => {
  const git = vi.fn().mockReturnValueOnce('b'.repeat(40)).mockReturnValueOnce(' M src/main.ts\n')
  expect(readDesktopSourceInfo('/synthetic/source', git)).toEqual({
    commit: 'b'.repeat(40),
    dirty: true
  })
})

it.each(['short', 'A'.repeat(40), ''])(
  'reports unknown when git returns an invalid commit %s',
  (sha) => {
    expect(readDesktopSourceInfo('/synthetic/source', () => sha)).toEqual({
      commit: null,
      dirty: null
    })
  }
)

it('reports unknown when source metadata is absent or its working tree cannot be inspected', () => {
  const git = vi
    .fn()
    .mockReturnValueOnce('c'.repeat(40))
    .mockImplementationOnce(() => {
      throw new Error('synthetic git failure')
    })
  expect(readDesktopSourceInfo('/synthetic/source', git)).toEqual({ commit: null, dirty: null })
})
