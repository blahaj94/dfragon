import assert from 'node:assert/strict'
import test from 'node:test'
import type { OpenAPIObject } from '@nestjs/swagger'
import { createApiHttpApp } from '../src/http.js'

test('Swagger는 공개 API 경로만 문서화하고 DB, provider를 호출하지 않는다', async (t) => {
  const unused = t.mock.fn(async (): Promise<never> => {
    throw new Error('documentation must not call services')
  })
  const app = await createApiHttpApp(
    { searchCharacters: unused },
    {
      store: { read: unused, beginFetch: unused, saveAndRead: unused },
      fetchDetails: unused
    },
    { search: unused },
    undefined,
    undefined,
    { fetchAppearance: unused }
  )
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
        'get /adventures/characters',
        'get /characters/{serverId}/{characterId}',
        'get /characters/{serverId}/{characterId}/appearance',
        'post /characters/{serverId}/{characterId}/refresh'
      ].sort()
    )
    assert.equal(document.paths['/me'], undefined)
    assert.equal(document.security, undefined)
    assert.equal(document.paths['/characters'].get?.security, undefined)
    assert.equal(
      document.paths['/characters/{serverId}/{characterId}/appearance'].get?.security,
      undefined
    )
    const appearance = document.components?.schemas?.CharacterAppearance
    assert(appearance && 'properties' in appearance)
    assert.equal(appearance.additionalProperties, false)
    assert.deepEqual(Object.keys(appearance.properties ?? {}), [
      'serverId',
      'characterId',
      'characterName',
      'jobName',
      'jobGrowName',
      'avatar'
    ])
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
    for (const path of ['/auth/login/authorize', '/me']) {
      const response = await fetch(`${origin}${path}`)
      assert.equal(response.status, 404)
    }
    assert.equal(unused.mock.callCount(), 0)
  } finally {
    await app.close()
  }
})
