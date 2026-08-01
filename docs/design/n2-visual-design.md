# N2 Visual Design — Claw Machine V1

**Status:** Approved — N2 baseline revision 1; human approval recorded in [`n2-approval-rev1.md`](./n2-approval-rev1.md)  
**Node:** N2 — Visual design (turn-based)  
**Baseline:** `gate-1-approved` (dispatch baseline; repository tag remains `gate-0-baseline` pending N1a promotion)  
**Allowed scope:** `docs/design/**` only  
**Contract basis:** `docs/contracts/scene-claw-hierarchy.md`, `docs/contracts/transform-layers.md`, `docs/contracts/authority-map.md`, `docs/contracts/asset-contract.md`, `docs/contracts/open-decisions.md`, `records/contracts/performance-thresholds.md`

## 1. Design intent

Create a compact, premium arcade claw machine that reads immediately at a three-quarter view. The machine should feel sturdy and tactile, while the claw remains the visual focal point: a bright mechanical object suspended over a simple, legible prize field.

The design uses restrained industrial forms, a dark graphite shell, warm interior light, and a small cyan accent on the claw carriage. Rounded exterior corners and a thick lower plinth provide friendly toy-machine character without making the machine soft or toy-like. The design is intentionally achievable with the existing Three.js/R3F stack and does not require a new dependency, procedural effect, or gameplay behavior.

### Non-goals

- No scoring, lives, sound, UI, randomness, or ScrollTrigger treatment (A-07, A-29, A-31 remain deferred).
- No physics or gameplay behavior is defined here. Visual geometry must not imply physical finger colliders; v1 fingers are visual-only with dedicated sensor proxies (A-02/A-23).
- No compression, streaming, or texture-pipeline decision is introduced (A-20 deferred).
- No runtime asset URL or loader decision beyond the approved typed GLB/glTF manifest (A-16).

## 2. Coordinate system and authored placement

The design follows the Gate 1 coordinate contract:

- **Units:** meters.
- **Up:** +Y.
- **Handedness:** right-handed.
- **World origin:** `SceneRoot` at the center of the machine's floor footprint.
- **Front:** +Z; the review camera is placed toward +Z and looks toward the machine.
- **Machine placement:** `MachineRoot` is static and centered at `(0, 0, 0)`.
- **Floor baseline:** `y = 0`.
- **No hidden correction:** imported assets are validated and converted once at the asset boundary; no component invents compensating scale or rotation (A-17, L0/L3).

All dimensions below are authored design targets. They are not gameplay state and must not be recomputed per frame.

## 3. Machine proportions

### 3.1 Primary envelope

| Contract node / part                      | Width (X) | Height (Y) | Depth (Z) | Authored placement / purpose                                                                    |
| ----------------------------------------- | --------: | ---------: | --------: | ----------------------------------------------------------------------------------------------- |
| `MachineRoot` visual envelope             |      3.60 |       4.20 |      2.00 | Centered on the `SceneRoot` floor origin; front face at approximately `z = +1.00`.              |
| `MachineVisuals/LowerPlinth`              |      3.60 |       0.55 |      2.00 | `y = 0.275`; visually heavy base, hides lower structural joins.                                 |
| `MachineVisuals/PlayfieldCabinet`         |      3.40 |       2.35 |      1.78 | `y = 1.72`; transparent prize chamber and floor occupy its front-facing volume.                 |
| `MachineVisuals/TopCap`                   |      3.60 |       0.55 |      2.00 | `y = 3.95`; rounded cap and rail housing.                                                       |
| `MachineVisuals/LeftFrame` / `RightFrame` |      0.18 |       2.85 |      1.92 | Centered at `x = ±1.71`, from `y = 0.825` to `3.675`.                                           |
| `MachineVisuals/TopFrame`                 |      3.42 |       0.18 |      1.92 | `y = 3.57`; bounds the glass chamber.                                                           |
| `MachineVisuals/FrontGlass`               |      3.20 |       2.65 |     0.035 | Front plane near `z = +0.91`; glass is a visual surface, not a physics definition.              |
| `MachineVisuals/PlayfieldFloor`           |      3.18 |       0.06 |      1.52 | `y = 0.86`, with a slight rear fall toward `-Z`; prize presentation surface.                    |
| `MachineVisuals/Chute`                    |      0.72 |       0.22 |      0.52 | Front lower-right, centered near `x = 1.05`, `y = 0.66`, `z = +1.02`; visual result receptacle. |

The visible play chamber has a roughly **3:2 width-to-height ratio**. The top cap and lower plinth each occupy about **13% of total height**, leaving a tall central window for the claw and prize to read clearly. The lower plinth is deliberately wider than the chamber, giving a stable silhouette and a natural location for any later overlay without changing the 3D hierarchy.

### 3.2 Machine proportion sketch

```text
Front elevation — authored meters, not to scale

                 MachineRoot: 3.60 W × 4.20 H
        ┌────────────────────────────────────┐  y = 4.20
        │            TopCap 0.55              │
        │  ┌──────────────────────────────┐  │
        │  │        TopFrame / rail       │  │
        │  │                              │  │
        │  │          ClawMount           │  │
        │  │      ┌──────────────┐        │  │
        │  │      │  ClawSystem  │        │  │  home head center:
        │  │      │  GripCenter  │        │  │  (0, 2.85, 0.10)
        │  │      └──────────────┘        │  │
        │  │          PrizeRoot           │  │
        │  │      PlayfieldRoot           │  │  playfield y = 0.86
        │  └──────────────────────────────┘  │
        │                 ┌──────┐           │  Chute
        └─────────────────┴──────┴───────────┘  y = 0
             LowerPlinth / MachineVisuals

        frame interior: 3.24 W       chamber: 3.40 W × 2.35 H
        MachineRoot front face: approximately z = +1.00
```

`ClawMount` is authored at the `MachineRoot` origin with an identity local transform for this visual baseline. It defines a presentation/design envelope of **2.50 W × 1.85 H × 0.90 D**; because the mount transform is identity, the envelope and target values below are numerically identical in `MachineRoot`-local and `ClawMount`-local meters. Its legal **ClawSystem head-center** target bounds are `x = [-1.25, +1.25]`, `y = [1.35, 3.20]`, and `z = [-0.35, +0.55]`; its baseline/home head-center target is `(0.00, 2.85, 0.10)`. These are authored design targets for N3/N4, not gameplay state. The bounds preserve a visible margin from the frame, glass, playfield, and top cap while keeping the `ClawSystem` centered in the review composition.

The sketch maps `MachineRoot` to the complete envelope, `MachineVisuals` to the shell/plinth/frame, `ClawMount` to the bounded gantry volume, `ClawSystem` to the suspended claw, `PrizeRoot` to the known prize fixture, `PlayfieldRoot` to the floor/chute area, and `Chute` to the lower-right receptacle.

### 3.3 Structural language

- Exterior silhouette: vertical sides, subtly radiused corners, thick top cap, broad lower plinth.
- Frame: mostly planar with chamfered edges; bevels are small and consistent rather than decorative.
- Glass: one uninterrupted front pane plus optional side panes, with low-opacity neutral tint and restrained roughness variation.
- Interior: dark enough to frame the prize, but not black; the warm interior light must preserve contact readability.
- Chute: high-contrast accent panel, visually subordinate to the claw and prize.
- Edge treatment: bevels should catch highlights, but the scene must remain within the approved desktop performance budget (≥50 fps sustained; p95 frame ≤20 ms).

## 4. Claw visual design

### 4.1 Character and silhouette

The claw is a clean, three-finger industrial grabber with a compact carriage and a visible cable. It should read as a precise machine tool rather than a threatening animal claw. The head is a rounded triangular hub with three evenly spaced fingers, each finger tapering toward a soft inward hook. Cyan accent paint is limited to the carriage stripe and small head fastener rings; the fingers remain brushed steel so their pose remains visible under warm lighting.

The claw is the main visual contrast against the dark interior: a small bright assembly suspended in the upper-middle of the chamber.

### 4.2 Claw dimensions

| Contract node / part        |                                  Target dimensions | Local design rule                                                      |
| --------------------------- | -------------------------------------------------: | ---------------------------------------------------------------------- |
| `ClawSystem/ClawVisualRoot` |                  envelope 0.70 W × 1.10 H × 0.58 D | Root is local to `ClawMount`; no second global scale or rotation.      |
| `Carriage`                  |                           0.58 W × 0.20 H × 0.42 D | Slides with the gantry; graphite shell with cyan accent band.          |
| `Cable`                     |              radius 0.035; visible length variable | Centered on the head; vertical and straight in the baseline/home pose. |
| `HeadRoot` / `HeadMesh`     |                           0.46 W × 0.28 H × 0.44 D | Rigid rounded hub; remains rigid during finger articulation.           |
| `GripCenter`                | marker at `(0, -0.25, 0)` from `HeadRoot` baseline | Logical reference only; not automatically a collider or win condition. |
| `FingerRig`                 |                     3 fingers, 120° radial spacing | Local articulation space below the rigid head.                         |
| Each `FingerPivot_i`        |                 pivot radius 0.16 from head center | Named pivot; rotations are absolute pose targets.                      |
| Each `FingerMesh_i`         |                   approx. 0.10 W × 0.44 L × 0.12 D | Brushed steel, tapered lower third, rounded hook tip.                  |
| Finger spread               |    0.52 outer diameter in `open`; 0.28 in `closed` | Visual target only; exact grip evaluation remains physics-owned later. |

Three fingers are selected as the single approved design choice for this first visual asset. They provide a recognizable claw silhouette from the review camera while keeping the hierarchy small and symmetric. No fourth finger or decorative secondary rig is needed.

### 4.3 Contract hierarchy sketch

```text
SceneRoot                                             # world origin; meters, Y-up, RH
├── LightingRoot                                     # static presentation only
├── CameraRig                                        # camera/presentation authority
├── MachineRoot                                      # static authored placement
│   ├── MachineVisuals                                # frame, panels, glass, trim, chute
│   ├── MachineCollisionProxies                       # separate future environment geometry
│   └── ClawMount                                    # legal travel volume + home transform
│       └── ClawSystem                               # one logical claw instance
│           ├── ClawPhysicsRoot                      # logical adapter boundary; no visual mesh
│           └── ClawVisualRoot                       # rendered hierarchy
│               ├── Carriage
│               ├── Cable
│               ├── HeadRoot                         # rigid during finger articulation
│               │   ├── HeadMesh
│               │   ├── GripCenter                   # logical marker, not win condition
│               │   └── FingerRig
│               │       ├── FingerPivot_0
│               │       │   └── FingerMesh_0
│               │       ├── FingerPivot_1
│               │       │   └── FingerMesh_1
│               │       └── FingerPivot_2
│               │           └── FingerMesh_2
│               └── ClawDebugRoot                    # optional, read-only diagnostics
├── PrizeRoot                                       # one known prize in v1
├── PlayfieldRoot                                   # floor/walls/chute/catch area
└── DebugRoot                                       # opt-in, read-only diagnostics
```

`ClawPhysicsRoot` is shown to document the adapter boundary only. It must not become an additional Three.js transform parent. Once physics is active, the kinematic claw target is submitted from `ClawMount`-local meters and the visual root receives one read-only synchronization from the authoritative pose (A-01, A-21, A-39; L3-L5).

### 4.4 Claw pose silhouettes

```text
Front elevation — three fingers are visually symmetric around GripCenter

       Carriage / gantry
     ┌─────────────────┐
     └────────┬────────┘
              │ Cable
          ┌───┴───┐
          │HeadRoot│       rigid shell
          └─┬─┬─┬─┘
           /  |  \
          /   •   \        • = GripCenter
       __/    |    \__     open: tips spread around center

       closed target: the three hooked tips converge around GripCenter
       raised/lowered targets: move the rigid assembly, not the fingers' baselines
```

Every controlled pivot retains an authored baseline and explicit targets for `home`, `raised`, `lowered`, `open`, `closed`, and `reset`. Reset restores those absolute targets; it never negates the current rotation (scene/claw hierarchy and transform-layer contracts).

## 5. Materials and color palette

Materials are authored as a small named palette so later assets can share a coherent look. Cached source materials remain immutable; render instances follow A-18's per-instance clone policy.

| Material name     | Base color | Roughness | Metalness | Use                                                             |
| ----------------- | ---------- | --------: | --------: | --------------------------------------------------------------- |
| `MachineGraphite` | `#20262B`  |      0.34 |      0.78 | Main shell, frame, plinth, carriage body.                       |
| `MachineEdge`     | `#46515A`  |      0.26 |      0.82 | Chamfer highlights, trim rails, fastener rings.                 |
| `ClawSteel`       | `#AEB9BD`  |      0.24 |      0.92 | Head accents and three fingers; keeps articulation legible.     |
| `ClawCyanAccent`  | `#41D9E8`  |      0.20 |      0.55 | Thin carriage stripe and small head accent only.                |
| `InteriorSlate`   | `#303A3E`  |      0.52 |      0.35 | Interior back and side panels; avoids a featureless black void. |
| `GlassNeutral`    | `#B8D0D2`  |      0.08 |      0.04 | Front/side glass; transparent/tinted at the renderer layer.     |
| `ChuteAmber`      | `#D88932`  |      0.32 |      0.55 | Chute lip and result receptacle accent.                         |
| `PlayfieldWarm`   | `#88745C`  |      0.68 |      0.08 | Neutral prize surface that supports varied prize colors.        |
| `RubberDark`      | `#151719`  |      0.72 |      0.05 | Cable sleeve, gaskets, foot pads.                               |

Material rules:

- Use geometry and lighting for form; do not introduce normal-map or post-processing requirements at N2.
- Keep the cyan accent below approximately 5% of visible machine surface area.
- Keep glass reflections controlled: the prize and claw must remain readable through the front pane.
- Prize materials are deliberately not fully specified here beyond a neutral, high-contrast test prize; prize asset styling can be approved with N3's asset inventory without changing the machine palette.

## 6. Lighting design

`LightingRoot` owns static environment presentation. Lighting never writes gameplay state, physics transforms, or pose targets.

### 6.1 Baseline rig

| Light           | Type / color                                                       | Target placement                                    | Purpose                                                                   |
| --------------- | ------------------------------------------------------------------ | --------------------------------------------------- | ------------------------------------------------------------------------- |
| `KeyLight`      | large area-like soft source, warm `#FFD8A3`, medium-high intensity | front-left, above camera, around `(−3.5, 6.0, 4.5)` | Defines machine silhouette and gives the claw steel a readable highlight. |
| `FillLight`     | broad cool source, `#9CCBDB`, low-medium intensity                 | front-right around `(4.0, 3.0, 3.0)`                | Opens graphite shadows without flattening the form.                       |
| `RimLight`      | narrow cool source, `#4FE5F2`, low intensity                       | rear-right around `(−2.5, 4.5, −3.0)`               | Separates the top cap, cable, and head from the interior.                 |
| `InteriorLight` | warm point/area-like source, `#FFC06B`, low-medium intensity       | inside upper chamber around `(0, 3.1, 0.0)`         | Makes the prize field and claw readable through glass.                    |
| `FloorBounce`   | neutral warm, very low intensity                                   | below/front of playfield                            | Prevents the lower plinth and chute from disappearing into black.         |

Use one restrained ambient/environment contribution in addition to the named sources. Avoid a bright unshadowed ambient wash: the design depends on a clear key-to-fill ratio of approximately 2:1.

### 6.2 Lighting constraints

- Baseline is static; no gameplay-driven light flashing or camera shake is part of N2.
- Shadows should be soft and selective. Prioritize the claw, floor, and machine silhouette over high-resolution all-object shadows.
- The review image must show the three finger tips, `GripCenter`, cable, front glass boundary, and chute without clipping or bloom obscuring them.
- Lighting must remain credible in the optional front debug view; it must not be authored only for one diagonal angle.
- Any later post-processing, emissive animation, or dynamic lighting is outside this node and requires a new approval.

## 7. Camera presets

A-30 requires one agreed review camera plus optional debug views. `CameraRig` owns these presentation presets; camera framing cannot modify `MachineRoot`, `ClawMount`, or physics state.

### 7.1 Normative preset: `ReviewCamera`

This is the camera used for the human N2 visual gate and the N3 screenshot evidence.

- **Projection:** perspective.
- **Position:** `(6.30, 4.35, 7.80)` meters.
- **Look-at target:** `(0.00, 2.05, 0.00)` meters.
- **Up:** +Y.
- **Field of view:** 38° vertical.
- **Near/far clip:** `0.05 / 100` meters.
- **Aspect behavior:** preserve the full machine envelope; on narrow viewports, reduce horizontal margin before changing target height.
- **Framing margin:** 8% around the `MachineRoot` envelope, with the entire top cap, lower plinth, chute, playfield, and a small floor reveal visible.
- **Visual priority:** `ClawSystem` and `MachineVisuals` occupy the central 80% of the image; `PrizeRoot` remains visible below the claw.
- **Motion policy:** fixed preset. No gameplay tracking, camera shake, scroll movement, or automatic dolly in N2/N3.

This angle is intentionally a moderate three-quarter view: enough front glass and side depth to establish volume, but not so diagonal that the claw's three-finger symmetry becomes ambiguous.

### 7.2 Optional diagnostic presets

These are not product cameras and do not change the normative review evidence.

| Preset             | Position             | Target               | Purpose                                                                          |
| ------------------ | -------------------- | -------------------- | -------------------------------------------------------------------------------- |
| `FrontDebugCamera` | `(0.00, 2.20, 8.60)` | `(0.00, 2.10, 0.00)` | Check silhouette, symmetry, front glass, chute, and finger spacing.              |
| `SideDebugCamera`  | `(8.60, 2.20, 0.00)` | `(0.00, 2.10, 0.00)` | Check depth, cable verticality, playfield fall, and panel thickness.             |
| `RigDebugCamera`   | `(3.20, 3.00, 5.00)` | `(0.00, 2.20, 0.00)` | Inspect named pivots, `GripCenter`, `ClawMount` bounds, and transform ownership. |

Debug views are read-only inspection tools under `DebugRoot`/`CameraRig`; they are not an excuse to add alternate gameplay framing or a second world anchor.

## 8. Review-camera definition and evidence procedure

The N2 review camera is a **definition**, not an implementation claim. N3 must realize the following exact review artifact:

1. Render the static baseline/home pose with `ReviewCamera` active.
2. Show the complete `MachineRoot` envelope, the `ClawMount` home position, one known `PrizeRoot` fixture, `PlayfieldRoot`, and the chute.
3. Include the hierarchy names in a companion report or debug capture; visual evidence alone cannot prove parent-child relationships.
4. Capture the same view after a refresh/remount to check stable authored placement and no transform drift.
5. If debug markers are enabled, show them in a separate optional capture; the normative product capture keeps `DebugRoot` hidden.
6. Save the normative screenshot and its companion review record under `records/evidence/` per A-34; record camera preset, viewport dimensions, baseline revision, and asset manifest revision with the screenshot.

A review pass is successful only when the human can answer “yes” to all of the following:

- Does the machine read as one coherent 3.60 m × 4.20 m × 2.00 m object?
- Is the claw immediately identifiable, with three fingers and visible `GripCenter` relationship?
- Is the claw large enough to inspect but not so large that it dominates the prize field?
- Can the glass, chute, playfield, and interior lighting be distinguished?
- Are the hierarchy and transform responsibilities consistent with `SceneRoot → MachineRoot → ClawMount → ClawSystem`?

## 9. Contract mapping and implementation guardrails

| Design decision                         | Contract mapping                                               | Guardrail for N3/N4                                                                                                                                |
| --------------------------------------- | -------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Machine envelope and centered placement | `MachineRoot`; scene hierarchy; L3 static placement; A-36      | Author once at `SceneRoot` origin; no per-frame machine transform writes.                                                                          |
| Travel volume and home claw pose        | `ClawMount`; A-09, A-21, A-37                                  | Use the documented 2.50 m × 1.85 m × 0.90 m envelope and home target; store targets in `ClawMount`-local meters and clamp at the adapter boundary. |
| Three-finger visual rig                 | `ClawSystem`, `FingerRig`, named `FingerPivot_0..2`; A-02/A-23 | Fingers are visual-only; any sensor proxy is separate and explicit.                                                                                |
| Rigid head and grip reference           | `HeadRoot`, `GripCenter`; A-03/A-24                            | `HeadRoot` stays rigid; `GripCenter` is not a win condition or implicit collider.                                                                  |
| Render/physics separation               | `ClawPhysicsRoot` sibling boundary; A-01, A-39; L4/L5          | Never add a physics root as a second visual transform parent.                                                                                      |
| Camera framing                          | `CameraRig`; authority map camera/presentation layer; A-30; L6 | Camera may frame/read scene but cannot write state, physics, or gameplay transforms.                                                               |
| Static lighting/materials               | `LightingRoot`; authority map scene/presentation layer         | Keep lighting/materials presentation-only and source resources immutable (A-18).                                                                   |
| Asset dimensions and axes               | A-16/A-17; asset contract                                      | Validate anchors, finite transforms, dimensions, scale, and orientation at the asset boundary.                                                     |
| Performance-conscious detail            | A-32; `records/contracts/performance-thresholds.md`            | Prefer simple bevels and controlled lights; no new rendering dependency or post stack.                                                             |

## 10. Approval checklist

Human approval of this document should explicitly confirm:

- [x] The 3.60 m × 4.20 m × 2.00 m machine envelope and centered `MachineRoot` placement.
- [x] The three-finger `ClawSystem` silhouette, dimensions, and `GripCenter` relationship.
- [x] The graphite / steel / cyan / amber material direction.
- [x] The warm-key / cool-fill / cyan-rim lighting direction and static-lighting constraint.
- [x] `ReviewCamera` as the normative camera at the specified position, target, FOV, and framing rule.
- [x] The optional debug cameras are inspection-only and not product behavior.
- [x] The hierarchy sketch and transform/authority mappings are sufficient for N3 scene and asset implementation.

**Routing:** If any proportion, aesthetic, or camera choice is rejected, remain in N2 and revise this document. Do not start N3 scene/asset work. If implementation requires gameplay code, a new physics strategy, a new authority, or a new dependency, stop and escalate to the human as required by the node contract.
