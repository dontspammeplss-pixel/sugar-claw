# Contract Packet — N47–N51: Feel & rigging — pendulum coupling, speed profiles, braking, force-source, ops grip

> Nodes N47–N51 in the Claw Machine 3D engineering graph (Phase C of the feature
> roadmap; follows Phases A/B — N41–N46).
> **Status:** contract-only / implementation not started (2026-08-04).
> This packet converts Phase C of `claw-app-feature-spec.md` (v0 draft) into
> bounded implementation nodes. It deliberately changes **no source code, tests,
> physics configuration, generated evidence, dependencies, or build artifacts**
> until Eli accepts it as the implementation plan.
> **Source:** feature spec §3 F-07/F-08/F-09/F-10/F-11, §4 retention balance
> (the pendulum and travel terms), §5 Phase C, §6 dev/ops access design, §7 open
> decisions 1, 2, 7. Code/line evidence as-cited, not independently verified.
> **Baseline:** `3b8bb05` (N36–N40 landed) + approved Phase A/B packets.

---

## 1. The wanted outcome (from the spec)

Phase C makes movement itself a physical quantity. The pendulum stops being
cosmetic; travel speed trades off against retention; the claw stops on a dime only
by design; and the single rigging knob every real machine has — **grip strength** —
becomes a dev/operator-only control. The spine for this phase: *voltage becomes a
single physical meaning* (grip strength ↔ travel speed), and *slower = more
stable* emerges from physics, not lookup tables.

Phase C feeds the retention balance (F-01, Phase A):

```
RequiredHoldForce = f(prizeWeight, pendulum swing accel [F-07], travel accel [F-08],
                     CoM-offset torque τ = m·g·d [F-01], packing collisions [F-06])
```

F-07 and F-08 add the two dynamic terms that were stubbed at zero in Phase A.
F-09/F-10 shape *how* travel accelerates/brakes. F-11 is the operator knob on the
capacity side of the same equation.

## 2. Node graph

```text
N47 Pendulum coupling (F-07) ──────┐
N48 Speed-profile throttling (F-08)─┼──► N50 Force-source model decision (F-10, ADR)
N49 Per-phase braking (F-09) ───────┘            │
                                   ┌─────────────┘
                                   ▼
                        N51 Ops-only grip strength (F-11)
                                   │
                        Phase-C promotion gate (Eli: voltage = one meaning; ops panel live-tunes)
```

N47/N48 wire F-07/F-08 into F-01's `RequiredHoldForce` and are independent of each
other. N49 (braking) **depends on the F-10 decision**: if F-10's middle path
lands, braking is emergent (voltage → force → braking profile); if F-10 is
deferred, N49 is a standalone polish item. N50 is a decision node (ADR), not an
implementation node. N51 (ops access) depends on F-01's `GripCapacity` input and
on the ops-access mechanism (§4). Recommended order: **N50 (decide F-10) →
N47/N48 (parallel) → N51 → N49 (per the F-10 outcome) → gate.**

## 3. Shared invariants and protected boundaries

Until Eli accepts this packet as the implementation plan, **only this packet, its
contract references, and the project decision ledger may be edited** for N47–N51.

The following remain protected unless a separate contract revision is opened:

- `src/physics/adapter.ts` — sole Rapier authority; the pendulum already exists as
  a real spherical-jointed dynamic head (A-01 hybrid strategy); Phase C only
  **couples** its acceleration into the hold balance — it does not re-author the
  head.
- `src/physics/config.ts` — sole owner of damping, mass/inertia, timestep, solver
  values, and the new per-phase speed/accel profiles. The N26 lesson stands: no
  torque springs; the head self-rights as a pendulum.
- Fixed-step policy, collision matrix, attachment primitive, performance
  thresholds — versioned; Phase C adds no per-frame polling or unbounded solver
  work.
- `src/state/**` (C-02) — no new states for F-07/F-08; F-09/F-10 affect motion
  scheduling, not transitions; F-11 is a physics parameter, not a state.
- Determinism (A-27) and no-randomness (A-07): the F-07/F-08 coupling must be
  fixed-step reproducible; "slow carry holds / fast carry drops" is a
  deterministic fixture, not a probability.
- **Ops values never reach player save data** (spec §6): dev-only namespace;
  players cannot inherit or see rigging values. This is a hard rule for F-11 and
  every Phase-C knob.
- No new dependency without approval (A-33).

## 4. N50 — Force-source model decision (F-10) — decision node first

### Job (decide before N49)

Decide F-10's scope: **full drive-train simulation** (coil/motor/rack-and-pinion)
vs **voltage-parameterized travel** (recommended middle path) vs **defer F-10
entirely** and keep F-09 braking as standalone polish. N50 records the ADR in
`docs/contracts/` (C-06 extension) — it changes no code.

### The three options (spec §7 #1)

| Option | What it does | Verdict (spec recommendation) |
|--------|--------------|-------------------------------|
| Full drive-train sim | Coil/motor/rack-and-pinion mechanics; voltage → force → acceleration → momentum, physical overshoot | ⚠️ large architectural change, high risk to the deterministic suite, marginal player value |
| **Middle path** | **Voltage-parameterized travel**: max speed/accel per phase derived from a voltage/force parameter with clamping + braking profiles | ✅ **recommended** — unifies grip (F-11) and travel (F-08) under one voltage meaning |
| Defer F-10 | Keep F-09 braking standalone; no unified voltage meaning | ✅ acceptable fallback; loses the "single voltage meaning" goal |

### Contract (if middle path approved)

1. Travel speed/accel scale from a single voltage/force config; phases obey the
   F-08 profile.
2. "Slower = more stable" is **emergent**: higher transit speed raises
   `RequiredHoldForce` (F-08 term), which F-01 turns into slip risk — no lookup
   table.
3. Clamping and braking profiles prevent runaway/overshoot; determinism tests
   unchanged in policy.
4. F-09 braking becomes emergent (deceleration profile from the same voltage
   model), not a separate easing hack.

### Evidence required (decision node)

1. ADR drafted with in/out scope, risk to the deterministic suite, and the
   recommended option; recorded in the decision ledger.
2. If middle path: a fixture proving a fast carry with a weak grip drops while a
   slow carry with the same grip holds (the emergent tradeoff).

### Stop conditions

Full simulation is out of scope for this phase unless Eli explicitly overrides
the recommendation; if chosen, open a separate contract revision with its own
risk plan.

---

## 5. N47 — Functional pendulum: swing shakes marginal grips loose [F-07 → C-06 ext]

### Job

Feed head-swing acceleration into the retention model as part of
`RequiredHoldForce`. A sharp swing/sudden stop releases a weak hold; a strong one
holds. The pendulum becomes functional, not cosmetic.

### Why (spec evidence, as-cited)

The head is already a real pendulum (spherical joint, damping 10,
`adapter.ts:508-520,1185-1202`, `config.ts:118-125`), but the carried prize is
rigidly attached, so swing never releases it. The missing link is the coupling.

### Ownership

- `src/physics/config.ts` — versioned swing-accel → required-hold-force transfer
  function; damping stays in the fixed-step policy.
- `src/physics/adapter.ts` — samples head angular/swing acceleration in the fixed
  step and feeds the F-01 balance; no visual quaternion writes.
- `src/effects/n7-coordinator.ts` — travel profile can *create* the swing
  (sudden stops); it must not fake one.

### Contract

1. Swing acceleration is a declared term in `RequiredHoldForce` (F-01).
2. Deterministic fixture: sharp swing/sudden stop with a **weak** grip → release;
   **strong** grip → hold.
3. No torque springs, no per-frame angular corrections (N26 lesson); the swing is
   the physical pendulum's real motion.
4. The coupling is monotone and bounded: more swing accel ⇒ strictly
   non-decreasing required force.

### Failure results

- `pendulum-decoupled`: swing has no measurable effect on the hold balance.
- `pendulum-unstable`: the coupling destabilizes the head (revisit N26/N33
  damping discipline).
- `swing-faked`: release caused by a scripted event, not the physical swing.

### Evidence required

1. Swing/stop fixture at low and high voltage (per F-01), fixed-step
   reproducible.
2. Swing-accel sweep trace: required-hold-force vs swing magnitude.
3. N33 head-feel evidence still green (weighted settling preserved).
4. Full gate: typecheck/lint/test/build.

### Stop conditions

Stop if the coupling requires changing the head body strategy (A-01), the
spherical joint contract, or the fixed-step policy.

---

## 6. N48 — Speed-profile throttling + speed/success tradeoff [F-08 → C-06 ext]

### Job

Per-phase speed profile: fastest during free positioning; slowest during
descent/close/lift. Slower movement → better retention — **by physics** (travel
acceleration feeds F-01), not by lookup.

### Why (spec evidence, as-cited)

Descent ≈1.9 u/s (800 ms), lift ≈2.1 u/s (700 ms), return ≈2.1 u/s; aim glide
1.8 u/s (X) / 0.9 u/s (Z) (`n7-coordinator.ts:632-636`) — descent/lift are *not*
slower than aim glide. No speed tuning (`adapter.ts:1170-1202`).

### Ownership

- `src/physics/config.ts` — per-phase max speeds and accelerations (config-
  tunable, conservative default so it never feels sluggish — spec §7 #7).
- `src/effects/n7-coordinator.ts` — phase scheduler applies the profile; motion
  completion stays normalized and epoch-safe (A-40).
- Travel acceleration feeds F-01's `RequiredHoldForce` — wired in the adapter,
  not as a separate cheat.

### Contract

1. Phase speeds obey the profile: free positioning fastest; descent/close/lift
   slowest; conservative defaults.
2. Deterministic fixture: a fast carry with a weak grip drops; a slow carry with
   the same grip holds (the tradeoff is physical).
3. The profile is config-tunable (dev/ops surface, F-11 namespace); defaults
   never feel tedious.
4. Existing aim-glide semantics (velocity glide, per-axis clamp — N23) are
   preserved; only speeds/accels change.

### Failure results

- `profile-unapplied`: a phase ignores its speed cap (measured).
- `tradeoff-unphysical`: faster travel does not increase slip risk per F-01.
- `feel-sluggish-default`: defaults violate the "never feels tedious" rule (Eli's
  visual gate).

### Evidence required

1. Per-phase speed trace vs profile (measured step velocities).
2. Fast-vs-slow carry fixture with identical grip voltage → drop vs hold.
3. Full gate: typecheck/lint/test/build; N23 glide/bounds tests intact.

### Stop conditions

Stop if the profile requires a state-machine change or alters the fixed-step
policy.

---

## 7. N49 — Per-phase braking profile [F-09 → C-06 ext]

### Job

Motors accelerate/brake to avoid overshoot; easing decelerates into targets; no
abrupt stop on release. **Scope depends on the F-10 decision (N50):** emergent
braking if the middle path lands, standalone polish otherwise.

### Why (spec evidence, as-cited)

`easeInOutCubic` on all travel (`travel-animator.ts:9-11,71`;
`n7-coordinator.ts:340-350`); glide is constant-velocity with bounds clamp, no
braking. W-06 (travel animator extraction, de-over-engineering) overlaps this
scope — coordinate (spec §8).

### Ownership

- `src/effects/n7-coordinator.ts` + `src/animation/` — braking/settle phase at
  target and endpoint approach (decelerate into target, micro-settle before
  release); coordinate with W-06's animator extraction.
- `src/physics/config.ts` — braking distance / settle duration (config-tunable).
- If F-10 lands: braking is **emergent** from the voltage model; N49 then only
  verifies/evidences it.

### Contract

1. Travel visibly decelerates into targets; release does not snap; no overshoot.
2. Braking distance and settle duration are config values, not hardcoded.
3. No new state-machine transitions (motion scheduling only).
4. If F-10's middle path is approved, N49's deliverable is evidence of emergent
  braking rather than new code.

### Failure results

- `snap-release`: the claw stops abruptly at release/endpoints.
- `overshoot`: target overrun not recovered by the settle phase.
- `braking-nondeterministic`: braking outcome not fixed-step reproducible.

### Evidence required

1. Travel trace: velocity profile into target (deceleration visible), release
   without snap, no overshoot.
2. Deterministic repeatability across runs.
3. Full gate: typecheck/lint/test/build.

### Stop conditions

Stop if braking requires a state change, a dependency, or if F-10's decision
changes the ownership boundary mid-implementation.

---

## 8. N51 — Adjustable grip strength (45–60 psi / 12–36V), dev/operator-only [F-11 → C-10]

### Job

The operator can dial grip strength up/down — a rigging knob accessible **only to
developers/operators**, never a player-facing control. Feeds F-01's
`GripCapacity`; live-tunable in dev builds.

### Why

User: "I want to add this feature but only accessible by developers somehow."
Real machines: grip strength is *the* operator rigging knob; its absence is the
single most important missing rigging control. No grip-strength parameter exists
today (repo-wide grep: no voltage/strength settings; `adapter.ts:1154-1167`
binary approve/reject).

### Ownership — dev/operator access mechanism (spec §6, recommended)

| Option | How | Verdict |
|--------|-----|---------|
| **Env flag** | `VITE_OPS=1` (and/or `import.meta.env.DEV`) gates the panel | ✅ recommended (build-scoped, safe) |
| **Hidden toggle** | e.g., Ctrl+Shift+O toggles the panel at runtime | ✅ recommended alongside the env flag (fast iteration) |
| URL query param | `?ops=1` | ⚠️ acceptable for testing, leaks easily |
| Build-time only | settings compiled in | ❌ too rigid; ops need live tuning |

Panel contents (all operator knobs, per spec §6): grip strength/voltage (live),
pad friction, per-phase speed-profile overrides (N48), prize
placement/density/layout (F-03), payout-rate rule (F-12, later). Settings persist
in a **dev-only namespace** — never in player save data.

### Contract

1. `gripVoltage` 12–36V (internal 0–100% + psi readout for calibration display)
   is a runtime-tunable parameter feeding F-01's `GripCapacity`.
2. Only dev/ops builds expose the control (env flag + hidden toggle per the
   approved mechanism); players never see or inherit it.
3. Tuning changes retention behavior **live** (observable in the running scene).
4. Saved state never leaks rigging values into player save data (namespace
   separation).
5. Defaults match the approved Phase-A values so a non-ops build behaves
   identically to baseline.

### Failure results

- `ops-leak`: rigging values visible/inheritable in a player build or save.
- `ops-gate-inert`: `VITE_OPS=0`/production build still exposes the panel.
- `ops-disconnected`: tuning does not change retention behavior live.
- `ops-voltage-out-of-band`: value outside 12–36V accepted without clamp.

### Evidence required

1. Build-gate trace: production build has no panel (grep + bundle check);
   `VITE_OPS=1` build has it.
2. Live-tuning trace: voltage change shifts `GripCapacity`/hold margin in the
   running scene.
3. Namespace trace: player save contains no ops keys.
4. Full gate: typecheck/lint/test/build.

### Stop conditions

Stop if the mechanism requires a dependency, a server, or touches the state
machine; env-flag gating is build-scoped and reversible.

---

## 9. Phase-C open decisions (from spec §7, pending Eli)

1. **F-10 scope (§7 #1):** full drive-train sim vs **voltage-parameterized
   travel (recommended)** vs defer. Blocks N49's shape.
2. **F-11 access mechanism (§7 #2):** env flag + hidden toggle (recommended).
   Confirm flag name (`VITE_OPS`?) and keybind (Ctrl+Shift+O?).
3. **F-08 feel aggressiveness (§7 #7):** how slow should the slow phases be?
   (Recommend: config-tunable, conservative default so the game never feels
   sluggish.)
4. **Voltage → force transfer (F-01/F-07/F-08 shared):** confirm the
   `gripVoltage` scale spans both grip capacity and travel force so "one voltage
   meaning" holds across F-08/F-10/F-11.

## 10. Promotion gate (Phase C)

Eli's live-app gates:

1. The pendulum visibly shakes a marginal grip loose on a sharp stop; a strong
   grip holds.
2. Fast carry + weak grip drops; slow carry + same grip holds.
3. Travel decelerates into targets; release doesn't snap.
4. Ops panel only appears in dev/ops builds; live grip tuning changes behavior;
   player save never contains rigging values.

## 11. Recommendation

**N50 (decide F-10) first** — every other node in this phase is shaped by it.
Then N47/N48 in parallel, then N51, then N49 per the F-10 outcome. Draft the C-06
extension (F-07/F-08/F-09/F-10) and C-10 (ops access ADR) in `docs/contracts/`
via `/c-contract-first` before implementation, and record the F-11 access
mechanism in the decision ledger.
