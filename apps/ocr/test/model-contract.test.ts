import assert from 'node:assert/strict'
import test from 'node:test'
import type { Capture, TestCollection } from '../src/model.js'
import { parseUpload } from '../src/images.js'
import { parseSyntheticUpload } from '../src/synthetic-upload.js'
import { syntheticUpload, upload } from './fixtures.js'

type CaptureFields = Omit<Capture, 'kind' | 'synthetic' | 'testCollection'>
type SyntheticMetadata = Extract<Capture, { kind: 'synthetic' }>['synthetic']
type IsCapture<T> = T extends Capture ? true : false

// 종류와 메타데이터의 연결이 풀리면 이 리터럴 타입 계약에서 컴파일이 실패한다.
const contracts: [
  IsCapture<CaptureFields & { kind: 'synthetic' }>,
  IsCapture<CaptureFields & { kind: 'hud'; synthetic: SyntheticMetadata }>,
  IsCapture<CaptureFields & { kind: 'synthetic'; synthetic: SyntheticMetadata }>,
  IsCapture<CaptureFields & { kind: 'hud' }>,
  IsCapture<
    CaptureFields & {
      kind: 'synthetic'
      synthetic: SyntheticMetadata
      testCollection: TestCollection
    }
  >,
  IsCapture<CaptureFields & { kind: 'hud'; testCollection: TestCollection }>
] = [false, false, true, true, false, true]

test('합성 캡처 종류에만 합성 정답, 렌더링 메타데이터를 요구한다', () => {
  assert.deepEqual(contracts, [false, false, true, true, false, true])
  const ordinary = parseUpload(upload()).capture
  const synthetic = parseSyntheticUpload(syntheticUpload()).capture
  assert.equal(ordinary.kind, 'hud')
  assert.equal(ordinary.synthetic, undefined)
  assert.equal(synthetic.kind, 'synthetic')
  if (synthetic.kind === 'synthetic') {
    assert.equal(synthetic.synthetic.text, '합성고래')
  }
})
