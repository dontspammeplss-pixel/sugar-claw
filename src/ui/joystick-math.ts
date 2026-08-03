/**
 * N23: pure joystick deflection math. Kept DOM-free so the stick's vector
 * semantics (pointer offset -> clamped unit deflection, screen-Y flip) are
 * unit-testable without a browser.
 *
 * Coordinate contract: deflection.x is +1 fully right / -1 fully left;
 * deflection.z is +1 toward the player (front, +Z) / -1 away (back, -Z).
 * Screen axis and world axis agree on Z: dragging DOWN on the pad (increasing
 * pointer Y) maps to +Z (front, toward the player/camera) and dragging UP maps
 * to -Z (back), matching the keyboard mapping (S/ArrowDown = front, W/ArrowUp
 * = back).
 */
export interface Deflection {
  readonly x: number
  readonly z: number
}

export type SemanticDirection = 'left' | 'right' | 'back' | 'front'

export const DEFLECTION_RADIUS = 1

/** A fresh zero deflection for callers that own the joystick state. */
export const ZERO_DEFLECTION: Deflection = Object.freeze({ x: 0, z: 0 })

export function clampDeflection(x: number, z: number): Deflection {
  const magnitude = Math.hypot(x, z)
  if (magnitude > DEFLECTION_RADIUS) {
    return { x: x / magnitude, z: z / magnitude }
  }
  return { x, z }
}

/** Maps a pointer offset from the pad center to a clamped unit deflection. */
export function deflectionFromPointer(
  centerX: number,
  centerY: number,
  pointerX: number,
  pointerY: number,
  radius: number,
): Deflection {
  if (!Number.isFinite(radius) || radius <= 0) {
    return { x: 0, z: 0 }
  }
  return clampDeflection(
    (pointerX - centerX) / radius,
    (pointerY - centerY) / radius,
  )
}

/** Deflection produced by the currently pressed movement keys. */
export function deflectionFromKeys(
  pressed: ReadonlySet<SemanticDirection>,
): Deflection {
  let x = 0
  let z = 0
  if (pressed.has('left')) x -= 1
  if (pressed.has('right')) x += 1
  if (pressed.has('back')) z -= 1
  if (pressed.has('front')) z += 1
  return clampDeflection(x, z)
}

