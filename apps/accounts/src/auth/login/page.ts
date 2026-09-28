import { randomBytes } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import type { LoginAuthorization } from '../../types/login.js'

const htmlEntities: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
}

export async function passkeyPage(authorization: LoginAuthorization) {
  const nonce = randomBytes(24).toString('base64')
  const template = await readFile(new URL('../../browser/passkeys.html', import.meta.url), 'utf8')
  const values: Record<string, string> = {
    nonce,
    requestId: authorization.requestId,
    purpose: authorization.purpose,
    view: authorization.view === 'phone' ? 'phone' : 'desktop',
    confirmationCode: authorization.confirmationCode ?? '',
    webReturnUrl: authorization.webReturnUrl ?? ''
  }
  const html = template.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => {
    if (!Object.hasOwn(values, key)) {
      throw new Error('Unknown passkey page placeholder')
    }
    return values[key].replace(/[&<>"']/g, (character) => htmlEntities[character]!)
  })
  return {
    policy: `default-src 'none'; script-src 'nonce-${nonce}'; style-src 'self'; img-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`,
    html
  }
}
