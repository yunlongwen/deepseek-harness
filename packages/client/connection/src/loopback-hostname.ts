/**
 * Browser-safe, zero-dependency loopback classification and trusted-authority
 * matching shared by the `/api` Host fence and the package's `ctx.connection`
 * state. The predicates stay package-internal; client plugins consume the
 * derived state through Cordis.
 */

/** Page global carrying the deployment's trusted authorities, injected by the node half. */
export const TRUSTED_HOSTS_GLOBAL = '__DSH_TRUSTED_HOSTS__'

/**
 * Whether a normalized URL hostname names the local loopback authority.
 * @param hostname - WHATWG URL hostname (IPv6 literals retain brackets).
 * @returns true for localhost, IPv6 loopback, or any IPv4 address in 127/8.
 */
export function isLoopbackHostname(hostname: string): boolean {
  if (hostname === 'localhost' || hostname === '[::1]') return true
  const parts = hostname.split('.')
  return parts.length === 4
    && parts[0] === '127'
    && parts.every(part => /^\d{1,3}$/.test(part) && Number(part) <= 255)
}

/**
 * Normalized `host:port` of a URL authority, or undefined when the hostname is
 * absent. This mirrors the Host fence's canonical form (`hostname` when no port
 * was written, else `hostname:port`) so both sides compare the same shapes.
 * @param authority - WHATWG URL authority (`host`, `host:port`, IPv6 in brackets).
 * @returns the canonical authority, or undefined when unparsable.
 */
function parseAuthority(authority: string): URL | undefined {
  try {
    // http: is a WHATWG "special scheme": parsing yields a non-empty hostname
    // or throws, and default ports are stripped the same way the Host fence sees them.
    return new URL(`http://${authority}`)
  } catch {
    return undefined
  }
}

/**
 * Whether a `trustedHosts` entry is port-less in canonical form. The Host fence
 * classifies an entry by whether an explicit port survives both scheme parses
 * (a redundant default port is stripped and would fail `assertTrustedAuthority`,
 * so a ported entry here is always a real `host:port`).
 * @param entryUrl - parsed entry authority.
 * @param entry - the configured value, verbatim.
 * @returns true when the entry matches any port of its hostname.
 */
function entryIsPortless(entryUrl: URL, entry: string): boolean {
  const port = entryUrl.port !== '' ? entryUrl.port : new URL(`https://${entry}`).port
  return port === ''
}

/**
 * Whether one page authority matches a `trustedHosts` entry. An entry with an
 * explicit port matches that exact authority; a port-less entry matches the
 * hostname on any port. Comparison runs through WHATWG normalization so case
 * and a redundant default port never decide trust, matching the Host fence.
 * @param hostname - the page's URL hostname (IPv6 literals retain brackets).
 * @param port - the page's port, or an empty string when the scheme default applies.
 * @param trustedHosts - deployment authorities accepted by the /api trust fence.
 * @returns whether the page authority is a declared trusted authority.
 */
export function isTrustedAuthority(
  hostname: string,
  port: string,
  trustedHosts: readonly string[],
): boolean {
  const page = `${hostname}${port === '' ? '' : `:${port}`}`
  return trustedHosts.some((entry) => {
    const entryUrl = parseAuthority(entry)
    if (entryUrl === undefined) return false
    return entryIsPortless(entryUrl, entry)
      ? entryUrl.hostname === hostname
      : entryUrl.host === page
  })
}
