import assert from 'node:assert/strict'
import test from 'node:test'
import { crc32 } from 'node:zlib'
import { PNG } from 'pngjs'
import { cropPng, decodePng, decodeUploadedPng, parseUpload } from '../src/images.js'
import { upload } from './fixtures.js'

function pngWithByteLength(length: number): Buffer {
  const image = new PNG({ width: 1, height: 1 })
  image.data.set([24, 81, 190, 255])
  const png = PNG.sync.write(image)
  // PNG 규격의 비필수 private chunk로 유효 이미지의 정확한 전송 크기를 만든다.
  const chunk = Buffer.alloc(length - png.length)
  chunk.writeUInt32BE(chunk.length - 12, 0)
  chunk.write('paDd', 4, 'ascii')
  chunk.writeUInt32BE(crc32(chunk.subarray(4, -4)), chunk.length - 4)

  return Buffer.concat([png.subarray(0, 33), chunk, png.subarray(33)])
}

test('PNG는 정확한 16 MiB를 허용하고 한 byte 초과와 비정규 base64를 거절한다', () => {
  const maximum = pngWithByteLength(16 * 1024 * 1024)
  const decoded = decodeUploadedPng(maximum.toString('base64'))
  assert.equal(decoded.png.length, 16 * 1024 * 1024)
  assert.deepEqual([...decoded.decoded.data], [24, 81, 190, 255])
  const oversized = pngWithByteLength(16 * 1024 * 1024 + 1)
  assert.throws(() => decodeUploadedPng(oversized.toString('base64')), { code: 'INVALID_INPUT' })
  const canonical = upload().originalPng
  for (const encoded of [
    `${canonical}\n`,
    `${canonical}=`,
    canonical.slice(0, -1),
    `data:image/png;base64,${canonical}`
  ]) {
    assert.throws(() => decodeUploadedPng(encoded), { code: 'INVALID_INPUT' })
  }
})

test('PNG는 축 8192와 총 16777216 pixels의 정확한 상한을 각각 적용한다', async (t) => {
  for (const { name, width, height, allowed } of [
    { name: '축 상한은 허용', width: 8192, height: 1, allowed: true },
    { name: '축 상한 한 pixel 초과는 거절', width: 8193, height: 1, allowed: false },
    { name: '전체 pixel 상한은 허용', width: 4096, height: 4096, allowed: true },
    { name: '축은 유효해도 전체 pixel 초과는 거절', width: 4096, height: 4097, allowed: false }
  ]) {
    await t.test(name, () => {
      const image = new PNG({ width, height })
      const bytes = PNG.sync.write(image)
      if (allowed) {
        const decoded = decodePng(bytes)
        assert.equal(decoded.width, width)
        assert.equal(decoded.height, height)
        assert.equal(decoded.data.length, width * height * 4)
      } else {
        assert.throws(() => decodePng(bytes), { code: 'INVALID_INPUT' })
      }
    })
  }
})

test('PNG의 CRC 손상, 잘린 종료, 종료 뒤 bytes는 입력 오류로 거절한다', async (t) => {
  const png = Buffer.from(upload().originalPng, 'base64')
  const corruptCrc = Buffer.from(png)
  corruptCrc[29] ^= 1
  for (const [name, bytes] of [
    ['IHDR CRC 손상', corruptCrc],
    ['잘린 IEND', png.subarray(0, -1)],
    ['IEND 뒤 추가 bytes', Buffer.concat([png, Buffer.from([0])])]
  ] as const) {
    await t.test(name, () => {
      assert.throws(() => decodePng(bytes), { code: 'INVALID_INPUT' })
    })
  }
})

test('크롭은 마지막 pixel까지 허용하고 정수, 양수 크기, 원본 범위, 중복 슬롯을 검사한다', async (t) => {
  const input = upload()
  const accepted = parseUpload({ ...input, crops: [{ slot: 4, x: 7, y: 3, width: 1, height: 1 }] })
  assert.deepEqual(accepted.capture.crops, [{ slot: 4, x: 7, y: 3, width: 1, height: 1 }])
  const image = new PNG({ width: 2, height: 2 })
  image.data.set([11, 12, 13, 255, 21, 22, 23, 255, 31, 32, 33, 255, 41, 42, 43, 255])
  const cropped = PNG.sync.read(cropPng(image, { slot: 1, x: 1, y: 1, width: 1, height: 1 }))
  assert.deepEqual([...cropped.data], [41, 42, 43, 255])
  const crop = { slot: 1, x: 0, y: 0, width: 8, height: 4 }
  for (const [name, change] of [
    ['음수 x', { x: -1 }],
    ['원본 밖 x', { x: 8, width: 1 }],
    ['원본 밖 y', { y: 4, height: 1 }],
    ['오른쪽 한 pixel 초과', { width: 9 }],
    ['아래쪽 한 pixel 초과', { height: 5 }],
    ['너비 0', { width: 0 }],
    ['높이 0', { height: 0 }],
    ['소수 좌표', { x: 0.5 }],
    ['문자열 좌표', { x: '0' }],
    ['안전한 정수 밖 좌표', { x: Number.MAX_SAFE_INTEGER + 1 }],
    ['슬롯 0', { slot: 0 }],
    ['hud 슬롯 5', { slot: 5 }]
  ] as const) {
    await t.test(name, () => {
      assert.throws(() => parseUpload({ ...input, crops: [{ ...crop, ...change }] }), {
        code: 'INVALID_INPUT'
      })
    })
  }
  assert.throws(() => parseUpload({ ...input, crops: [crop, crop] }), { code: 'INVALID_INPUT' })
})

test('캡처 식별자는 소문자 UUID만 받고 끝의 개행, 공백이나 비표준 생성 시각을 거절한다', async (t) => {
  const input = upload('00000000-0000-4000-8000-000000000001')
  for (const [name, change] of [
    ['UUID 끝 LF', { id: `${input.id}\n` }],
    ['UUID 끝 CR', { id: `${input.id}\r` }],
    ['UUID 끝 줄 구분자', { id: `${input.id}\u2028` }],
    ['UUID 끝 문단 구분자', { id: `${input.id}\u2029` }],
    ['UUID 끝 공백', { id: `${input.id} ` }],
    ['대문자 UUID', { id: 'AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA' }],
    ['밀리초 없는 시각', { capturedAt: '2026-09-25T00:00:00Z' }],
    ['UTC가 아닌 시각 표기', { capturedAt: '2026-09-25T09:00:00.000+09:00' }],
    ['존재하지 않는 날짜', { capturedAt: '2026-02-30T00:00:00.000Z' }]
  ] as const) {
    await t.test(name, () => {
      assert.throws(() => parseUpload({ ...input, ...change }), { code: 'INVALID_INPUT' })
    })
  }
})
