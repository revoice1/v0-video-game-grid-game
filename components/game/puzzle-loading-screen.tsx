import { Progress } from '@/components/ui/progress'
import { getIntersectionLabelClass, type LoadingAttempt } from '@/components/game/loading-helpers'

type PuzzleLoadingMode = 'daily' | 'practice' | 'versus'

interface PuzzleLoadingScreenProps {
  mode: PuzzleLoadingMode
  loadingStage: string
  loadingProgress: number
  loadingAttempts: LoadingAttempt[]
}

function getRejectedIntersections(attempt: LoadingAttempt) {
  return attempt.intersections.filter((intersection) => intersection.status === 'failed')
}

function getLoadingDescription(mode: PuzzleLoadingMode, loadingProgress: number): string {
  if (mode === 'daily') {
    if (loadingProgress < 10) {
      return "Checking for today's puzzle..."
    }

    if (loadingProgress < 75) {
      return "Generating today's puzzle and validating intersections."
    }

    return 'Almost done!'
  }

  if (mode === 'versus') {
    return 'Building a local head-to-head board and validating each intersection.'
  }

  return 'Generating a fresh practice puzzle and sanity-checking each intersection.'
}

export function PuzzleLoadingScreen({
  mode,
  loadingStage,
  loadingProgress,
  loadingAttempts,
}: PuzzleLoadingScreenProps) {
  const activeAttempt = loadingAttempts[loadingAttempts.length - 1] ?? null
  const pastAttempts = loadingAttempts.slice(0, -1).reverse()

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-5xl md:flex md:items-start md:justify-center md:gap-4">
        <div className="w-full max-w-md rounded-2xl border border-border bg-card/70 p-6 shadow-xl backdrop-blur-sm">
          <p className="text-center text-sm font-semibold uppercase tracking-[0.24em] text-primary">
            {mode === 'daily'
              ? 'Daily Puzzle'
              : mode === 'versus'
                ? 'Setting Up Match'
                : 'Building Grid'}
          </p>
          <p className="mt-3 whitespace-pre-line text-center text-lg font-semibold text-foreground">
            {loadingStage}
          </p>
          <p className="mt-2 text-center text-sm text-muted-foreground">
            {getLoadingDescription(mode, loadingProgress)}
          </p>
          {mode !== 'daily' && (
            <div className="mt-6 space-y-2">
              <Progress value={loadingProgress} className="h-3" />
              <p className="text-right text-xs font-medium text-muted-foreground">
                {loadingProgress}% complete
              </p>
            </div>
          )}
          {mode !== 'daily' && pastAttempts.length > 0 && (
            <div className="mt-5 border-t border-border/70 pt-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Rejected Intersections
              </p>
              <div className="mt-2 space-y-1.5">
                {pastAttempts.map((attempt) => {
                  const failedIntersections = getRejectedIntersections(attempt)

                  return (
                    <div
                      key={`history-${attempt.attempt}`}
                      className="rounded-lg border border-border/60 bg-background/30 px-3 py-2 text-xs text-muted-foreground"
                    >
                      <p className="font-medium text-foreground/80">Attempt {attempt.attempt}</p>
                      {failedIntersections.length > 0 ? (
                        <div className="mt-1 space-y-1">
                          {failedIntersections.map((intersection) => (
                            <p
                              key={`${attempt.attempt}-${intersection.label}`}
                              className="break-words"
                            >
                              {intersection.label}
                              {typeof intersection.validOptionCount === 'number'
                                ? ` (${intersection.validOptionCount})`
                                : ''}
                            </p>
                          ))}
                        </div>
                      ) : (
                        <p className="mt-1 truncate">
                          {attempt.rejectedMessage ?? 'Moved on to a new board.'}
                        </p>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {mode !== 'daily' && (
          <aside className="mt-4 w-full rounded-2xl border border-border bg-card/70 p-4 shadow-xl backdrop-blur-sm md:mt-0 md:max-w-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">
              Attempt Notes
            </p>
            {!activeAttempt && (
              <p className="mt-3 text-sm text-muted-foreground">
                Waiting for the generator to pick a board...
              </p>
            )}
            {activeAttempt && (
              <div className="mt-3 space-y-3">
                <div className="rounded-xl border border-border/80 bg-secondary/30 p-3">
                  <p className="text-sm font-semibold text-foreground">
                    Attempt {activeAttempt.attempt}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Rows: {activeAttempt.rows.join(', ')}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Cols: {activeAttempt.cols.join(', ')}
                  </p>
                </div>
                <div className="space-y-1.5">
                  {activeAttempt.intersections.map((intersection) => (
                    <div
                      key={`${activeAttempt.attempt}-${intersection.label}`}
                      className="flex items-center justify-between rounded-lg border border-border/70 bg-background/40 px-3 py-2 text-xs"
                    >
                      <span
                        className={`pr-3 whitespace-nowrap text-foreground/90 ${getIntersectionLabelClass(intersection.label)}`}
                      >
                        {intersection.label}
                      </span>
                      <span className="shrink-0 text-muted-foreground">
                        {intersection.status === 'passed' &&
                          (typeof intersection.validOptionCount === 'number'
                            ? `${intersection.validOptionCount}`
                            : 'OK')}
                        {intersection.status === 'failed' &&
                          `X${typeof intersection.validOptionCount === 'number' ? ` ${intersection.validOptionCount}` : ''}`}
                        {intersection.status === 'pending' && '...'}
                      </span>
                    </div>
                  ))}
                </div>
                {activeAttempt.rejectedMessage && (
                  <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
                    {activeAttempt.rejectedMessage}
                  </p>
                )}
              </div>
            )}
          </aside>
        )}
      </div>
    </div>
  )
}
