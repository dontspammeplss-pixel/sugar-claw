# Gate 2 Approval — N3 Static Scene + Assets

| Field | Value |
| --- | --- |
| **Decision** | Approve N3 static scene and assets; close the N3 visual gate |
| **Approved by** | Human (project owner / routing node) |
| **Date** | 2026-08-01 |
| **Upstream baseline** | `gate-1-approved + gate-2-design-approved` |
| **Runtime evidence** | [`records/evidence/n3-runtime-report.md`](../evidence/n3-runtime-report.md) |
| **Scene implementation** | [`docs/scene/n3-static-scene.md`](../../docs/scene/n3-static-scene.md) |
| **Screenshot** | [`records/evidence/n3-review-camera.png`](../evidence/n3-review-camera.png) |

## Decision

The human reviewed the N3 render at localhost and approved the visual gate. The scene is accepted under the approved N2 visual contract and the N3 static-scene boundaries.

Accepted presentation includes:

- complete machine envelope and three-quarter review composition;
- static claw at the approved home position;
- visible prize/playfield presentation, chute, and floor reveal;
- approved graphite, steel, cyan, amber, and lighting direction;
- fixed `ReviewCamera` framing with no gameplay or physics behavior.

## Deterministic proof retained

- Runtime report status: `pass`
- Hierarchy: 56 named paths; no missing required paths
- Validation: `[]`
- Refresh report hashes: identical
- `MachineRoot` and `ClawMount`: identity transforms
- `ClawSystem` home position: `[0, 2.85, 0.1]`
- Required automated evidence: typecheck, lint, focused N3 tests, and build documented in the scene record

**Approval status:** APPROVED — N3 visual gate closed.
