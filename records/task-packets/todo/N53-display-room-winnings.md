# Contract Packet — N53: Prize display room — grab winnings, place around [F-14 → C-09 ext]

> Node N53 in the Claw Machine 3D engineering graph (Phase E of the feature
> roadmap; follows Phases A–D — N41–N52).
> **Status:** contract-only / implementation not started (2026-08-04).
> This packet converts Phase E of `claw-app-feature-spec.md` (v0 draft) into a
> bounded implementation node. It deliberately changes **no source code, tests,
> physics configuration, generated evidence, dependencies, or build artifacts**
> until Eli accepts it as the implementation plan.
> **Source:** feature spec §3 F-14, §5 Phase E, §7 open decision 4.
> Code/line evidence as-cited, not independently verified.
> **Baseline:** `3b8bb05` (N36–N40 landed) + approved Phase A–D packets.

---

## 1. The wanted outcome (from the spec)

The payoff loop that makes winnings *meaningful*: a persistent location/room
where you display your winnings **by grabbing them (with the claw) and placing
them around**. User: "eventually the goal is to have a location/room where you
can display your winnings by grabbing them and placing them around."

Phase E completes the win pipeline: won prizes leave the playfield (F-03) →
inventory (F-12) → spawn in the display room (F-14), where they can be carried,
dropped on shelves/plinths, and their placement persists.

## 2. Node graph

```text
N53 Display room (F-14)
   │   └─ consumes: F-03 prize removal, F-12 inventory, F-01 grip/carry (the claw must carry in the room)
   ▼
Phase-E promotion gate (Eli: winnings placeable + placement persists)
```

N53 depends on the claw already being able to carry and drop prizes (F-01/F-02
behavior) — the room reuses the existing claw cycle rather than re-authoring it.

## 3. Shared invariants and protected boundaries

Until Eli accepts this packet as the implementation plan, **only this packet, its
contract references, and the project decision ledger may be edited** for N53.

The following remain protected unless a separate contract revision is opened:

- The display room is a **new scene/gameplay surface**, not a physics change: it
  reuses the approved claw cycle, grip semantics (F-01), and carry constraint.
- `src/physics/adapter.ts` remains the sole Rapier authority (room shelves and
  prizes are bodies registered through it; placement = physical dropping, no
  teleport-paste).
- `src/state/**` (C-02): room mode needs a **scene/mode transition** (arcade →
  room), which is a C-02 revision — the claw's micro-states inside the room are
  the existing ones.
- Fixed-step policy, collision matrix, performance thresholds — versioned;
  room scene must meet the per-frame budget (N21 methodology).
- Persistence: placement is **player save data** (local-only for now — §5);
  ops/rigging values never enter the room save.
- No new dependency without approval (A-33); no server (non-goal).
- Determinism (A-27): room placement outcomes are fixed-step reproducible.

### Non-goals (explicit, per spec)

- No multiplayer/online gallery; no photo mode; no room decoration economy
  beyond placing winnings (unless Eli asks later).

## 4. N53 — Display room

### Job

A persistent "display room" scene where won prizes spawn (from F-12 inventory);
the claw can carry and drop them onto shelves/plinth surfaces; placement
persists across reloads.

### Why

This is the payoff loop: winnings are only meaningful if they can be *shown*.
It also dogfoods the whole stack — the same claw, grip, carry, and win mechanics
run in a second scene.

### Ownership

- **Room scene** (scene/config/data layer): shelf/plinth surfaces, spawn points,
  camera preset (reuse A-30 review camera conventions), and a room→arcade mode
  switch.
- `src/state/**` — C-02 revision: a mode/scene transition between the arcade and
  the room; the claw's states inside the room are the existing approved set.
- `src/physics/adapter.ts` — registers room bodies (shelves static; prizes
  dynamic); the claw's existing grip/carry/drop path works unchanged.
- `src/effects/n7-coordinator.ts` — room-mode motion scheduling reuses the
  Phase-A–C travel/grip pipeline; no second coordinator.
- Persistence — player namespace: room placement (per-prize pose), spawned
  inventory; survives reloads.

### Contract

1. A won prize (F-12 inventory entry) appears in the room at a spawn point.
2. The claw can grab it (F-01 grip onset), carry it, and drop it on a
   shelf/plinth surface — a real physical drop, no snap-to-slot.
3. Placement persists across reloads (local save, player namespace).
4. Placement rule is the §5 decision: **free placement** (prize rests where it
   physically lands) or **grid-snap** (stabilized slots).
5. Mode switch arcade ↔ room is explicit and does not disturb the playfield's
   persisted state (F-03) or the economy ledger (F-12).
6. The room meets the per-frame budget and the reset/repeatability contracts.

### Failure results

- `room-mode-conflict`: switching scenes corrupts the arcade playfield or
  economy state.
- `room-teleport-paste`: a prize placed by snapping rather than physical
  dropping (violates A-04/no-hidden-teleport discipline).
- `placement-loss`: placements not restored on reload.
- `room-perf-regression`: room scene misses the per-frame budget.
- `room-inventory-mismatch`: a prize in inventory not spawnable / a spawned
  prize not in inventory.

### Evidence required

1. Spawn fixture: won prize appears in the room from inventory.
2. Carry/drop fixture: claw grabs, carries, physically drops onto a shelf;
   fixed-step reproducible.
3. Persistence fixture: placement survives a reload; arcade playfield and
   economy ledger untouched.
4. Performance evidence vs `performance-thresholds.md`.
5. Full gate: typecheck/lint/test/build.

### Stop conditions

Stop if N53 requires a server, a new dependency, a physics strategy change, or a
state-machine revision beyond the documented mode transition.

---

## 5. Phase-E open decisions (from spec §7 #4, pending Eli)

1. **Persistence:** local-only for now? (Recommendation: yes — no server is a
   standing non-goal.)
2. **Placement rule:** **grid-snap** (stabilized slots; predictable, tidy) vs
   **free placement** (prize rests where it physically lands; emergent, messier,
   truer to the physics-first ethos). Recommendation leans free placement with
   optional snap-on-shelf; Eli decides.
3. **Room access:** how does the player enter the room (button on the arcade
   screen, when winnings exist, or always)?

## 6. Promotion gate (Phase E)

Eli's live-app gates:

1. A won prize appears in the room.
2. It can be grabbed, carried, and placed on a shelf/plinth.
3. Placement survives a reload; the arcade playfield and economy state are
   undisturbed.

## 7. Recommendation

**Implement N53 after N52 (economy) lands**, since inventory is the room's input.
Reuse the entire claw pipeline rather than re-authoring anything. Choose the
placement rule (free vs grid-snap) before implementation — it drives the shelf
collider design. Draft the C-09 extension (display-room ADR) in
`docs/contracts/` via `/c-contract-first` before implementation.
