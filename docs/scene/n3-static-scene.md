# N3 Static Scene

**Status:** APPROVED — implementation complete, deterministic evidence captured, and human visual gate approved on 2026-08-01.
**Baseline:** `gate-1-approved + gate-2-design-approved`

## Scope

This implementation keeps the scene completely static. It does not import or write gameplay state, physics, animation, input, or a new authority. The scene is authored in meters, Y-up, right-handed coordinates with `SceneRoot` as the only world-origin anchor.

## Implementation

- `src/App.tsx` mounts the approved N3 canvas in place of the bootstrap cube.
- `src/scene/StaticScene.tsx` mirrors the approved `SceneRoot → MachineRoot → ClawMount → ClawSystem` hierarchy with explicit `ClawPhysicsRoot` adapter-boundary sibling and no physics body.
- Machine proportions, home placement, palette, lights, and `ReviewCamera` values are immutable in `src/scene/config.ts`.
- `src/assets/manifest.ts` declares typed required model records, authored axes/unit scale, anchors, bounds, and preload policy.
- `src/assets/registry.ts` validates finite transforms, positive dimensions, anchors, and scale; deduplicates concurrent canonical requests; preserves immutable source resources; and returns per-instance clone records without disposing shared sources.
- `src/scene/report.ts` traverses the mounted Three.js hierarchy and validates required paths, static transforms, home position, and active review-camera pose.
- `src/scene/N3Canvas.tsx` publishes the runtime report through `window.__N3_RUNTIME_REPORT__` and the app status attribute `data-n3-runtime`.

The active review camera is the Canvas-owned perspective camera. `CameraRig` is the named presentation grouping that configures that camera; it is not a second camera or world transform authority.

## Deterministic evidence

```bash
npm run typecheck
npm run lint
npm test -- --run src/evidence/n3.test.ts
npm run build
```

`src/evidence/n3.test.ts` proves runtime traversal on a contract-shaped Three.js hierarchy, identity `MachineRoot`/`ClawMount` transforms, the home target `(0, 2.85, 0.10)`, hierarchy names, concurrent request deduplication, clone-key stability, disposal/remount behavior, and required-asset failure behavior.

Browser evidence was captured from the Vite dev server at `http://127.0.0.1:5174/` using a 1440 × 1000 Chrome viewport:

- Screenshot: [`records/evidence/n3-review-camera.png`](../../records/evidence/n3-review-camera.png)
- Runtime report and refresh comparison: [`src/evidence/n3-runtime-report.json`](../../src/evidence/n3-runtime-report.json)
- Initial and refreshed reports both returned `data-n3-runtime="pass"`.
- Both reports contained 56 named hierarchy paths, no missing paths, no validation errors, identity machine/mount transforms, home claw position `[0, 2.85, 0.1]`, and the exact `ReviewCamera` position/FOV/clip configuration.
- Initial and refreshed report hashes matched, proving no transform or hierarchy drift across the two fresh browser loads.

The screenshot was captured with Chrome headless using SwiftShader WebGL fallback. It is suitable for the human visual gate, with the renderer limitation recorded in the companion report.
