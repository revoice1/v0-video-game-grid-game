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
