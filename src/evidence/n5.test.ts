import { describe, expect, it } from 'vitest'
import {
  createStateController,
  createStateStore,
  GAME_STATES,
  type Command,
  type ControllerAction,
  type GameState,
  type StateController,
} from '../state/controller'
import { createN5Evidence } from './n5-evidence'

const runEvent = (controller: StateController, action: ControllerAction) =>
  controller.dispatch({
    ...action,
    ...('runId' in action ? { runId: controller.snapshot().runId } : {}),
  } as ControllerAction)

function enterState(controller: StateController, state: GameState): void {
  if (state === 'booting') return
  if (state === 'error') {
    controller.dispatch({ type: 'assetLoadFailed', error: 'asset unavailable' })
    return
  }
  if (state === 'resetting') {
    controller.dispatch({ type: 'requestReset' })
    return
  }

  controller.dispatch({ type: 'assetsReady' })
  if (state === 'ready') return
  controller.dispatch({ type: 'beginAim' })
  if (state === 'aiming') return
  controller.dispatch({ type: 'moveAim', axis: 'x', value: 0.25 })
  controller.dispatch({ type: 'confirmDrop' })
  if (state === 'lowering') return
  runEvent(controller, { type: 'poseReached', pose: 'lowered', runId: 0 })
  if (state === 'aligning') return
  runEvent(controller, { type: 'alignmentSettled', runId: 0 })
  if (state === 'gripping') return
  runEvent(controller, { type: 'gripEvaluated', outcome: 'success', runId: 0 })
  if (state === 'lifting') return
  runEvent(controller, { type: 'liftReached', runId: 0 })
  if (state === 'returning') return
  runEvent(controller, { type: 'returnReached', runId: 0 })
  if (state === 'releasing') return
  runEvent(controller, { type: 'releaseComplete', outcome: 'success', runId: 0 })
  expect(controller.snapshot().state).toBe('result')
}

function actionForCommand(command: Command): Command {
  if (command.type === 'moveAim') return { ...command, value: 0.5 }
  if (command.type === 'retryLoad') return command
  return command
}

function commandExpected(state: GameState, command: Command): boolean {
  if (command.type === 'requestReset') return state !== 'resetting'
  if (command.type === 'beginAim') return state === 'ready'
  if (command.type === 'moveAim') return state === 'aiming'
  if (command.type === 'confirmDrop') return state === 'aiming'
  return state === 'error'
}

describe('N5 typed state controller', () => {
  it('executes the complete legal interaction sequence and reset', () => {
    const controller = createStateController()
    controller.dispatch({ type: 'bootRequested' })
    controller.dispatch({ type: 'assetsReady' })
    controller.dispatch({ type: 'beginAim' })
    controller.dispatch({ type: 'moveAim', axis: 'x', value: 0.4 })
    controller.dispatch({ type: 'confirmDrop' })
    runEvent(controller, { type: 'poseReached', pose: 'lowered', runId: 0 })
    runEvent(controller, { type: 'alignmentSettled', runId: 0 })
    runEvent(controller, { type: 'gripEvaluated', outcome: 'success', runId: 0 })
    runEvent(controller, { type: 'liftReached', runId: 0 })
    runEvent(controller, { type: 'returnReached', runId: 0 })
    runEvent(controller, { type: 'releaseComplete', outcome: 'success', runId: 0 })

    expect(controller.snapshot().state).toBe('result')
    expect(controller.snapshot().outcome).toBe('success')
    expect(controller.snapshot().transitions.map(({ from, event, to }) => [from, event, to])).toEqual([
      ['booting', 'assetsReady', 'ready'],
      ['ready', 'beginAim', 'aiming'],
      ['aiming', 'moveAim', 'aiming'],
      ['aiming', 'confirmDrop', 'lowering'],
      ['lowering', 'poseReached', 'aligning'],
      ['aligning', 'alignmentSettled', 'gripping'],
      ['gripping', 'gripEvaluated', 'lifting'],
      ['lifting', 'liftReached', 'returning'],
      ['returning', 'returnReached', 'releasing'],
      ['releasing', 'releaseComplete', 'result'],
    ])

    const oldRunId = controller.snapshot().runId
    controller.dispatch({ type: 'requestReset' })
    expect(controller.snapshot().runId).toBe(oldRunId + 1)
    const resetRunId = controller.snapshot().runId
    controller.dispatch({ type: 'baselineRestored', status: 'ready', runId: resetRunId })
    expect(controller.snapshot()).toMatchObject({
      state: 'ready',
      aim: { x: 0, z: 0 },
      gripOutcome: null,
      resultOutcome: null,
      outcome: null,
    })
  })

  it('implements the command legality table for every command in every state', () => {
    const commands: Command[] = [
      { type: 'beginAim' },
      { type: 'moveAim', axis: 'x', value: 0.5 },
      { type: 'confirmDrop' },
      { type: 'requestReset' },
      { type: 'retryLoad' },
    ]

    for (const state of GAME_STATES) {
      for (const command of commands) {
        const controller = createStateController()
        enterState(controller, state)
        const before = controller.snapshot()
        const result = controller.dispatch(actionForCommand(command))
        expect(result.accepted, `${command.type} from ${state}`).toBe(commandExpected(state, command))
        if (commandExpected(state, command)) {
          if (command.type === 'requestReset') expect(result.snapshot.state).toBe('resetting')
          if (command.type === 'beginAim') expect(result.snapshot.state).toBe('aiming')
          if (command.type === 'confirmDrop') expect(result.snapshot.state).toBe('lowering')
          if (command.type === 'retryLoad') expect(result.snapshot.state).toBe('booting')
        } else {
          expect(result.snapshot.state).toBe(before.state)
          expect(result.snapshot.diagnostics.at(-1)?.kind).toBe(
            state === 'resetting' && command.type === 'requestReset'
              ? 'coalesced-reset'
              : 'rejected-command',
          )
        }
      }
    }
  })

  it('treats bootRequested as an idempotent lifecycle no-op with diagnostics', () => {
    const controller = createStateController()
    const result = controller.dispatch({ type: 'bootRequested' })

    expect(result).toMatchObject({ accepted: false, kind: 'noop' })
    expect(result.snapshot.state).toBe('booting')
    expect(result.snapshot.transitions).toEqual([])
    expect(result.snapshot.diagnostics.at(-1)).toMatchObject({
      kind: 'ignored-event',
      action: 'bootRequested',
    })
  })

  it('rejects out-of-state completion events and keeps state unchanged', () => {
    const controller = createStateController()
    const result = controller.dispatch({
      type: 'releaseComplete',
      outcome: 'success',
      runId: controller.snapshot().runId,
    })

    expect(result.accepted).toBe(false)
    expect(result.snapshot.state).toBe('booting')
    expect(result.snapshot.diagnostics.at(-1)).toMatchObject({
      kind: 'rejected-event',
      action: 'releaseComplete',
    })
  })

  it('resets from every state, including a coalesced resetting request', () => {
    for (const state of GAME_STATES) {
      const controller = createStateController()
      enterState(controller, state)
      const beforeResetRunId = controller.snapshot().runId
      const first = controller.dispatch({ type: 'requestReset' })
      const second = controller.dispatch({ type: 'requestReset' })
      expect(first.accepted, `reset from ${state}`).toBe(state !== 'resetting')
      expect(second.accepted).toBe(false)
      expect(controller.snapshot().state).toBe('resetting')
      expect(controller.snapshot().runId).toBe(state === 'resetting' ? beforeResetRunId : beforeResetRunId + 1)
      expect(controller.snapshot().diagnostics.at(-1)?.kind).toBe('coalesced-reset')

      const resetRunId = controller.snapshot().runId
      controller.dispatch({ type: 'baselineRestored', status: 'ready', runId: resetRunId })
      expect(controller.snapshot().state).toBe('ready')
      expect(controller.snapshot().aim).toEqual({ x: 0, z: 0 })
    }
  })

  it('ignores stale callbacks after an interrupted action', () => {
    const controller = createStateController()
    controller.dispatch({ type: 'assetsReady' })
    controller.dispatch({ type: 'beginAim' })
    controller.dispatch({ type: 'confirmDrop' })
    const oldRunId = controller.snapshot().runId
    controller.dispatch({ type: 'requestReset' })
    const newRunId = controller.snapshot().runId
    const before = controller.snapshot()

    const stale = controller.dispatch({ type: 'poseReached', pose: 'lowered', runId: oldRunId })
    expect(stale.accepted).toBe(false)
    expect(stale.snapshot.state).toBe('resetting')
    expect(stale.snapshot.runId).toBe(newRunId)
    expect(stale.snapshot.transitions).toEqual(before.transitions)
    expect(stale.snapshot.diagnostics.at(-1)).toMatchObject({
      kind: 'stale-callback',
      callbackRunId: oldRunId,
    })
  })

  it('clamps bounded local aim and rejects invalid aim without mutation', () => {
    const controller = createStateController({ aimBounds: { x: [-2, 2], z: [-0.5, 0.5] } })
    controller.dispatch({ type: 'assetsReady' })
    controller.dispatch({ type: 'beginAim' })
    controller.dispatch({ type: 'moveAim', axis: 'x', value: 99 })
    controller.dispatch({ type: 'moveAim', axis: 'z', value: -99 })
    expect(controller.snapshot().aim).toEqual({ x: 2, z: -0.5 })

    const before = controller.snapshot()
    const invalid = controller.dispatch({ type: 'moveAim', axis: 'x', value: Number.NaN })
    expect(invalid.accepted).toBe(false)
    expect(invalid.snapshot.aim).toEqual(before.aim)
    expect(invalid.snapshot.diagnostics.at(-1)?.kind).toBe('rejected-command')
  })

  it('supports needsLoad reset completion and reset failure recovery paths', () => {
    const needsLoad = createStateController()
    needsLoad.dispatch({ type: 'requestReset' })
    const needsLoadRunId = needsLoad.snapshot().runId
    needsLoad.dispatch({ type: 'baselineRestored', status: 'needsLoad', runId: needsLoadRunId })
    expect(needsLoad.snapshot()).toMatchObject({ state: 'booting', errorKind: null })

    const failedReset = createStateController()
    failedReset.dispatch({ type: 'requestReset' })
    const failedResetRunId = failedReset.snapshot().runId
    failedReset.dispatch({ type: 'resetFailed', error: 'baseline unavailable', runId: failedResetRunId })
    expect(failedReset.snapshot()).toMatchObject({
      state: 'error',
      errorKind: 'reset',
      lastError: 'baseline unavailable',
    })
  })

  it('routes asset errors through recoverable retry and blocks retry after invariant errors', () => {
    const assetFailure = createStateController()
    assetFailure.dispatch({ type: 'assetLoadFailed', error: 'missing required asset' })
    expect(assetFailure.snapshot()).toMatchObject({ state: 'error', errorKind: 'asset-load' })
    expect(assetFailure.dispatch({ type: 'retryLoad' }).accepted).toBe(true)
    expect(assetFailure.snapshot().state).toBe('booting')

    const invariantFailure = createStateController()
    invariantFailure.dispatch({ type: 'invariantFailure', error: 'bad invariant', runId: 1 })
    expect(invariantFailure.snapshot()).toMatchObject({ state: 'error', errorKind: 'invariant' })
    expect(invariantFailure.dispatch({ type: 'retryLoad' }).accepted).toBe(false)
    expect(invariantFailure.snapshot().state).toBe('error')
    invariantFailure.dispatch({ type: 'requestReset' })
    const resetRunId = invariantFailure.snapshot().runId
    invariantFailure.dispatch({ type: 'resetFailed', error: 'reset failed', runId: resetRunId })
    expect(invariantFailure.snapshot()).toMatchObject({ state: 'error', errorKind: 'reset' })
  })

  it('diagnoses malformed runtime payloads instead of throwing', () => {
    const controller = createStateController()
    const malformed = controller.dispatch({
      type: 'poseReached',
      pose: 'lowered',
      runId: Number.NaN,
    } as never)

    expect(malformed.accepted).toBe(false)
    expect(malformed.snapshot.state).toBe('booting')
    expect(malformed.snapshot.diagnostics.at(-1)).toMatchObject({
      kind: 'rejected-event',
      action: 'poseReached',
    })

    const malformedError = controller.dispatch({
      type: 'assetLoadFailed',
    } as never)
    expect(malformedError.accepted).toBe(false)
    expect(malformedError.snapshot.diagnostics.at(-1)).toMatchObject({
      kind: 'rejected-event',
      action: 'assetLoadFailed',
    })
  })

  it('replays identical input and event sequences deterministically', () => {
    const replay = () => {
      const controller = createStateController()
      controller.dispatch({ type: 'assetsReady' })
      controller.dispatch({ type: 'beginAim' })
      controller.dispatch({ type: 'moveAim', axis: 'x', value: 0.75 })
      controller.dispatch({ type: 'confirmDrop' })
      runEvent(controller, { type: 'poseReached', pose: 'lowered', runId: 0 })
      runEvent(controller, { type: 'alignmentSettled', runId: 0 })
      runEvent(controller, { type: 'gripEvaluated', outcome: { success: true }, runId: 0 })
      runEvent(controller, { type: 'liftReached', runId: 0 })
      runEvent(controller, { type: 'returnReached', runId: 0 })
      runEvent(controller, { type: 'releaseComplete', outcome: { success: true }, runId: 0 })
      return controller.snapshot()
    }

    expect(replay().transitions).toEqual(replay().transitions)
    expect(replay().aim).toEqual({ x: 0.75, z: 0 })
    expect(replay().outcome).toEqual({ success: true })
  })

  it('keeps Zustand as snapshot/dispatch infrastructure, not a second authority', () => {
    const store = createStateStore()
    expect('setState' in store).toBe(false)
    const notifications: string[] = []
    const unsubscribe = store.subscribe((snapshot) => notifications.push(snapshot.state))

    store.dispatch({ type: 'assetsReady' })
    store.dispatch({ type: 'beginAim' })
    unsubscribe()

    expect(store.getState().state).toBe('aiming')
    expect(notifications).toEqual(['ready', 'aiming'])
  })

  it('publishes complete N5 evidence for sequence, reset, interruption, and recovery', () => {
    const evidence = createN5Evidence()
    expect(evidence.node).toBe('N5')
    expect(evidence.baseline).toBe('gate-1-baseline-rev1')
    expect(evidence.deterministic).toBe(true)
    expect(evidence.legalSequence.map(({ to }) => to)).toEqual([
      'ready',
      'aiming',
      'aiming',
      'lowering',
      'aligning',
      'gripping',
      'lifting',
      'returning',
      'releasing',
      'result',
    ])
    expect(evidence.resetSequence.map(({ to }) => to)).toEqual(['resetting', 'ready'])
    expect(Object.values(evidence.resetFromEveryState).every((entry) => entry.state === 'ready')).toBe(true)
    expect(evidence.interruptedAction.staleAccepted).toBe(false)
    expect(evidence.interruptedAction.diagnostic?.kind).toBe('stale-callback')
    expect(evidence.errorRecovery.state).toBe('booting')
  })
})
