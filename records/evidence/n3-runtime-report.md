# N3 Runtime Evidence

**Node:** N3 — Static scene + assets
**Baseline:** `gate-1-approved + gate-2-design-approved`
**Human visual gate:** APPROVED — user confirmed the localhost render on 2026-08-01
**Captured:** 2026-08-01
**Dev server:** `http://127.0.0.1:5174/`
**Viewport:** 1440 × 1000 CSS pixels; canvas 1440 × 913 pixels

## Required proof

| Proof             | Result                                                                                       |
| ----------------- | -------------------------------------------------------------------------------------------- |
| Dev server        | PASS — Vite responded over HTTP at `127.0.0.1:5174`                                          |
| Runtime report    | PASS — `data-n3-runtime="pass"`, `validation: []`                                            |
| Hierarchy         | PASS — 56 named runtime paths; no missing required paths                                     |
| Static transforms | PASS — `MachineRoot` and `ClawMount` position `[0,0,0]`, scale `[1,1,1]`                     |
| Claw home         | PASS — runtime `ClawSystem` and `HeadRoot` world position `[0,2.85,0.1]`                     |
| Grip marker       | PASS — runtime world position `[0,2.6,0.1]`                                                  |
| Review camera     | PASS — `ReviewCamera`, position `[6.3,4.35,7.8]`, FOV `38`, clip `0.05/100`                  |
| Refresh           | PASS — two fresh browser loads produced identical report hash, hierarchy, transforms, camera |
| Screenshot        | PASS — [`n3-review-camera.png`](./n3-review-camera.png)                                      |

## Refresh comparison

Both fresh loads returned:

- `status: pass`
- `hierarchyCount: 56`
- `missingHierarchy: []`
- `validation: []`
- `reportSha256: e43eba5a38aaa34881dd86032a0555f4999dd512070b607fbe6bcc43fa685e5f`
- `MachineRoot` and `ClawMount` identity transforms
- `ClawSystem` home position `[0,2.85,0.1]`
- `ReviewCamera` position/FOV/clip values matching the approved design

No duplicate `SceneRoot` or logical scene registration was observed in either fresh load. Full machine hierarchy and machine/claw transform data are persisted in [`n3-runtime-report.json`](./n3-runtime-report.json).

## Screenshot metadata

- Path: `records/evidence/n3-review-camera.png`
- SHA-256: `8df0864a8b25a270d953af6bda2319694e9dbe008db63b0959452840bdf6c728`
- Image: 1440 × 1000 PNG
- Renderer: Chrome headless with SwiftShader WebGL fallback; this limitation is recorded for the human visual gate.

The active camera is Canvas-owned and configured by the named `CameraRig` presentation group. No physics, state, gameplay animation, or per-frame gameplay transform writer is involved.

## Human visual decision

The user reviewed the rendered N3 image at localhost and approved the visual gate on 2026-08-01. The complete machine composition, claw, prize/playfield presentation, chute, floor reveal, and approved review-camera framing were accepted.
