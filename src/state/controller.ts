import { createStore } from 'zustand/vanilla'

export const GAME_STATES = [
  'booting',
  'ready',
  'aiming',
  'lowering',
  'aligning',
  'gripping',
  'lifting',
  'returning',
  'releasing',
  'result',
  'resetting',
  'error',
] as const

export type GameState = (typeof GAME_STATES)[number]
export type AimAxis = 'x' | 'z'
export type ResetStatus = 'ready' | 'needsLoad'
export type Outcome = string | Readonly<Record<string, unknown>>
export type ErrorValue = string | Readonly<{ message: string; code?: string }>
export type ErrorKind = 'asset-load' | 'reset' | 'invariant'

export interface AimBounds {
  readonly x: readonly [number, number]
  readonly z: readonly [number, number]
}

export interface AimIntent {
  readonly x: number
  readonly z: number
}

export type Command =
  | { readonly type: 'beginAim' }
  | { readonly type: 'moveAim'; readonly axis: AimAxis; readonly value: number }
  | { readonly type: 'confirmDrop' }
  | { readonly type: 'requestReset' }
  | { readonly type: 'retryLoad' }

export type SystemEvent =
  | { readonly type: 'bootRequested' }
  | { readonly type: 'assetsReady' }
  | { readonly type: 'assetLoadFailed'; readonly error: ErrorValue }
  | {
      readonly type: 'poseReached'
      readonly pose: 'lowered'
      readonly runId: number
    }
  | { readonly type: 'alignmentSettled'; readonly runId: number }
  | {
      readonly type: 'gripEvaluated'
      readonly outcome: Outcome
      readonly runId: number
    }
  | { readonly type: 'liftReached'; readonly runId: number }
  | { readonly type: 'returnReached'; readonly runId: number }
  | {
      readonly type: 'releaseComplete'
      readonly outcome: Outcome
      readonly runId: number
    }
  | {
      readonly type: 'baselineRestored'
      readonly status: ResetStatus
      readonly runId: number
    }
  | {
      readonly type: 'resetFailed'
      readonly error: ErrorValue
      readonly runId: number
    }
  | {
      readonly type: 'invariantFailure'
      readonly error: ErrorValue
      readonly runId: number
    }

export type ControllerAction = Command | SystemEvent
export type ActionType = ControllerAction['type']

export interface TransitionRecord {
  readonly sequence: number
  readonly from: GameState
  readonly event: ActionType
  readonly to: GameState
  readonly runId: number
}

export type DiagnosticKind =
  | 'rejected-command'
  | 'rejected-event'
  | 'stale-callback'
  | 'ignored-event'
  | 'coalesced-reset'

export interface DiagnosticRecord {
  readonly sequence: number
  readonly kind: DiagnosticKind
  readonly action: ActionType | string
  readonly state: GameState
  readonly runId: number
  readonly reason: string
  readonly callbackRunId?: number
}

export interface StateSnapshot {
  readonly state: GameState
  readonly runId: number
  readonly aim: AimIntent
  readonly gripOutcome: Outcome | null
  readonly resultOutcome: Outcome | null
  readonly outcome: Outcome | null
  readonly lastError: string | null
  readonly errorKind: ErrorKind | null
  readonly transitions: readonly TransitionRecord[]
  readonly diagnostics: readonly DiagnosticRecord[]
}

export interface DispatchResult {
  readonly accepted: boolean
  readonly kind: 'transition' | 'diagnostic' | 'noop'
  readonly snapshot: StateSnapshot
}

export interface StateControllerOptions {
  readonly aimBounds?: AimBounds
  readonly initialRunId?: number
  readonly initialAim?: Partial<AimIntent>
}

export interface StateStore extends StateSnapshot {
  readonly dispatch: (action: ControllerAction) => DispatchResult
}

export interface ReadonlyStateStore {
  readonly getState: () => StateStore
  readonly subscribe: (listener: (snapshot: StateStore) => void) => () => void
  readonly dispatch: (action: ControllerAction) => DispatchResult
}

export interface LegalTransition {
  readonly from: GameState | '*'
  readonly event: ActionType
  readonly to: GameState | 'error' | 'resetting(coalesced)'
  readonly guard?: string
}

export const DEFAULT_AIM_BOUNDS: AimBounds = {
  x: [-1, 1],
  z: [-1, 1],
}

/** The approved state-machine table, including invariant/error and reset rules. */
export const LEGAL_TRANSITIONS: readonly LegalTransition[] = [
  { from: 'booting', event: 'assetsReady', to: 'ready' },
  { from: 'booting', event: 'assetLoadFailed', to: 'error' },
  { from: 'booting', event: 'requestReset', to: 'resetting' },
  { from: 'ready', event: 'beginAim', to: 'aiming' },
  { from: 'ready', event: 'requestReset', to: 'resetting' },
  { from: 'aiming', event: 'moveAim', to: 'aiming' },
  { from: 'aiming', event: 'confirmDrop', to: 'lowering' },
  { from: 'aiming', event: 'requestReset', to: 'resetting' },
  { from: 'lowering', event: 'poseReached', to: 'aligning', guard: 'pose=lowered' },
  { from: 'lowering', event: 'requestReset', to: 'resetting' },
  { from: 'aligning', event: 'alignmentSettled', to: 'gripping' },
  { from: 'aligning', event: 'requestReset', to: 'resetting' },
  { from: 'gripping', event: 'gripEvaluated', to: 'lifting' },
  { from: 'gripping', event: 'requestReset', to: 'resetting' },
  { from: 'lifting', event: 'liftReached', to: 'returning' },
  { from: 'lifting', event: 'requestReset', to: 'resetting' },
  { from: 'returning', event: 'returnReached', to: 'releasing' },
  { from: 'returning', event: 'requestReset', to: 'resetting' },
  { from: 'releasing', event: 'releaseComplete', to: 'result' },
  { from: 'releasing', event: 'requestReset', to: 'resetting' },
  { from: 'result', event: 'requestReset', to: 'resetting' },
  { from: 'resetting', event: 'baselineRestored', to: 'ready', guard: 'status=ready' },
  { from: 'resetting', event: 'baselineRestored', to: 'booting', guard: 'status=needsLoad' },
  { from: 'resetting', event: 'resetFailed', to: 'error' },
  {
    from: 'resetting',
    event: 'requestReset',
    to: 'resetting(coalesced)',
    guard: 'same active reset epoch',
  },
  { from: 'error', event: 'requestReset', to: 'resetting' },
  { from: 'error', event: 'retryLoad', to: 'booting' },
  { from: '*', event: 'invariantFailure', to: 'error', guard: 'except resetting' },
]

const CALLBACK_EVENTS = new Set<ActionType>([
  'poseReached',
  'alignmentSettled',
  'gripEvaluated',
  'liftReached',
  'returnReached',
  'releaseComplete',
  'baselineRestored',
  'resetFailed',
  'invariantFailure',
])

const COMMAND_TYPES = new Set<ActionType>([
  'beginAim',
  'moveAim',
  'confirmDrop',
  'requestReset',
  'retryLoad',
])

function copyBounds(bounds: AimBounds): AimBounds {
  for (const axis of ['x', 'z'] as const) {
    const [min, max] = bounds[axis]
    if (!Number.isFinite(min) || !Number.isFinite(max) || min > max) {
      throw new Error(`Invalid ${axis} aim bounds`)
    }
  }
  return { x: [...bounds.x], z: [...bounds.z] }
}

function clamp(value: number, [min, max]: readonly [number, number]): number {
  return Math.min(max, Math.max(min, value))
}

function errorMessage(error: ErrorValue): string {
  return typeof error === 'string' ? error : error.message
}

function cloneOutcome(outcome: Outcome | null): Outcome | null {
  if (outcome === null || typeof outcome === 'string') return outcome
  return Object.fromEntries(
    Object.entries(outcome).map(([key, value]) => [
      key,
      Array.isArray(value)
        ? value.map((item) => cloneUnknown(item))
        : cloneUnknown(value),
    ]),
  )
}

function cloneUnknown(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((item) => cloneUnknown(item))
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, cloneUnknown(item)]),
    )
  }
  return value
}

function isCallbackAction(action: ControllerAction): action is SystemEvent & { runId: number } {
  return CALLBACK_EVENTS.has(action.type)
}

function isErrorValue(value: unknown): value is ErrorValue {
  return (
    typeof value === 'string' ||
    (value !== null &&
      typeof value === 'object' &&
      typeof (value as { message?: unknown }).message === 'string')
  )
}

function isOutcome(value: unknown): value is Outcome {
  return typeof value === 'string' || (value !== null && typeof value === 'object')
}

function validateActionPayload(action: ControllerAction): string | null {
  const candidate = action as unknown as Record<string, unknown>
  if (CALLBACK_EVENTS.has(action.type)) {
    if (!Number.isInteger(candidate.runId) || (candidate.runId as number) < 1) {
      return `${action.type} requires a positive integer runId`
    }
  }
  if (action.type === 'moveAim') {
    if (!isAimAxis(candidate.axis)) return 'moveAim axis must be x or z'
    if (!Number.isFinite(candidate.value)) return 'moveAim value must be finite'
  }
  if (
    action.type === 'assetLoadFailed' ||
    action.type === 'resetFailed' ||
    action.type === 'invariantFailure'
  ) {
    if (!isErrorValue(candidate.error)) return `${action.type} requires an error payload`
  }
  if (action.type === 'gripEvaluated' || action.type === 'releaseComplete') {
    if (!isOutcome(candidate.outcome)) return `${action.type} requires an outcome payload`
  }
  if (action.type === 'baselineRestored' && candidate.status !== 'ready' && candidate.status !== 'needsLoad') {
    return 'baselineRestored status must be ready or needsLoad'
  }
  return null
}

function isAimAxis(value: unknown): value is AimAxis {
  return value === 'x' || value === 'z'
}

export class StateController {
  private readonly bounds: AimBounds
  private sequence = 0
  private current: StateSnapshot

  public constructor(options: StateControllerOptions = {}) {
    this.bounds = copyBounds(options.aimBounds ?? DEFAULT_AIM_BOUNDS)
    const initialAim = options.initialAim ?? {}
    const runId = options.initialRunId ?? 1
    if (!Number.isInteger(runId) || runId < 1) {
      throw new Error('initialRunId must be a positive integer')
    }

    this.current = {
      state: 'booting',
      runId,
      aim: {
        x: clamp(initialAim.x ?? 0, this.bounds.x),
        z: clamp(initialAim.z ?? 0, this.bounds.z),
      },
      gripOutcome: null,
      resultOutcome: null,
      outcome: null,
      lastError: null,
      errorKind: null,
      transitions: [],
      diagnostics: [],
    }
  }

  public snapshot(): StateSnapshot {
    return {
      ...this.current,
      aim: { ...this.current.aim },
      gripOutcome: cloneOutcome(this.current.gripOutcome),
      resultOutcome: cloneOutcome(this.current.resultOutcome),
      outcome: cloneOutcome(this.current.outcome),
      transitions: this.current.transitions.map((record) => ({ ...record })),
      diagnostics: this.current.diagnostics.map((record) => ({ ...record })),
    }
  }

  public dispatch(action: ControllerAction): DispatchResult {
    if (!action || typeof action !== 'object' || typeof action.type !== 'string') {
      return this.diagnose('rejected-event', { type: 'unknown' }, 'action must have a type')
    }
    const payloadError = validateActionPayload(action)
    if (payloadError) {
      return this.diagnose(
        COMMAND_TYPES.has(action.type) ? 'rejected-command' : 'rejected-event',
        action,
        payloadError,
      )
    }
    if (isCallbackAction(action) && action.runId !== this.current.runId) {
      return this.diagnose(
        'stale-callback',
        action,
        `callback belongs to run ${action.runId}; active run is ${this.current.runId}`,
        action.runId,
      )
    }

    switch (action.type) {
      case 'bootRequested':
        if (this.current.state === 'booting') {
          return this.diagnose('ignored-event', action, 'boot is already in progress')
        }
        return this.rejectEvent(action, 'bootRequested is only meaningful during booting')
      case 'assetsReady':
        return this.transitionFrom(['booting'], action, 'ready')
      case 'assetLoadFailed':
        return this.transitionFrom(['booting'], action, 'error', () => {
          this.current = {
            ...this.current,
            lastError: errorMessage(action.error),
            errorKind: 'asset-load',
          }
        })
      case 'beginAim':
        return this.transitionFrom(['ready'], action, 'aiming')
      case 'moveAim':
        if (this.current.state !== 'aiming') {
          return this.rejectCommand(action, 'moveAim requires aiming')
        }
        if (!isAimAxis(action.axis)) {
          return this.rejectCommand(action, 'moveAim axis must be x or z')
        }
        if (!Number.isFinite(action.value)) {
          return this.rejectCommand(action, 'moveAim value must be finite')
        }
        this.current = {
          ...this.current,
          aim: {
            ...this.current.aim,
            [action.axis]: clamp(action.value, this.bounds[action.axis]),
          },
        }
        return this.recordTransition('aiming', action.type, 'aiming')
      case 'confirmDrop':
        return this.transitionFrom(['aiming'], action, 'lowering')
      case 'poseReached':
        if (action.pose !== 'lowered') {
          return this.rejectEvent(action, 'only poseReached(lowered) is legal in v1')
        }
        return this.transitionFrom(['lowering'], action, 'aligning')
      case 'alignmentSettled':
        return this.transitionFrom(['aligning'], action, 'gripping')
      case 'gripEvaluated':
        return this.transitionFrom(['gripping'], action, 'lifting', () => {
          const outcome = cloneOutcome(action.outcome)
          this.current = {
            ...this.current,
            gripOutcome: outcome,
            outcome,
          }
        })
      case 'liftReached':
        return this.transitionFrom(['lifting'], action, 'returning')
      case 'returnReached':
        return this.transitionFrom(['returning'], action, 'releasing')
      case 'releaseComplete':
        return this.transitionFrom(['releasing'], action, 'result', () => {
          const outcome = cloneOutcome(action.outcome)
          this.current = {
            ...this.current,
            resultOutcome: outcome,
            outcome,
          }
        })
      case 'baselineRestored':
        return this.transitionFrom(
          ['resetting'],
          action,
          action.status === 'ready' ? 'ready' : 'booting',
          () => {
            this.current = {
              ...this.current,
              aim: { x: clamp(0, this.bounds.x), z: clamp(0, this.bounds.z) },
              gripOutcome: null,
              resultOutcome: null,
              outcome: null,
              lastError: null,
              errorKind: null,
            }
          },
        )
      case 'resetFailed':
        return this.transitionFrom(['resetting'], action, 'error', () => {
          this.current = {
            ...this.current,
            lastError: errorMessage(action.error),
            errorKind: 'reset',
          }
        })
      case 'retryLoad':
        if (this.current.state !== 'error' || this.current.errorKind !== 'asset-load') {
          return this.rejectCommand(
            action,
            'retryLoad requires a recoverable asset-load error',
          )
        }
        return this.transitionFrom(['error'], action, 'booting', () => {
          this.current = { ...this.current, lastError: null, errorKind: null }
        })
      case 'invariantFailure':
        if (this.current.state === 'resetting') {
          return this.rejectEvent(
            action,
            'invariantFailure is not the reset failure event during resetting',
          )
        }
        return this.transitionFrom(['booting', ...GAME_STATES.slice(1)], action, 'error', () => {
          this.current = {
            ...this.current,
            lastError: errorMessage(action.error),
            errorKind: 'invariant',
          }
        })
      case 'requestReset':
        return this.requestReset()
      default:
        return this.diagnose('rejected-event', action, 'unknown action')
    }
  }

  private requestReset(): DispatchResult {
    if (this.current.state === 'resetting') {
      return this.diagnose('coalesced-reset', { type: 'requestReset' }, 'reset already active')
    }

    const from = this.current.state
    this.current = {
      ...this.current,
      state: 'resetting',
      runId: this.current.runId + 1,
      gripOutcome: null,
      resultOutcome: null,
      outcome: null,
      lastError: null,
      errorKind: null,
    }
    return this.recordTransition(from, 'requestReset', 'resetting')
  }

  private transitionFrom(
    allowedStates: readonly GameState[],
    action: ControllerAction,
    to: GameState,
    mutate?: () => void,
  ): DispatchResult {
    if (!allowedStates.includes(this.current.state)) {
      return this.isCommand(action)
        ? this.rejectCommand(action, `${action.type} is not legal from ${this.current.state}`)
        : this.rejectEvent(action, `${action.type} is not legal from ${this.current.state}`)
    }
    mutate?.()
    return this.recordTransition(this.current.state, action.type, to)
  }

  private recordTransition(from: GameState, event: ActionType, to: GameState): DispatchResult {
    const sequence = ++this.sequence
    const record: TransitionRecord = {
      sequence,
      from,
      event,
      to,
      runId: this.current.runId,
    }
    this.current = {
      ...this.current,
      state: to,
      transitions: [...this.current.transitions, record],
    }
    return { accepted: true, kind: 'transition', snapshot: this.snapshot() }
  }

  private rejectCommand(action: ControllerAction, reason: string): DispatchResult {
    return this.diagnose('rejected-command', action, reason)
  }

  private rejectEvent(action: ControllerAction, reason: string): DispatchResult {
    return this.diagnose('rejected-event', action, reason)
  }

  private isCommand(action: ControllerAction): action is Command {
    return COMMAND_TYPES.has(action.type)
  }

  private diagnose(
    kind: DiagnosticKind,
    action: { type: string },
    reason: string,
    callbackRunId?: number,
  ): DispatchResult {
    const sequence = ++this.sequence
    const diagnostic: DiagnosticRecord = {
      sequence,
      kind,
      action: action.type,
      state: this.current.state,
      runId: this.current.runId,
      reason,
      ...(callbackRunId === undefined ? {} : { callbackRunId }),
    }
    this.current = {
      ...this.current,
      diagnostics: [...this.current.diagnostics, diagnostic],
    }
    return {
      accepted: false,
      kind: kind === 'ignored-event' ? 'noop' : 'diagnostic',
      snapshot: this.snapshot(),
    }
  }
}

export function createStateController(options: StateControllerOptions = {}): StateController {
  return new StateController(options)
}

export function createStateStore(options: StateControllerOptions = {}): ReadonlyStateStore {
  const controller = createStateController(options)
  const dispatch = (action: ControllerAction): DispatchResult => {
    const result = controller.dispatch(action)
    store.setState(readState())
    return result
  }

  const readState = (): StateStore => ({
    ...controller.snapshot(),
    dispatch,
  })

  const store = createStore<StateStore>(() => readState())

  return {
    getState: readState,
    subscribe: (listener) => store.subscribe(() => listener(readState())),
    dispatch,
  }
}
