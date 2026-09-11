/**
 * Web/base implementation. Metro resolves nativeMonitoring.native.ts on iOS
 * and Android, keeping the native Sentry SDK out of the web bundle.
 */
export function initNativeMonitoring(): void {}

export function captureNativeException(
  _error: Error,
  _context?: Record<string, unknown>,
): void {}

export function captureNativeMessage(
  _message: string,
  _context?: Record<string, unknown>,
): void {}

export function setNativeUser(
  _user: { id: string; username?: string } | null,
): void {}
