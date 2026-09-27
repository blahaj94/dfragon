import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { chromium } from 'playwright'
import { createAccountsRuntime } from '../dist/runtime/application.js'
import { createAccessJwtIssuer, createAccessJwtVerifier } from '../dist/auth/access-jwt/index.js'
import { challenge } from '../dist/auth/login/crypto.js'
import { authenticationConfiguration, unusedRuntimePort } from './runtime-fixtures.mjs'
import { command } from './docker-postgres.mjs'

export async function assertPasskeyMigration(source, mark = () => {}) {
  const directory = await mkdtemp(join(tmpdir(), 'dfragon-rp-migration-'))
  let runtime, browser, userId
  try {
    const key = join(directory, 'key.pem'),
      cert = join(directory, 'cert.pem')
    assert.equal(
      (
        await command('openssl', [
          'req',
          '-x509',
          '-newkey',
          'rsa:2048',
          '-nodes',
          '-keyout',
          key,
          '-out',
          cert,
          '-days',
          '1',
          '-subj',
          '/CN=localhost'
        ])
      ).code,
      0
    )
    const port = await unusedRuntimePort(),
      loopback = `https://localhost:${port}`
    const legacy = `https://api.localhost:${port}`,
      primary = `https://accounts.localhost:${port}`
    const jwt = authenticationConfiguration().accessJwt
    const issueAccessJwt = await createAccessJwtIssuer(jwt),
      verifyAccessJwt = await createAccessJwtVerifier(jwt)
    const configuration = {
      apiOrigin: primary,
      rpId: 'accounts.localhost',
      rpName: 'DFRAGON',
      returnUrl: 'dfragon.dev://auth/callback',
      legacyOrigin: legacy
    }
    const start = async (configuration) => {
      runtime = await createAccountsRuntime({
        database: source.options,
        port,
        configuration,
        issueAccessJwt,
        verifyAccessJwt,
        localHttps: { key: await readFile(key), cert: await readFile(cert) }
      })
      await runtime.app.listen(port, '127.0.0.1')
    }
    await start({
      ...configuration,
      apiOrigin: legacy,
      rpId: 'api.localhost',
      legacyOrigin: undefined
    })
    browser = await chromium.launch({
      headless: true,
      args: ['--host-resolver-rules=MAP *.localhost 127.0.0.1']
    })
    const context = await browser.newContext({ ignoreHTTPSErrors: true }),
      page = await context.newPage()
    context.setDefaultTimeout(10000)
    const cdp = await context.newCDPSession(page)
    await cdp.send('WebAuthn.enable')
    await cdp.send('WebAuthn.addVirtualAuthenticator', {
      options: {
        protocol: 'ctap2',
        ctap2Version: 'ctap2_1',
        transport: 'internal',
        hasResidentKey: true,
        hasUserVerification: true,
        isUserVerified: true,
        automaticPresenceSimulation: true
      }
    })
    const begin = async (view = page) => {
      const codeVerifier = randomBytes(32).toString('base64url')
      const response = await context.request.post(`${loopback}/auth/login-requests`, {
        data: {
          provider: 'passkey',
          clientId: 'desktop',
          codeChallenge: challenge(codeVerifier),
          codeChallengeMethod: 'S256'
        }
      })
      assert.equal(response.status(), 201)
      const request = await response.json()
      await view.goto(request.browserUrl)
      return { requestId: request.requestId, clientId: 'desktop', codeVerifier }
    }
    const post = (view, action, extra = {}) =>
      view.evaluate(
        async ({ action, extra }) => {
          const requestId = globalThis.document.querySelector('main').dataset.requestId
          const response = await fetch(`/auth/passkeys/${action}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ requestId, ...extra })
          })
          return { status: response.status, body: await response.json() }
        },
        { action, extra }
      )
    const exchange = async (request, url) => {
      const response = await context.request.post(`${loopback}/auth/exchange`, {
        data: { ...request, code: new URL(url).searchParams.get('code') }
      })
      assert.equal(response.status(), 200)
      return response.json()
    }
    const completeUrl = async () => {
      await page.locator('#complete').waitFor({ state: 'visible', timeout: 10000 })
      return page.locator('#return').getAttribute('href')
    }
    mark('prepare existing old-RP account with a real browser credential')
    const initial = await begin()
    await page.locator('#register').click()
    await page.locator('#signup-passkey').click()
    userId = (await exchange(initial, await completeUrl())).user.id
    runtime.app.getHttpServer().closeAllConnections()
    await runtime.close()
    runtime = undefined
    await start(configuration)
    const enterLegacy = async (view = page) => {
      mark('legacy entry button')
      await view
        .getByRole('button', { name: '이전 주소에서 만든 패스키로 로그인', exact: true })
        .click()
      try {
        await view.getByRole('button', { name: '기존 패스키로 인증', exact: true }).waitFor()
      } catch {
        throw new Error('Legacy entry: ' + (await view.locator('body').innerText()))
      }
      assert.equal(new URL(view.url()).origin, legacy)
    }
    const proveLegacy = async () => {
      mark('legacy WebAuthn proof')
      await page.getByRole('button', { name: '기존 패스키로 인증', exact: true }).click()
      await page.getByRole('button', { name: '새 주소의 패스키 추가', exact: true }).waitFor()
      assert.equal(new URL(page.url()).origin, primary)
    }
    mark('two actual origins preserve initiating cookie and same UUID; old key remains usable')
    const migrating = await begin()
    await enterLegacy()
    const departedUrl = page.url()
    const wrongOrigin = await context.request.post(`${loopback}/auth/passkeys/legacy-options`, {
      headers: { Origin: primary },
      data: { requestId: migrating.requestId }
    })
    assert.equal(wrongOrigin.status(), 400)
    await proveLegacy()
    const returnedUrl = page.url()
    assert.equal(
      (
        await context.request.get(
          `${loopback}${new URL(departedUrl).pathname}${new URL(departedUrl).search}`,
          { headers: { Host: new URL(legacy).host } }
        )
      ).status(),
      400
    )
    assert.equal(
      (
        await context.request.get(
          `${loopback}${new URL(returnedUrl).pathname}${new URL(returnedUrl).search}`,
          { headers: { Host: new URL(primary).host } }
        )
      ).status(),
      400
    )
    if (process.env.DFRAGON_PASSKEY_ARTIFACTS) {
      await page.screenshot({
        path: join(process.env.DFRAGON_PASSKEY_ARTIFACTS, 'passkey-migrate.png'),
        fullPage: true
      })
    }
    await page.getByRole('button', { name: '새 주소의 패스키 추가', exact: true }).click()
    const migrated = await exchange(migrating, await completeUrl())
    assert.equal(migrated.user.id, userId)
    assert.equal(migrated.isNewUser, false)
    assert.deepEqual(
      (
        await source.query('SELECT rp_id FROM auth_passkeys WHERE user_id=$1 ORDER BY rp_id', [
          userId
        ])
      ).map((r) => r.rp_id),
      ['accounts.localhost', 'api.localhost']
    )
    const normal = await begin()
    await page.locator('#authenticate').click()
    assert.equal((await exchange(normal, await completeUrl())).user.id, userId)
    mark('migration may be deferred without creating another account')
    const deferred = await begin()
    await enterLegacy()
    await proveLegacy()
    await page.getByRole('button', { name: '지금은 기존 패스키로 계속', exact: true }).click()
    assert.equal((await exchange(deferred, await completeUrl())).user.id, userId)
    assert.equal(
      (
        await source.query('SELECT count(*)::int AS n FROM auth_passkeys WHERE user_id=$1', [
          userId
        ])
      )[0].n,
      2
    )
    mark(
      'return ticket without original accounts cookie cannot advance; correct browser can still consume it'
    )
    await begin()
    await enterLegacy()
    let intercepted = false
    await page.route('**/auth/login/migrate?*', async (route) => {
      const url = new URL(route.request().url())
      const stolen = await context.request.get(`${loopback}${url.pathname}${url.search}`, {
        headers: { Host: url.host }
      })
      assert.equal(stolen.status(), 400)
      intercepted = true
      await route.continue()
    })
    await proveLegacy()
    assert.equal(intercepted, true)
    await page.unroute('**/auth/login/migrate?*')
    mark('deleting the proved old key prevents enrollment and session issuance')
    const oldKey = (
      await source.query('SELECT * FROM auth_passkeys WHERE user_id=$1 AND rp_id=$2', [
        userId,
        'api.localhost'
      ])
    )[0]
    await source.query('DELETE FROM auth_passkeys WHERE id=$1', [oldKey.id])
    assert.equal((await post(page, 'migration-skip')).status, 400)
    assert.equal((await post(page, 'migration-options')).status, 400)
    // Restore the synthetic credential for phone tests, preserving all recorded counters.
    const columns = Object.keys(oldKey)
    await source.query(
      `INSERT INTO auth_passkeys (${columns.join(',')}) VALUES (${columns.map((_, i) => `$${i + 1}`).join(',')})`,
      columns.map((c) => (c === 'transports' ? JSON.stringify(oldKey[c]) : oldKey[c]))
    )
    await post(page, 'cancel')
    const pcContext = await browser.newContext({ ignoreHTTPSErrors: true }),
      pc = await pcContext.newPage()
    pcContext.setDefaultTimeout(10000)
    await pc.clock.install()
    await pc.clock.pauseAt(new Date())
    const beginPhone = async () => {
      const request = await begin(pc)
      const qrResponse = pc.waitForResponse((r) => r.url().endsWith('/auth/passkeys/qr'))
      await pc.locator('#qr-start').click()
      const qr = await (await qrResponse).json()
      await page.goto(qr.phoneUrl)
      return request
    }
    mark('phone migration retains explicit phone approval and PC code proof')
    const phoneRequest = await beginPhone()
    await enterLegacy()
    await proveLegacy()
    await page.getByRole('button', { name: '지금은 기존 패스키로 계속', exact: true }).click()
    await page.locator('#approve').waitFor()
    assert.equal((await post(pc, 'claim')).status, 400)
    await page.locator('#approve').click()
    await page.locator('#phone-approved').waitFor()
    const claimed = await post(pc, 'claim')
    assert.equal(claimed.status, 200)
    assert.equal((await exchange(phoneRequest, claimed.body.returnUrl)).user.id, userId)
    mark('canceling either phone WebAuthn ceremony terminates the request')
    for (const stage of ['legacy', 'enrolling']) {
      const pending = await beginPhone()
      await enterLegacy()
      if (stage === 'enrolling') {
        await proveLegacy()
      }
      await page.evaluate((stage) => {
        navigator.credentials[stage === 'legacy' ? 'get' : 'create'] = () =>
          Promise.reject(new DOMException('Cancelled', 'NotAllowedError'))
      }, stage)
      await page
        .getByRole('button', {
          name: stage === 'legacy' ? '기존 패스키로 인증' : '새 주소의 패스키 추가',
          exact: true
        })
        .click()
      await page.locator('#phone-canceled').waitFor()
      assert.equal(
        (
          await source.query('SELECT status FROM auth_login_requests WHERE id=$1', [
            pending.requestId
          ])
        )[0].status,
        'failed'
      )
      assert.equal((await post(pc, 'claim')).status, 400)
    }
    await pcContext.close()
    assert.equal(
      (await source.query('SELECT count(*)::int AS n FROM users WHERE id=$1', [userId]))[0].n,
      1
    )
  } finally {
    await browser?.close()
    runtime?.app.getHttpServer().closeAllConnections()
    await runtime?.close()
    if (userId) {
      await source.query('DELETE FROM users WHERE id=$1', [userId])
    }
    await rm(directory, { recursive: true, force: true })
  }
}
