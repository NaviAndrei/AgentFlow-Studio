import { describe, expect, it } from 'vitest'
import { validateHttpUrl } from './validateHttpUrl'

describe('validateHttpUrl', () => {
  it('allows a public https URL', () => {
    expect(validateHttpUrl('https://api.example.com/v1/data')).toBeNull()
  })

  it('blocks plain http://', () => {
    expect(validateHttpUrl('http://api.example.com/v1/data')).toMatch(/non-HTTPS/)
  })

  it('blocks localhost', () => {
    expect(validateHttpUrl('https://localhost:8080/admin')).toMatch(/private\/internal host/)
  })

  it('blocks 169.254.x.x (cloud metadata / link-local)', () => {
    expect(validateHttpUrl('https://169.254.169.254/latest/meta-data/')).toMatch(
      /private\/internal host/,
    )
  })

  it('blocks 127.0.0.1 loopback', () => {
    expect(validateHttpUrl('https://127.0.0.1/secret')).toMatch(/private\/internal host/)
  })

  it('blocks 10.x.x.x private range', () => {
    expect(validateHttpUrl('https://10.1.2.3/internal')).toMatch(/private\/internal host/)
  })

  it('blocks 192.168.x.x private range', () => {
    expect(validateHttpUrl('https://192.168.1.1/router')).toMatch(/private\/internal host/)
  })

  it('blocks 172.16-31.x.x private range', () => {
    expect(validateHttpUrl('https://172.20.0.5/internal')).toMatch(/private\/internal host/)
  })

  it('allows a 172.x address outside the private range (172.32+)', () => {
    expect(validateHttpUrl('https://172.32.0.5/data')).toBeNull()
  })

  it('blocks IPv6 loopback ::1', () => {
    expect(validateHttpUrl('https://[::1]/secret')).toMatch(/private\/internal host/)
  })

  it('rejects an unparseable URL', () => {
    expect(validateHttpUrl('not a url')).toMatch(/Invalid URL/)
  })
})
