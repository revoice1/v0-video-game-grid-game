'use client'

import { useCallback, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import type { OnlineVersusPhase } from '@/hooks/use-online-versus-room'
import type { RoomPlayer, VersusRoom } from '@/lib/versus-room'

interface OnlineVersusLobbyProps {
  isOpen: boolean
  phase: OnlineVersusPhase
  room: VersusRoom | null
  myRole: RoomPlayer | null
  errorMessage: string | null
  onCreateRoom: () => void
  onJoinRoom: (code: string) => void
  onDismiss: () => void
}

function humanizeError(raw: string | null): string {
  if (!raw) return 'Something went wrong. Please try again.'
  if (raw.toLowerCase().includes('full')) return 'That match already has two players.'
  if (raw.toLowerCase().includes('expired')) return 'That invite has expired.'
  if (raw.toLowerCase().includes('not found')) return "We couldn't find a match with that code."
  if (raw.toLowerCase().includes('ended') || raw.toLowerCase().includes('finished'))
    return 'That match has already ended.'
  if (raw.toLowerCase().includes('network'))
    return 'Connection error — check your internet and try again.'
  return raw
}

export function OnlineVersusLobby({
  isOpen,
  phase,
  room,
  myRole,
  errorMessage,
  onCreateRoom,
  onJoinRoom,
  onDismiss,
}: OnlineVersusLobbyProps) {
  const [joinCode, setJoinCode] = useState('')
  const [copiedWhat, setCopiedWhat] = useState<'code' | 'link' | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleJoinSubmit = useCallback(() => {
    const code = joinCode.trim().toUpperCase()
    if (code.length !== 6) return
    onJoinRoom(code)
  }, [joinCode, onJoinRoom])

  const handleCopy = useCallback(
    async (what: 'code' | 'link') => {
      if (!room?.code) return
      const text = what === 'code' ? room.code : `${window.location.origin}?join=${room.code}`

      // Try the modern Clipboard API first
      if (navigator.clipboard?.writeText) {
        try {
          await navigator.clipboard.writeText(text)
          setCopiedWhat(what)
          setTimeout(() => setCopiedWhat(null), 2000)
          return
        } catch {
          /* fall through to execCommand */
        }
      }

      // Fallback for non-secure contexts or browsers that block clipboard access
      const el = document.createElement('textarea')
      el.value = text
      el.style.cssText = 'position:fixed;top:-9999px;left:-9999px;opacity:0'
      document.body.appendChild(el)
      el.focus()
      el.select()
      try {
        document.execCommand('copy')
        setCopiedWhat(what)
        setTimeout(() => setCopiedWhat(null), 2000)
      } finally {
        document.body.removeChild(el)
      }
    },
    [room?.code]
  )

  const isLoading = phase === 'creating' || phase === 'joining'

  // Derive a title for the dialog based on phase
  const dialogTitle = (() => {
    if (phase === 'lobby' && myRole === 'x') return 'Waiting for opponent'
    if (phase === 'joining' || (phase === 'lobby' && myRole === 'o')) return 'Joining match…'
    if (phase === 'active') return 'Opponent connected'
    return 'Play online'
  })()

  const dialogDescription = (() => {
    if (phase === 'lobby' && myRole === 'x')
      return 'Share your invite link or match code with a friend.'
    if (phase === 'joining' || (phase === 'lobby' && myRole === 'o'))
      return room ? `Match code: ${room.code}` : 'Connecting to match…'
    if (phase === 'active')
      return myRole === 'o'
        ? "You're playing as O. X goes first."
        : "You're playing as X. You go first."
    return 'Challenge a friend to a live match on the same board.'
  })()

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onDismiss()
      }}
    >
      <DialogContent className="max-w-sm bg-card border-border">
        <DialogHeader>
          <DialogTitle>{dialogTitle}</DialogTitle>
          <DialogDescription>{dialogDescription}</DialogDescription>
        </DialogHeader>

        {/* ── Error ─────────────────────────────────────────────────────── */}
        {phase === 'error' && errorMessage && (
          <div className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {humanizeError(errorMessage)}
          </div>
        )}

        {/* ── Idle / pick action ─────────────────────────────────────────── */}
        {(phase === 'idle' || phase === 'error') && (
          <div className="space-y-3 pt-1">
            <Button className="w-full" onClick={onCreateRoom} disabled={isLoading}>
              Host a match
            </Button>

            <div className="relative flex items-center gap-2">
              <div className="h-px flex-1 bg-border" />
              <span className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                or
              </span>
              <div className="h-px flex-1 bg-border" />
            </div>

            <div className="flex gap-2">
              <input
                ref={inputRef}
                className="h-10 flex-1 rounded-lg border border-border bg-background px-3 font-mono text-sm uppercase tracking-widest placeholder:normal-case placeholder:tracking-normal placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="Match code"
                maxLength={6}
                value={joinCode}
                onChange={(e) =>
                  setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))
                }
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleJoinSubmit()
                }}
              />
              <Button
                variant="outline"
                onClick={handleJoinSubmit}
                disabled={joinCode.trim().length !== 6 || isLoading}
              >
                Join match
              </Button>
            </div>
          </div>
        )}

        {/* ── Creating spinner ───────────────────────────────────────────── */}
        {phase === 'creating' && (
          <div className="flex items-center justify-center py-6">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-border border-t-primary" />
            <span className="ml-3 text-sm text-muted-foreground">Creating match…</span>
          </div>
        )}

        {/* ── Joining / guest lobby ──────────────────────────────────────── */}
        {(phase === 'joining' || (phase === 'lobby' && myRole === 'o')) && (
          <div className="space-y-3 pt-1">
            {room && (
              <div className="rounded-xl border border-border bg-secondary/20 px-4 py-3 text-center">
                <p className="font-mono text-2xl font-black tracking-[0.22em] text-foreground">
                  {room.code}
                </p>
              </div>
            )}
            <div className="flex items-center gap-3 rounded-xl border border-border bg-background/55 px-4 py-3">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-border border-t-primary shrink-0" />
              <div>
                <p className="text-sm font-medium text-foreground">
                  {phase === 'joining' ? 'Joining match…' : 'Connecting…'}
                </p>
                <p className="text-xs text-muted-foreground">You&apos;ll play as O.</p>
              </div>
            </div>
          </div>
        )}

        {/* ── Host lobby — waiting for opponent ─────────────────────────── */}
        {phase === 'lobby' && myRole === 'x' && room && (
          <div className="space-y-4 pt-1">
            {/* Invite link — primary CTA */}
            <div className="space-y-1.5">
              <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                Invite link
              </p>
              <div className="flex gap-2">
                <input
                  readOnly
                  value={`${typeof window !== 'undefined' ? window.location.origin : ''}?join=${room.code}`}
                  onFocus={(e) => e.target.select()}
                  className="h-9 flex-1 min-w-0 rounded-lg border border-border bg-background px-3 font-mono text-xs text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring cursor-text"
                />
                <Button size="sm" onClick={() => handleCopy('link')} className="shrink-0">
                  {copiedWhat === 'link' ? 'Copied!' : 'Copy'}
                </Button>
              </div>
            </div>

            {/* Match code — secondary */}
            <div className="rounded-xl border border-border bg-secondary/20 p-4 text-center">
              <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                Match code
              </p>
              <p className="mt-1 font-mono text-3xl font-black tracking-[0.22em] text-foreground">
                {room.code}
              </p>
              <button
                onClick={() => handleCopy('code')}
                className="mt-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                {copiedWhat === 'code' ? 'Copied!' : 'Copy code'}
              </button>
            </div>

            <div className="flex items-center gap-3 rounded-xl border border-border bg-background/55 px-4 py-3">
              <div className="relative flex h-3 w-3 shrink-0">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
                <span className="relative inline-flex h-3 w-3 rounded-full bg-amber-400" />
              </div>
              <p className="text-sm text-muted-foreground">Waiting for opponent to join…</p>
            </div>
          </div>
        )}

        {/* ── Active — both players present ─────────────────────────────── */}
        {phase === 'active' && (
          <div className="space-y-3 pt-1">
            <div className={cn('rounded-xl border px-4 py-3', 'border-primary/30 bg-primary/10')}>
              <p className="text-sm font-semibold text-primary">
                {myRole === 'x' ? 'Opponent joined — you go first.' : "You're in — X goes first."}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                You are playing as <span className="font-bold">{myRole?.toUpperCase()}</span>.
                {myRole === 'x' ? ' The board is loading now.' : ' Waiting for the board to load.'}
              </p>
            </div>
            <Button className="w-full" onClick={onDismiss}>
              Enter match
            </Button>
          </div>
        )}

        {/* ── Cancel / dismiss ──────────────────────────────────────────── */}
        {(phase === 'lobby' || phase === 'error' || phase === 'creating') && (
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-muted-foreground"
            onClick={onDismiss}
          >
            Cancel
          </Button>
        )}
      </DialogContent>
    </Dialog>
  )
}
