/**
 * Canonical geometry tuple types (N13).
 *
 * Single source of truth for the tuple shapes used across physics, the claw
 * rig, and animation. Consumers should import from here; modules that once
 * owned local definitions (`physics/config.ts`, `claw/rig.ts`) re-export these
 * so existing import paths keep working.
 */
export type Vec3 = readonly [number, number, number]
export type Quat = readonly [number, number, number, number]
