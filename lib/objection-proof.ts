import { createHmac, timingSafeEqual } from 'node:crypto'
import type { Category } from './types'

const OBJECTION_PROOF_SECRET = process.env.OBJECTION_PROOF_SECRET ?? process.env.CRON_SECRET ?? ''
const OBJECTION_PROOF_TTL_MS = 10 * 60 * 1000

interface ObjectionProofPayload {
  gameId: number
  rowCategory: {
    type: Category['type']
    id: string
    name: string
  }
  colCategory: {
    type: Category['type']
    id: string
    name: string
  }
  verdict: 'sustained'
  issuedAt: number
}

function toStableCategoryShape(category: Category) {
  return {
    type: category.type,
    id: String(category.id),
    name: category.name,
  }
}

function base64UrlEncode(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64url')
}

function base64UrlDecode(value: string): string {
  return Buffer.from(value, 'base64url').toString('utf8')
}

function signPayload(encodedPayload: string): string {
  return createHmac('sha256', OBJECTION_PROOF_SECRET).update(encodedPayload).digest('base64url')
}

export function createObjectionProof(options: {
  gameId: number
  rowCategory: Category
  colCategory: Category
  verdict: 'sustained'
}): string | null {
  if (!OBJECTION_PROOF_SECRET) {
    return null
  }

  const payload: ObjectionProofPayload = {
    gameId: options.gameId,
    rowCategory: toStableCategoryShape(options.rowCategory),
    colCategory: toStableCategoryShape(options.colCategory),
    verdict: options.verdict,
    issuedAt: Date.now(),
  }

  const encodedPayload = base64UrlEncode(JSON.stringify(payload))
  const signature = signPayload(encodedPayload)
  return `${encodedPayload}.${signature}`
}

export function verifyObjectionProof(
  proof: string | null | undefined,
  options: {
    gameId: number
    rowCategory: Category
    colCategory: Category
    verdict: 'sustained'
    now?: number
  }
): boolean {
  if (!OBJECTION_PROOF_SECRET || typeof proof !== 'string') {
    return false
  }

  const [encodedPayload, providedSignature] = proof.split('.')
  if (!encodedPayload || !providedSignature) {
    return false
  }

  const expectedSignature = signPayload(encodedPayload)
  const providedBuffer = Buffer.from(providedSignature, 'utf8')
  const expectedBuffer = Buffer.from(expectedSignature, 'utf8')
  if (
    providedBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(providedBuffer, expectedBuffer)
  ) {
    return false
  }

  let parsed: ObjectionProofPayload
  try {
    parsed = JSON.parse(base64UrlDecode(encodedPayload)) as ObjectionProofPayload
  } catch {
    return false
  }

  const now = options.now ?? Date.now()
  if (
    parsed.verdict !== options.verdict ||
    parsed.gameId !== options.gameId ||
    parsed.rowCategory.type !== options.rowCategory.type ||
    parsed.rowCategory.id !== String(options.rowCategory.id) ||
    parsed.rowCategory.name !== options.rowCategory.name ||
    parsed.colCategory.type !== options.colCategory.type ||
    parsed.colCategory.id !== String(options.colCategory.id) ||
    parsed.colCategory.name !== options.colCategory.name
  ) {
    return false
  }

  if (!Number.isFinite(parsed.issuedAt) || now - parsed.issuedAt > OBJECTION_PROOF_TTL_MS) {
    return false
  }

  return true
}
