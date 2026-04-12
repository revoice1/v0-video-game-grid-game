export function isAuthorizedCronRequest(
  headers: Pick<Headers, 'get'>,
  secret = process.env.CRON_SECRET
): boolean {
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      console.warn(
        '[cron-auth] CRON_SECRET is not set in production — all cron requests will be rejected'
      )
    }
    return process.env.NODE_ENV !== 'production'
  }

  return headers.get('authorization') === `Bearer ${secret}`
}
