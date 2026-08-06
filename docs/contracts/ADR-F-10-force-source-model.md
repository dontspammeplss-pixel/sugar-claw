# ADR — F-10 Force-Source Model: scope decision (N50 → A-44)

**Status:** Approved — Eli, 2026-08-05 (middle path: voltage-parameterized travel)
**Authority:** Eli (product decision) + physics system (extends C-06 retention physics)
**Baseline:** `claw_app` @ main (`f97da6f` — N47/N48 landed)

## Rule

F-10's scope is **voltage-parameterized travel** (the middle path). A single
`voltage` parameter (12–36V, default 24V — the same voltage as grip strength,
F-11) derives per-phase travel max speed/acceleration through a versioned,
clamped transfer. Travel speed and grip strength share one physical meaning;
"slower = more stable" stays emergent (N48's travel term), never a lookup table.
Full drive-train simulation is out of scope for this phase (stop condition:
requires a separate contract revision with its own risk plan).

## Body

### Context (verified, 2026-08-05)

- `gripVoltage` (12–36V, default 24V) exists only in retention
  (`src/physics/config.ts` `retention`) — grip capacity, no travel coupling.
- Travel speeds are fixed per-phase constants (`travelProfile`, rev
  `n48-speed-profile-rev1`): free positioning fastest (3.8 u/s), descent/lift
  slowest (1.6 u/s), return legs fast (2.6/3.7 u/s).
- N23 aim-glide is velocity-based and never profile-governed
  (`GLIDE_SPEED_X = 1.8` / `GLIDE_SPEED_Z = 0.9`).
- N48's passing fixture already demonstrates the middle-path tradeoff:
  fast 12V carry releases (step 9, peak travel accel 11.25 m/s², margin
  −5.12 N) while the same-grip slow carry holds (+9.94 N, peak 4.5 m/s²);
  byte-identical repeat. Evidence: `records/evidence/n48-speed-trace.json`.

### Options considered

| Option | In / out | Risk (grounded) | Verdict |
|--------|----------|-----------------|---------|
| A — Full drive-train sim | Position-keyframed travel replaced by a simulated drive; momentum, mechanical feel, physical overshoot | HIGH: replaces position-based completion (A-40) every scheduled-phase test relies on; re-authors the adapter's travel surface; solver load vs `performance-thresholds.md`; churns N7/N23/N48 evidence | ⚠️ not recommended this phase |
| B — Middle path (chosen) | One voltage derives per-phase max speed/accel via a versioned, clamped transfer; braking (F-09) emerges | MEDIUM-LOW: config-level only; no step change, no adapter authority change, no dependency (A-33); config revision bump + determinism trace (A-27/A-07); default 24V must reproduce baseline `travelProfile` | ✅ chosen |
| C — Defer F-10 | F-09 braking as standalone polish; no unified voltage meaning | LOW | ✅ acceptable fallback (not chosen) |

### Decision

**Middle path (voltage-parameterized travel).** Recorded as A-44 in the
decision ledger (`docs/contracts/open-decisions.md`, Revision 5).

### Scope — in

1. `src/physics/config.ts` owns the versioned `voltage → {maxSpeed, maxAccel}`
   per-phase transfer with clamping; `travelTransfer` bounds remain the cap;
   `retention.revision` / `travelProfile.revision` bump (`n50-voltage-rev1`).
2. At the default 24V the derived profile reproduces the current
   `travelProfile` byte-for-byte — a non-ops build behaves identically to
   baseline (N48 trace stays green).
3. `src/effects/n7-coordinator.ts` consumes the derived caps in the existing
   phase scheduler — motion scheduling only, no new state transitions (C-02).
4. Braking (F-09) is **emergent** from the voltage-derived accel profile;
   N49's deliverable is evidence of it, not new code.
5. N23 glide semantics are untouched; no new dependency (A-33).

### Scope — out (non-goals)

- Full drive-train simulation (coil/motor/rack-and-pinion) — out of scope this
  phase; requires a separate contract revision with its own risk plan.
- Standalone braking code (N49) — not needed; braking emerges from the model.
- Any change to the fixed-step policy, the adapter's Rapier authority, or the
  state machine (C-02).

## Verification

1. ADR drafted with in/out scope, risk, recommended option — this document.
2. Decision recorded in the ledger: A-44 (Revision 5, 2026-08-05).
3. Middle-path fixture: **already exists** — `records/evidence/n48-speed-trace.json`
   (fast-weak drops / slow-same holds; result pass, 6/6 gates, byte-identical
   repeat). No new fixture required at the decision node.

## Open questions

1. ~~Shared voltage namespace~~ **Resolved (2026-08-05, A-45/C-10):** YES —
   `voltage` lives in the F-11 dev/ops namespace (default 24V); per-phase
   override knobs arrive with the travel transfer (OQ2).
2. Exact derived-profile transfer curve (tuning; defaults reproduce baseline).

## Cross-references

- Contract: `docs/contracts/C-06-retention-physics.md` (rev 4).
- Outline row: `records/task-packets/todo/N47-N51-feel-rigging-pendulum-speed-ops.md` §4 (N50).
- Decision ledger: `docs/contracts/open-decisions.md` (A-44, Revision 5).
- Nodes: N49 (evidence of emergent braking, F-09), N51 (ops grip, C-10).
