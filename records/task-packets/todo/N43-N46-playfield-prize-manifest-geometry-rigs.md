# Contract Packet — N43–N46: Playfield — multi-prize manifest, geometry variety, bone rigs, obstacles

> Nodes N43–N46 in the Claw Machine 3D engineering graph (Phase B of the feature
> roadmap; follows Phase A / N41–N42).
> **Status:** contract-only / implementation not started (2026-08-04).
> This packet converts Phase B of `claw-app-feature-spec.md` (v0 draft) into
> bounded implementation nodes. It deliberately changes **no source code, tests,
> physics configuration, generated evidence, dependencies, or build artifacts**
> until Eli accepts it as the implementation plan.
> **Source:** feature spec §3 F-03/F-04/F-05/F-06, §4 dependency graph, §5
> Phase B, §7 open decisions 5 and 6. Code/line evidence as-cited, not
> independently verified from this repo.
> **Baseline:** `3b8bb05` (N36–N40 landed) + approved Phase A packets.

---

## 1. The wanted outcome (from the spec)

Phase B breaks the single-sphere, resets-every-run prize and makes the playfield a
place where strategy exists: **from one resetting prize → persistent playfield**.
Concretely:

- **F-03** — several prizes, operator-configurable density/angles, and
  **persistence of prize positions across plays** so nudging and multi-play
  carryover work;
- **F-04** — prizes caught only by a strap/tag/corner; partial-contact "looks
  gripped" fails;
- **F-05** — bone-rigged articulated prizes whose parts flop and dangle, and
  which can be grabbed by a limb — added as **data, not code**;
- **F-06** — obstacles (shelves, dividers, other prizes) that block grabs, shift
  prizes during descent, and make packing interference real.

"Data over code for prizes" (spec §1.6) is the spine of this phase: adding a
prize is a manifest/config act, never a source edit.

## 2. Node graph

```text
N43 Prize manifest + persistence (F-03)
   ├──► N44 Geometry variety (F-04)   ──┐
   ├──► N46 Obstacles & packing (F-06) ─┼──► Phase-B promotion gate (Eli)
   └──► N45 Bone-rigged prizes (F-05) ──┘        (data-driven prizes; nudging works)
```

N43 is the foundation (manifest = the single source of prize truth) and must land
first. N44 and N46 are independent of each other once N43's manifest exists.
N45 depends on N43 + N44 (rig format extends the manifest; geometry primitives
are the joint attachment surfaces). Recommended order: N43 → N44/N46 (parallel)
→ N45 → gate.

## 3. Shared invariants and protected boundaries

Until Eli accepts this packet as the implementation plan, **only this packet, its
contract references, and the project decision ledger may be edited** for
N43–N46. No implementation or evidence artifact is authorized.

The following remain protected unless a separate contract revision is opened:

- `src/physics/adapter.ts` remains the sole Rapier body/collider/contact
  authority. Multi-prize bodies, jointed parts, and obstacle colliders are all
  registered and stepped through it.
- `src/physics/config.ts` remains the sole owner of fixed-step, collision-group,
  and physical parameter configuration. Prize placement/density/layout is
  operator config — **not** hardcoded component state (F-11/T3 owns the ops
  surface).
- Fixed-step policy, collision matrix, attachment primitive, and
  performance-thresholds contracts stay versioned; multi-prize scenes must meet
  the existing per-frame budget (headroom measured in N21).
- `src/state/**` (C-02) is protected except for the **blocked-descent policy**
  decision (F-06) which explicitly requires a state-machine call (spec §7 #6).
- `src/effects/n7-coordinator.ts` owns motion/completion; a blocked descent must
  stop/lift via the chosen policy, never observe-and-continue through an object.
- Determinism (A-27) and no-randomness (A-07) hold: multi-prize outcomes are
  fixed-step reproducible.
- Persistence writes go to a **local store**, never into `src/**` or the
  dependency set (A-33); save data is player-owned, ops values live in a dev-only
  namespace (F-11).
- **A-05 reversal (spec §4):** prize "reset every run" is reversed by F-03
  persistence — `docs/contracts/open-decisions.md` A-05 must be amended when
  N43 lands. This is a ledger revision, not a silent behavior change.

### Deliberate semantic changes this phase

- The playfield is no longer a single static prize: collision groups must now
  distinguish **prize-vs-prize** (dynamic blockers, F-06) from prize-vs-claw and
  prize-vs-floor — a collision-matrix revision (rev 3) is expected.
- Won prizes are **removed** from the playfield (F-03) rather than reset —
  feeding inventory (F-12/F-14).

---

## 4. N43 — Multi-prize manifest + persistent placement [F-03 → C-08]

### Job

Introduce a data-driven prize manifest (definitions with positions, orientations,
spawn layout), support several prizes, and persist prize state across plays so
nudging strategies and multi-play carryover work.

### Why (spec evidence, as-cited)

The research's strategy section is built on target selection and multi-play
nudging — impossible with a single fixed prize that resets every run (`config.ts:111`
`prizePosition`, `prizeRadius 0.22`; A-05).

### Ownership

- Manifest format + loader — **data** (JSON), single source of prize truth;
  authored via a new manifest schema (type duplication with N-13's Vec3/Quat
  cleanup must reuse the unified types).
- `src/physics/config.ts` — versioned collision groups for prize-vs-prize
  interaction; spawn layout defaults.
- `src/physics/adapter.ts` — registers N prize bodies; enforces persistence
  snapshot/restore within the fixed-step world.
- Ops placement (density/angle/layout presets) — owned by the dev/ops panel
  (F-11, Phase C); N43 defines the data shape the panel edits.
- Persistence store — local store keyed by prize manifest revision; player save
  data namespace separate from dev-only namespace.
- `src/state/**` — no new states; win (F-02) removes the won prize (already
  hooked in N42).

### Contract

1. A prize manifest exists: list of prize definitions with position,
   orientation, spawn layout, plus per-prize `weight` / `centerOfMass` (F-01's
   inputs) and geometry type (F-04).
2. Multiple prizes spawn per manifest; density/angle/layout is operator-
   configurable (data, not code).
3. Prize state (positions; won/removed flags) **persists across plays**; nudging
   on play 1 visibly changes what play 2 can grab.
4. Won prizes are removed from the playfield and tracked as winnings (F-12
   hook), not reset into place.
5. Reset semantics: a *new machine* (fresh manifest revision) restores a
   deterministic layout; an *ongoing machine* resumes the persisted state.
6. Collision groups distinguish prize-vs-prize from prize-vs-claw (revision to
   `records/contracts/collision-matrix.md`).
7. Adding a prize requires **zero code changes** — only manifest/config data.

### Failure results

- `manifest-invalid`: schema violation, duplicate IDs, or missing physics fields.
- `persistence-loss`: positions/won-flags not restored across a reload within the
  same manifest revision.
- `prize-collision-ambiguity`: prize-vs-prize and prize-vs-claw groups
  indistinguishable.
- `reset-vs-resume-conflict`: new-machine reset and ongoing-machine resume
  collide (e.g., stale save applied to a new manifest).
- `playfield-perf-regression`: multi-prize scene misses the per-frame budget.

### Evidence required

1. Manifest schema fixture: 3+ prizes of mixed geometry; validation result.
2. Persistence trace: nudge on play 1 → play 2 grab uses the nudged position;
   reload within revision preserves it.
3. Win-removal trace: won prize leaves the field; winnings counter increments.
4. Deterministic fixed-step runs for each fixture (repeatability tolerance).
5. Performance evidence vs `performance-thresholds.md` (N21 methodology).
6. Full gate: typecheck/lint/test/build.

### Stop conditions

Stop and open a revision if N43 needs a new persistence dependency, a state
machine change, a changed world convention, or non-data changes to add a prize.

---

## 5. N44 — Prize geometry variety: straps, tags, corners, packaging [F-04 → C-08]

### Job

Break the single sphere: prizes can be caught only by a strap/tag/corner;
partial-contact "looks gripped" fails. Grip quality depends on what was actually
caught.

### Why (spec evidence, as-cited)

Real machines are won or lost on packaging geometry — a strap, tag, or loop is
the whole game. Today: single spherical prize, no packaging/tag geometry
(`StaticScene.tsx` `PrizeRoot`, `config.ts:111`).

### Ownership

- Manifest (N43) — per-prize geometry definition: sphere, box, soft pouch, and
  **tag/strap/loop primitives** that are legitimate grip targets.
- Grip evaluator (F-01's onset predicate) — evaluates grip against the caught
  sub-geometry: contact + capture-envelope logic must identify *what* was
  contacted (strap vs body).
- `src/physics/adapter.ts` — colliders for sub-geometries per the collision
  matrix; contact-region identities feed the evaluator.
- `src/scene/**` — visual representations of packaging primitives; visuals never
  define grip.

### Contract

1. Manifest geometry types: sphere, box, soft pouch, plus tag/strap/loop
   primitives.
2. A strap/tag catch is **distinguishable** from a body catch (evaluator reports
   the caught region).
3. Grip quality depends on what was caught: a strap-only hold has different
   retention properties (feeds F-01's grip points / contact geometry) than a
   full-body cage.
4. Partial contact that "looks gripped" (visual/sensor overlap without a valid
   sub-geometry capture) fails — consistent with N37's valid-capture rule.
5. Per-prize mass and CoM offset are declared (F-01 torque inputs).

### Failure results

- `geometry-undefined`: prize without a declared geometry type.
- `strap-vs-body-ambiguous`: evaluator cannot report which region was caught.
- `pseudo-capture`: sensor/visual overlap approving a grip without a valid
  sub-geometry capture.

### Evidence required

1. Fixtures per geometry type: strap catch, tag catch, corner catch, body cage —
  each reports the caught region and its retention effect.
2. Negative fixture: overlap without valid sub-geometry capture → reject
  (mirrors N37's side-grab rejection).
3. Fixed-step repeatability per fixture; full gate.

### Stop conditions

Stop if F-04 requires a new physics strategy (e.g., cloth), a dependency, or
concave-mesh physics not approved by N39's collider-derivation policy.

---

## 6. N45 — Bone-rigged articulated prizes [F-05 → C-08]

### Job

A data-driven rig format for prizes "with bones": body parts as rigid bodies +
joint definitions, so limbs, head, and ears flop and dangle under Rapier, and a
limb can be grabbed. Authoring a new plushie = adding data, not code.

### Why

User request: "a better way to add objects with bones maybe that allow moving for
objects like plushies." Also a prerequisite for meaningful torque/slip on soft
prizes (F-01's mass/CoM per part).

### Ownership

- **Prize rig format** — JSON per prize: parts (rigid bodies) + joint
  definitions (Rapier ball/spherical joints with damping for flop), materials,
  grip points/tags, mass per part. Lives with the manifest (N43).
- `src/physics/adapter.ts` — instantiates part bodies + joints; jointed parts
  respond to grip, torque, collisions (limb caught → prize drags/flops → torque
  affects hold).
- Optional cosmetic sway layer — **on top of** physical, never instead of it
  (spec §1.3).
- Collider derivation — jointed/articulated meshes are **not** auto-derived
  candidates (N39 policy): rig parts need authored profiles.

### Contract

1. A plushie's limb dangles/flops under Rapier physics (spherical joints with
   damping); verified deterministically.
2. Grabbing a limb is physically meaningful: the joint chain transmits force, and
   the hold balance (F-01) sees the effective mass/CoM of what is caught.
3. Adding a new plushie requires zero code changes (data + authored collider
   profiles only).
4. Joint stiffness/damping, part masses, and grip points are per-rig data.
5. Rig parts register through the collision matrix (part-vs-part, part-vs-claw,
   part-vs-floor) without ad-hoc masks.

### Failure results

- `rig-invalid`: bad part/joint graph (dangling parts, missing mass, unbounded
  joint count).
- `flop-unstable`: jointed parts diverge or explode under fixed-step (the N26
  spring-explosion lesson applies — joint damping must be physical, no torque
  springs).
- `limb-grip-meaningless`: a limb catch does not change retention/torque
  behavior.
- `rig-needs-code`: adding a plushie requires a source edit.

### Evidence required

1. Deterministic flop fixture: part angular displacement vs damping over ≥90
   fixed steps; no divergence.
2. Limb-grab fixture: prize hangs/flops from the caught limb; hold margin shifts
   per F-01's equation with the effective mass/CoM.
3. Data-only authoring proof: a new plushie added via manifest+profiles, zero
   `src/**` diff.
4. Performance: N parts + N joints within the per-frame budget (N21 headroom).
5. Full gate: typecheck/lint/test/build.

### Stop conditions

Stop if F-05 requires a new physics engine feature beyond Rapier's joint set, a
dependency, or a non-data code path per plushie.

---

## 7. N46 — Obstacles & packing interference [F-06 → C-08]

### Job

Obstacles block grabs and shift prizes during descent; packed prizes interfere
with each other. A blocked descent must stop/lift per an explicit policy — never
ghost through.

### Why (spec evidence, as-cited)

With a full playfield, other-prize interference is what makes machine depth real
and placement strategy matter. Today: floor + 4 walls only
(`config.ts:84-89,140`); descent observes prize contact but continues
(`n7-coordinator.ts:431-437`); single prize, so no packing.

### Ownership

- Obstacle layout — operator-configurable data (shelves, dividers, window lip),
  owned by the same config surface as N43's placement.
- Collision groups — prize-vs-prize as dynamic blockers (N43's matrix revision).
- `src/effects/n7-coordinator.ts` — descent stops/lifts when physically blocked;
  implements the chosen policy (stall / retract / shake — **open decision**, §8).
- `src/state/**` — **C-02 impact:** the blocked-descent policy is a state-machine
  decision (spec §7 #6); the chosen behavior may need a state/transition entry.
- `src/physics/adapter.ts` — authoritative contact facts that trigger the policy.

### Contract

1. Configurable obstacles: shelves, dividers, window lip, **and other prizes as
   dynamic blockers** (already dynamic — verified prize nudges during grip).
2. A blocked descent **visibly stops or retracts** (no ghost-through) per the
   approved policy; stop reason reported (collider pair + contact facts).
3. Packed prizes push/nudge each other; your prize selection interacts with
   neighbors — deterministic and repeatable.
4. Obstacle layout is operator-configurable (data).
5. The chosen blocked-descent policy is recorded in the state-machine contract
   before implementation.

### Failure results

- `ghost-descent`: claw passes through an obstacle or packed prize.
- `blocked-descent-undefined`: contact observed but no policy applied (the
  observe-and-continue behavior N46 replaces).
- `packing-nondeterministic`: neighbor nudging not fixed-step reproducible.
- `obstacle-visual-only`: obstacle renders but has no physical collider.

### Evidence required

1. Blocked-descent fixture per policy: claw contacts an obstacle mid-descent →
   stops/retracts; no penetration; reason reported.
2. Packing fixture: two+ prizes — descent into one shifts its neighbor;
   reproducible across runs.
3. Layout config fixture: shelf/dividers from data change the playable volume.
4. Full gate: typecheck/lint/test/build; N36 descent contract still green with
   obstacles present.

### Stop conditions

Stop if the chosen policy needs a state-machine change beyond C-02's documented
revision, or requires new physics features/dependencies.

---

## 8. Phase-B open decisions (from spec §7, pending Eli)

1. **F-06 blocked descent (spec §7 #6):** when the claw is physically blocked
   mid-descent — **stall, retract, or shake?** This is a state-machine decision
   (C-02 impact) and must be resolved before N46 implementation.
2. **F-05 prize rig format (spec §7 #5):** confirm **JSON data-driven authoring**
   as the "better way to add objects with bones." Which first plushie(s) should
   the rig support? The choice affects joint tuning (flop feel) and the first
   authored profiles.
3. **Persistence store (F-03):** local store choice (e.g., `localStorage` vs
   IndexedDB) and save-schema versioning; player namespace vs dev/ops namespace
   separation (ties into F-11).
4. **Collision matrix revision:** confirm prize-vs-prize becomes a dynamic-
   blocker pair (rev 3) when N43 lands; A-05 ledger reversal wording.

## 9. Promotion gate (Phase B)

Eli's live-app gates:

1. Data-driven prizes: multiple prizes spawn per manifest; adding one requires no
   code.
2. Nudging works across plays: play 1 nudges, play 2 grabs the nudged state.
3. A plushie flops/dangles and can be grabbed by a limb.
4. A blocked descent visibly stops/retracts (no ghost-through); packed prizes
   shift neighbors.
5. Won prizes disappear and are tracked; full suite green.

## 10. Recommendation

**N43 → N44/N46 (parallel) → N45 → gate.** The manifest is the foundation every
other Phase-B node consumes; rigs (N45) and obstacles (N46) both extend it.
Resolve open decisions 1 (blocked descent) and 2 (first plushie) before
implementation of N46/N45 respectively. Draft C-08 in `docs/contracts/` via
`/c-contract-first` before implementation, and amend A-05 in the decision ledger
when N43 lands.
