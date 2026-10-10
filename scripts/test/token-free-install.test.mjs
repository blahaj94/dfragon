import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { readFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../../', import.meta.url))
// A package registry credential in an install path means fork PRs and fresh checkouts without the
// secret can no longer install the workspace. The secret and BuildKit secret names cover a token
// passed under another variable name.
const installCredential =
  /NODE_AUTH_TOKEN|node-auth-token|_authToken|PACKAGES_TOKEN|github_packages_token/u
const privateRegistry = /npm\.pkg\.github\.com|registry-url:/u

function readRepositoryFile(path) {
  return readFile(join(root, path), 'utf8')
}

test('workspace 설치 action은 registry 인증 설정 없이 lockfile대로 설치한다', async () => {
  const action = await readRepositoryFile('.github/actions/setup-workspace/action.yml')

  assert.match(action, /^ {4}- run: pnpm install --frozen-lockfile\b/mu)
  assert.doesNotMatch(action, privateRegistry)
  assert.doesNotMatch(action, installCredential)
})

test('workflow는 비공개 registry 설정이나 registry 토큰을 설치에 넘기지 않는다', async () => {
  const workflows = (await readdir(join(root, '.github/workflows'))).filter((name) => {
    return /\.ya?ml$/u.test(name)
  })

  assert.ok(workflows.includes('code-quality.yml'), 'workflow 목록을 찾지 못했다')

  for (const name of workflows) {
    const workflow = await readRepositoryFile(`.github/workflows/${name}`)

    assert.doesNotMatch(workflow, privateRegistry, name)
    assert.doesNotMatch(workflow, installCredential, name)
  }
})

test('서버 이미지는 BuildKit secret 없이 의존성을 설치하고 빌드한다', async () => {
  const dockerfiles = (await readdir(join(root, 'apps')))
    .map((app) => `apps/${app}/Dockerfile`)
    .filter((path) => existsSync(join(root, path)))

  assert.ok(dockerfiles.includes('apps/api/Dockerfile'), '서버 Dockerfile을 찾지 못했다')

  for (const path of dockerfiles) {
    const dockerfile = await readRepositoryFile(path)

    assert.match(dockerfile, /^RUN pnpm install --frozen-lockfile\b/mu, path)
    assert.doesNotMatch(dockerfile, /--mount=type=secret/u, path)
    assert.doesNotMatch(dockerfile, privateRegistry, path)
    assert.doesNotMatch(dockerfile, installCredential, path)
  }
})
