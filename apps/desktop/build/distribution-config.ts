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
    const hostname = new URL(origin).hostname
    if (
      hostname === 'localhost' ||
      hostname.endsWith('.localhost') ||
      hostname.startsWith('127.') ||
      hostname === '[::1]'
    ) {
      throw new Error()
    }
    return origin
  } catch {
    // Never echo an invalid value: it may accidentally contain credentials.
    throw new Error('Set LDB_DISTRIBUTION_API_ORIGIN to a non-loopback canonical HTTPS origin.')
  }
}
