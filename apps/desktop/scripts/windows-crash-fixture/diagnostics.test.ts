import { expect, it } from 'vitest'
import { createStageDiagnostic } from './diagnostics'

it('reports only the fixed stage when setup throws sensitive native details', async () => {
  const diagnostic = createStageDiagnostic()
  diagnostic.enter('ancestor-inspection')

  let failure: unknown
  try {
    await diagnostic.run(async () => {
      throw new Error('private path and native identity')
    })
  } catch (error) {
    failure = error
  }
  expect(failure).toBeInstanceOf(Error)
  expect((failure as Error).message).toBe(
    'Synthetic Windows fixture failed at ancestor-inspection; preserve evidence.'
  )
  expect((failure as Error).cause).toBeUndefined()
})

it('retains successful work and identifies failures before configuration is read', async () => {
  const diagnostic = createStageDiagnostic()
  await expect(diagnostic.run(async () => 'completed')).resolves.toBe('completed')
  await expect(
    diagnostic.run(async () => {
      throw new Error('untrusted details')
    })
  ).rejects.toThrow('failed at config-read;')
})
