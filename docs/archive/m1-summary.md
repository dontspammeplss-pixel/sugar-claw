# Milestone 1 Archive Summary — Claw Machine 3D

**Status:** V1 executed through the N9 human gate; planning documents archived 2026-08-02.
**Author of record:** Human (Eli), with Freebuff agents as the bounded implementation workforce.
**Archive location:** `docs/archive/m1/` — content-immutable. Do not edit, rewrite, or delete.

---

## 1. Purpose of this archive

This folder records **what was planned and built** for the Claw Machine 3D app so the working tree
stays uncluttered while the history stays recoverable. The pattern follows the vault's own
`raw/ → wiki → raw/done/` rule: a summary is written **before** anything moves, then the transient
documents are archived intact. Nothing here is deleted — it is moved and pointed to.

## 2. Milestone objective

Build a deterministic, gate-enforced claw-machine app (Vite + React 18 + TS + R3F + Zustand + GSAP
+ Rapier) from an approved charter and architecture contracts, using the graph-of-loops execution
model: bounded nodes, code-controlled routing, evidence-backed promotion, and a human promotion gate.

## 3. What was completed (gates and nodes)

| Item | What landed | Evidence |
| --- | --- | --- |
| Gate 0 — N0 bootstrap | Scaffold, exact-pinned deps, minimal R3F scene, smoke test | `BOOTSTRAP.md`, tag `gate-0-baseline` |
| Gate 1 — N1 contracts | A-01…A-40 architecture contracts approved (baseline rev 1) | `records/approvals/gate-1-baseline-rev1.md`, `docs/contracts/`, tag `gate-1-baseline-rev1` |
| Gate 1 — N1a gate script | Deterministic gate enforcement (`scripts/gate.mjs`) | `records/gate-log.md` PASS entries 2026-08-01 |
| Gate 2 — N2 design | Visual design, review camera, gate sheet | `docs/design/`, `docs/design/n2-approval-rev1.md` |
| Gate 2 — N3 scene + assets | Static machine/scene, typed asset manifest/registry | `src/scene/`, `src/assets/`, `records/approvals/gate-2-n3-approved.md`, `records/evidence/n3-*` |
| Gate 3 — N4 claw rig | Named pivots, poses, pose adapter, no drift | `src/claw/`, `src/animation/`, `records/evidence/n4-*` |
| Gate 4 — N5 state | Typed state controller, legal transitions, reset, stale-runId guard | `src/state/`, `records/evidence/n5-*` |
| Gate 5 — N6 physics | Minimal Rapier scenario, contact ≠ overlap, reset | `src/physics/`, `records/evidence/n6-*` |
| Gate 6 — N7 integration | State drives claw, physics/visual sync, effects coordinator | `src/App.tsx`, `src/effects/`, `records/evidence/n7-*` |
| Gate 7 — N8 verification diamond | Independent verifiers, findings merged/routed; 2 clean rounds converged | `records/gate-log.md` n8 record |
| Gate 7 — N9 human gate | Bug-fix commit `67e277c`; **50 tests green** (suite now at 52), typecheck, lint, build | `records/gate-log.md` n9 record |
| Task packets N18–N20 | Follow-on bounded nodes: physics ratchet (N18), charter revision (N19), claw cycle classic arcade (N20) | `records/task-packets/` |

Final pre-archive HEAD: `a2eb8ea` (git clean at archive time).

## 4. What was archived (and why)

All five documents below were **consumed** — superseded, landed, or fixed — and now live untouched in
`docs/archive/m1/`:

| Document | Why archived |
| --- | --- |
| `fb_plan.md` | Linear Phase 0–7 plan, superseded by the graph plan and fully executed |
| `fb_plan_graph.md` | Graph-of-loops execution plan; consumed by N1–N9 and `META_PROMPT.md` |
| `PLAN-node-contracts.md` | Proposal for converting pasted implementations to contract nodes; landed as N18–N20 |
| `bug_fixes_needed.md` | The 5 reported bugs were fixed and committed (`67e277c`) |
| `CHECKLIST-bugfix-verification.md` | Verification checklist for those fixes; verified complete |

## 5. Operating documents that stay at root (purpose)

These remain live because future sessions depend on them:

| Document | Purpose | Owner |
| --- | --- | --- |
| `META_PROMPT.md` | Operating program / resume driver: how to dispatch, verify, and route nodes | Human |
| `ARCHITECTURE_CONTRACTS.md` | Authoritative A-01…A-40 contract baseline the gate checks against | Human/architecture |
| `BOOTSTRAP.md` | Gate 0 foundation record: pinned deps, commands, validation evidence | Human/bootstrap |

`records/` (approvals, contracts, task packets, evidence, gate log) and `docs/` (contracts, design,
scene) are the durable evidence layer and were **not** moved.

## 6. Known limitations and open items (do not forget these)

- **N8-P-001:** the declared `gate-6-integration` tag was never created; `n8` ran against a
  resolved checkout instead. Create the tag retroactively or document why.
- **N8-F-001:** browser visual interaction proof was unavailable (deterministic N7/HTTP checks
  passed; structured browser report could not be produced).
- **N8-F-003:** FPS / frame-budget / physics-step metrics were never measured in-browser.
- **N8-F-004:** production bundle ≈ **3057.72 kB** (minified chunk) — exceeds the Vite default
  warning size; code splitting deferred.
- **A-07/A-20/A-29/A-31/A-33 etc.:** randomness, compression tooling, ScrollTrigger, scoring/sound/
  lives/UI were explicitly deferred in the approved contracts; open decisions live in
  `docs/contracts/open-decisions.md`.
- Dev-tool `npm audit` advisories remain (see `BOOTSTRAP.md` caveats; do not `npm audit fix --force`).

## 7. How to resume from here

1. Read `META_PROMPT.md` §9 for the immediate next action (finish V1 open items → optimization → V2).
2. Source of truth for the current frontier: `git tag` + `records/approvals/` + `records/task-packets/`.
3. The archive ratchet tag `m1-archive` exists (commit `46a1a7f`) and `scripts/gate.mjs`
   `defaultBaseline` points at it. Before the next optimization node, **tag a fresh baseline from
   `m1-archive`** so the deterministic gate enforces that node against the archived state.
