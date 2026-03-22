import { useState } from 'react'
import type { VersusCategoryFilters } from '@/components/game/versus-setup-modal'

export function usePracticeSetupState() {
  const [practiceCategoryFilters, setPracticeCategoryFilters] = useState<VersusCategoryFilters>({})
  const [showPracticeSetup, setShowPracticeSetup] = useState(false)
  const [showPracticeStartOptions, setShowPracticeStartOptions] = useState(false)
  const [practiceSetupError, setPracticeSetupError] = useState<string | null>(null)

  return {
    practiceCategoryFilters,
    setPracticeCategoryFilters,
    showPracticeSetup,
    setShowPracticeSetup,
    showPracticeStartOptions,
    setShowPracticeStartOptions,
    practiceSetupError,
    setPracticeSetupError,
  }
}
