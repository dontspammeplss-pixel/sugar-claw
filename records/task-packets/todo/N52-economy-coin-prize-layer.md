# Contract Packet — N52: Economy / coin / prize-cost layer [F-12 → C-09]

> Node N52 in the Claw Machine 3D engineering graph (Phase D of the feature
> roadmap; follows Phases A–C — N41–N51).
> **Status:** contract-only / implementation not started (2026-08-04).
> This packet converts Phase D of `claw-app-feature-spec.md` (v0 draft) into a
> bounded implementation node. It deliberately changes **no source code, tests,
> physics configuration, generated evidence, dependencies, or build artifacts**
> until Eli accepts it as the implementation plan.
> **Source:** feature spec §3 F-12, §4 win pipeline, §5 Phase D, §7 open
> decision 3. Code/line evidence as-cited, not independently verified.
> **Baseline:** `3b8bb05` (N36–N40 landed) + approved Phase A–C packets.

---

## 1. The wanted outcome (from the spec)

A virtual coin system, cost-per-play, and a prize-cost/value model so the machine
has a **profit curve to tune**. User priority: "Economy / coin / prize-cost layer
(needed for profit-based algorithms)." This is what makes the machine a
*business* and enables operator analytics (win-rate vs profit). The spine for this
phase: *from a sandbox → a collectible, profitable machine*.

Phase D sits on top of the win pipeline delivered in Phases A–B:

```text
prize crosses chute sensor [F-02] = WIN
  → prize removed from playfield [F-03]
  → inventory [F-12]        ← this node
  → display room [F-14]
cost per play, profit/win-rate stats [F-12]   ← this node
```

## 2. Node graph

```text
N52 Economy / coin / prize-cost layer (F-12)
   │   └─ consumes: F-02 win events, F-03 prize removal, F-11 ops knobs
   ▼
Phase-D promotion gate (Eli: coin/prize/profit cycle observable)
```

N52 is a single bounded node but carries three contract surfaces that must not
be conflated: **credits** (coins in), **value** (prize value out), and **stats**
(profit/win-rate observability). Dependencies: F-02 (win events), F-03 (prize
removal), F-11 (payout-rate rule as an ops knob).

## 3. Shared invariants and protected boundaries

Until Eli accepts this packet as the implementation plan, **only this packet, its
contract references, and the project decision ledger may be edited** for N52.

The following remain protected unless a separate contract revision is opened:

- Economy state is **product-level data**, not physics: it never enters
  `src/physics/**`, never influences the fixed-step world, and never changes the
  collision matrix or solver. The claw still loses for physical reasons; the
  economy observes outcomes.
- `src/state/**` (C-02): cost/credit transitions are a new **gameplay overlay**,
  not new claw states. If the payout rule must force a win, that **violates
  A-07/no-randomness and F-01's physicality** — the rule must instead bias the
  *available grip parameters* via F-01/F-11 within their legal bands, never
  inject a non-physical win.
- The payout-rate rule (if any) is an **ops knob** (F-11 namespace, dev-only),
  never player-facing (spec §6).
- Persistence: credits, inventory, and stats live in the **player save**
  namespace; ops values (payout strictness, prize costs) live in the **dev-only**
  namespace. The two never mix.
- No new dependency without approval (A-33); a simple local ledger/JSON store
  suffices.
- Determinism holds: economy updates are event-driven (win event → ledger
  entry), not frame-polled.

### Non-goals (explicit, per spec)

- No real-money anything; no server/backend; no leaderboards; no in-game shop UI
  beyond a minimal credit display unless Eli asks.

## 4. N52 — Economy / coin / prize-cost layer

### Job

Virtual credits; cost per play; per-prize value/cost; win-rate vs profit stats;
an optional payout-cycling rule tied to F-01's grip capacity and F-02's win
detection. Track coins-in vs prize-value-out and expose stats to the ops panel
(F-11).

### Why (spec evidence, as-cited)

User priority: "Economy / coin / prize-cost layer (needed for profit-based
algorithms)." Enables operator analytics (win-rate vs profit) and the end-state
vision of a collectible, profitable machine.

### Ownership

- **Economy module** (product/data layer, outside physics): credits, cost-per-
  play, prize cost/value table, ledger entries (coin-in, win, prize-out,
  profit), win-rate stats. Owns the payout-cycling rule.
- `src/state/**` — C-02 revision only for the **gameplay overlay**: starting a
  play costs a coin (credit check before `ready`→aim, or on drop — decision §6);
  win events from F-02 trigger ledger entries.
- `src/physics/**` — untouched except reading approved grip parameters if the
  payout rule biases them within legal bands (F-01/F-11); never injects wins.
- Ops panel (F-11) — exposes prize costs, payout strictness; stats readout.
- Persistence — player namespace: credits, inventory, stats; dev namespace: cost
  table, payout rule.

### Contract

1. Playing costs coins; a play cannot start without sufficient credits
   (credit check behavior is a product decision — see §6).
2. Wins remove a prize (F-03 hook) and grant its value to the player ledger;
   inventory entry created (F-12/F-14 handoff).
3. Profit/win-rate stats accumulate across plays: coins-in, prize-value-out,
   profit, win-rate; observable in the ops panel.
4. Prize cost/value is data (per-prize manifest field), tunable by the operator
   (dev namespace).
5. The **payout-cycling rule** (e.g., ensure a win within N plays) is optional
   and ops-gated; if enabled, it biases the available grip parameters via
   F-01/F-11 **within their legal bands** — it never creates a non-physical win
   (A-07 + F-01 physicality preserved).
6. Economy updates are event-driven (F-02 win event → ledger entry), never
   frame-polled; deterministic and replayable.
7. No economy value leaks into physics save data and no physics value leaks into
   player-facing economy display beyond approved stats.

### Failure results

- `economy-negative-credits`: a play starts or continues with insufficient
  credits.
- `economy-ghost-win`: a ledger win entry without a corresponding F-02 win
  event.
- `economy-stats-inconsistent`: coins-in/prize-out/profit not reconcilable.
- `payout-nonphysical`: the payout rule injects a win not traceable to F-01/F-02
  (violates A-07 + F-01).
- `ops-value-leak`: prize costs/payout strictness visible or inheritable in
  player builds/saves (F-11 namespace rule).
- `economy-determinism-loss`: ledger divergence across identical play sequences.

### Evidence required

1. Credit fixture: play costs a coin; insufficient credits block play.
2. Win fixture: F-02 win → prize removed (F-03) → value granted → inventory
   entry; ledger reconciles.
3. Stats fixture: scripted sequence of wins/losses → win-rate and profit match
   the manual calculation.
4. Payout-rule fixture (if enabled): grip parameters biased within legal bands;
   no non-physical win.
5. Namespace trace: player save has no ops keys; dev namespace has no credits.
6. Full gate: typecheck/lint/test/build.

### Stop conditions

Stop and open a revision if N52 requires a server/backend, a new dependency, a
change to win semantics (F-02), or any change to the physics world.

---

## 5. Phase-D open decisions (from spec §7 #3, pending Eli)

1. **Economy scope:** virtual credits only, or **also per-prize value +
   profit/win-rate stats from day one**? (Recommendation in the spec leans
   toward the fuller cut — the profit curve is the point.)
2. **Payout-rate enforcement:** should the payout-cycling rule exist in the
   first cut, and is its strictness an ops knob from the start? (Recommendation:
   yes, ops-gated, conservative.)
3. **Credit check semantics:** when does a play cost a coin — entering aim,
   dropping the claw, or completing a run? And what happens on `reset` (refund
   or not)?
4. **Prize value source:** value as a per-prize manifest field (recommended) vs
   derived from mass/size.

## 6. Promotion gate (Phase D)

Eli's live-app gates:

1. Playing costs coins; a run without credits can't start.
2. A win removes the prize, grants value, and accumulates in stats.
3. The ops panel shows coins-in / prize-value-out / win-rate / profit, live.
4. No player build or save can see or change rigging/economy-tuning values.

## 7. Recommendation

**Implement N52 as one bounded node after Phase B's F-03 prize removal and
Phase C's F-11 ops surface exist** (both are hard dependencies). Keep the payout
rule ops-gated and physically honest: it biases available grip parameters, it
never fabricates a win. Draft C-09 (economy ADR) in `docs/contracts/` via
`/c-contract-first` before implementation.
