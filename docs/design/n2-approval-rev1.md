# N2 Approval — Static Visual Baseline Revision 1

| Field                 | Value                                                                                               |
| --------------------- | --------------------------------------------------------------------------------------------------- |
| **Decision**          | Approve N2 baseline revision 1 as the static-scene visual contract                                  |
| **Approved by**       | Human (routing node)                                                                                |
| **Date**              | 2026-08-01                                                                                          |
| **Canonical design**  | [`n2-visual-design.md`](./n2-visual-design.md)                                                      |
| **Review sheet**      | [`n2-visual-gate-sheet.md`](./n2-visual-gate-sheet.md)                                              |
| **Upstream baseline** | `gate-1-approved` dispatch baseline; repository tag remains `gate-0-baseline` pending N1a promotion |
| **Resulting route**   | N2 approved; static-scene work may proceed under the guardrails below                               |

## Approved visual contract

The reviewed machine and claw proportions are accepted as the static-scene visual contract:

- `MachineRoot`: centered at the `SceneRoot` floor origin; **3.60 W × 4.20 H × 2.00 D**.
- `ClawMount`: identity visual baseline; **2.50 W × 1.85 H × 0.90 D** design envelope.
- `ClawSystem/ClawVisualRoot`: **0.70 W × 1.10 H × 0.58 D**.
- `ClawSystem`: three visual fingers at 120° spacing, rigid `HeadRoot`, logical `GripCenter`, and separate physics-adapter boundary.
- Approved visual direction: graphite machine, brushed-steel claw, restrained cyan accent, amber chute, warm key/cool fill/cyan rim/static interior lighting.

## Canonical `ReviewCamera` configuration

All N2/Gate 2 screenshots must use this named preset. These values are normative and must not be inferred from a viewport or substituted by a debug camera.

```text
ReviewCamera = {
  projection: "perspective",
  position: [6.30, 4.35, 7.80],
  target: [0.00, 2.05, 0.00],
  up: [0.00, 1.00, 0.00],
  fovVerticalDeg: 38.00,
  nearClip: 0.05,
  farClip: 100.00,
  framingMargin: 0.08,
  motion: "fixed",
}
```

The evidence frame must include the complete machine envelope, `ClawMount` home position, one known `PrizeRoot`, `PlayfieldRoot`, chute, and a small floor reveal. `FrontDebugCamera`, `SideDebugCamera`, and `RigDebugCamera` remain inspection-only.

## Revision rule

Any later change to machine dimensions, claw scale, claw home pose, or any `ReviewCamera` value requires a new N2 revision and renewed human visual approval before scene/asset work adopts it.

## Static-scene prohibitions

N3/static-scene work remains prohibited from adding or deciding:

- physics bodies, colliders, sensor behavior, stepping, or grip evaluation;
- gameplay state, transitions, input handling, or command routing;
- prize logic, result logic, scoring, lives, sound, or UI;
- authoritative animation, gameplay-driven tweens, or state promotion;
- a new authority boundary, physics strategy, loader/helper dependency, or other dependency.

Presentation-only camera, lighting, and static visual composition are allowed. Any conflict with these boundaries stops the node and routes back to the human.

**Approval status:** APPROVED — N2 baseline revision 1.
