import { useState } from 'react'
import type {
  VersusCategoryFilters,
  VersusStealRule,
  VersusTurnTimerOption,
} from '@/components/game/versus-setup-modal'

export function useVersusSetupState() {
  const [versusCategoryFilters, setVersusCategoryFilters] = useState<VersusCategoryFilters>({})
  const [versusStealRule, setVersusStealRule] = useState<VersusStealRule>('lower')
  const [versusTimerOption, setVersusTimerOption] = useState<VersusTurnTimerOption>('none')
  const [showVersusSetup, setShowVersusSetup] = useState(false)
  const [showVersusStartOptions, setShowVersusStartOptions] = useState(false)
  const [versusSetupError, setVersusSetupError] = useState<string | null>(null)

  return {
    versusCategoryFilters,
    setVersusCategoryFilters,
    versusStealRule,
    setVersusStealRule,
    versusTimerOption,
    setVersusTimerOption,
    showVersusSetup,
    setShowVersusSetup,
    showVersusStartOptions,
    setShowVersusStartOptions,
    versusSetupError,
    setVersusSetupError,
  }
}
