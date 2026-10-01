import assert from 'node:assert/strict'
import test from 'node:test'
import type { Capture } from '../src/model.js'
import { parseUpload } from '../src/images.js'
import { parseSyntheticUpload } from '../src/synthetic-upload.js'
import { syntheticUpload, upload } from './fixtures.js'

type CaptureFields = Omit<Capture, 'kind' | 'synthetic'>
type SyntheticMetadata = Extract<Capture, { kind: 'synthetic' }>['synthetic']
type IsCapture<T> = T extends Capture ? true : false

// These literal assignments fail compilation if kind and metadata become independent again.
const contracts: [
  IsCapture<CaptureFields & { kind: 'synthetic' }>,
  IsCapture<CaptureFields & { kind: 'hud'; synthetic: SyntheticMetadata }>,
  IsCapture<CaptureFields & { kind: 'synthetic'; synthetic: SyntheticMetadata }>,
  IsCapture<CaptureFields & { kind: 'hud' }>
] = [false, false, true, true]

test('capture kinds require synthetic metadata only for synthetic images', () => {
  assert.deepEqual(contracts, [false, false, true, true])
  const ordinary = parseUpload(upload()).capture
  const synthetic = parseSyntheticUpload(syntheticUpload()).capture
  assert.equal(ordinary.kind, 'hud')
  assert.equal(ordinary.synthetic, undefined)
  assert.equal(synthetic.kind, 'synthetic')
  if (synthetic.kind === 'synthetic') {
    assert.equal(synthetic.synthetic.text, '합성고래')
  }
})
