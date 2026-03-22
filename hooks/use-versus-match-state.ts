import { useState } from 'react'

type VersusMatchStateOptions<TVersusRecord> = {
  initialRecord: TVersusRecord
}

export function useVersusMatchState<TVersusRecord, TPendingFinalSteal>({
  initialRecord,
}: VersusMatchStateOptions<TVersusRecord>) {
  const [turnTimeLeft, setTurnTimeLeft] = useState<number | null>(null)
  const [versusRecord, setVersusRecord] = useState<TVersusRecord>(initialRecord)
  const [pendingFinalSteal, setPendingFinalSteal] = useState<TPendingFinalSteal | null>(null)
  const [lockImpactCell, setLockImpactCell] = useState<number | null>(null)

  return {
    turnTimeLeft,
    setTurnTimeLeft,
    versusRecord,
    setVersusRecord,
    pendingFinalSteal,
    setPendingFinalSteal,
    lockImpactCell,
    setLockImpactCell,
  }
}
