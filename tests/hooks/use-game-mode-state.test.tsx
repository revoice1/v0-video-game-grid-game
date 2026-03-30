import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { useGameModeState } from '@/hooks/use-game-mode-state'

describe('useGameModeState', () => {
  beforeEach(() => {
    sessionStorage.clear()
  })

  it('defaults to daily when nothing is stored', () => {
    const { result } = renderHook(() => useGameModeState())

    expect(result.current.mode).toBe('daily')
    expect(result.current.loadedPuzzleMode).toBeNull()
  })

  it('restores a saved mode from session storage', () => {
    sessionStorage.setItem('gamegrid_active_mode', 'versus')

    const { result } = renderHook(() => useGameModeState())

    expect(result.current.mode).toBe('versus')
  })

  it('persists mode updates back to session storage', () => {
    const { result } = renderHook(() => useGameModeState())

    act(() => {
      result.current.setMode('practice')
    })

    expect(result.current.mode).toBe('practice')
    expect(sessionStorage.getItem('gamegrid_active_mode')).toBe('practice')
  })

  it('falls back to daily for invalid stored values', () => {
    sessionStorage.setItem('gamegrid_active_mode', 'arcade')

    const { result } = renderHook(() => useGameModeState())

    expect(result.current.mode).toBe('daily')
  })
})
