import { useState } from 'react'
import type {
  VersusCategoryFilters,
  VersusObjectionRule,
  VersusStealRule,
  VersusTurnTimerOption,
} from '@/components/game/versus-setup-modal'

export function useVersusSetupState() {
  const [versusCategoryFilters, setVersusCategoryFilters] = useState<VersusCategoryFilters>({})
  const [versusMinimumValidOptions, setVersusMinimumValidOptions] = useState<number | null>(null)
  const [versusStealRule, setVersusStealRule] = useState<VersusStealRule>('fewer_reviews')
  const [versusTimerOption, setVersusTimerOption] = useState<VersusTurnTimerOption>(300)
  const [versusDisableDraws, setVersusDisableDraws] = useState(true)
  const [versusObjectionRule, setVersusObjectionRule] = useState<VersusObjectionRule>('one')
  const [showVersusSetup, setShowVersusSetup] = useState(false)
  const [showVersusStartOptions, setShowVersusStartOptions] = useState(false)
  const [versusSetupError, setVersusSetupError] = useState<string | null>(null)

  return {
    versusCategoryFilters,
    setVersusCategoryFilters,
    versusMinimumValidOptions,
    setVersusMinimumValidOptions,
    versusStealRule,
    setVersusStealRule,
    versusTimerOption,
    setVersusTimerOption,
    versusDisableDraws,
    setVersusDisableDraws,
    versusObjectionRule,
    setVersusObjectionRule,
    showVersusSetup,
    setShowVersusSetup,
    showVersusStartOptions,
    setShowVersusStartOptions,
    versusSetupError,
    setVersusSetupError,
  }
}
