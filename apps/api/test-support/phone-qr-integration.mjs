import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { challenge } from '../dist/auth/login/crypto.js'

export async function assertPhoneQrIntegration({ source, browser, origin, mark }) {
  const pc = await browser.newContext({ ignoreHTTPSErrors: true })
  // A PC without WebAuthn must still be able to start signup on a phone.
  await pc.addInitScript(() => {
    globalThis.PublicKeyCredential = undefined
  })
  const phone = await browser.newContext({
    ignoreHTTPSErrors: true,
    viewport: { width: 390, height: 844 }
  })
  const pcPage = await pc.newPage(),
    phonePage = await phone.newPage()
  let userId
  const cdp = await phone.newCDPSession(phonePage)
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
  const post = (context, action, requestId, rest = {}, requestOrigin = origin) =>
    context.request.post(`${origin}/auth/passkeys/${action}`, {
      headers: { Origin: requestOrigin },
      data: { requestId, ...rest }
    })
  const begin = async (signup = false) => {
    const codeVerifier = randomBytes(32).toString('base64url')
    const created = await pc.request.post(`${origin}/auth/login-requests`, {
      data: {
        provider: 'passkey',
        clientId: 'desktop',
        codeChallenge: challenge(codeVerifier),
        codeChallengeMethod: 'S256'
      }
    })
    assert.equal(created.status(), 201)
    const request = await created.json()
    await pcPage.goto(request.browserUrl)
    const qrResponse = pcPage.waitForResponse((r) => r.url().endsWith('/auth/passkeys/qr'))
    if (signup) {
      await pcPage.locator('#register').click()
      assert.equal(await pcPage.locator('#signup-passkey').isDisabled(), true)
      await pcPage.locator('#signup-phone').click()
    } else {
      await pcPage.locator('#qr-start').click()
    }
    const qr = await (await qrResponse).json()
    await pcPage.locator('#qr-panel').waitFor({ state: 'visible' })
    assert.equal(await pcPage.locator('#confirmation').textContent(), qr.confirmationCode)
    return { ...request, ...qr, codeVerifier }
  }
  const phoneVerify = async (request, operation = 'authenticate') => {
    assert.equal((await phonePage.goto(request.phoneUrl)).status(), 200)
    assert.equal(
      await phonePage.locator('#phone-confirmation').textContent(),
      request.confirmationCode
    )
    await phonePage.locator(`#${operation}`).click()
    if (operation === 'register') {
      await phonePage.locator('#signup-passkey').click()
    }
    await phonePage.locator('#phone-consent').waitFor({ state: 'visible' })
  }
  const approve = async () => {
    await phonePage.locator('#approve').click()
    await phonePage.getByText('승인했습니다.', { exact: false }).waitFor()
  }
  const exchange = (request, code) =>
    pc.request.post(`${origin}/auth/exchange`, {
      data: {
        requestId: request.requestId,
        clientId: 'desktop',
        codeVerifier: request.codeVerifier,
        code
      }
    })
  try {
    mark('QR signup: separate PC/phone cookies, explicit approvals, PKCE exchange')
    const first = await begin(true)
    assert.equal((await post(phone, 'claim', first.requestId)).status(), 400)
    assert.equal((await post(pc, 'phone-approve', first.requestId)).status(), 400)
    assert.equal(
      (await post(pc, 'qr', first.requestId, {}, 'https://untrusted.invalid')).status(),
      400
    )
    // HEAD cannot consume the QR, and a ticket is single use.
    assert.equal((await phone.request.head(first.phoneUrl)).status(), 400)
    await phoneVerify(first, 'register')
    userId = (
      await source.query('SELECT verified_user_id AS id FROM auth_login_requests WHERE id=$1', [
        first.requestId
      ])
    )[0].id
    assert.equal((await pc.request.get(first.phoneUrl)).status(), 400)
    assert.equal((await post(pc, 'claim', first.requestId)).status(), 400)
    assert.equal((await post(phone, 'claim', first.requestId)).status(), 400)
    assert.equal(
      (
        await source.query('SELECT count(*)::int AS n FROM auth_sessions WHERE user_id=$1', [
          userId
        ])
      )[0].n,
      0
    )
    await approve()
    await pcPage.locator('#pc-consent').waitFor({ state: 'visible', timeout: 12000 })
    await pcPage.locator('#claim').click()
    await pcPage.locator('#complete').waitFor({ state: 'visible' })
    const code = new URL(await pcPage.locator('#return').getAttribute('href')).searchParams.get(
      'code'
    )
    const results = await Promise.all([exchange(first, code), exchange(first, code)])
    assert.deepEqual(results.map((r) => r.status()).sort(), [200, 400])
    assert.equal((await results.find((r) => r.status() === 200).json()).user.id, userId)
    assert.equal((await post(pc, 'claim', first.requestId)).status(), 400)

    mark('QR login: same account, PC approval single use')
    const again = await begin()
    await phoneVerify(again)
    await approve()
    const claims = await Promise.all([
      post(pc, 'claim', again.requestId),
      post(pc, 'claim', again.requestId)
    ])
    assert.deepEqual(claims.map((r) => r.status()).sort(), [200, 400])
    const callback = await claims.find((r) => r.status() === 200).json()
    const signedIn = await exchange(again, new URL(callback.returnUrl).searchParams.get('code'))
    assert.equal(signedIn.status(), 200)
    assert.equal((await signedIn.json()).user.id, userId)

    mark('QR reissue and cancellation invalidate previous phone authorization')
    const replaced = await begin()
    await phoneVerify(replaced)
    const newQr = await (await post(pc, 'qr', replaced.requestId)).json()
    assert.equal((await post(phone, 'phone-approve', replaced.requestId)).status(), 400)
    assert.equal((await phone.request.get(replaced.phoneUrl)).status(), 400)
    await phoneVerify({ ...replaced, ...newQr })
    assert.equal((await post(pc, 'cancel', replaced.requestId)).status(), 200)
    assert.equal((await post(phone, 'phone-approve', replaced.requestId)).status(), 400)
    assert.equal((await post(pc, 'claim', replaced.requestId)).status(), 400)

    mark('QR expiry and removed passkey cannot issue app login code')
    const expired = await begin()
    await source.query(
      "UPDATE auth_login_requests SET created_at=clock_timestamp()-interval '20 minutes', expires_at=clock_timestamp()-interval '1 second' WHERE id=$1",
      [expired.requestId]
    )
    assert.equal((await phone.request.get(expired.phoneUrl)).status(), 400)
    const removed = await begin()
    await phoneVerify(removed)
    await approve()
    await source.query('DELETE FROM auth_passkeys WHERE user_id=$1', [userId])
    assert.equal((await post(pc, 'claim', removed.requestId)).status(), 400)
    const terminal = await source.query(
      'SELECT qr_ticket_hash, phone_binding_hash, confirmation_code FROM auth_login_requests WHERE id=ANY($1::uuid[])',
      [[first.requestId, replaced.requestId]]
    )
    assert(terminal.every((row) => Object.values(row).every((value) => value === null)))
  } finally {
    await pc.close()
    await phone.close()
    if (userId) {
      await source.query('DELETE FROM users WHERE id=$1', [userId])
    }
  }
}
