import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { isAuthorizedCronRequest } from '@/lib/cron-auth'

describe('isAuthorizedCronRequest', () => {
  it('accepts a matching bearer token', () => {
    const headers = new Headers({ authorization: 'Bearer secret-token' })

    expect(isAuthorizedCronRequest(headers, 'secret-token')).toBe(true)
  })

  it('rejects a missing or invalid bearer token', () => {
    expect(isAuthorizedCronRequest(new Headers(), 'secret-token')).toBe(false)
    expect(
      isAuthorizedCronRequest(new Headers({ authorization: 'Bearer nope' }), 'secret-token')
    ).toBe(false)
  })

  describe('when no secret configured', () => {
    beforeEach(() => {
      vi.stubEnv('NODE_ENV', 'test')
    })

    afterEach(() => {
      vi.unstubAllEnvs()
    })

    it('allows requests in non-production when secret is absent', () => {
      expect(isAuthorizedCronRequest(new Headers(), undefined)).toBe(true)
    })

    it('rejects all requests in production when secret is absent and warns', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      vi.stubEnv('NODE_ENV', 'production')

      expect(isAuthorizedCronRequest(new Headers(), undefined)).toBe(false)
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('CRON_SECRET is not set'))

      warnSpy.mockRestore()
    })
  })
})
