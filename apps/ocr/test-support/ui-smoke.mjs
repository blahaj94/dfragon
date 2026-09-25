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
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto(origin)
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
  await page.getByText('원본 이미지 업로드', { exact: true }).click()
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
  await page.getByRole('button', { name: '업로드', exact: true }).click()
  await page.getByText('업로드했습니다. 정답을 입력할 수 있습니다.', { exact: true }).waitFor()
  await page.getByLabel('닉네임 정답', { exact: true }).fill('샘플고래')
  await page.getByRole('button', { name: '정답 저장', exact: true }).click()
  await page.locator('.sample strong').filter({ hasText: '샘플고래' }).waitFor()
  page.once('dialog', (dialog) => dialog.accept())
  await page.getByRole('combobox', { name: /닉네임 단위 분할/ }).selectOption('train')
  await page.waitForFunction(() =>
    globalThis.document.querySelector('.sample span')?.textContent?.includes('train')
  )
  assert.equal(store.exportManifest().samples[0].split, 'train')
  await page.getByRole('button', { name: '학습에서 제외', exact: true }).click()
  await page.getByRole('button', { name: '제외 복원', exact: true }).waitFor()
  await page.getByRole('button', { name: '제외 복원', exact: true }).click()
  await page.getByRole('button', { name: '학습에서 제외', exact: true }).waitFor()
  await page.getByText('원본 이미지 업로드', { exact: true }).click()
  const artifacts = process.env.OCR_UI_ARTIFACTS
  if (artifacts) {
    await mkdir(resolve(artifacts), { recursive: true })
    await page.screenshot({ path: join(resolve(artifacts), 'desktop.png'), fullPage: true })
  }
  await page.setViewportSize({ width: 390, height: 844 })
  assert(
    await page.evaluate(
      () => globalThis.document.documentElement.scrollWidth <= globalThis.innerWidth
    )
  )
  if (artifacts) {
    await page.screenshot({ path: join(resolve(artifacts), 'mobile.png'), fullPage: true })
  }
  await page.getByRole('button', { name: '로그아웃', exact: true }).click()
  await page.getByRole('button', { name: '패스키 로그인', exact: true }).waitFor()
  assert.deepEqual(errors, [])
  process.stdout.write(
    'OCR browser upload, labels, split, exclusion, responsive layout and logout passed\n'
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
