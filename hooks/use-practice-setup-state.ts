import { useState } from 'react'
import type { VersusCategoryFilters } from '@/components/game/versus-setup-modal'

export function usePracticeSetupState() {
  const [practiceCategoryFilters, setPracticeCategoryFilters] = useState<VersusCategoryFilters>({})
  const [practiceMinimumValidOptions, setPracticeMinimumValidOptions] = useState<number | null>(
    null
  )
  const [showPracticeSetup, setShowPracticeSetup] = useState(false)
  const [showPracticeStartOptions, setShowPracticeStartOptions] = useState(false)
  const [practiceSetupError, setPracticeSetupError] = useState<string | null>(null)

  return {
    practiceCategoryFilters,
    setPracticeCategoryFilters,
    practiceMinimumValidOptions,
    setPracticeMinimumValidOptions,
    showPracticeSetup,
    setShowPracticeSetup,
    showPracticeStartOptions,
    setShowPracticeStartOptions,
    practiceSetupError,
    setPracticeSetupError,
  }
}
