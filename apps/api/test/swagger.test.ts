import assert from 'node:assert/strict'
import test from 'node:test'
import type { OpenAPIObject } from '@nestjs/swagger'
import { createCatalogService } from '../src/characters/catalog/service.js'
import { createApiHttpApp } from '../src/http.js'

test('Swagger는 공개 API 경로만 문서화하고 provider를 호출하지 않는다', async (t) => {
  const unused = t.mock.fn(async (): Promise<never> => {
    throw new Error('documentation must not call services')
  })
  const app = await createApiHttpApp({
    search: { searchCharacters: unused },
    details: { fetchDetails: unused, catalog: createCatalogService(unused) },
    todayGrade: { fetchShopGrade: unused }
  })
  try {
    await app.listen(0, '127.0.0.1')
    const origin = await app.getUrl()
    const response = await fetch(`${origin}/docs/openapi.json`)
    assert.equal(response.status, 200)
    assert.equal(response.headers.get('cache-control'), 'no-store')
    const document = (await response.json()) as OpenAPIObject
    const methods = ['get', 'put', 'post', 'delete', 'options', 'head', 'patch', 'trace'] as const
    const operations = Object.entries(document.paths).flatMap(([path, item]) =>
      methods.filter((method) => item[method]).map((method) => `${method} ${path}`)
    )
    assert.deepEqual(
      operations.sort(),
      [
        'get /health',
        'get /version',
        'get /characters',
        'get /characters/candidates',
        'get /characters/{serverId}/{characterId}',
        'post /characters/{serverId}/{characterId}/refresh',
        'get /items/today-grade'
      ].sort()
    )
    const refresh = document.paths['/characters/{serverId}/{characterId}/refresh']!.post!
    assert.deepEqual(Object.keys(refresh.responses).sort(), [
      '200',
      '400',
      '500',
      '502',
      '503',
      '504'
    ])
    assert.equal(document.paths['/me'], undefined)
    assert.equal(document.security, undefined)
    assert.equal(document.paths['/characters'].get?.security, undefined)
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
    for (const path of ['/auth/login/authorize', '/me']) {
      const response = await fetch(`${origin}${path}`)
      assert.equal(response.status, 404)
    }
    for (const path of [
      '/characters/cain/character-id/appearance',
      '/adventures/characters?adventureName=fixture'
    ]) {
      const removed = await fetch(`${origin}${path}`)
      assert.equal(removed.status, 404, path)
      assert.deepEqual(await removed.json(), { statusCode: 404, message: 'Not Found' })
    }
    assert.equal(unused.mock.callCount(), 0)
  } finally {
    await app.close()
  }
})
