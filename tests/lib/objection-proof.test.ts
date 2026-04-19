import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Category } from '@/lib/types'

const rowCategory: Category = {
  type: 'genre',
  id: 31,
  name: 'Adventure',
}

const colCategory: Category = {
  type: 'theme',
  id: 43,
  name: 'Mystery',
}

describe('objection proof helpers', () => {
  beforeEach(() => {
    vi.resetModules()
    process.env.OBJECTION_PROOF_SECRET = 'test-proof-secret'
  })

  it('creates and verifies a sustained objection proof', async () => {
    const { createObjectionProof, verifyObjectionProof } = await import('@/lib/objection-proof')

    const proof = createObjectionProof({
      gameId: 7650,
      rowCategory,
      colCategory,
      verdict: 'sustained',
    })

    expect(proof).toEqual(expect.any(String))
    expect(
      verifyObjectionProof(proof, {
        gameId: 7650,
        rowCategory,
        colCategory,
        verdict: 'sustained',
      })
    ).toBe(true)
  })

  it('rejects a proof for a different category pair', async () => {
    const { createObjectionProof, verifyObjectionProof } = await import('@/lib/objection-proof')

    const proof = createObjectionProof({
      gameId: 7650,
      rowCategory,
      colCategory,
      verdict: 'sustained',
    })

    expect(
      verifyObjectionProof(proof, {
        gameId: 7650,
        rowCategory,
        colCategory: {
          ...colCategory,
          name: 'Science fiction',
        },
        verdict: 'sustained',
      })
    ).toBe(false)
  })
})
