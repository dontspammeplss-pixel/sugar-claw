# Contract Packet — N41–N42: Retention core — force-based hold (F-01) and chute-based win (F-02)

> Nodes N41–N42 in the Claw Machine 3D engineering graph (Phase A of the feature
> roadmap; follows the N36–N40 baseline commit `3b8bb05`).
> **Status:** N41 implemented and verified / N42 contract-only (2026-08-04).\n> **N41 Workstream:** completed; cross-link `N-41-force-based-retention-and-mid-carry-release.md` ↔ C-06.
> This packet converts Phase A of `claw-app-feature-spec.md` (v0 draft, vault note)
> into bounded implementation nodes. It deliberately changes **no source code,
> tests, physics configuration, generated evidence, dependencies, or build
> artifacts** until Eli accepts it as the implementation plan.
> **Source:** feature spec §3 F-01/F-02, §4 coherence map (retention balance
> equation + win pipeline), §5 Phase A, §8 C-06/C-07 contract candidates.
> Code/line evidence in the spec is reproduced as-cited by the user and is **not
> independently verified from this repo** (the vault has no `claw_app` checkout).
> **Baseline:** `3b8bb05` (clean tree, N36–N40 landed); decision ledger through
> Revision 4; 60/60 tests green at the N23–N28 close-out.

---

## 1. The wanted outcome (from the spec)

The app is a deterministic physics sandbox with binary outcomes: grip success is a
rigid joint (`approve/reject`), the chute is decorative, and the prize resets every
run. Phase A delivers the first half of the spec's spine:

- **from binary grip → force-governed hold** (F-01): a hold model where success
  emerges from force × geometry × materials, including mid-carry slippage and
  torque-induced release;
- **from grip-contact win → delivery win** (F-02): success = the prize crosses the
  chute/release sensor, not grip approval.

Everything that follows (persistent playfield, economy, display room) is built on
these two semantics. Nothing in Phase A is a hardcoded random drop — every failure
must trace to a verifiable physical balance (spec §1.1).

## 2. Node graph

```text
N41 Force-based hold model (F-01) ──► N42 Chute-based win detection (F-02)
          │                                   │
          └──────► Phase-A promotion gate (Eli: "clawed it… and lost it" + win = chute)
```

N41 first: F-02's win semantics give F-01's mid-carry releases their meaning (a
dropped prize can still win). N42 depends on N41 only for the *release* event being
a distinct physics outcome. No parallel implementation split is required — the two
are small enough to land as one pass, but they are separate contracts with separate
evidence.

## 3. Shared invariants and protected boundaries

Until Eli accepts this packet as the implementation plan, **only this packet, its
contract references, and the project decision ledger may be edited** for N41–N42.
No implementation or evidence artifact is authorized by this document.

The following remain protected unless a separate contract revision is opened:

- `src/physics/adapter.ts` is the sole Rapier world/body/contact authority. The
  hold model is evaluated **inside** the adapter's fixed step, never around it.
- `src/physics/config.ts` is the sole owner of fixed-step, collision-group, and
  physical parameter configuration. New retention parameters (voltage → force
  curve, μ, thresholds) are versioned candidate values in this file or its
  approved manifest, not ad-hoc constants in components.
- Physics remains fixed-step under `records/contracts/fixed-step-policy.md`; the
  collision matrix (`records/contracts/collision-matrix.md`) and the explicit
  carry constraint (`records/contracts/attachment-primitive.md`) stay versioned.
- `src/state/**` state-machine semantics (C-02) are protected. Phase A does not
  add new states: mid-carry release is a **physics outcome**, not a transition.
  The only C-02 impact is the win path (N42) — delivery replaces the current
  grip-approval-as-success outcome.
- `src/effects/n7-coordinator.ts` owns normalized motion/completion; it must not
  decide hold or win from render overlap.
- Determinism (A-27): the existing n6/n7 grip tests are reworked, **never
  weakened** — the slip/hold outcome must be reproducible under fixed-step.
- No new dependency, physics engine, or browser-global polling loop (A-33).
- A-07 randomness stays deferred: no probability table is introduced for release.

### Deliberate semantic changes this phase (to call out in the ledger)

- The existing `approve/reject` grip gate becomes **grip onset** ("gripped", not
  "won") — the approve condition itself is unchanged; only its meaning narrows.
- Success moves from grip-contact to delivery (N42). A prize dropped over the
  chute after a failed grip still wins — realistic and emergent.
- These extend the physics policy contract (C-03) and require the new contracts
  **C-06 (retention physics)** and **C-07 (win/delivery semantics)** to be
  drafted in `docs/contracts/` before implementation (via `/c-contract-first`).

---

## 4. N41 — Force-based hold model: slippage + torque [F-01 → C-06]

### Job

Replace the rigid carry joint with a hold force/voltage model evaluated each
physics step. `GripCapacity` vs `RequiredHoldForce` decide retention; off-center
grips can rotate the prize out via torque; mid-carry release exists as a distinct,
observable event.

### Why (spec evidence, as-cited)

Most real-world failure is *sustained-force failure after an initial grab*; today
a successful grip can never drop. Retention ignores torque entirely
(`adapter.ts:1170-1202`, `observeGrip()` at `:1018-1090`; binary gate at
`adapter.ts:1154-1202`). This is the single largest game-feel and fidelity gain.

### Ownership

- `src/physics/config.ts` — versioned candidates: `gripVoltage` (12–36V) →
  max-hold-force transfer, `padFriction` μ, hold-failure threshold; per-prize
  `weight` / `centerOfMass` live in the prize manifest (F-05, Phase B — Phase A
  uses the existing single prize plus a declared weight/CoM).
- `src/physics/adapter.ts` — the hold balance evaluated per fixed step; the carry
  constraint is replaced by the hold model; retention state published to the
  evidence bus.
- Grip evaluator (existing) — the pure predicate for **grip onset** keeps its
  current semantics (sensor + solver contacts + capture envelope).
- `src/state/**` — unchanged in N41 (no new states).
- `src/effects/n7-coordinator.ts` — consumes retention state for UI copy and
  evidence; never decides hold from render overlap.
- `src/evidence/**` — read-only traces: retention state, margin, release event.

### Contract

1. The existing approval gate is kept and re-meant as **grip onset** — it
   concludes "gripped," not "won."
2. The rigid carry joint is replaced by a hold model evaluated each fixed step:
   - `GripCapacity = f(holdVoltage 12–36V → maxHoldForce, padFriction μ,
     contact geometry, grip points on prize)`
   - `RequiredHoldForce = f(prizeWeight, pendulum swing accel [F-07],
     travel accel [F-08], CoM-offset torque τ = m·g·d, packing collisions [F-06])`
   - `HoldMargin = GripCapacity − RequiredHoldForce`; fail when margin < 0 →
     slippage → mid-carry release.
3. Failure is purely the balance. No hardcoded probability, no random drop
   (A-07). Phase A's torque term uses the single prize's declared CoM; pendulum
   (F-07) and travel-accel (F-08) terms are **stubbed at zero** until Phase C —
   their slots exist in the equation, their inputs are not yet wired.
4. Mid-carry release is a **distinct event**: evidence-log entry + UI copy
   ("it slipped!"), not merely another "miss."
5. An off-center grip on a heavy prize rotates/frees it under torque; a centered
   grip holds — both reproducible in fixed-step fixtures.
6. Retention state (voltage, capacity, required, margin, released-at) is
   published on the evidence bus so the gate workflow can observe it.
7. Existing tests stay green after the deterministic grip tests are reworked to
   the hold model (slip/hold must be deterministic, not tuned to pass).

### Failure results

- `hold-undefined-capacity`: voltage/μ mapping missing, or voltage outside the
  12–36V band.
- `hold-margin-unmeasurable`: required hold force not derivable from declared
  physics quantities (missing weight, CoM, or geometry inputs).
- `hold-random-release`: a release not traceable to the balance (violates §1.1).
- `hold-torque-misapplied`: torque term present but off-center/centered fixtures
  do not behave per the balance.
- `hold-event-missing`: release not observable as a distinct event.
- `retention-regression`: existing n6/n7 tests weakened rather than reworked.

### Evidence required

1. Deterministic fixture: insufficient voltage slips and drops the prize
   mid-carry (reproducible across repeated runs, within fixed-step tolerance).
2. Off-center vs centered grip fixture on a heavy prize: torque frees vs holds.
3. Voltage sweep trace (12 / 24 / 36 V) vs measured hold margin, per fixed step.
4. Release-event evidence: evidence-log entry with state, step index, and margin
   at release; UI copy present.
5. Full gate: `npm run typecheck` && `npm run lint` && `npm test` &&
   `npm run build` — all green with the reworked deterministic tests.

### Stop conditions

Stop and open a contract revision if N41 requires changing the fixed-step policy
(dt/solver), the collision matrix, the state machine (C-02), the explicit-carry
contract beyond its replacement, or the dependency set; or if it needs a
protected file outside the approved list.

---

### N41 implementation Workstream / verification (completed 2026-08-04)

- **Phase:** A — retention core; N41 only. N42 remains unimplemented.
- **Files touched:** `src/physics/config.ts`, `src/physics/adapter.ts`, `src/effects/n7-coordinator.ts`, and approved `src/evidence/**` consumers/fixtures. `src/state/**`, `src/App.tsx`, dependencies, and physics/collision contracts were unchanged.
- **Definition of done:** grip onset preserved; rigid carry joint removed; fixed-step hold margin implemented; voltage/CoM torque fixtures deterministic; release state/step/margin published; distinct slip UI copy present; no `src/state/**`, fixed-step, collision-matrix, or dependency changes.
- **Evidence:** N6 retention tests cover insufficient-voltage release, centered-vs-off-center torque, repeated 12/24/36V margin traces, voltage-band validation, and release event fields. Focused N6/N7 gate: 24/24 tests passed. Full gate: `npm run typecheck` passed; `npm run lint` passed; `npm test` passed (13 test files, 83 tests); `npm run build` passed (72 modules transformed).
- **Review note:** generated N33/N34/N36 evidence JSON was restored after verification; unrelated pre-existing task packets were preserved. Legacy `jointCreated`/`jointActive` fields are compatibility projections of hold state and are not Rapier carry-joint claims.

## 5. N42 — Chute-based win detection: delivery semantics [F-02 → C-07]

### Job

Make success = the prize crosses the chute/release-point sensor, regardless of
how it got there. The chute stops being decorative; the win path resets the
play/win countdown and hands the prize to the inventory hook (F-12 later).

### Why (spec evidence, as-cited)

Success is currently decided by grip contact; the chute is decorative. Correcting
outcome semantics (a prize dropped over the chute is a win; a gripped-but-never-
delivered prize is not) unblocks payout cycling and the economy layer (F-12).

### Ownership

- `src/physics/adapter.ts` — the chute plane/sensor volume at the release point;
  the intersection test (Rapier contact or spatial test) each fixed step.
- `src/state/**` — the win transition (C-02 impact): delivery replaces grip-
  approval as the success outcome; outcome + result states reflect the delivery
  win; the play/win countdown is reset on win.
- `src/effects/n7-coordinator.ts` — win event → UI + evidence; coordinates the
  countdown reset; must not decide win from render overlap.
- Inventory/payout hook — Phase A fires the hook point as an event only (no-op
  consumer until F-12/F-03 land); the hook must be observable on the evidence
  bus, not silent.
- `src/scene/**` — chute visuals reference the physical sensor; never define it.

### Contract

1. A chute plane/sensor volume exists at the release point, authored in canonical
   meters per the transform contract.
2. Win fires when the prize's tracked volume intersects the sensor — **however**
   the prize got there: carried, dropped, or nudged.
3. Negative: gripping a prize and carrying it away = **no win**.
4. Positive: dropping the prize into the chute = win; a prize that slides/falls
   in after a **failed** grip still wins (emergent, allowed).
5. On win: transition state (C-02), remove the prize from the playfield (F-03
   hook), fire the payout/inventory hook (F-12), reset the countdown.
6. The win is observable on the evidence bus (state, prize ID, step index,
   sensor-relative geometry) — never inferred from a screenshot.

### Failure results

- `chute-sensor-undefined`: no physical sensor volume or no authored plane.
- `win-not-delivered`: a win fired without the prize intersecting the sensor.
- `delivery-denied`: a true delivery not recognized (e.g., release drops the
  prize short of the sensor with no fall-through path).
- `win-stale-epoch`: a win observation from a cancelled/old run epoch accepted.
- `win-ghost`: a win while the prize is still attached to the claw.

### Evidence required

1. No-win carry fixture: grip approved, carried away, no win, countdown intact.
2. Win fixture: carried prize released over the chute → win; countdown resets.
3. Emergent fixture: failed grip → prize slides/falls into chute → win.
4. Evidence-bus capture for each fixture (state path, prize ID, step index).
5. Full gate: typecheck/lint/test/build green; existing reset + repeatability
   tests intact.

### Stop conditions

Stop and open a contract revision if N42 requires changing the world convention,
the state machine beyond the win path (C-02 revision is expected), the collision
matrix, or if the sensor test needs per-frame DOM/render work.

---

### N41 status boundary

N41 is complete for the retention contract. N42 remains pending and must not be inferred from N41’s passing retention/build gates.

## 6. Phase-A open decisions (from spec §7, pending Eli)

1. **First-cut retention defaults.** Propose conservative `gripVoltage` /
   `padFriction` starting values so the machine's first-cut behavior retains like
   today at the reference grip (deterministic tests then define the baseline).
   Decision needed before C-06's parameter table is frozen.
2. **Chute geometry.** Sensor volume shape/size at the release point — proposed:
   a plane/box spanning the chute mouth; the "prize constitutes delivery" rule
   (bounding volume crosses the plane) is proposed in the spec and confirmed here.
3. **Ledger updates.** Spec §4 calls out that A-05 (prize reset every run) is
   reversed by F-03 persistence — that reversal lands in Phase B, not here; but
   the **semantic re-meaning of the grip gate** (A-03/A-24/A-26 context) and the
   **win definition** (A-06: "human-defined result zone/placement, not contact
   alone") are already binding and support F-02 — confirm the ledger entry
   wording when C-06/C-07 are drafted.

## 7. Promotion gate (Phase A)

Eli's live-app gates, not a green suite alone:

1. The "clawed it… and lost it" moment exists: a weak grip slips mid-carry; a
   strong one holds; torque visibly rotates an off-center prize loose.
2. Win = chute: carrying the prize away never wins; dropping it into the chute
   does — including after a failed grip.
3. Full suite green with reworked deterministic tests; no protected contract
   silently renegotiated.

## 8. Recommendation

**Implement N41 then N42.** N41's mid-carry releases only become meaningful game
outcomes once N42's delivery win exists, so land the pair as one Phase-A pass but
keep their evidence separate. Before implementation, draft C-06 + C-07 in
`docs/contracts/` via `/c-contract-first` (house style: Status / Authority /
Baseline / Rule / Body / Workstream / Verification), and record the semantic
changes in the decision ledger — A-06 already endorses the delivery-win
definition. Revert scope: the hold model can be disabled in config (revert to
explicit-carry) without touching protected files.
