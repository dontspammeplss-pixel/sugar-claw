# N-43 — Multi-prize manifest and persistent playfield

**Bottom line:** N43 defines a JSON-backed, revisioned prize manifest and deterministic local persistence so multiple prizes resume their nudged positions across plays while newly revised machines start from a deterministic layout.

## Retain

- The manifest is the single source of prize truth in `src/playfield/default-prize-manifest.json`: it contains a unique prize ID, initial position and orientation, spawn-layout data, per-prize weight and center-of-mass data for N41/F-01, and a declared geometry type. The N43 schema accepts the concrete N44 types `sphere`, `box`, `soft-pouch`, `tag`, `strap`, and `loop`; N43 validates the declaration but does not implement their physics behavior.
- Adding a prize is a data/configuration change only; no prize-specific source branch, component, or physics code is permitted.
- Multiple manifest entries register as separate prize bodies through the existing physics authority, render through manifest-generated prize roots, and can be selected through the adapter-owned target API. Prize-vs-prize interaction is distinct from prize-vs-claw and prize-vs-environment interaction through collision-matrix rev 3.
- Operator placement is represented as data (density, angle, and layout presets); the dev/ops panel owns editing those values in Phase C. N43 defines the shape but does not implement the panel.
- Player save data is separate from dev-only operator data. The player persistence record is keyed by the prize-manifest revision and contains the physical prize state needed to resume, including positions and won/removed flags.
- A fresh manifest revision deterministically restores its authored spawn layout. The same revision resumes the persisted state; a stale record must not be applied to a new revision.
- N42’s delivery path remains the removal authority: a won prize leaves the playfield and is forwarded to the F-12 winnings hook rather than being reset into place.
- N43 preserves the existing fixed-step world, transform convention, state-machine shape, and no-randomness/determinism requirements. It adds no state-machine state and no persistence dependency.
- Required evidence passed in `records/evidence/n43-playfield-manifest.json`: three mixed geometries, invalid-manifest rejection, nudge/play carryover and reload persistence, arbitrary `tag-prize` win/removal and winnings trace with declared weight/CoM, actual distinct-collider prize-vs-prize solver contact, 30-step repeatability, 120-step average physics cost `0.3008 ms` versus the `2 ms` budget, and the full typecheck/lint/test/build gate. Browser FPS/p95/reference-device memory remain pending.

## Caveats

- The vault outline had N-19 (the single resetting prize finding) and draft C-08, but no N43 implementation row when this draft was prepared. The target repository packet supplied the missing N43 implementation boundary; the outline row is now marked verified on 2026-08-04.
- The pasted request includes a complete N44 geometry-variety contract after the N43 contract. N43 only declares the manifest geometry reference and the data shape needed by N44. Strap/tag/loop colliders, contact-region identity, grip evaluation, and partial-contact rejection remain N44 scope.
- The contract packet names baseline `3b8bb05` plus approved Phase-A packets, while the request names `main`. This draft follows the request’s `main` authority and records the packet hash as historical context; it does not rewrite a source baseline.
- The target repository’s existing versioned contract directory is `records/contracts/`, although the vault outline’s generic convention says `docs/contracts/`. The C-08 draft records this path discrepancy rather than treating the paths as interchangeable.
- Collision matrix rev 3 now distinguishes prize-vs-prize, prize-vs-claw, and prize-vs-environment. N43 adds members to the existing prize group; it does not add a new collision role.
- Browser FPS/reference-device performance is not claimed by the headless evidence; only the fixed-step physics budget was measured. Existing build chunk-size warnings remain unrelated to N43 correctness.
- Browser FPS/reference-device performance is not claimed by the headless evidence; only the fixed-step physics budget was measured. The implementation uses no new persistence dependency.

## Do not infer

- Do not infer that manifest geometry types implement N44 geometry behavior, bone rigs, articulated parts, or collider derivation.
- Do not infer that operator-configurable placement means a player-facing placement control; the ops panel is Phase C and dev-only.
- Do not infer that a manifest revision alone resets an ongoing machine, or that a save from another revision is safe to apply.
- Do not infer that a won prize can reappear on the next play; delivery removal and winnings tracking are retained.
- Do not infer that persistence may bypass the fixed-step adapter, write directly from render/UI code, or become a new state-machine path.
- Do not infer that a passing N42 gate proves N43 persistence, multi-prize collision separation, or playfield performance.
- Do not infer that N43 authorizes a new dependency, changed world convention, changed fixed-step policy, or a new state. Any such need is a stop-and-revise condition.

## Sources

- Authoritative N43 contract pasted in the user request: manifest schema, multi-prize spawn, persistence, reset/resume semantics, collision separation, winnings hook, failure results, evidence, and stop conditions.
- Target repository packet: `~/Documents/coding_proj/claw_app/records/task-packets/N43-N46-playfield-prize-manifest-geometry-rigs.md`, §4 N43 — Multi-prize manifest + persistent placement.
- Vault feature specification: `claw-app-feature-spec.md`, F-03, F-04, §4 win pipeline, §5 Phase B, and §8 contract impacts.
- Vault index and conventions: [[claw-app-node-contract-outline]].
- Related finding: [[claw-app-node-contract-outline]] → N-19 (single resetting prize blocks strategy).
- Related implementation: [[N-41-force-based-retention-and-mid-carry-release]] (weight/CoM inputs).
- Related delivery authority: [[N-42-chute-based-win-detection-and-delivery-semantics]] and [[N-42.1-carry-to-delivery-motion-path]] (won-prize removal and delivery semantics).
- Target repository contracts consumed by N43: `records/contracts/fixed-step-policy.md`, `records/contracts/collision-matrix.md`, and `records/contracts/performance-thresholds.md`.

**Status:** Implemented — functionally verified; reference-device performance pending
**Last checked:** 2026-08-04
**Review by:** 2026-11-04
