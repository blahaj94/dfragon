import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { join } from 'node:path'
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
  await pcPage.clock.install()
  await pcPage.clock.pauseAt(new Date())
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
    await pcPage.clock.setSystemTime(new Date())
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
    assert.match(await pcPage.locator('#qr-expiry').textContent(), /분 \d+초까지 인증 가능해요/)
    assert.equal(await pcPage.locator('#direct').count(), 0)
    return { ...request, ...qr, codeVerifier }
  }
  const phoneVerify = async (request, operation = 'authenticate') => {
    assert.equal((await phonePage.goto(request.phoneUrl)).status(), 200)
    assert.equal(
      await phonePage.locator('#phone-confirmation').textContent(),
      request.confirmationCode
    )
    assert.equal(await phonePage.locator('#cancel').count(), 0)
    await phonePage.locator(`#${operation}`).click()
    await phonePage.locator('#phone-consent').waitFor({ state: 'visible' })
    assert.equal(await phonePage.locator('#signup').count(), 0)
    assert.equal(await phonePage.locator('#cancel').count(), 0)
    assert.match(await phonePage.locator('#phone-account').textContent(), / 님이 맞으신가요\?$/)
  }
  const approve = async () => {
    await phonePage.locator('#approve').click()
    await phonePage.locator('#phone-approved').waitFor()
    assert.equal(await phonePage.locator('#phone-approved h1').textContent(), '로그인 성공!')
    assert.equal(await phonePage.locator('#phone-confirmation').count(), 0)
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
    mark('QR signup: phone approval, automatic PC claim, separate cookies and PKCE exchange')
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
    await pcPage.clock.runFor(5000)
    assert.equal(await pcPage.locator('#complete').count(), 0)
    if (process.env.DFRAGON_PASSKEY_ARTIFACTS) {
      for (const colorScheme of ['light', 'dark']) {
        await phonePage.emulateMedia({ colorScheme })
        await phonePage.screenshot({
          path: join(process.env.DFRAGON_PASSKEY_ARTIFACTS, `phone-consent-${colorScheme}.png`)
        })
      }
    }
    await approve()
    await pcPage.clock.runFor(5000)
    await pcPage.locator('#complete').waitFor({ state: 'visible' })
    assert.equal(await pcPage.locator('#claim').count(), 0)
    assert.equal((await pcPage.locator('#return').textContent()).trim(), '돌아가기')
    if (process.env.DFRAGON_PASSKEY_ARTIFACTS) {
      await phonePage.screenshot({
        path: join(process.env.DFRAGON_PASSKEY_ARTIFACTS, 'phone-approved.png')
      })
      await pcPage.screenshot({
        path: join(process.env.DFRAGON_PASSKEY_ARTIFACTS, 'phone-pc-return.png')
      })
    }
    const code = new URL(await pcPage.locator('#return').getAttribute('href')).searchParams.get(
      'code'
    )
    const results = await Promise.all([exchange(first, code), exchange(first, code)])
    assert.deepEqual(results.map((r) => r.status()).sort(), [200, 400])
    assert.equal((await results.find((r) => r.status() === 200).json()).user.id, userId)
    assert.equal((await post(pc, 'claim', first.requestId)).status(), 400)

    mark('QR login: same account, PC claim single use')
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

    mark('stale approved status cannot claim after QR reissue')
    const stale = await begin()
    await phoneVerify(stale)
    await approve()
    const intercepted = Promise.withResolvers()
    const release = Promise.withResolvers()
    let claimCount = 0
    const countClaim = (request) => {
      if (request.url().endsWith('/auth/passkeys/claim')) {
        claimCount += 1
      }
    }
    pcPage.on('request', countClaim)
    await pcPage.route(
      '**/auth/passkeys/status',
      async (route) => {
        const response = await route.fetch()
        intercepted.resolve()
        await release.promise
        await route.fulfill({ response })
      },
      { times: 1 }
    )
    await pcPage.clock.runFor(5000)
    await intercepted.promise
    const replacementResponse = pcPage.waitForResponse((r) => r.url().endsWith('/auth/passkeys/qr'))
    await pcPage.locator('#qr-start').click()
    const replacement = await (await replacementResponse).json()
    const staleStatus = pcPage.waitForResponse((r) => r.url().endsWith('/auth/passkeys/status'))
    release.resolve()
    await staleStatus
    await pcPage.clock.runFor(5000)
    assert.equal(claimCount, 0)
    assert.equal(await pcPage.locator('#complete').count(), 0)
    await phoneVerify({ ...stale, ...replacement })
    await approve()
    await pcPage.clock.runFor(5000)
    await pcPage.locator('#complete').waitFor()
    assert.equal(claimCount, 1)
    pcPage.off('request', countClaim)

    mark('QR reissue and cancellation invalidate previous phone authorization')
    const replaced = await begin()
    await phoneVerify(replaced)
    const reissued = pcPage.waitForResponse((r) => r.url().endsWith('/auth/passkeys/qr'))
    await pcPage.locator('#qr-start').click()
    const newQr = await (await reissued).json()
    assert.equal(newQr.expiresAt, replaced.expiresAt)
    const failedApproval = phonePage.waitForResponse((r) =>
      r.url().endsWith('/auth/passkeys/phone-approve')
    )
    await phonePage.locator('#approve').click()
    assert.equal((await failedApproval).status(), 400)
    assert.equal(await phonePage.locator('#phone-approved').count(), 0)
    assert.equal(
      await phonePage.locator('#phone-confirmation').textContent(),
      replaced.confirmationCode
    )
    assert.equal((await phone.request.get(replaced.phoneUrl)).status(), 400)
    await phoneVerify({ ...replaced, ...newQr })
    assert.equal((await post(pc, 'cancel', replaced.requestId)).status(), 200)
    assert.equal((await post(phone, 'phone-approve', replaced.requestId)).status(), 400)
    assert.equal((await post(pc, 'claim', replaced.requestId)).status(), 400)

    mark('phone ceremony cancellation ends both login and signup requests')
    for (const operation of ['authenticate', 'register']) {
      const canceled = await begin()
      await phonePage.goto(canceled.phoneUrl)
      await phonePage.evaluate(
        (method) => {
          navigator.credentials[method] = async () => {
            throw new DOMException('User canceled', 'NotAllowedError')
          }
        },
        operation === 'register' ? 'create' : 'get'
      )
      await phonePage.locator(`#${operation}`).click()
      await phonePage.locator('#phone-canceled').waitFor()
      assert.equal(await phonePage.locator('#phone-canceled h1').textContent(), '로그인 취소')
      assert.equal(await phonePage.locator('#phone-confirmation').count(), 0)
      assert.equal((await post(pc, 'claim', canceled.requestId)).status(), 400)
      assert.equal((await post(phone, 'phone-approve', canceled.requestId)).status(), 400)
      assert.equal(
        (
          await source.query('SELECT status FROM auth_login_requests WHERE id=$1', [
            canceled.requestId
          ])
        )[0].status,
        'failed'
      )
      if (process.env.DFRAGON_PASSKEY_ARTIFACTS && operation === 'authenticate') {
        await phonePage.screenshot({
          path: join(process.env.DFRAGON_PASSKEY_ARTIFACTS, 'phone-canceled.png')
        })
      }
    }

    mark('QR expiry and removed passkey cannot issue app login code')
    const expired = await begin()
    await source.query(
      "UPDATE auth_login_requests SET created_at=clock_timestamp()-interval '20 minutes', expires_at=clock_timestamp()-interval '1 second' WHERE id=$1",
      [expired.requestId]
    )
    assert.equal((await phone.request.get(expired.phoneUrl)).status(), 400)
    mark('QR expiry countdown remains visible and disables reissue')
    await pcPage.clock.setSystemTime(new Date(Date.parse(expired.expiresAt) + 1000))
    await pcPage.clock.runFor(5000)
    assert.equal(
      await pcPage.locator('#qr-expiry').textContent(),
      '0분 0초 · 인증 시간이 만료됐어요'
    )
    assert.equal(await pcPage.locator('#qr-start').isDisabled(), true)
    mark('expired QR close cancels locally even if server rejects cancellation')
    await pcPage.evaluate(() => {
      globalThis.window.close = () => {
        globalThis.closeRequested = true
      }
    })
    await pcPage.locator('#cancel').click()
    await pcPage.getByText('인증을 중단했습니다. 이 창을 닫아 주세요.', { exact: true }).waitFor()
    assert.equal(await pcPage.evaluate(() => globalThis.closeRequested), true)
    await pcPage.clock.setSystemTime(new Date())
    mark('removed passkey cannot issue app login code')
    const removed = await begin()
    await phoneVerify(removed)
    await approve()
    await source.query('DELETE FROM auth_passkeys WHERE user_id=$1', [userId])
    const rejectedClaim = pcPage.waitForResponse((r) => r.url().endsWith('/auth/passkeys/claim'))
    await pcPage.clock.runFor(5000)
    assert.equal((await rejectedClaim).status(), 400)
    await pcPage.locator('#entry').waitFor()
    assert.equal(await pcPage.locator('#complete').count(), 0)
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
