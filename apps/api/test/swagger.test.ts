import assert from 'node:assert/strict'
import test from 'node:test'
import { DataSource } from 'typeorm'
import type { OpenAPIObject } from '@nestjs/swagger'
import { createLoginHttpApp } from '../src/auth/login/http.js'
import { LOGIN } from '../src/constants/login.js'

test('Swagger serves every runtime route and preserves the login CSP and parser', async () => {
  const unused = async (): Promise<never> => {
    throw new Error('documentation must not call services')
  }
  const app = await createLoginHttpApp(
    { create: unused, exchange: unused, authorize: unused, callback: unused },
    { refresh: unused, logout: unused },
    { dataSource: new DataSource({ type: 'postgres' }), verifyAccessJwt: unused },
    { apiKey: 'documentation-fixture', searchCharacters: unused },
    undefined,
    {
      apiKey: 'documentation-fixture',
      store: { read: unused, beginFetch: unused, saveAndRead: unused },
      fetchDetails: unused
    }
  )
  try {
    await app.listen(0, '127.0.0.1')
    const origin = await app.getUrl()
    const response = await fetch(`${origin}/docs/openapi.json`)
    assert.equal(response.status, 200)
    assert.equal(response.headers.get('cache-control'), 'no-store')
    const document = (await response.json()) as OpenAPIObject
    const methods = ['get', 'post', 'patch'] as const
    const operations = Object.entries(document.paths).flatMap(([path, item]) =>
      methods.filter((method) => item[method]).map((method) => `${method} ${path}`)
    )
    assert.deepEqual(
      operations.sort(),
      [
        'post /auth/login-requests',
        'post /auth/exchange',
        'post /auth/refresh',
        'post /auth/logout',
        'get /auth/login/authorize',
        'get /auth/callback/google',
        'get /auth/callback/discord',
        'get /me',
        'patch /me/nickname',
        'get /characters',
        'get /characters/{serverId}/{characterId}',
        'post /characters/{serverId}/{characterId}/refresh'
      ].sort()
    )
    assert.deepEqual(document.paths['/me'].get?.security, [{ bearer: [] }])
    assert.equal(document.paths['/characters'].get?.security, undefined)
    assert.deepEqual(Object.keys(document.paths['/auth/refresh'].post!.responses).sort(), [
      '200',
      '400',
      '401',
      '413',
      '415',
      '500',
      '503'
    ])
    assert.equal(
      Object.hasOwn(document.paths['/auth/logout'].post!.responses['204']!, 'content'),
      false
    )
    assert.ok(document.paths['/auth/callback/google'].get!.responses['200'])
    // 수동으로 기술한 request/response model을 포함해 모든 참조가 연결되어야 합니다.
    const refs = JSON.stringify(document).matchAll(/"\$ref":"#\/components\/schemas\/([^"/]+)"/g)
    for (const [, name] of refs) {
      assert.ok(document.components?.schemas?.[name], name)
    }

    for (const path of [
      '/docs',
      '/docs/',
      '/docs/swagger-ui.css',
      '/docs/swagger-ui-bundle.js',
      '/docs/swagger-ui-init.js'
    ]) {
      const asset = await fetch(`${origin}${path}`)
      assert.equal(asset.status, 200, path)
      assert.match(asset.headers.get('content-security-policy')!, /script-src 'self'/)
      const content = await asset.text()
      assert.ok(content.length > 0)
      if (path.endsWith('init.js')) {
        assert.match(content, /"persistAuthorization": false/)
        assert.match(content, /"validatorUrl": null/)
      }
    }
    for (const path of ['/auth/login/authorize', '/auth/callback/google']) {
      const login = await fetch(`${origin}${path}`)
      assert.equal(login.status, 400)
      assert.equal(login.headers.get('content-security-policy'), LOGIN.contentSecurityPolicy)
      assert.equal(login.headers.get('referrer-policy'), 'no-referrer')
    }
    const invalidBody = await fetch(`${origin}/auth/login-requests`, { method: 'POST', body: '{}' })
    assert.equal(invalidBody.status, 415)
    assert.equal((await invalidBody.json()).error.code, 'UNSUPPORTED_MEDIA_TYPE')
    const unknown = await fetch(`${origin}/docs-missing`)
    assert.equal(unknown.status, 404)
    assert.equal(unknown.headers.get('content-security-policy'), LOGIN.contentSecurityPolicy)
  } finally {
    await app.close()
  }
})
