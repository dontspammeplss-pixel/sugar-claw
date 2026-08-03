import { describe, expect, it } from 'vitest'
import {
  clampDeflection,
  deflectionFromKeys,
  deflectionFromPointer,
  type SemanticDirection,
} from './joystick-math'
import {
  addPressedCode,
  removePressedCode,
  semanticDirectionsFromPressedCodes,
  KEY_BINDINGS,
} from './joystick-keyboard'

describe('joystick deflection math (N23)', () => {
  it('maps a centered pointer to a zero deflection', () => {
    expect(deflectionFromPointer(100, 100, 100, 100, 50)).toEqual({ x: 0, z: 0 })
  })

  it('maps right/up drags with the world-Z agreement (up = -Z = back)', () => {
    // Drag right 25px and up 50px from a 50px-radius pad: the raw offset is
    // (0.5, -1) but the deflection is clamped to unit magnitude.
    const result = deflectionFromPointer(100, 100, 125, 50, 50)
    expect(Math.hypot(result.x, result.z)).toBeCloseTo(1, 10)
    expect(result.x).toBeCloseTo(0.5 / Math.hypot(0.5, 1), 10)
    expect(result.z).toBeCloseTo(-1 / Math.hypot(0.5, 1), 10)
  })

  it('maps down drags to +Z (front)', () => {
    expect(deflectionFromPointer(100, 100, 100, 150, 50)).toEqual({ x: 0, z: 1 })
  })

  it('reverses the emitted sign when the drag reverses direction', () => {
    const right = deflectionFromPointer(100, 100, 150, 100, 50)
    const left = deflectionFromPointer(100, 100, 50, 100, 50)
    expect(right.x).toBe(1)
    expect(left.x).toBe(-1)
    expect(right.z).toBe(0)
    expect(left.z).toBe(0)
  })

  it('normalizes diagonal and overshoot samples from a non-square pad', () => {
    // A 180x100 pad uses its stable, smaller half-dimension as the radius.
    // The center is (210, 125), independent of the knob presentation.
    const diagonal = deflectionFromPointer(210, 125, 255, 90, 50)
    expect(diagonal.x).toBeCloseTo(0.789352, 5)
    expect(diagonal.z).toBeCloseTo(-0.613941, 5)

    const overshoot = deflectionFromPointer(210, 125, 390, 125, 50)
    expect(overshoot).toEqual({ x: 1, z: 0 })
  })

  it('uses a changed rectangle center rather than a stale initial coordinate', () => {
    const initial = deflectionFromPointer(100, 100, 140, 100, 50)
    const afterLayoutChange = deflectionFromPointer(260, 180, 300, 180, 50)
    expect(initial).toEqual({ x: 0.8, z: 0 })
    expect(afterLayoutChange).toEqual({ x: 0.8, z: 0 })
  })

  it('clamps overshoot vectors to unit magnitude, preserving direction', () => {
    const result = clampDeflection(2, 1)
    const magnitude = Math.hypot(result.x, result.z)
    expect(magnitude).toBeCloseTo(1, 10)
    expect(result.x / result.z).toBeCloseTo(2, 10)
  })

  it('keeps in-range vectors unclamped', () => {
    expect(clampDeflection(0.3, -0.4)).toEqual({ x: 0.3, z: -0.4 })
  })

  it('rejects degenerate pointer radii', () => {
    expect(deflectionFromPointer(0, 0, 10, 10, 0)).toEqual({ x: 0, z: 0 })
  })

  it('maps every WASD and arrow code to its semantic direction', () => {
    expect(KEY_BINDINGS).toEqual({
      ArrowLeft: 'left',
      KeyA: 'left',
      ArrowRight: 'right',
      KeyD: 'right',
      ArrowUp: 'back',
      KeyW: 'back',
      ArrowDown: 'front',
      KeyS: 'front',
    })
  })

  it('combines semantic keys with opposing cancellation and diagonal normalization', () => {
    expect(deflectionFromKeys(new Set(['back']))).toEqual({ x: 0, z: -1 })
    expect(deflectionFromKeys(new Set(['front']))).toEqual({ x: 0, z: 1 })
    expect(deflectionFromKeys(new Set(['left']))).toEqual({ x: -1, z: 0 })
    expect(deflectionFromKeys(new Set(['right']))).toEqual({ x: 1, z: 0 })
    expect(deflectionFromKeys(new Set(['left', 'right']))).toEqual({
      x: 0,
      z: 0,
    })
    expect(deflectionFromKeys(new Set(['back', 'front']))).toEqual({
      x: 0,
      z: 0,
    })

    const diagonal = deflectionFromKeys(new Set(['back', 'right']))
    expect(Math.hypot(diagonal.x, diagonal.z)).toBeCloseTo(1, 10)
    expect(diagonal.x).toBeCloseTo(Math.SQRT1_2, 10)
    expect(diagonal.z).toBeCloseTo(-Math.SQRT1_2, 10)
  })

  it('ignores key repeat and preserves an orthogonal key on release', () => {
    let pressed = new Map<string, SemanticDirection>()
    pressed = addPressedCode(pressed, 'KeyW')
    pressed = addPressedCode(pressed, 'KeyW')
    pressed = addPressedCode(pressed, 'KeyD')
    expect(pressed.size).toBe(2)
    const diagonal = deflectionFromKeys(
      semanticDirectionsFromPressedCodes(pressed),
    )
    expect(diagonal.x).toBeCloseTo(Math.SQRT1_2, 10)
    expect(diagonal.z).toBeCloseTo(-Math.SQRT1_2, 10)

    pressed = removePressedCode(pressed, 'KeyW')
    expect(
      deflectionFromKeys(semanticDirectionsFromPressedCodes(pressed)),
    ).toEqual({ x: 1, z: 0 })
    pressed = removePressedCode(pressed, 'KeyD')
    expect(
      deflectionFromKeys(semanticDirectionsFromPressedCodes(pressed)),
    ).toEqual({ x: 0, z: 0 })
  })

  it('keeps an aliased direction active until both physical keys release', () => {
    let pressed = new Map<string, SemanticDirection>()
    pressed = addPressedCode(pressed, 'KeyW')
    pressed = addPressedCode(pressed, 'ArrowUp')
    pressed = removePressedCode(pressed, 'KeyW')
    expect(semanticDirectionsFromPressedCodes(pressed)).toEqual(new Set(['back']))
    pressed = removePressedCode(pressed, 'ArrowUp')
    expect(semanticDirectionsFromPressedCodes(pressed)).toEqual(new Set())
  })
})
