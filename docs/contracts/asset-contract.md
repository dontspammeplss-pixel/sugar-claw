# Asset Contract

**Status:** Approved — Gate 1 baseline revision 1 (2026-08-01)  
**Baseline:** `gate-1-baseline-rev1`

## Manifest

Runtime assets are declared in one **typed GLB/glTF manifest** keyed by stable logical IDs (A-16 approved). URL literals must not be scattered through gameplay or scene components.

```text
AssetId -> {
  url,
  kind,                 # model, texture, audio, environment, ...
  version or content key,
  authoredUnitScale,
  authoredUpAxis,
  authoredForwardAxis,
  expectedAnchors,
  preloadPolicy,        # required or optional
}
```

The manifest is the source of truth for required assets and authored-coordinate metadata. Components consume resolved records and do not invent compensating scale/rotation values.

## Lifecycle

```text
unrequested -> loading -> ready
                    └──> failed
ready -------> disposed       # only when registry ownership ends
```

- Bootstrap requests required assets before entering `ready`.
- Required-asset failure blocks `ready` and enters `error`; silent fallback is forbidden.
- Optional/debug failure may not block gameplay only when explicitly marked optional.
- Concurrent requests deduplicate to one canonical resource record.
- Load, retry, remount, and disposal must not duplicate registrations, listeners, bodies, or object references.

## Ownership and cloning

The asset registry owns cached/shared resource records and their disposal. R3F owns instance-owned scene objects it created. A component never disposes a shared resource; the registry never disposes an instance it does not own. Cached source scenes/materials remain immutable. Render instances use an explicit clone/material policy (A-18 approved: per-instance clone with shared immutable source resources).

## Validation

Every required load validates expected anchors, finite transforms, non-zero dimensions, supported orientation, and expected bounds. Validation failures are actionable asset errors, not hidden transform corrections. Unit/axis conversion happens once at the asset boundary and is represented in the resolved record.

## Resolved and deferred at Gate 1 (rev 1)

- **A-16 approved:** typed GLB/glTF manifests loaded through a Three.js-compatible GLTF loader.
- **A-18 approved:** per-instance clone with shared immutable source resources.
- **A-19 approved:** machine/claw/prize assets required; debug assets optional.
- **A-20 deferred:** compression/texture/streaming tooling until an asset inventory exists.
- **A-33 deferred:** no new loader/helper dependency without an approved need.
