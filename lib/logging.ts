export const LOG_PREFIX = '[GG]'

export function logInfo(message: string, ...args: unknown[]) {
  console.log(`${LOG_PREFIX} ${message}`, ...args)
}

export function logWarn(message: string, ...args: unknown[]) {
  console.warn(`${LOG_PREFIX} ${message}`, ...args)
}

export function logError(message: string, ...args: unknown[]) {
  console.error(`${LOG_PREFIX} ${message}`, ...args)
}

/**
 * Generates a short random request ID for correlating log lines within a
 * single request. Not cryptographically strong — used only for log tracing.
 */
export function generateRequestId(): string {
  return Math.random().toString(36).slice(2, 10)
}

export interface RequestLogger {
  requestId: string
  info(message: string, context?: Record<string, unknown>): void
  warn(message: string, context?: Record<string, unknown>): void
  error(message: string, context?: Record<string, unknown>): void
}

/**
 * Creates a logger bound to a request ID. Every call includes
 * `{ requestId }` so all log lines for a request are correlatable.
 *
 * Usage:
 *   const logger = createRequestLogger()
 *   logger.info('Fetching room', { code })
 *   logger.error('DB error', { error })
 */
export function createRequestLogger(requestId = generateRequestId()): RequestLogger {
  return {
    requestId,
    info(message, context) {
      logInfo(message, { requestId, ...context })
    },
    warn(message, context) {
      logWarn(message, { requestId, ...context })
    },
    error(message, context) {
      logError(message, { requestId, ...context })
    },
  }
}
