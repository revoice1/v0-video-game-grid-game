'use client'

import { useCallback, useEffect, useState } from 'react'

const SEARCH_CONFIRM_STORAGE_KEY = 'gamegrid_search_confirm'
const UI_PREFERENCES_EVENT = 'gamegrid-ui-preferences'

function readSearchConfirmPreference(): boolean {
  if (typeof window === 'undefined') {
    return false
  }

  return window.localStorage.getItem(SEARCH_CONFIRM_STORAGE_KEY) === 'true'
}

function writeSearchConfirmPreference(enabled: boolean) {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.setItem(SEARCH_CONFIRM_STORAGE_KEY, String(enabled))
  window.dispatchEvent(new CustomEvent(UI_PREFERENCES_EVENT))
}

export function useSearchConfirmPreference() {
  const [mounted, setMounted] = useState(false)
  const [enabled, setEnabled] = useState(false)

  useEffect(() => {
    setMounted(true)
    setEnabled(readSearchConfirmPreference())

    const handlePreferenceChange = () => {
      setEnabled(readSearchConfirmPreference())
    }

    window.addEventListener(UI_PREFERENCES_EVENT, handlePreferenceChange)
    window.addEventListener('storage', handlePreferenceChange)

    return () => {
      window.removeEventListener(UI_PREFERENCES_EVENT, handlePreferenceChange)
      window.removeEventListener('storage', handlePreferenceChange)
    }
  }, [])

  const updateEnabled = useCallback((nextEnabled: boolean) => {
    setEnabled(nextEnabled)
    writeSearchConfirmPreference(nextEnabled)
  }, [])

  return {
    mounted,
    enabled,
    setEnabled: updateEnabled,
  }
}
