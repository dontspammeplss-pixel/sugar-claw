import {
  createStateController,
  type ControllerAction,
  type GameState,
  type StateController,
} from '../state/controller'

function event(type: ControllerAction['type'], runId: number): ControllerAction {
  switch (type) {
    case 'poseReached':
      return { type, pose: 'lowered', runId }
    case 'alignmentSettled':
    case 'liftReached':
    case 'returnReached':
      return { type, runId }
    case 'gripEvaluated':
      return { type, outcome: 'success', runId }
    case 'releaseComplete':
      return { type, outcome: 'success', runId }
    case 'baselineRestored':
      return { type, status: 'ready', runId }
    case 'resetFailed':
      return { type, error: 'reset failed', runId }
    case 'invariantFailure':
      return { type, error: 'invariant failed', runId }
    default:
      throw new Error(`Unsupported evidence event: ${type}`)
  }
}

function toState(controller: StateController, target: Exclude<GameState, 'booting'>): void {
  if (target === 'ready') {
    controller.dispatch({ type: 'assetsReady' })
    return
  }
  controller.dispatch({ type: 'assetsReady' })
  if (target === 'aiming') {
    controller.dispatch({ type: 'beginAim' })
    return
  }
  controller.dispatch({ type: 'beginAim' })
  controller.dispatch({ type: 'moveAim', axis: 'x', value: 0.25 })
  if (target === 'lowering') {
    controller.dispatch({ type: 'confirmDrop' })
    return
  }
  controller.dispatch({ type: 'confirmDrop' })
  const completions: Array<[Exclude<GameState, 'booting' | 'ready' | 'aiming' | 'lowering'>, ControllerAction['type']]> = [
    ['aligning', 'poseReached'],
    ['gripping', 'alignmentSettled'],
    ['lifting', 'gripEvaluated'],
    ['returning', 'liftReached'],
    ['releasing', 'returnReached'],
    ['result', 'releaseComplete'],
  ]
  for (const [state, actionType] of completions) {
    controller.dispatch(event(actionType, controller.snapshot().runId))
    if (target === state) return
  }
}

function completeRun(controller: StateController): void {
  toState(controller, 'result')
}

export function createN5Evidence() {
  const legal = createStateController()
  completeRun(legal)
  const beforeReset = legal.snapshot()
  legal.dispatch({ type: 'requestReset' })
  const resetRunId = legal.snapshot().runId
  legal.dispatch({ type: 'baselineRestored', status: 'ready', runId: resetRunId })

  const interrupted = createStateController()
  interrupted.dispatch({ type: 'assetsReady' })
  interrupted.dispatch({ type: 'beginAim' })
  interrupted.dispatch({ type: 'confirmDrop' })
  const staleRunId = interrupted.snapshot().runId
  interrupted.dispatch({ type: 'requestReset' })
  const activeRunId = interrupted.snapshot().runId
  const stale = interrupted.dispatch({
    type: 'poseReached',
    pose: 'lowered',
    runId: staleRunId,
  })
  interrupted.dispatch({ type: 'baselineRestored', status: 'ready', runId: activeRunId })

  const error = createStateController()
  error.dispatch({ type: 'assetLoadFailed', error: 'asset unavailable' })
  error.dispatch({ type: 'retryLoad' })
  const errorRecovery = error.snapshot()

  const resetFromEveryState = Object.fromEntries(
    (['booting', 'ready', 'aiming', 'lowering', 'aligning', 'gripping', 'lifting', 'returning', 'releasing', 'result', 'resetting', 'error'] as const).map(
      (state) => {
        const controller = createStateController()
        if (state === 'resetting') {
          controller.dispatch({ type: 'requestReset' })
          controller.dispatch({ type: 'requestReset' })
        } else if (state === 'error') {
          controller.dispatch({ type: 'invariantFailure', error: 'fixture error', runId: 1 })
          controller.dispatch({ type: 'requestReset' })
        } else if (state !== 'booting') {
          toState(controller, state)
          controller.dispatch({ type: 'requestReset' })
        } else {
          controller.dispatch({ type: 'requestReset' })
        }
        const runId = controller.snapshot().runId
        controller.dispatch({ type: 'baselineRestored', status: 'ready', runId })
        return [state, {
          state: controller.snapshot().state,
          runId: controller.snapshot().runId,
          resetAccepted: controller.snapshot().transitions.some(
            (transition) => transition.event === 'requestReset',
          ),
        }]
      },
    ),
  )

  return {
    node: 'N5',
    baseline: 'gate-1-baseline-rev1',
    deterministic: true,
    legalSequence: beforeReset.transitions.map(({ from, event, to, runId }) => ({ from, event, to, runId })),
    resetSequence: legal.snapshot().transitions.slice(-2),
    resetFromEveryState,
    interruptedAction: {
      staleRunId,
      activeRunId,
      staleAccepted: stale.accepted,
      finalState: interrupted.snapshot().state,
      diagnostic: interrupted.snapshot().diagnostics.at(-1),
    },
    errorRecovery,
  }
}

export function serializeN5Evidence(): string {
  return JSON.stringify(createN5Evidence(), null, 2)
}

export const N5_EVIDENCE_JSON = serializeN5Evidence()
