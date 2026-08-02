# Task Packet — N18: Tune Rapier parameters within existing config (ratchet)

> Node N18 in the Claw Machine 3D engineering graph (Implementation C; runs in parallel
> with N17; independent of N11–N16 cleanup and N20 presentation work).
> **Status:** contract written and dispatched 2026-08-01; ratchet loop executed and
> verified 2026-08-02. **Verdict: all probes reverted — no configuration change kept.**
> The approved `fixed-step-rev1` parameters are the local optimum for the N6 fixture.

---

## 1. The contract

```text
You are node N18 in the Claw Machine 3D engineering graph.

Task:            Raise solver iterations / friction / restitution per the physics guide,
                 ONLY inside N6_PHYSICS_CONFIG; run the full N6 scenario set after each
                 change; keep-or-revert per the results (ratchet loop).
Objective:       Measurable improvement in carry stability and jitter without violating
                 fixed-step policy or performance thresholds.
Allowed files:   src/physics/config.ts, src/evidence/n6.*, records/contracts/performance-thresholds.md
Protected files: src/state/**, src/scene/**, src/effects/**
Proof:           n6.test.ts scenarios 1-8 (idle, travel, open/close, single-prize contact,
                 carry, failed carry, reset, repeated run) + performance evidence.
Stop conditions: any scenario regresses; per-frame budget exceeded.
```

## 2. Method (ratchet loop, executed 2026-08-02)

One parameter change at a time. After each change the **full n6 scenario set**
(`n6.test.ts`, 11 tests) plus the evidence-based metric probe ran. The objective
metric is **carry deviation** (max anchor deviation during the jointed lift) with
**idle jitter** as the stability check, matching the fixture's own tolerance model
(`carryPosition` 0.025, `idlePosition` 0.002). Wall-clock step cost is measured as a
headless proxy (same limitation N8 recorded; browser frame timing is N9 territory).

A probe was
**KEPT** only if it strictly improved the objective metric or showed a
measurable benefit; byte-identical outcomes and regressions were **REVERTED**.

> Scope note: the §1 contract's literal allowed list is `src/physics/config.ts`,
> `src/evidence/n6.*`, and `records/contracts/performance-thresholds.md`. This packet and
> the `PLAN-node-contracts.md` status section follow the established repo convention that
> every executed node records a task packet and a plan status entry (same as N19/N20).
> No protected file was touched.

| # | Change (one at a time) | n6 scenarios | Carry deviation | Idle jitter | Verdict |
| - | ---------------------- | ------------ | --------------- | ----------- | ------- |
| — | **baseline** (solverIterations 8, additionalFrictionIterations 2, friction 0.7, restitution 0) | 11/11 pass | 0.0069271 | 0 | — |
| 1 | solverIterations 8 → 16 | 11/11 pass | 0.0074218 | 0 | **REVERT** — deviation regressed (+7.1%) |
| 2 | solverIterations 8 → 12 | 11/11 pass | 0.0072568 | 0 | **REVERT** — deviation regressed (+4.8%) |
| 3 | friction 0.7 → 0.9 | 11/11 pass | 0.0069271 | 0 | **REVERT** — byte-identical, no benefit |
| 4 | restitution 0 → 0.1 | 11/11 pass | 0.0069271 | 0 | **REVERT** — byte-identical, no benefit |
| 5 | additionalFrictionIterations 2 → 4 | 11/11 pass | 0.0069271 | 0 | **REVERT** — byte-identical, higher step cost |

## 3. Determinism confirmation (bonus finding)

The fresh re-run (2026-08-02) reproduced the prior session's carry deviations **to the
last digit** for every probe (e.g. solverIterations 16 → `0.0074218273162842685` in both
runs). This independently confirms the N6 fixture and evidence generator are
deterministic under the fixed-step policy — the same determinism the n6 suite already
asserts via its repeated-run scenario.

## 4. Why every probe reverted (evidence, not preference)

- **Solver iterations (probes 1–2):** the approved carry is an **explicit fixed impulse
  joint** (A-03). More solver iterations converge that joint to a slightly *looser*
  anchored pose in this fixture — carry deviation rose monotonically with iterations
  (8 → 12 → 16: 0.00693 → 0.00726 → 0.00742). The 12-iteration probe confirms the
  16-iteration result was not a threshold artifact.
- **Friction (probe 3):** surface friction is inert while the fixed joint is active and
  does not alter idle settling (byte-identical outcomes). Friction would only matter for
  dynamic finger tips, which are visual-only per A-02/A-23 (see N19 / charter request A-43).
- **Restitution (probe 4):** `restitution 0` is the approved non-bouncy floor contact;
  raising it produced byte-identical fixture outcomes and adds unmeasured post-release
  bounce risk with zero benefit.
- **Friction iterations (probe 5, extra):** byte-identical outcomes but measurably higher
  step cost (idle ~1.7× baseline in the headless proxy) — pure cost, no benefit.

No test scenario ever failed and the per-frame budget was never exceeded, so the node's
**stop conditions were not triggered** — the design's ratchet *revert* arm did its job
instead.

## 5. Performance evidence

| Metric | Baseline | Worst probe | Threshold (`performance-thresholds.md` rev 1) |
| ------ | -------- | ----------- | --------------------------------------------- |
| Physics step cost, idle | ~0.106 ms | ~0.179 ms | ≤ 2 ms average |
| Physics step cost, carry lift | ~0.123 ms | ~0.217 ms | ≤ 2 ms average |

Headroom ≈ 9–19× below the threshold across all probes; the fixed 1/60 s step is
unchanged, so **no threshold revision is required**. Caveat: headless Vitest wall-clock
proxy, same limitation N8 recorded.

## 6. Required proof (results)

| Check | Command | Result |
| ----- | ------- | ------ |
| n6 scenario set | `npx vitest run src/evidence/n6.test.ts` | 11/11 pass, re-run after each of 5 probes |
| Objective metrics | evidence probe (carry deviation, idle jitter, step cost) | recorded per probe in §2/§5 and `n6-ratchet-report.json` |
| Full suite | `npm test` | 52/52 green at close-out |
| Typecheck / lint / build | `npm run typecheck && npm run lint && npm run build` | all clean at close-out |

## 7. Known limitations

- The step-cost figures are a headless wall-clock proxy, not browser-frame timing
  (browser timing is N9 territory per the performance contract).
- The fixture is deliberately minimal (one claw, one prize, one floor). A richer scene
  (e.g. multiple prizes, A-08 first-interaction scope) could surface different
  sensitivity, but the jointed-carry result is fixture-robust: the carry is an explicit
  constraint, and solver/friction knobs do not change that physics.

## 8. Recommendation

**REVERT ALL — KEEP the approved `fixed-step-rev1` configuration unchanged.**
`solverIterations 8, additionalFrictionIterations 2, friction 0.7, restitution 0` is the
local optimum for the N6 fixture. Any future attempt to make the claw *feel* different is
a presentation decision (N20 already resolves the cycle) or a physics-strategy change
(gated behind charter request **A-43**), not a parameter tune.
