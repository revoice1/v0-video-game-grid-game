const TRANSFER_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const TRANSFER_CODE_RAW_LENGTH = 8
const TRANSFER_CODE_GROUP_LENGTH = TRANSFER_CODE_RAW_LENGTH / 2

export const TRANSFER_CODE_TTL_MINUTES = 10
export const TRANSFER_CODE_RE = /^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/

export function createTransferCode() {
  const randomValues = new Uint8Array(TRANSFER_CODE_RAW_LENGTH)
  crypto.getRandomValues(randomValues)

  const raw = Array.from(
    randomValues,
    (value) => TRANSFER_CODE_ALPHABET[value % TRANSFER_CODE_ALPHABET.length]
  ).join('')
  return `${raw.slice(0, TRANSFER_CODE_GROUP_LENGTH)}-${raw.slice(TRANSFER_CODE_GROUP_LENGTH)}`
}

export function createTransferExpiryDate(now = new Date()) {
  return new Date(now.getTime() + TRANSFER_CODE_TTL_MINUTES * 60_000)
}

export function normalizeTransferCode(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null
  }

  const compact = value.toUpperCase().replace(/[^A-Z0-9]/g, '')
  if (compact.length !== TRANSFER_CODE_RAW_LENGTH) {
    return null
  }

  if (!/^[A-HJ-NP-Z2-9]+$/.test(compact)) {
    return null
  }

  return `${compact.slice(0, TRANSFER_CODE_GROUP_LENGTH)}-${compact.slice(TRANSFER_CODE_GROUP_LENGTH)}`
}
