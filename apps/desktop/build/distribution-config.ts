import { validateApiOrigin } from '../src/backend/auth/protocol'

const DNS_ROOT_LABEL_PATTERN = /\.$/
const IPV4_MAPPED_LOOPBACK_PATTERN = /^\[::ffff:7f[0-9a-f]{2}:[0-9a-f]{1,4}\]$/
const IPV4_LOOPBACK_PATTERN = /^127\.\d+\.\d+\.\d+$/

/** Only public connection settings may cross into the installed main bundle. */
export function readDistributionApiOrigin(
  environment: Readonly<Record<string, string | undefined>> = process.env
): string {
  const origin = environment['DFRAGON_DISTRIBUTION_API_ORIGIN']
  try {
    if (origin == null) {
      throw new Error()
    }
    validateApiOrigin(origin)
    const hostname = new URL(origin).hostname.replace(DNS_ROOT_LABEL_PATTERN, '')
    // Canonical URL hostnames encode IPv4-mapped IPv6 as ::ffff:hhhh:hhhh.
    const isMappedLoopback = IPV4_MAPPED_LOOPBACK_PATTERN.test(hostname)
    if (
      hostname === 'localhost' ||
      hostname.endsWith('.localhost') ||
      IPV4_LOOPBACK_PATTERN.test(hostname) ||
      hostname === '[::1]' ||
      isMappedLoopback
    ) {
      throw new Error()
    }

    return origin
  } catch {
    // Never echo an invalid value: it may accidentally contain credentials.
    throw new Error('Set DFRAGON_DISTRIBUTION_API_ORIGIN to a non-loopback canonical HTTPS origin.')
  }
}

/** Accounts is independently configured; the game API origin remains the search destination. */
export function readDistributionAccountsOrigin(
  environment: Readonly<Record<string, string | undefined>> = process.env
): string {
  return readDistributionApiOrigin({
    DFRAGON_DISTRIBUTION_API_ORIGIN:
      environment['DFRAGON_DISTRIBUTION_ACCOUNTS_ORIGIN'] ?? 'https://accounts.dfragon.com'
  })
}
