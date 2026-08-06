# N-51 — Adjustable grip strength (F-11): ops-only access + voltage namespace

**Bottom line:** Per A-45 (C-10 ADR, 2026-08-05), grip strength is a
dev/operator-only runtime knob: `gripVoltage` (12–36V, default 24V) is
live-tunable in `VITE_OPS=1` builds via an ops panel (Ctrl+Shift+O) that is
tree-shaken from player builds; the knob feeds F-01's `GripCapacity` through
the coordinator → adapter clamped path and persists to the dev-only namespace
`claw-app:ops:v1` — never player save data. **A-44 open question 1 resolved:
YES — one voltage meaning lives in the F-11 ops namespace (default 24V)**;
the travel-side transfer (`n50-voltage-rev1`) stays open question 2.

## Retain

- Ops gate is build-scoped (`import.meta.env.VITE_OPS === '1'`); the panel
  module is dead-code-eliminated from player bundles (verified by the
  build-gate trace). Defaults unchanged — a non-ops build behaves identically
  to baseline (gripVoltage 24V).
- Live tuning is deterministic and clamped: the retention balance re-evaluates
  every fixed step while holding, so a mid-carry change shifts capacity/margin
  on the next step (measured 12→20N, 24→40N, 36→60N capacity).
- Authority (C-01): the coordinator is the sanctioned write path; the UI never
  touches the adapter directly; ops settings are operator/dev-owned, never
  player-visible or player-inherited.
- Namespace separation mirrors prize persistence: ops writes only its own key;
  player save data stays clean (verified).
- No state-machine transitions (C-02), no fixed-step policy change, no new
  dependency (A-33); `vite-env.d.ts` adds only Vite client type declarations.

## Caveats

- `ops-leak` / `ops-gate-inert` are build-level guards: the prod-bundle grep
  runs in the n51 evidence when `dist/` exists; the ops-side presence check is
  automated via `npm run gate:ops` (VITE_OPS=1 build + marker grep).
- The travel transfer (A-44 OQ2) is explicitly NOT this node — do not wire
  per-phase speed overrides into the panel here.
- Live-tuning evidence is adapter-level; the panel write path
  (`applyOpsVoltage`) is unit-tested against a fake coordinator, and the
  panel presence is verified by `npm run gate:ops` (the coordinator delegate
  itself is a thin, type-checked wrapper).

## Do not infer

- Do not infer N51 adds a player-facing control, save-data keys, or a runtime
  panel in player builds.
- Do not infer the shared voltage now governs travel — only grip (retention)
  is wired; travel derivation stays pending (OQ2).
- Do not infer pad-friction / speed-override / prize-layout / payout knobs are
  live — the panel is grip-voltage only in this node.

## Sources

- Authoritative contract: N51 (packet §8) + A-45 (C-10 ADR).
- Outline row: `records/task-packets/todo/N47-N51-feel-rigging-pendulum-speed-ops.md` §8.
- Decision: `docs/contracts/open-decisions.md` (A-45, Revision 6).
- ADR: `docs/contracts/ADR-C-10-ops-access-f11-grip-strength.md`.
- Repo: `src/ops/ops-store.ts`, `src/ui/OpsPanel.tsx`, `src/App.tsx`,
  `src/physics/adapter.ts`, `src/effects/n7-coordinator.ts`,
  `records/evidence/n51-ops-gate.json`.

**Status:** Implemented + verified (2026-08-05) — ops gate, live tuning, and
namespace traces green; full gate green
**Last checked:** 2026-08-05
**Review by:** 2026-11-05
