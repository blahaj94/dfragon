import assert from 'node:assert/strict'
import { createServer } from 'node:https'
import { execFileSync } from 'node:child_process'
import { mkdtemp, readFile, rm, mkdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { once } from 'node:events'
import { randomUUID } from 'node:crypto'
import express from 'express'
import { chromium } from 'playwright'
import { OcrAuth } from '../dist/src/auth.js'
import { OcrStore } from '../dist/src/store.js'
import { createOcrApp } from '../dist/src/server.js'
const directory = await mkdtemp(join(tmpdir(), 'ocr-ui-'))
let browser, server, runtime, store
try {
  execFileSync(
    'openssl',
    [
      'req',
      '-x509',
      '-newkey',
      'rsa:2048',
      '-nodes',
      '-keyout',
      join(directory, 'key.pem'),
      '-out',
      join(directory, 'cert.pem'),
      '-days',
      '1',
      '-subj',
      '/CN=localhost'
    ],
    { stdio: 'ignore' }
  )
  const outer = express()
  server = createServer(
    {
      key: await readFile(join(directory, 'key.pem')),
      cert: await readFile(join(directory, 'cert.pem'))
    },
    outer
  )
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const origin = `https://localhost:${server.address().port}`,
    ownerId = randomUUID()
  // Explicit dependency injection in this isolated fixture only; no product login bypass.
  const authFetch = async (input) => {
    const path = new URL(String(input)).pathname
    if (path === '/auth/login-requests') {
      return Response.json({
        requestId: randomUUID(),
        browserUrl: `${origin}/auth/login/authorize`,
        expiresAt: new Date(Date.now() + 600_000).toISOString()
      })
    }
    if (path === '/auth/exchange') {
      return Response.json({
        accessToken: 'synthetic',
        refreshToken: 'synthetic',
        accessTokenExpiresAt: new Date(Date.now() + 900_000).toISOString(),
        user: { id: ownerId, nickname: '검증계정' }
      })
    }
    if (path === '/me') {
      return Response.json({ user: { id: ownerId, nickname: '검증계정' } })
    }
    if (path === '/auth/logout') {
      return new Response(null, { status: 204 })
    }
    throw new Error('Unexpected fixture request')
  }
  outer.get('/auth/login/authorize', (_request, response) =>
    response.redirect(`/auth/callback?code=${'A'.repeat(43)}`)
  )
  const config = { origin, authOrigin: origin, ownerId }
  store = new OcrStore(':memory:', 1024 * 1024 * 32)
  runtime = await createOcrApp(config, store, new OcrAuth(config, authFetch))
  outer.use(runtime.app.getHttpAdapter().getInstance())
  browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
      ignoreHTTPSErrors: true,
      viewport: { width: 1440, height: 1050 }
    }),
    page = await context.newPage()
  const errors = []
  const sampleRequests = []
  page.on('request', (request) => {
    if (new URL(request.url()).pathname === '/api/samples') {
      sampleRequests.push(request.url())
    }
  })
  page.on('pageerror', (error) => errors.push(error.message))
  const artifacts = process.env.OCR_UI_ARTIFACTS
  async function screenshot(name) {
    await page.evaluate(async () => {
      await globalThis.document.fonts.ready
      await Promise.all([...globalThis.document.images].map((image) => image.decode()))
    })
    if (artifacts) {
      await mkdir(resolve(artifacts), { recursive: true })
      await page.screenshot({
        path: join(resolve(artifacts), `${name}.png`),
        fullPage: true,
        animations: 'disabled'
      })
    }
  }
  await page.goto(origin)
  await page.getByRole('button', { name: '패스키 로그인', exact: true }).waitFor()
  await screenshot('login')
  assert(await page.evaluate(() => globalThis.document.fonts.check('14px NanumSquareNeo')))
  await page.getByRole('button', { name: '패스키 로그인', exact: true }).click()
  await page.getByRole('link', { name: '전체 다운로드' }).waitFor()
  const original = await page.evaluate(() => {
    const canvas = globalThis.document.createElement('canvas')
    canvas.width = 960
    canvas.height = 540
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = '#28323b'
    ctx.fillRect(0, 0, 960, 540)
    ctx.fillStyle = '#334657'
    ctx.fillRect(30, 30, 900, 480)
    ctx.fillStyle = '#10151b'
    ctx.fillRect(55, 55, 280, 130)
    ctx.fillStyle = '#e6ddb0'
    ctx.font = '20px sans-serif'
    ctx.fillText('샘플고래', 80, 90)
    ctx.fillStyle = '#5d966a'
    ctx.fillRect(80, 110, 180, 10)
    ctx.fillStyle = '#6395c0'
    ctx.fillRect(80, 125, 180, 10)
    return canvas.toDataURL('image/png').split(',')[1]
  })
  const uploadToggle = page.getByRole('button', { name: '이미지 업로드', exact: true })
  assert.equal(await uploadToggle.getAttribute('aria-expanded'), 'false')
  await uploadToggle.click()
  await page.getByLabel('원본 PNG', { exact: true }).setInputFiles({
    name: 'synthetic.png',
    mimeType: 'image/png',
    buffer: Buffer.from(original, 'base64')
  })
  await page.getByLabel('UI 크기 (%)', { exact: true }).fill('75')
  for (const [name, value] of [
    ['왼쪽 X', '75'],
    ['위쪽 Y', '67'],
    ['너비', '120'],
    ['높이', '30']
  ]) {
    await page.getByLabel(name, { exact: true }).fill(value)
  }
  await screenshot('upload')
  await page.getByRole('button', { name: '접기', exact: true }).click()
  assert.equal(await uploadToggle.getAttribute('aria-expanded'), 'false')
  assert(await uploadToggle.evaluate((button) => button === globalThis.document.activeElement))
  await uploadToggle.press('Enter')
  assert.equal(await page.getByLabel('너비', { exact: true }).inputValue(), '120')
  assert.equal(
    await page.getByLabel('원본 PNG', { exact: true }).evaluate((input) => input.files.length),
    1
  )
  await page.getByRole('button', { name: '업로드', exact: true }).click()
  await page.getByText('업로드했습니다. 정답을 입력할 수 있습니다.', { exact: true }).waitFor()
  await page.getByLabel('닉네임 정답', { exact: true }).fill('샘플고래')
  await page.getByRole('button', { name: '정답 저장', exact: true }).click()
  await page.getByRole('button', { name: /샘플고래/ }).waitFor()
  page.once('dialog', (dialog) => dialog.accept())
  await page.getByRole('combobox', { name: /닉네임 단위 분할/ }).selectOption('train')
  await page.getByRole('button', { name: /샘플고래.*train/ }).waitFor()
  assert.equal(store.exportManifest().samples[0].split, 'train')
  await page.getByRole('button', { name: '학습에서 제외', exact: true }).click()
  await page.getByRole('button', { name: '제외 복원', exact: true }).waitFor()
  await page.getByRole('button', { name: '제외 복원', exact: true }).click()
  await page.getByRole('button', { name: '학습에서 제외', exact: true }).waitFor()
  const downloadReady = page.waitForEvent('download')
  await page.getByRole('link', { name: '전체 다운로드' }).click()
  const download = await downloadReady
  assert.equal(download.suggestedFilename(), 'ocr-data.tar')
  assert.equal(await download.failure(), null)
  assert((await readFile(await download.path())).length > 0)
  await uploadToggle.click()
  const kindFilter = page
    .getByRole('group', { name: '자료 필터' })
    .getByRole('combobox', { name: '수집 종류' })
  await kindFilter.selectOption('hud')
  await page.getByRole('button', { name: /샘플고래.*train/ }).waitFor()
  const beforeCachedFilter = sampleRequests.length
  await kindFilter.selectOption('')
  await page.getByRole('button', { name: /샘플고래.*train/ }).waitFor()
  assert.equal(sampleRequests.length, beforeCachedFilter)
  await page.getByRole('button', { name: '로그아웃', exact: true }).click()
  await page.getByRole('button', { name: '패스키 로그인', exact: true }).waitFor()
  await page.getByRole('button', { name: '패스키 로그인', exact: true }).click()
  await page.getByRole('button', { name: /샘플고래.*train/ }).waitFor()
  assert(
    sampleRequests.length > beforeCachedFilter,
    'login after logout refetches the cleared dataset cache'
  )

  // Exercise raid-only row limits and keep each collection mode's coordinate draft.
  await uploadToggle.click()
  const uploadPanel = page.getByRole('region', { name: '원본 이미지 업로드', exact: true })
  const uploadKind = uploadPanel.getByRole('combobox', { name: '수집 종류', exact: true })
  await uploadKind.selectOption('raid')
  await uploadPanel.getByLabel('원본 PNG', { exact: true }).setInputFiles({
    name: 'synthetic-raid.png',
    mimeType: 'image/png',
    buffer: Buffer.from(original, 'base64')
  })
  await uploadPanel.getByRole('combobox', { name: '크롭 1 위치', exact: true }).selectOption('12')
  const addCrop = uploadPanel.getByRole('button', { name: '크롭 추가', exact: true })
  for (let index = 1; index < 12; index += 1) {
    await addCrop.click()
  }
  assert(await addCrop.isDisabled())
  assert.equal(await uploadPanel.getByLabel('너비', { exact: true }).count(), 12)
  assert(
    await uploadPanel
      .getByRole('combobox', { name: '크롭 1 위치', exact: true })
      .getByRole('option', { name: '1', exact: true })
      .isDisabled()
  )
  for (let index = 0; index < 12; index += 1) {
    for (const [name, value] of [
      ['왼쪽 X', '75'],
      ['위쪽 Y', '67'],
      ['너비', '120'],
      ['높이', '30']
    ]) {
      await uploadPanel.getByLabel(name, { exact: true }).nth(index).fill(value)
    }
  }
  await uploadKind.selectOption('hud')
  assert.equal(await uploadPanel.getByLabel('너비', { exact: true }).count(), 1)
  await uploadPanel.getByLabel('너비', { exact: true }).fill('60')
  for (let index = 1; index < 4; index += 1) {
    await addCrop.click()
  }
  assert(await addCrop.isDisabled())
  assert.equal(
    await uploadPanel
      .getByRole('combobox', { name: '크롭 1 위치', exact: true })
      .locator('option')
      .count(),
    4
  )
  await uploadKind.selectOption('raid')
  assert.equal(await uploadPanel.getByLabel('너비', { exact: true }).count(), 12)
  assert.equal(await uploadPanel.getByLabel('너비', { exact: true }).first().inputValue(), '120')
  assert.equal(
    await uploadPanel.getByRole('combobox', { name: '크롭 1 위치', exact: true }).inputValue(),
    '12'
  )
  await uploadPanel.getByRole('button', { name: '업로드', exact: true }).click()
  await uploadPanel
    .getByText('업로드했습니다. 정답을 입력할 수 있습니다.', { exact: true })
    .waitFor()
  const raidCapture = store.exportManifest().captures.find((capture) => capture.kind === 'raid')
  assert(raidCapture)
  assert.deepEqual(
    raidCapture.crops.map(({ slot }) => slot),
    Array.from({ length: 12 }, (_, i) => i + 1)
  )
  await uploadPanel.getByRole('button', { name: '접기', exact: true }).click()
  await kindFilter.selectOption('raid')
  const galleryRegion = page.getByRole('region', { name: '수집 이미지', exact: true })
  const twelfth = galleryRegion.getByRole('button', { name: /공대원창.*위치 12/ })
  await twelfth.waitFor()
  assert.equal(await galleryRegion.getByRole('button').count(), 12)
  await twelfth.click()
  await page.getByLabel('닉네임 정답', { exact: true }).fill('공대열두번째')
  await page.getByRole('button', { name: '정답 저장', exact: true }).click()
  await galleryRegion.getByRole('button', { name: /공대열두번째.*공대원창.*위치 12/ }).waitFor()
  page.once('dialog', (dialog) => dialog.accept())
  await page.getByRole('combobox', { name: /닉네임 단위 분할/ }).selectOption('test')
  await galleryRegion.getByRole('button', { name: /공대열두번째.*test/ }).waitFor()
  assert.equal(store.sample(`${raidCapture.id}-12`).split, 'test')
  await screenshot('raid')
  await kindFilter.selectOption('hud')
  await galleryRegion.getByRole('button', { name: /샘플고래.*train/ }).waitFor()
  assert.equal(await galleryRegion.getByRole('button').count(), 1)
  await kindFilter.selectOption('')

  // Fill the gallery with synthetic captures to inspect the desktop and mobile grids.
  const capture = store.exportManifest().captures[0]
  for (let index = 0; index < 8; index += 1) {
    const id = randomUUID()
    store.add(
      { ...capture, id, kind: index % 2 === 0 ? 'hud' : 'participants' },
      Buffer.from(original, 'base64')
    )
    if (index % 3 !== 0) {
      store.updateSample(`${id}-1`, {
        text: '샘플고래',
        excluded: index === 2,
        confirmSplitChange: false
      })
    }
  }
  await page.reload()
  await page
    .getByRole('region', { name: '수집 이미지', exact: true })
    .getByRole('button')
    .nth(8)
    .waitFor()
  await screenshot('desktop')
  await page.getByRole('button', { name: '다크 테마로 전환', exact: true }).click()
  await page.reload()
  await page.getByRole('button', { name: '라이트 테마로 전환', exact: true }).waitFor()
  await page
    .getByRole('region', { name: '수집 이미지', exact: true })
    .getByRole('button')
    .nth(8)
    .waitFor()
  assert.equal(await page.locator('html').getAttribute('data-seed-color-mode'), 'dark-only')
  await screenshot('desktop-dark')
  await page.getByRole('button', { name: '라이트 테마로 전환', exact: true }).click()
  for (const width of [500, 390]) {
    await page.setViewportSize({ width, height: 844 })
    assert(
      await page.evaluate(
        () => globalThis.document.documentElement.scrollWidth <= globalThis.innerWidth
      )
    )
    const gallery = await page
      .getByRole('region', { name: '수집 이미지', exact: true })
      .boundingBox()
    const editor = await page.getByRole('region', { name: '정답 편집', exact: true }).boundingBox()
    assert(editor.y >= gallery.y + gallery.height)
    await screenshot(`mobile-${width}`)
  }
  assert.deepEqual(errors, [])
  process.stdout.write(
    'OCR browser HUD/raid upload limits, draft preservation, labels, split, exclusion, download, themes, responsive layout and logout passed\n'
  )
} finally {
  await browser?.close()
  if (server) {
    await new Promise((resolve) => server.close(resolve))
  }
  await runtime?.close()
  store?.close()
  await rm(directory, { recursive: true, force: true })
}
