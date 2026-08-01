# N2 Visual Gate Sheet — Claw Machine V1

**Decision:** Approved — N2 baseline revision 1  
**Approval record:** [`n2-approval-rev1.md`](./n2-approval-rev1.md)  
**Baseline:** `gate-1-approved` dispatch baseline; repository tag remains `gate-0-baseline` pending N1a promotion  
**Canonical detail:** [`n2-visual-design.md`](./n2-visual-design.md)  
**Scope:** `docs/design/**` only — no gameplay, physics implementation, or new dependencies

## The one-minute read

A compact, premium arcade claw machine: dark graphite shell, warm interior, restrained cyan carriage accent, and a bright three-finger steel claw as the focal point. The normative presentation is a fixed moderate three-quarter view that keeps the claw, prize, glass, playfield, and chute legible together.

## 1. Proportion + hierarchy proof

```text
SceneRoot                         meters · Y-up · right-handed · floor origin
└── MachineRoot                    static · 3.60 W × 4.20 H × 2.00 D
    ├── MachineVisuals             shell · frame · glass · plinth · chute
    └── ClawMount                  identity baseline; legal head-center bounds
        └── ClawSystem             one logical claw instance
            └── ClawVisualRoot     0.70 W × 1.10 H × 0.58 D
                ├── Carriage + Cable
                └── HeadRoot        rigid
                    ├── GripCenter  logical marker only
                    └── FingerRig   3 visual fingers at 120°

    PrizeRoot + PlayfieldRoot       known prize + floor/chute presentation
    CameraRig + LightingRoot        presentation-only authorities
    DebugRoot                       optional, read-only diagnostics
```

```text
Front proportion sketch — authored targets, not to scale

       MachineRoot: 3.60 W × 4.20 H × 2.00 D
     ┌────────────────────────────────────┐  top cap
     │          ClawMount                 │
     │       ┌──────────────┐             │  home head center
     │       │ ClawSystem   │             │  (0.00, 2.85, 0.10)
     │       │ GripCenter   │             │
     │       └──────────────┘             │
     │          PrizeRoot                 │
     │       PlayfieldRoot       ┌───┐    │  Chute
     └───────────────────────────┴───┴────┘  floor y = 0

     ClawMount envelope: 2.50 W × 1.85 H × 0.90 D
     Head-center bounds: x [-1.25,+1.25], y [1.35,3.20], z [-0.35,+0.55]
```

## 2. Look, materials, and lighting

| Area               | Approved direction                                                                                                                               |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Machine silhouette | Vertical graphite shell, rounded corners, thick top cap, broad lower plinth, chamfer highlights.                                                 |
| Claw character     | Precise industrial tool; rounded triangular head; brushed-steel fingers; soft inward hooks; visible cable.                                       |
| Palette            | `MachineGraphite #20262B`; `ClawSteel #AEB9BD`; `ClawCyanAccent #41D9E8`; `ChuteAmber #D88932`; `InteriorSlate #303A3E`; `GlassNeutral #B8D0D2`. |
| Accent restraint   | Cyan remains below approximately 5% of visible machine surface.                                                                                  |
| Lighting           | Static warm `KeyLight`, cool `FillLight`, cyan `RimLight`, warm `InteriorLight`, very low warm `FloorBounce`; target key/fill ratio ≈ 2:1.       |
| Readability        | Claw tips, `GripCenter`, cable, front glass, playfield, prize, and chute must remain visible; no bloom/post-processing requirement.              |

## 3. Normative review camera

**Preset:** `ReviewCamera` · perspective · fixed, no tracking or shake  
**Position:** `(6.30, 4.35, 7.80)` m · **Target:** `(0.00, 2.05, 0.00)` m · **Up:** +Y  
**FOV:** 38° vertical · **Clip:** `0.05 / 100` m · **Framing:** 8% margin around full `MachineRoot` envelope

The capture must show the complete machine, `ClawMount` home position, one known `PrizeRoot`, `PlayfieldRoot`, chute, and a small floor reveal. `FrontDebugCamera`, `SideDebugCamera`, and `RigDebugCamera` are inspection-only and never normative product views.

## 4. Guardrails + human decision

- [x] Approve the 3.60 × 4.20 × 2.00 m `MachineRoot` envelope and centered placement.
- [x] Approve the 2.50 × 1.85 × 0.90 m `ClawMount` design envelope and home target.
- [x] Approve the three-finger `ClawSystem`, rigid `HeadRoot`, and logical `GripCenter` relationship.
- [x] Approve graphite / steel / cyan / amber materials and static lighting direction.
- [x] Approve `ReviewCamera` position, target, FOV, and 8% framing rule.
- [x] Confirm visual fingers are separate from later sensor proxies; no physical finger colliders are implied here.
- [x] Confirm `ClawPhysicsRoot` is an adapter boundary, never a second visual transform parent.
- [x] Confirm debug cameras and `DebugRoot` are read-only inspection tools.

**Review evidence:** save the approved normative screenshot and companion record under `records/evidence/` per A-34, including camera preset, viewport, baseline revision, and asset manifest revision.

**Routing:** N2 approved → proceed to N3 within the recorded guardrails. Reject or amend any aesthetic/proportion/camera choice → create a new N2 revision and remain in N2. If implementation needs gameplay code, a new authority, a new physics strategy, or a dependency → stop and escalate.

**Human decision:** ☒ APPROVE N2 ☐ AMEND N2 ☐ ESCALATE  
**Reviewer:** Human (routing node) **Date:** 2026-08-01 **Revision/notes:** Baseline revision 1 approved.
