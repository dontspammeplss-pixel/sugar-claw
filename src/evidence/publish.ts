import type { N7RuntimeReport } from '../effects/n7-coordinator'
import type { RuntimeSceneReport } from '../scene/report'

/**
 * N15: single publisher for runtime evidence. Every window global and DOM
 * attribute that carries the test harness (`__N7_RUNTIME_REPORT__`,
 * `__N3_RUNTIME_REPORT__`, `data-n7-*`, `data-n3-*`) is written only from
 * this module, so the N7 coordinator and the N3 canvas never touch
 * `document` or `window` themselves.
 *
 * Note: the N7RuntimeReport/N3RuntimeReport imports are type-only; there is
 * no runtime dependency back onto the coordinator or the canvas.
 */

declare global {
  interface Window {
    __N7_RUNTIME_REPORT__?: N7RuntimeReport
    __N3_RUNTIME_REPORT__?: RuntimeSceneReport
  }
}

let cachedShell: HTMLElement | null = null

/** Resolves and caches the app-shell element that carries evidence attributes. */
function appShell(): HTMLElement | null {
  if (cachedShell?.isConnected) return cachedShell
  cachedShell = document.querySelector<HTMLElement>('.app-shell')
  return cachedShell
}

function setAttribute(
  element: HTMLElement | null,
  name: string,
  value: string,
): void {
  if (element && element.getAttribute(name) !== value) {
    element.setAttribute(name, value)
  }
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export function publishN7RuntimeReport(report: N7RuntimeReport): void {
  window.__N7_RUNTIME_REPORT__ = report
  const shell = appShell()
  if (!shell) return
  const sync =
    report.sync && report.sync.clawSynchronized && report.sync.prizeSynchronized
      ? 'pass'
      : 'pending'
  setAttribute(shell, 'data-n7-state', report.state.state)
  setAttribute(shell, 'data-n7-sync', sync)
}

export function publishN7RuntimeError(error: unknown): void {
  const shell = appShell()
  setAttribute(shell, 'data-n7-state', 'error')
  setAttribute(shell, 'data-n7-error', errorMessage(error))
}

export function publishN3RuntimeReport(report: RuntimeSceneReport): void {
  window.__N3_RUNTIME_REPORT__ = report
  const shell = appShell()
  setAttribute(
    shell,
    'data-n3-runtime',
    report.validation.length === 0 ? 'pass' : 'fail',
  )
  setAttribute(shell, 'data-n3-runtime-errors', report.validation.join('|'))
}

export function clearN3RuntimeReport(): void {
  delete window.__N3_RUNTIME_REPORT__
}
