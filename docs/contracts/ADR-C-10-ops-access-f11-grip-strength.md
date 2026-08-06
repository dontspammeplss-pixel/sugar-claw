# ADR — Ops Access & Adjustable Grip Strength (N51 → A-45) [C-10]

**Status:** Approved — Eli, 2026-08-05 (env flag + hidden toggle; gripVoltage knob
only; shared voltage namespace confirmed)
**Authority:** Eli (product decision) + operator/dev role (extends C-01 authority map)
**Baseline:** `claw_app` @ main (`f97da6f`; N47/N48/N50/N49 landed)

## Rule

F-11's grip strength is a **dev/operator-only** runtime knob. `gripVoltage`
(12–36V, default 24V) is live-tunable through an ops panel that exists only in
ops-enabled builds (`VITE_OPS=1`), toggled with **Ctrl+Shift+O**; the knob feeds
F-01's `GripCapacity` through the coordinator → adapter clamped path; ops
values persist in a **dev-only namespace** (`claw-app:ops:v1`), never player
save data. **A-44 open question 1 resolves: YES — one voltage meaning lives in
the F-11 ops namespace (default 24V)**, spanning grip (this node) and, later,
travel (`n50-voltage-rev1` — OQ2, not this node). No player-facing control, no
state-machine change (C-02), no dependency (A-33).

## Body

### Context (verified, 2026-08-05)

- `gripVoltage` already derives `GripCapacity` linearly — `holdCapacity()`:
  (30 N + ratio·(90−30 N)) · padFriction · contactFactor · retentionFactor
  (`adapter.ts:1994-2001`); 12–36V enforced at create (`validateRetentionConfig`).
- `retentionConfig` was `private readonly` with no runtime setter — N51 adds a
  clamped `setGripVoltage` and makes gripVoltage the single writable retention
  knob (type-level change in the merged config type).
- The retention balance is re-evaluated **every fixed step while holding**
  (`adapter.ts` step(): `createRetentionState('holding')` per step) reading
  `retentionConfig.gripVoltage` live — a mid-carry voltage change shifts
  capacity/margin on the next step (verified: 24V→40N/29.97 margin,
  12V→20N/9.97, 36V→60N/49.97).
- `N7EffectCoordinator` exposes `readonly physics`; App holds the coordinator
  via `onReady`; UI never writes the adapter directly (C-01 boundary rule) →
  writes go through `coordinator.setGripVoltage`.
- Player save data = `claw-app:player:prizes:` (`prize-persistence.ts`); ops
  values use the separate `claw-app:ops:v1` key.
- No `VITE_` env usage or `vite-env.d.ts` existed — both added.

### Options considered (access mechanism — spec §6 / packet §8)

| Option | How | Verdict |
|--------|-----|---------|
| **Env flag + hidden toggle (chosen)** | `VITE_OPS=1` gates the panel module (tree-shaken from player builds); Ctrl+Shift+O toggles visibility | ✅ build-scoped, safe, fast iteration |
| Env flag only | Panel always shown in ops builds | ⚠️ acceptable |
| Hidden toggle only | Panel in every build behind a keybind | ❌ leaks into player bundles |
| URL query `?ops=1` | — | ⚠️ leaks easily; excluded |
| Build-time only | Settings compiled in | ❌ too rigid (spec §6) |

### Decision

- **Access:** `VITE_OPS=1` env flag + Ctrl+Shift+O hidden toggle (Eli,
  2026-08-05).
- **Namespace (A-44 OQ1):** confirmed — one voltage (12–36V, default 24V) in
  the F-11 dev/ops namespace; per-phase override knobs arrive with the travel
  transfer (OQ2).
- **Panel scope:** gripVoltage knob only (slider + %/psi calibration readouts;
  live retention-margin chip). Pad friction / speed overrides / prize layout /
  payout are out of scope (they feed F-03/F-08/F-12).

### Scope — in

1. `src/ops/ops-store.ts`: env gate, `claw-app:ops:v1` dev-only persistence,
   defaults `{gripVoltage: 24, revision: n51-ops-rev1}`, clamp + readouts.
2. `src/physics/adapter.ts`: `setGripVoltage(v)` — 12–36 clamp + finite check,
   mutates `retentionConfig` (deterministic; no fixed-step change).
3. `src/effects/n7-coordinator.ts`: `setGripVoltage` delegate (sanctioned path).
4. `src/ui/OpsPanel.tsx` + `src/App.tsx` wiring: panel + Ctrl+Shift+O + gate.
5. `src/vite-env.d.ts`: Vite client types for `import.meta.env.VITE_OPS`.
6. Evidence: `src/evidence/n51.test.ts` + `n51-evidence.ts` →
   `records/evidence/n51-ops-gate.json`.

### Scope — out

- Travel-side voltage transfer (`n50-voltage-rev1`, A-44 OQ2) — separate node.
- Other panel knobs (pad friction, per-phase speed overrides, prize layout,
  payout) — not wired by N51.
- `?ops=1`, player-facing controls, save-data changes, state-machine changes
  (C-02), any dependency (A-33).

## Workstream

- **Phase:** C — Feel & rigging.
- **Status:** Implemented + verified — 2026-08-06.
- **Files:** `src/ops/ops-store.ts`, `src/ui/OpsPanel.tsx`, `src/App.tsx`,
  `src/physics/adapter.ts`, `src/effects/n7-coordinator.ts`,
  `src/vite-env.d.ts`, `scripts/gate-ops.mjs`, `src/evidence/n51.test.ts`,
  `src/evidence/n51-evidence.ts`, and `records/evidence/n51-ops-gate.json`.
- **Definition of done:** The Ctrl+Shift+O panel is present only in a
  `VITE_OPS=1` build; finite `gripVoltage` values are clamped to 12–36V;
  coordinator-mediated changes update live capacity/hold margin; ops data uses
  `claw-app:ops:v1`; player saves remain clean; fresh player/ops bundle marker
  checks pass; and the full typecheck/lint/test/build gate passes.
- **Verification evidence:** `npm run typecheck` PASS; `npm run lint` PASS;
  `npm test` PASS (22 files, 98 tests); fresh production build PASS with
  `claw-ops-v1` absent; `npm run gate:ops` PASS with explicit `VITE_OPS=0`
  absence and `VITE_OPS=1` presence; focused N51 test PASS (2 tests).

## Verification

1. **Build-gate trace:** fresh player bundle built with `VITE_OPS=0` has no
   `claw-ops-v1` marker; fresh ops bundle built with `VITE_OPS=1` contains the
   marker. `npm run gate:ops` enforces both sides and passes. `ops-gate-inert`
   is green.
2. **Live-tuning trace:** same running adapter, active hold — 24V → capacity
   40N / margin +29.97N; 12V → 20N / +9.97N; 36V → 60N / +49.97N (monotone);
   out-of-band 5→12 and 50→36 clamped; non-finite rejected.
   `ops-disconnected` / `ops-voltage-out-of-band` guards green.
3. **Namespace trace:** ops save writes only `claw-app:ops:v1` (round-trip
   load returns 30V); player prize save (`claw-app:player:prizes:*`) contains
   no ops keys/values. `ops-leak` guard green.
4. **Full gate:** typecheck / lint / 22 files / 98 tests / build + `npm run gate:ops` — all green.

## Open questions

1. A-44 OQ2 — travel-side voltage transfer (`n50-voltage-rev1`, per-phase
   override knobs) — unchanged, separate node.

## Cross-references

- Contract: `docs/contracts/C-06-retention-physics.md` (rev 4); authority map
  C-01 (operator/dev row added).
- Outline row: `records/task-packets/todo/N47-N51-feel-rigging-pendulum-speed-ops.md` §8.
- Decision ledger: `docs/contracts/open-decisions.md` (A-45, Revision 6).
- Nodes: N51 (this), N49 (emergent braking evidence), N50 (F-10 decision).
