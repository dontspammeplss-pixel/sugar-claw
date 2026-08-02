# Task Packet — N21: Bundle Code-Splitting + First Browser Performance Baseline

> Node N21 in the Claw Machine 3D engineering graph (optimization node; follows N18–N20 and the
> m1 archive). Dispatched 2026-08-02 per the "Optimize first" decision from the Developer Brain
> operating model (`AGENTS.md` §3 — technical/tooling decisions are the brain's to make).
>
> **Status:** contract written 2026-08-02; implementation executed, evidence recorded, gate
> evaluation in progress. **Ratchet verdict: KEEP.** All deterministic checks green; chunk table
> improved (app entry 3,067 kB → 53.85 kB, vendor split); browser evidence captured.
>
> **Node findings (recorded 2026-08-02):** F-001 — `gsap` and `zustand` are declared in
> `package.json` but not installed and not imported anywhere in `src/`; bundle does not contain
> them. Dependency edits are protected (charter §1.4 stack boundary), so no change was made; a
> future charter decision can remove or restore them. F-002 — rapier3d-compat WASM glue dominates the
> bundle (2,056 kB min / 761 kB gzip); the @react-three/rapier wrapper JS sits in the r3f
> chunk (the '@react-three' manualChunks check runs before the rapier check). F-003 — first in-browser frame-timing evidence captured
> (evidence gap partially closed; N8-F-003's binding threshold measurement still pending a
> human/GPU run on the reference desktop device); headless software-GL ~3 fps is indicative
> only, and no threshold pass is claimed (`thresholdPassClaimed: false` in n21-browser.json). F-004 — one 404 for `/favicon.ico` (no favicon link in
> `index.html`); cosmetic.

---

## 1. The contract

```text
You are node N21 in the Claw Machine 3D engineering graph.

Task:            Split the single 3 MB production chunk into per-vendor chunks and capture the
                 first in-browser frame-timing measurement against the approved performance
                 thresholds (records/contracts/performance-thresholds.md rev 1).
Objective:       (a) production build emits a documented per-vendor chunk table instead of one
                 3 MB blob; (b) a browser FPS / frame-budget / physics-step evidence record exists
                 (closes N8-F-003); (c) all deterministic checks stay green; (d) no runtime
                 behavior or authority boundary changes.
Current baseline:tag opt-baseline-1 (2026-08-02, clean tree at 818a215)
Allowed files:   vite.config.ts, records/task-packets/N21-*.md, records/evidence/n21-*,
                 records/gate-log.md (gate-owned output), package.json (scripts block only,
                 if a measurement script is needed), scripts/gate*.mjs (baseline pointer only)
Protected files: src/** (no runtime change), records/contracts/**, records/approvals/**,
                 docs/**, ARCHITECTURE_CONTRACTS.md, BOOTSTRAP.md, META_PROMPT.md
Loop type:       one-shot + ratchet — build config is reversible; keep only if checks pass and
                 the chunk table is no worse than baseline
Hypothesis:      The 3,067 kB single chunk is the minified sum of three/rapier/react/gsap/zustand
                 with no vendor boundaries; manualChunks gives cacheable per-library chunks and
                 attributes the bytes, and a rAF-sampled browser trace gives the first real
                 frame-timing evidence the perf contract requires.
Required proof:  npm run typecheck; npm run lint; npm run test; npm run build (chunk table
                 before/after); browser rAF frame-timing sample on the production preview; all
                 recorded under records/evidence/n21-*
Stop conditions: any change needing a src/ edit, a dependency change, a contract change, or a
                 protected-file edit; a chunk table worse than baseline; budget exceeded.
Required output: this packet; the vite.config.ts diff; evidence records; proof results; known
                 limitations; keep / revert / blocked recommendation.
```

## 2. Baseline (before) state

- Single JS chunk: `index-*.js` ≈ **3,067.09 kB minified** (gzip ≈ 1,042.12 kB) — Vite warns
  "Some chunks are larger than 500 kB".
- No in-browser frame timing exists. N8-F-003 (browser FPS/frame-budget unmeasured) is open.
- Bundle size is **not** an approved perf-contract threshold (N8-F-004): it is evidence for
  review. The binding thresholds are fps/frame-budget/physics-step/memory/network.

## 3. Implementation (diff summary)

`vite.config.ts` — the only runtime-adjacent change:

1. Added `build.rollupOptions.output.manualChunks` (function form) grouping by top-level vendor:
   `three` (three + @react-three/fiber), `rapier` (@react-three/rapier + rapier glue),
   `react` (react + react-dom), `gsap`, `zustand`.
2. Kept `chunkSizeWarningLimit` at Vite's default and **did not** silence the warning: a still-large
   rapier/three chunk is evidence to document, not hide. (Warning text changes to name the chunk.)

No `src/` file, contract, or dependency changed.

## 4. Evidence expected

- `records/evidence/n21-bundle.json` — before/after chunk table (names, minified bytes, gzip).
- `records/evidence/n21-browser.json` — rAF frame-timing sample: fps min/p50/p95, frame ms
  p50/p95/max, sample duration, physics-step observation if available, console errors, env notes.
- `records/evidence/n21-browser.png` — screenshot from the measurement session.
- Gate evaluation appended to `records/gate-log.md`.

## 5. Verification run (results recorded 2026-08-02)

```text
npm run typecheck  -> PASS (tsc -b clean)
npm run lint       -> PASS (eslint clean)
npm run test       -> PASS (52/52 across 6 files)
npm run build      -> PASS; chunk table: index 53.85k, react 141.78k, r3f 130.39k,
                      three 681.09k, rapier 2056.36k (minified kB)
browser sample     -> scene boots to ready; claw+prize synchronized; webgl2 true;
                      software-GL headless ~3 fps (indicative only); evidence in
                      records/evidence/n21-browser.json + n21-browser.png
```

Evidence: `records/evidence/n21-bundle.json`, `records/evidence/n21-browser.json`,
`records/evidence/n21-browser.png`.

## 6. Known limitations

- Code splitting improves caching and byte attribution; it does not shrink total transfer
  (single-canvas game needs every library at boot). Real byte reduction would require dropping
  or lazy-loading a stack dependency — not authorized by the approved stack boundary.
- Headless/software-GL frame timing is indicative, not a claim of the reference desktop target
  (perf contract's binding targets are measured on the reference device by the human/GPU).

## 7. Ratchet decision

**KEEP (2026-08-02).** All checks green, chunk table no worse than baseline (better: cacheable
per-vendor chunks, app entry 53.85 kB), browser evidence captured. Reverted nothing.

Next recommended node (not this one): a charter decision on gsap/zustand removal-or-restore
(F-001), and a human/GPU frame-timing pass on the reference desktop device to formally meet the
perf contract thresholds.
