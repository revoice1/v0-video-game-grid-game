'use client'

import { useCallback, useEffect, useState } from 'react'

const SEARCH_CONFIRM_STORAGE_KEY = 'gamegrid_search_confirm'
const VERSUS_ALARMS_STORAGE_KEY = 'gamegrid_versus_alarms'
const ANIMATIONS_STORAGE_KEY = 'gamegrid_animations'
const UI_PREFERENCES_EVENT = 'gamegrid-ui-preferences'

function readBooleanPreference(storageKey: string, defaultValue: boolean): boolean {
  if (typeof window === 'undefined') {
    return defaultValue
  }

  const storedValue = window.localStorage.getItem(storageKey)
  return storedValue === null ? defaultValue : storedValue === 'true'
}

function writeBooleanPreference(storageKey: string, enabled: boolean) {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.setItem(storageKey, String(enabled))
  window.dispatchEvent(new CustomEvent(UI_PREFERENCES_EVENT))
}

function useBooleanPreference(storageKey: string, defaultValue: boolean) {
  const [mounted, setMounted] = useState(false)
  const [enabled, setEnabled] = useState(defaultValue)

  useEffect(() => {
    setMounted(true)
    setEnabled(readBooleanPreference(storageKey, defaultValue))

    const handlePreferenceChange = () => {
      setEnabled(readBooleanPreference(storageKey, defaultValue))
    }

    window.addEventListener(UI_PREFERENCES_EVENT, handlePreferenceChange)
    window.addEventListener('storage', handlePreferenceChange)

    return () => {
      window.removeEventListener(UI_PREFERENCES_EVENT, handlePreferenceChange)
      window.removeEventListener('storage', handlePreferenceChange)
    }
  }, [defaultValue, storageKey])

  const updateEnabled = useCallback(
    (nextEnabled: boolean) => {
      setEnabled(nextEnabled)
      writeBooleanPreference(storageKey, nextEnabled)
    },
    [storageKey]
  )

  return {
    mounted,
    enabled,
    setEnabled: updateEnabled,
  }
}

export function useSearchConfirmPreference() {
  return useBooleanPreference(SEARCH_CONFIRM_STORAGE_KEY, true)
}

export function useVersusAlarmPreference() {
  return useBooleanPreference(VERSUS_ALARMS_STORAGE_KEY, true)
}

export function useAnimationPreference() {
  const preference = useBooleanPreference(ANIMATIONS_STORAGE_KEY, true)

  useEffect(() => {
    if (typeof document === 'undefined') {
      return
    }

    document.documentElement.dataset.gamegridAnimations = preference.enabled ? 'on' : 'off'
  }, [preference.enabled])

  return preference
}
