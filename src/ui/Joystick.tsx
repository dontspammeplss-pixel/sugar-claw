import { useCallback, useEffect, useRef } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import {
  deflectionFromKeys,
  deflectionFromPointer,
  type Deflection,
  type SemanticDirection,
} from './joystick-math'
import {
  addPressedCode,
  removePressedCode,
  semanticDirectionForCode,
  semanticDirectionsFromPressedCodes,
} from './joystick-keyboard'

export interface JoystickInputFailure {
  readonly kind: 'pointer-capture' | 'pointer-identity' | 'pointer-terminal'
  readonly pointerId: number
  readonly message: string
}

export interface JoystickProps {
  readonly deflection: Deflection
  readonly onChange: (deflection: Deflection) => void
  readonly onFailure?: (failure: JoystickInputFailure) => void
  readonly disabled?: boolean
  readonly ariaLabel?: string
}

const KNOB_TRAVEL = 34

function knobStyle(deflection: Deflection, disabled: boolean | undefined) {
  return {
    // Screen Y and world Z agree: +z (front) moves the knob down the pad.
    transform: `translate3d(${deflection.x * KNOB_TRAVEL}px, ${
      deflection.z * KNOB_TRAVEL
    }px, 0)`,
    opacity: disabled ? 0.55 : 1,
  }
}

/**
 * N23: virtual arcade joystick. Controlled component — the parent owns the
 * deflection (it dispatches `beginAim`/`moveAim`). Pointer input uses capture
 * so dragging outside the pad keeps working; WASD/arrows mirror the stick with
 * live visual feedback on the knob. Screen-Y agrees with world Z (down = +Z).
 */
export function Joystick({
  deflection,
  onChange,
  onFailure,
  disabled = false,
  ariaLabel = 'Claw joystick',
}: JoystickProps) {
  const activePointerRef = useRef<number | null>(null)
  const pointerOriginRef = useRef<{
    readonly centerX: number
    readonly centerY: number
    readonly radius: number
  } | null>(null)
  const pressedKeysRef = useRef<Map<string, SemanticDirection>>(new Map())
  const onChangeRef = useRef(onChange)
  const onFailureRef = useRef(onFailure)
  const disabledRef = useRef(disabled)
  onChangeRef.current = onChange
  onFailureRef.current = onFailure
  disabledRef.current = disabled

  const updateFromPointer = (clientX: number, clientY: number) => {
    const origin = pointerOriginRef.current
    if (!origin || disabledRef.current) return
    onChangeRef.current(
      deflectionFromPointer(
        origin.centerX,
        origin.centerY,
        clientX,
        clientY,
        origin.radius,
      ),
    )
  }

  const endPointer = useCallback((pointerId: number) => {
    if (activePointerRef.current !== pointerId) return
    activePointerRef.current = null
    pointerOriginRef.current = null
    onChangeRef.current({ x: 0, z: 0 })
  }, [])

  const endActivePointer = useCallback(() => {
    const pointerId = activePointerRef.current
    if (pointerId !== null) endPointer(pointerId)
  }, [endPointer])

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (disabled || activePointerRef.current !== null) return
    const rect = event.currentTarget.getBoundingClientRect()
    const radius = Math.min(rect.width, rect.height) / 2
    if (!Number.isFinite(radius) || radius <= 0) return

    activePointerRef.current = event.pointerId
    pointerOriginRef.current = {
      centerX: rect.left + rect.width / 2,
      centerY: rect.top + rect.height / 2,
      radius,
    }
    try {
      event.currentTarget.setPointerCapture(event.pointerId)
      if (!event.currentTarget.hasPointerCapture(event.pointerId)) {
        throw new Error('pointer capture was not established')
      }
    } catch {
      onFailureRef.current?.({
        kind: 'pointer-capture',
        pointerId: event.pointerId,
        message: 'Joystick pointer capture was not established',
      })
      endPointer(event.pointerId)
      return
    }
    updateFromPointer(event.clientX, event.clientY)
  }

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (activePointerRef.current !== event.pointerId) return
    updateFromPointer(event.clientX, event.clientY)
  }

  const releasePointer = (event: ReactPointerEvent<HTMLDivElement>) => {
    const activePointerId = activePointerRef.current
    if (activePointerId === null) return
    if (event.pointerId !== activePointerId) {
      onFailureRef.current?.({
        kind: 'pointer-identity',
        pointerId: event.pointerId,
        message: `Joystick received terminal pointer ${event.pointerId} while tracking ${activePointerId}`,
      })
      endPointer(activePointerId)
      return
    }
    endPointer(event.pointerId)
  }

  // Keyboard mirror: translate browser codes at the DOM boundary, then track
  // only semantic directions. Repeats are ignored by checking membership first.
  useEffect(() => {
    if (disabled) return

    const emitZeroIfActive = () => {
      if (pressedKeysRef.current.size === 0) return
      pressedKeysRef.current.clear()
      onChangeRef.current({ x: 0, z: 0 })
    }
    const syncKeys = () => {
      onChangeRef.current(
        deflectionFromKeys(
          semanticDirectionsFromPressedCodes(pressedKeysRef.current),
        ),
      )
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (disabledRef.current) return
      const direction = semanticDirectionForCode(event.code)
      if (!direction) return
      if (event.code.startsWith('Arrow')) event.preventDefault()
      const next = addPressedCode(pressedKeysRef.current, event.code)
      if (next.size === pressedKeysRef.current.size) return
      pressedKeysRef.current = next
      syncKeys()
    }
    const onKeyUp = (event: KeyboardEvent) => {
      const direction = semanticDirectionForCode(event.code)
      if (!direction) return
      const next = removePressedCode(pressedKeysRef.current, event.code)
      if (next.size === pressedKeysRef.current.size) return
      pressedKeysRef.current = next
      syncKeys()
    }
    const onBlur = () => emitZeroIfActive()
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', onBlur)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', onBlur)
      emitZeroIfActive()
    }
  }, [disabled])

  // On disable (sequence running), terminate both input surfaces so a captured
  // pointer cannot leave the coordinator gliding after the control locks.
  useEffect(() => {
    if (!disabled) return
    pressedKeysRef.current.clear()
    endActivePointer()
  }, [disabled, endActivePointer])

  // Blur and unmount are terminal pointer boundaries even when the browser does
  // not deliver pointerup/cancel. `endPointer` makes each drag idempotent, so a
  // later pointerup or lost-capture event cannot emit a second zero.
  useEffect(() => {
    const onWindowBlur = () => endActivePointer()
    window.addEventListener('blur', onWindowBlur)
    return () => {
      window.removeEventListener('blur', onWindowBlur)
      endActivePointer()
    }
  }, [endActivePointer])

  return (
    <div
      className="joystick-wrap"
      data-joystick-disabled={disabled ? 'true' : 'false'}
      aria-label={ariaLabel}
      role="group"
    >
      <div
        className="joystick-pad"
        aria-hidden={disabled ? true : undefined}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={releasePointer}
        onPointerCancel={releasePointer}
        onLostPointerCapture={releasePointer}
      >
        <div className="joystick-knob" style={knobStyle(deflection, disabled)} />
        <span className="joystick-axis joystick-axis-z joystick-axis-back" />
        <span className="joystick-axis joystick-axis-z joystick-axis-front" />
        <span className="joystick-axis joystick-axis-x joystick-axis-left" />
        <span className="joystick-axis joystick-axis-x joystick-axis-right" />
      </div>
      <div className="joystick-meta">
        <span className="joystick-readout">
          X {deflection.x.toFixed(2)} · Z {deflection.z.toFixed(2)}
        </span>
        <span className="joystick-hint">drag or WASD / arrows</span>
      </div>
    </div>
  )
}
