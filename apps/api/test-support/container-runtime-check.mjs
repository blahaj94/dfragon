import assert from 'node:assert/strict'
import { writeFileSync, existsSync } from 'node:fs'
import { setTimeout } from 'node:timers/promises'
assert.equal(process.getuid(), 1000)
assert.equal(process.getgid(), 1000)
assert.throws(() => writeFileSync('/app/write-probe', ''), { code: 'EROFS' })
for (const path of ['/app/src', '/app/test-support', '/run/secrets/db_password']) {
  assert.equal(existsSync(path), false)
}
let response
for (let attempt = 0; attempt < 30; attempt++) {
  try {
    response = await fetch('http://127.0.0.1:3000/', { signal: AbortSignal.timeout(1000) })
    break
  } catch {
    await setTimeout(200)
  }
}
assert.equal(response?.status, 404)
assert.equal(
  (await fetch('http://127.0.0.1:3000/health', { signal: AbortSignal.timeout(1000) })).status,
  200
)
assert.equal(
  (await fetch('http://127.0.0.1:3000/me', { signal: AbortSignal.timeout(1000) })).status,
  404
)
assert.equal(existsSync('/run/secrets/auth_config'), false)
