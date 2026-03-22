import { describe, expect, it } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'
import { applyAnonymousSessionCookie, resolveAnonymousSession } from '@/lib/server-session'

describe('resolveAnonymousSession', () => {
  it('prefers the server-owned cookie when present', () => {
    const request = new NextRequest('http://localhost/api/guess', {
      headers: {
        cookie: 'gg_session=cookie-session',
      },
    })

    expect(resolveAnonymousSession(request, 'legacy-session')).toEqual({
      sessionId: 'cookie-session',
      shouldSetCookie: false,
    })
  })

  it('promotes an existing browser session id into the cookie when needed', () => {
    const request = new NextRequest('http://localhost/api/guess')

    expect(resolveAnonymousSession(request, 'legacy-session')).toEqual({
      sessionId: 'legacy-session',
      shouldSetCookie: true,
    })
  })

  it('creates a fresh session id when neither source exists', () => {
    const request = new NextRequest('http://localhost/api/guess')
    const resolved = resolveAnonymousSession(request)

    expect(resolved.shouldSetCookie).toBe(true)
    expect(resolved.sessionId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    )
  })
})

describe('applyAnonymousSessionCookie', () => {
  it('sets the cookie only when the response needs it', () => {
    const response = applyAnonymousSessionCookie(NextResponse.json({ ok: true }), {
      sessionId: 'cookie-session',
      shouldSetCookie: true,
    })

    expect(response.cookies.get('gg_session')?.value).toBe('cookie-session')
  })

  it('leaves the response alone when the cookie already exists', () => {
    const response = applyAnonymousSessionCookie(NextResponse.json({ ok: true }), {
      sessionId: 'cookie-session',
      shouldSetCookie: false,
    })

    expect(response.cookies.get('gg_session')).toBeUndefined()
  })
})
