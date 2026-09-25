import { assertPhoneQrIntegration } from './phone-qr-integration.mjs'
import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { chromium } from 'playwright'
import { createApiRuntime } from '../dist/runtime/application.js'
import { createAccessJwtIssuer, createAccessJwtVerifier } from '../dist/auth/access-jwt/index.js'
import { createLoginService } from '../dist/auth/login/service.js'
import { challenge } from '../dist/auth/login/crypto.js'
import { authenticationConfiguration, unusedRuntimePort } from './runtime-fixtures.mjs'
import { command } from './docker-postgres.mjs'

export async function assertPasskeyIntegration(source, mark = () => {}) {
  const directory = await mkdtemp(join(tmpdir(), 'dfragon-passkey-browser-'))
  let runtime, browser
  try {
    const keyFile = join(directory, 'key.pem'),
      certFile = join(directory, 'cert.pem')
    assert.equal(
      (
        await command('openssl', [
          'req',
          '-x509',
          '-newkey',
          'rsa:2048',
          '-nodes',
          '-keyout',
          keyFile,
          '-out',
          certFile,
          '-days',
          '1',
          '-subj',
          '/CN=localhost'
        ])
      ).code,
      0
    )
    const port = await unusedRuntimePort(),
      origin = `https://localhost:${port}`
    const configuration = {
      apiOrigin: origin,
      rpId: 'localhost',
      rpName: 'DFRAGON',
      returnUrl: 'dfragon.dev://auth/callback',
      ocrReturnUrl: 'https://ocr.example.test/auth/callback'
    }
    const jwt = authenticationConfiguration().accessJwt
    const issueAccessJwt = await createAccessJwtIssuer(jwt),
      verifyAccessJwt = await createAccessJwtVerifier(jwt)
    runtime = await createApiRuntime({
      database: source.options,
      port,
      configuration,
      issueAccessJwt,
      verifyAccessJwt,
      apiKey: 'isolated-unused-key',
      localHttps: { key: await readFile(keyFile), cert: await readFile(certFile) }
    })
    await runtime.app.listen(port, '127.0.0.1')
    browser = await chromium.launch({ headless: true })
    await assertPhoneQrIntegration({ source, browser, origin, mark })
    const context = await browser.newContext({
        ignoreHTTPSErrors: true,
        viewport: { width: 1100, height: 850 }
      }),
      page = await context.newPage()
    const cdp = await context.newCDPSession(page)
    await cdp.send('WebAuthn.enable')
    const newAuthenticator = async () =>
      (
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
      ).authenticatorId
    let authenticator = await newAuthenticator()
    const post = (path, body, headers = {}) =>
      context.request.post(`${origin}${path}`, { data: body, headers })
    const begin = async (clientId = 'desktop') => {
      const codeVerifier = randomBytes(32).toString('base64url')
      const response = await post('/auth/login-requests', {
        provider: 'passkey',
        clientId,
        codeChallenge: challenge(codeVerifier),
        codeChallengeMethod: 'S256'
      })
      assert.equal(response.status(), 201)
      const request = await response.json()
      await page.goto(request.browserUrl)
      return { requestId: request.requestId, clientId, codeVerifier }
    }
    const complete = async (input, button = 'authenticate') => {
      await page.locator(`#${button}`).click()
      try {
        await page.locator('#complete').waitFor({ state: 'visible', timeout: 10000 })
      } catch {
        throw new Error('Passkey UI: ' + (await page.locator('#status').textContent()))
      }
      return {
        ...input,
        code: new URL(await page.locator('#return').getAttribute('href')).searchParams.get('code')
      }
    }
    const browserPost = (action, body, overrideOrigin = origin) =>
      post(`/auth/passkeys/${action}`, body, { Origin: overrideOrigin })
    const idOnPage = () => page.locator('main').getAttribute('data-request-id')
    const assertion = () =>
      page.evaluate(async () => {
        const requestId = globalThis.document.querySelector('main').dataset.requestId
        const res = await fetch('/auth/passkeys/options', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ requestId, operation: 'authenticate' })
        })
        const options = await res.json()
        if (!res.ok) {
          throw new Error('Options failed')
        }
        const key = await navigator.credentials.get({
          publicKey: globalThis.PublicKeyCredential.parseRequestOptionsFromJSON(options)
        })
        return { requestId, response: key.toJSON() }
      })
    mark('signup through actual browser bundle and WebAuthn verifier')
    const first = await begin()
    const usersBeforeSignup = await source.query('SELECT count(*)::int AS n FROM users')
    await page.locator('#register').click()
    await page.locator('#signup-heading').waitFor({ state: 'visible' })
    assert.equal(
      await page
        .locator('#signup-heading')
        .evaluate((el) => el === globalThis.document.activeElement),
      true
    )
    assert.deepEqual(await source.query('SELECT count(*)::int AS n FROM users'), usersBeforeSignup)
    await page.evaluate(() => {
      const create = navigator.credentials.create.bind(navigator.credentials)
      navigator.credentials.create = () => {
        navigator.credentials.create = create
        return Promise.reject(new DOMException('Cancelled', 'NotAllowedError'))
      }
    })
    await page.locator('#signup-passkey').click()
    await page
      .getByText('인증이 취소되었거나 시간이 지났습니다. 다시 시도해 주세요.', { exact: true })
      .waitFor()
    assert.equal(await page.locator('#signup').isVisible(), true)
    assert.deepEqual(await source.query('SELECT count(*)::int AS n FROM users'), usersBeforeSignup)
    if (process.env.DFRAGON_PASSKEY_ARTIFACTS) {
      await page.screenshot({
        path: join(process.env.DFRAGON_PASSKEY_ARTIFACTS, 'passkey-signup.png'),
        fullPage: true
      })
    }
    const registered = await complete(first, 'signup-passkey')
    const exchanges = await Promise.all([
      post('/auth/exchange', registered),
      post('/auth/exchange', registered)
    ])
    assert.deepEqual(exchanges.map((r) => r.status()).sort(), [200, 400])
    const tokens = await exchanges.find((r) => r.status() === 200).json(),
      userId = tokens.user.id
    assert.equal(tokens.isNewUser, true)
    assert.equal(
      (await verifyAccessJwt(tokens.accessToken, Math.floor(Date.now() / 1000))).userId,
      userId
    )
    assert.equal(
      (
        await context.request.get(`${origin}/me`, {
          headers: { authorization: `Bearer ${tokens.accessToken}` }
        })
      ).status(),
      200
    )
    const rotated = await post('/auth/refresh', { refreshToken: tokens.refreshToken })
    assert.equal(rotated.status(), 200)
    const refreshToken = (await rotated.json()).refreshToken
    assert.equal((await post('/auth/logout', { refreshToken })).status(), 204)
    assert.equal((await post('/auth/refresh', { refreshToken })).status(), 401)
    mark('existing passkey returns same account; removed OAuth rejected')
    const second = await complete(await begin()),
      existing = await post('/auth/exchange', second)
    assert.equal(existing.status(), 200)
    assert.equal((await existing.json()).user.id, userId)
    assert.equal((await context.request.get(`${origin}/auth/callback/google`)).status(), 404)
    assert.equal(
      (
        await post('/auth/login-requests', {
          provider: 'google',
          clientId: 'desktop',
          codeChallenge: challenge(first.codeVerifier),
          codeChallengeMethod: 'S256'
        })
      ).status(),
      400
    )
    mark('OCR browser return uses the existing passkey and binds the exchange to its client')
    await context.route('https://ocr.example.test/auth/callback?*', (route) =>
      route.fulfill({ status: 200, contentType: 'text/html', body: '<p>OCR callback</p>' })
    )
    const ocrRequest = await begin('ocr')
    await page.locator('#authenticate').click()
    await page.waitForURL('https://ocr.example.test/auth/callback?*')
    const ocrExchange = { ...ocrRequest, code: new URL(page.url()).searchParams.get('code') }
    assert.equal(
      (await post('/auth/exchange', { ...ocrExchange, clientId: 'desktop' })).status(),
      400
    )
    const ocrTokens = await post('/auth/exchange', ocrExchange)
    assert.equal(ocrTokens.status(), 200)
    const ocrIdentity = await ocrTokens.json()
    assert.equal(ocrIdentity.user.id, userId)
    assert.equal((await post('/auth/exchange', ocrExchange)).status(), 400)
    await post('/auth/logout', { refreshToken: ocrIdentity.refreshToken })
    await context.unroute('https://ocr.example.test/auth/callback?*')
    mark('wrong origin, handle, signature and replay refused')
    await begin()
    for (const tamper of [
      (body) => {
        body.response.response.userHandle = Buffer.from('wrong-user').toString('base64url')
      },
      (body) => {
        body.response.response.signature = Buffer.alloc(64).toString('base64url')
      },
      (body) => {
        const client = JSON.parse(Buffer.from(body.response.response.clientDataJSON, 'base64url'))
        client.origin = 'https://attacker.invalid'
        body.response.response.clientDataJSON = Buffer.from(JSON.stringify(client)).toString(
          'base64url'
        )
      }
    ]) {
      const body = await assertion()
      tamper(body)
      assert.equal((await browserPost('verify', body)).status(), 400)
      assert.equal((await browserPost('verify', body)).status(), 400)
    }
    const body = await assertion()
    assert.equal((await browserPost('verify', body, 'https://attacker.invalid')).status(), 400)
    assert.equal((await browserPost('verify', body)).status(), 200)
    assert.equal((await browserPost('verify', body)).status(), 400)
    mark('management requires reauth; last key preserved; backup belongs to same account')
    await page.goto(`${origin}/auth/passkeys/manage`)
    const managementId = await idOnPage()
    assert.equal((await browserPost('list', { requestId: managementId })).status(), 400)
    await page.locator('#authenticate').click()
    await page.locator('#management').waitFor({ state: 'visible' })
    const firstKey = (await (await browserPost('list', { requestId: managementId })).json()).keys[0]
    assert.equal(
      (
        await browserPost('remove', { requestId: managementId, credentialId: firstKey.id })
      ).status(),
      400
    )
    const credentials = (
      await cdp.send('WebAuthn.getCredentials', { authenticatorId: authenticator })
    ).credentials
    await cdp.send('WebAuthn.removeVirtualAuthenticator', { authenticatorId: authenticator })
    authenticator = await newAuthenticator()
    await page.locator('#add').click()
    await page.getByText('예비 패스키를 추가했습니다.', { exact: true }).waitFor()
    const keys = (await (await browserPost('list', { requestId: managementId })).json()).keys
    assert.equal(keys.length, 2)
    const backupKey = keys.find((key) => key.id !== firstKey.id)
    assert.equal(
      (
        await source.query(
          'SELECT count(DISTINCT user_id)::int AS count FROM auth_passkeys WHERE id=ANY($1)',
          [[firstKey.id, backupKey.id]]
        )
      )[0].count,
      1
    )
    if (process.env.DFRAGON_PASSKEY_ARTIFACTS) {
      await page.screenshot({
        path: join(process.env.DFRAGON_PASSKEY_ARTIFACTS, 'passkey-management.png'),
        fullPage: true
      })
    }
    mark('deleted key cannot exchange pending app code')
    const pendingBackup = await complete(await begin())
    assert.equal(
      (
        await browserPost('remove', { requestId: managementId, credentialId: backupKey.id })
      ).status(),
      200
    )
    assert.equal((await post('/auth/exchange', pendingBackup)).status(), 400)
    await cdp.send('WebAuthn.removeVirtualAuthenticator', { authenticatorId: authenticator })
    authenticator = await newAuthenticator()
    for (const credential of credentials) {
      await cdp.send('WebAuthn.addCredential', { authenticatorId: authenticator, credential })
    }
    await page.goto(`${origin}/auth/passkeys/manage`)
    const otherId = await idOnPage()
    await page.locator('#authenticate').click()
    await page.locator('#management').waitFor({ state: 'visible' })
    await cdp.send('WebAuthn.removeVirtualAuthenticator', { authenticatorId: authenticator })
    authenticator = await newAuthenticator()
    await page.locator('#add').click()
    await page.getByText('예비 패스키를 추가했습니다.', { exact: true }).waitFor()
    mark('deleting authenticating key ends every management grant using it')
    assert.equal(
      (await browserPost('remove', { requestId: otherId, credentialId: firstKey.id })).status(),
      200
    )
    assert.equal((await browserPost('list', { requestId: managementId })).status(), 400)
    assert.equal((await browserPost('list', { requestId: otherId })).status(), 400)
    mark('expired code and wrong app verifier refused; terminal proofs cleared')
    const pending = await complete(await begin())
    assert.equal(
      (
        await post('/auth/exchange', {
          ...pending,
          codeVerifier: randomBytes(32).toString('base64url')
        })
      ).status(),
      400
    )
    await source.query(
      "UPDATE auth_login_requests SET code_expires_at=clock_timestamp()-interval '1 second' WHERE id=$1",
      [pending.requestId]
    )
    assert.equal((await post('/auth/exchange', pending)).status(), 400)
    const rows = await source.query(
      "SELECT code_challenge,browser_binding_hash,credential_id,webauthn_challenge,exchange_code_hash FROM auth_login_requests WHERE status='consumed'"
    )
    assert(rows.every((row) => Object.values(row).every((value) => value === null)))
    const service = createLoginService({ dataSource: source, configuration, issueAccessJwt })
    const request = await service.create({
      provider: 'passkey',
      clientId: 'desktop',
      codeChallenge: challenge(first.codeVerifier),
      codeChallengeMethod: 'S256'
    })
    const changed = createLoginService({
      dataSource: source,
      configuration: { ...configuration, rpName: 'Changed' },
      issueAccessJwt
    })
    await assert.rejects(() =>
      changed.authorize(new URL(request.browserUrl).searchParams.get('ticket'))
    )
    await source.query('DELETE FROM users WHERE id=$1', [userId])
  } finally {
    await browser?.close()
    await runtime?.close()
    await rm(directory, { recursive: true, force: true })
  }
}
