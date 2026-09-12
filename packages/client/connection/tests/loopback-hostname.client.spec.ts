/** Shared loopback-hostname semantics for the Host fence and browser UI. */

import { describe, expect, it } from 'vitest'
import { isLoopbackHostname, isTrustedAuthority } from '../src/loopback-hostname.ts'

describe('isLoopbackHostname', () => {
  it('accepts localhost, IPv6 loopback, and the whole IPv4 127/8 block', () => {
    for (const hostname of ['localhost', '[::1]', '127.0.0.1', '127.8.9.10', '127.255.255.255']) {
      expect(isLoopbackHostname(hostname)).toBe(true)
    }
  })

  it('refuses malformed and non-loopback hostnames', () => {
    for (const hostname of ['remote.localhost', '::1', '128.0.0.1', '127.0.0', '127.0.0.256', '127.0.0.-1']) {
      expect(isLoopbackHostname(hostname)).toBe(false)
    }
  })
})

describe('isTrustedAuthority', () => {
  it('matches a port-less entry against the hostname on any page port', () => {
    const trusted = ['harness.agently.top']
    expect(isTrustedAuthority('harness.agently.top', '', trusted)).toBe(true)
    expect(isTrustedAuthority('harness.agently.top', '3080', trusted)).toBe(true)
    expect(isTrustedAuthority('harness.agently.top', '443', trusted)).toBe(true)
  })

  it('matches a ported entry only against the exact authority', () => {
    const trusted = ['harness.agently.top:3080']
    expect(isTrustedAuthority('harness.agently.top', '3080', trusted)).toBe(true)
    expect(isTrustedAuthority('harness.agently.top', '', trusted)).toBe(false)
    expect(isTrustedAuthority('harness.agently.top', '443', trusted)).toBe(false)
  })

  it('compares hostnames case-insensitively and refuses unrelated hosts', () => {
    const trusted = ['Harness.Agently.Top']
    expect(isTrustedAuthority('harness.agently.top', '', trusted)).toBe(true)
    expect(isTrustedAuthority('other.example', '', trusted)).toBe(false)
    expect(isTrustedAuthority('harness.agently.top', '8080', ['harness.agently.top:3080'])).toBe(false)
  })

  it('ignores malformed entries and an empty trust list', () => {
    expect(isTrustedAuthority('harness.agently.top', '', ['not a host!', ''])).toBe(false)
    expect(isTrustedAuthority('harness.agently.top', '', [])).toBe(false)
  })
})
