import { readFile } from 'node:fs/promises'
import { isAbsolute } from 'node:path'
import { createSecureContext } from 'node:tls'
import { createAccessJwtIssuer, createAccessJwtVerifier } from '../auth/access-jwt/index.js'
import { validatePasskeyConfiguration } from '../auth/login/configuration.js'
import { readDatabaseConfiguration } from '../database/configuration.js'
import { parsePort } from '../port.js'
import { parseAuthenticationInput } from './authentication-input.js'

const invalidConfiguration = 'Invalid API runtime configuration'

async function readLocalHttps(environment: NodeJS.ProcessEnv, port: number, apiOrigin: string) {
  const certPath = environment.LOCAL_HTTPS_CERT_FILE
  const keyPath = environment.LOCAL_HTTPS_KEY_FILE
  if (certPath === undefined && keyPath === undefined) {
    return undefined
  }
  if (
    certPath === undefined ||
    keyPath === undefined ||
    !isAbsolute(certPath) ||
    !isAbsolute(keyPath)
  ) {
    throw new Error(invalidConfiguration)
  }

  const localOrigins = [
    new URL(`https://localhost:${port}`).origin,
    new URL(`https://127.0.0.1:${port}`).origin
  ]
  if (!localOrigins.includes(apiOrigin)) {
    throw new Error(invalidConfiguration)
  }
  const cert = await readFile(certPath)
  const key = await readFile(keyPath)
  // PEM 파싱과 certificate/key 일치를 DB 연결 전에 확인한다.
  createSecureContext({ cert, key })
  return { cert, key }
}

/** 기본 entry가 전달한 환경과 파일을 한 번 읽고 DB 연결 전에 검증을 끝낸다. */
export async function readRuntimeConfiguration(environment: NodeJS.ProcessEnv) {
  try {
    const port = parsePort(environment.PORT)
    const proxyMode = environment.SEARCH_TRUST_PROXY
    if (proxyMode !== undefined && proxyMode !== 'single-hop') {
      throw new Error(invalidConfiguration)
    }
    const trustedProxyHops = proxyMode === 'single-hop' ? (1 as const) : undefined
    const database = readDatabaseConfiguration(environment)
    const apiKey = environment.NEOPLE_API_KEY
    const isApiKeyDefined = apiKey !== undefined
    if (!isApiKeyDefined) {
      throw new Error(invalidConfiguration)
    }
    const hasApiKeyContent = apiKey.length > 0
    if (!hasApiKeyContent) {
      throw new Error(invalidConfiguration)
    }
    const path = environment.AUTH_CONFIG_FILE
    const isPathDefined = path !== undefined
    if (!isPathDefined) {
      throw new Error(invalidConfiguration)
    }
    const hasPathContent = path.length > 0
    if (!hasPathContent) {
      throw new Error(invalidConfiguration)
    }
    const hasAbsolutePath = isAbsolute(path)
    if (!hasAbsolutePath) {
      throw new Error(invalidConfiguration)
    }
    const bytes = await readFile(path)
    const json = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
    const input = parseAuthenticationInput(JSON.parse(json) as unknown)
    const configuration = validatePasskeyConfiguration(input.passkey)
    const localHttps = await readLocalHttps(environment, port, configuration.apiOrigin)
    const issueAccessJwt = await createAccessJwtIssuer(input.accessJwt)
    const verifyAccessJwt = await createAccessJwtVerifier(input.accessJwt)
    return {
      port,
      trustedProxyHops,
      localHttps,
      database,
      apiKey,
      configuration,
      issueAccessJwt,
      verifyAccessJwt
    }
  } catch {
    // FS/JSON/crypto의 error와 cause는 파일 경로나 값을 포함할 수 있다.
    throw new Error(invalidConfiguration)
  }
}
