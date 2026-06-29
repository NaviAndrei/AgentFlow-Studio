/**
 * SSRF guard for the httpRequest node. Flow definitions can come from
 * untrusted sources (shared Blueprint JSON, NL Builder output, shared-canvas
 * URLs), so a flow author could point httpUrl at an internal/private
 * service. Only https: URLs to non-private hosts are allowed.
 */

function isPrivateIPv4(hostname: string): boolean {
  const match = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/)
  if (!match) return false
  const [a, b] = [Number(match[1]), Number(match[2])]
  if (a === 127) return true // loopback
  if (a === 10) return true // 10.0.0.0/8
  if (a === 172 && b >= 16 && b <= 31) return true // 172.16.0.0/12
  if (a === 192 && b === 168) return true // 192.168.0.0/16
  if (a === 169 && b === 254) return true // link-local / cloud metadata
  if (a === 0) return true // 0.0.0.0/8
  return false
}

function isPrivateHostname(hostname: string): boolean {
  const host = hostname.replace(/^\[|\]$/g, '').toLowerCase()
  if (host === 'localhost' || host.endsWith('.localhost')) return true
  if (host === '::1') return true
  if (host.startsWith('fe80:') || host.startsWith('fc00:') || host.startsWith('fd00:')) return true
  return isPrivateIPv4(host)
}

/**
 * Returns a human-readable reason the URL is blocked, or null if it's safe
 * to fetch.
 */
export function validateHttpUrl(url: string): string | null {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return `Invalid URL: ${url}`
  }
  if (parsed.protocol !== 'https:') {
    return `Blocked non-HTTPS URL (${parsed.protocol.replace(':', '')}): ${url}`
  }
  if (isPrivateHostname(parsed.hostname)) {
    return `Blocked request to private/internal host: ${parsed.hostname}`
  }
  return null
}
