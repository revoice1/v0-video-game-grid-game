export function isAuthorizedCronRequest(
  headers: Pick<Headers, 'get'>,
  secret = process.env.CRON_SECRET
): boolean {
  if (!secret) {
    return process.env.NODE_ENV !== 'production'
  }

  return headers.get('authorization') === `Bearer ${secret}`
}
