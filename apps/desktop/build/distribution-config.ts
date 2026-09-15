import { validateApiOrigin } from '../src/backend/auth/protocol'

/** Only public connection settings may cross into the installed main bundle. */
export function readDistributionApiOrigin(
  environment: Readonly<Record<string, string | undefined>> = process.env
): string {
  const origin = environment['LDB_DISTRIBUTION_API_ORIGIN']
  try {
    if (origin == null) {
      throw new Error()
    }
    validateApiOrigin(origin)
    const hostname = new URL(origin).hostname.replace(/\.$/, '')
    // Canonical URL hostnames encode IPv4-mapped IPv6 as ::ffff:hhhh:hhhh.
    const isMappedLoopback = /^\[::ffff:7f[0-9a-f]{2}:[0-9a-f]{1,4}\]$/.test(hostname)
    if (
      hostname === 'localhost' ||
      hostname.endsWith('.localhost') ||
      hostname.startsWith('127.') ||
      hostname === '[::1]' ||
      isMappedLoopback
    ) {
      throw new Error()
    }
    return origin
  } catch {
    // Never echo an invalid value: it may accidentally contain credentials.
    throw new Error('Set LDB_DISTRIBUTION_API_ORIGIN to a non-loopback canonical HTTPS origin.')
  }
}
