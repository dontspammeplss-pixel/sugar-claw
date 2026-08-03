import type { SemanticDirection } from './joystick-math'

/** Raw browser keyboard codes translated at the joystick DOM boundary. */
export const KEY_BINDINGS: Readonly<Record<string, SemanticDirection>> =
  Object.freeze({
    ArrowLeft: 'left',
    KeyA: 'left',
    ArrowRight: 'right',
    KeyD: 'right',
    ArrowUp: 'back',
    KeyW: 'back',
    ArrowDown: 'front',
    KeyS: 'front',
  })

export function semanticDirectionForCode(
  code: string,
): SemanticDirection | undefined {
  return KEY_BINDINGS[code]
}

/** Add one physical code without duplicating key-repeat state. */
export function addPressedCode(
  pressed: ReadonlyMap<string, SemanticDirection>,
  code: string,
): Map<string, SemanticDirection> {
  const next = new Map(pressed)
  const direction = semanticDirectionForCode(code)
  if (direction && !next.has(code)) next.set(code, direction)
  return next
}

/** Remove one physical code while preserving any still-held alias. */
export function removePressedCode(
  pressed: ReadonlyMap<string, SemanticDirection>,
  code: string,
): Map<string, SemanticDirection> {
  const next = new Map(pressed)
  next.delete(code)
  return next
}

/** Derive the semantic active-key set from the physical code ledger. */
export function semanticDirectionsFromPressedCodes(
  pressed: ReadonlyMap<string, SemanticDirection>,
): Set<SemanticDirection> {
  return new Set(pressed.values())
}
