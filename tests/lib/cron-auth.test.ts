import { describe, expect, it } from 'vitest'
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
})
