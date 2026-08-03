# Contract Packet — N36–N40: Descent, grip validity, collision proof, and collider derivation

> **Status:** contract-only / implementation not started (2026-08-02).
> This packet sets up contracts for four reported behavior gaps. It deliberately
> changes no source code, tests, physics configuration, generated evidence,
> dependencies, or build artifacts.
> Baseline: current N23–N35 working tree, including the resolved collision
> matrix rev 2 and the existing N31–N35 contract packet.

---

## 1. Reported defects and intended outcome

Eli reports four related failures or unknowns:

1. **The claw does not descend to the base of the machine box.**
2. **The claw can grab beside an object.** It can lift the entire object without
   making complete/proper contact with it.
3. **Claw/object collision is not observable.** It is unclear whether the claw
   has actual Rapier collision detection or only visual overlap behavior.
4. **Collider configuration is underspecified.** The claw needs collision
   barriers/parameters, objects need collision parameters, and it is unclear
   whether those settings can be derived automatically from each mesh.

The desired outcome is a **physically evidenced interaction contract**:

- descent reaches the lowest safe interaction depth at the machine base without
  penetrating the floor, object, or machine barriers;
- grip approval requires a declared, geometrically valid capture—not merely a
  nearby sensor overlap or visual envelope overlap;
- every required claw/object/barrier pair has observable Rapier contact and
  solver/sensor behavior;
- collider assignment has one explicit policy for authored profiles, automatic
  candidates, unsupported/ambiguous meshes, and diagnostics.

This packet does not select implementation APIs or write fixes.

---

## 2. Node graph

```text
N36 Descent-to-base contract ───────────────┐
                                             │
N37 Complete-contact grip contract ──────────┼──► N40 integrated physics gate
                                             │
N38 Collision observability contract ────────┤
                                             │
N39 Mesh-to-collider derivation policy ──────┘
                                                       │
                                             Human visual/feel promotion gate
```

N36–N39 define disjoint contracts and may be implemented independently after
this packet is accepted. N40 is the promotion gate and must not be treated as
passed by unit tests alone.

---

## 3. Contract-only boundary and protected invariants

Until Eli accepts this packet as the implementation plan, **only this packet,
its contract references, and the project decision ledger may be edited** for
N36–N40. No implementation or evidence artifact is authorized by this document.

The following remain protected unless a separate contract revision is opened:

- `src/physics/adapter.ts` is the sole Rapier world/body/collider/contact
  authority.
- `src/physics/config.ts` is the sole owner of fixed-step, collision-group,
  collider-parameter, and travel-bound configuration.
- `src/effects/n7-coordinator.ts` owns normalized motion completion and may not
  decide a grip from render overlap.
- `src/assets/manifest.ts` and `src/assets/registry.ts` own asset identity,
  bounds validation, and asset lifecycle; they do not own gameplay outcomes.
- R3F/Three.js owns visual meshes; visual intersection never proves physics
  contact.
- Collision-group bits and the solver/sensor distinction remain versioned in
  `records/contracts/collision-matrix.md`.
- The explicit carry constraint remains the only legal carry representation;
  no visual parenting, teleport, or identity swap may be introduced.
- Physics remains fixed-step under `records/contracts/fixed-step-policy.md`.
- No new physics engine, loader, collider helper, or dependency may be added
  silently.

### Required terminology

- **Visual overlap:** Three.js envelopes or mesh intersection. It is never grip
  evidence.
- **Sensor intersection:** an eligible sensor/prize intersection observation.
  It is necessary but not sufficient for a valid grip under this packet.
- **Solver contact:** a contact between physical colliders that participates in
  Rapier response. It is distinct from sensor intersection.
- **Capture envelope:** the approved region inside the claw where an object may
  be considered contained for gripping.
- **Base plane:** the authored physical top surface of the machine floor or
  equivalent lowest legal claw interaction plane, not an arbitrary visual
  mesh bottom.

---

## 4. N36 — Descent-to-base contract

### Job

Define and verify the lowest legal vertical descent so the claw reaches the
machine base rather than stopping at an arbitrary fixed height or stopping
because of a non-grip visual overlap.

### Ownership

- `src/physics/config.ts` owns the authored base plane, claw clearance,
  object-clearance policy, travel bounds, and fixed-step tolerances.
- `src/effects/n7-coordinator.ts` owns the descent command and normalized
  completion observation; it must not invent a second base height.
- `src/physics/adapter.ts` owns the authoritative sweep/step/contact facts and
  prevents physical penetration through Rapier response.
- `src/scene/**` and asset metadata provide visual/reference geometry only;
  they do not define the physical base implicitly.

### Contract

- The base plane is explicit, finite, and expressed in canonical meters and
  world/`ClawMount` coordinates according to the existing transform contract.
- A descent from every legal horizontal position must continue until the
  claw's **approved physical clearance envelope** reaches the base interaction
  plane, unless an earlier physical barrier or object contact is intentionally
  selected by the active descent policy.
- The current fixed `gripPosition.y` is not sufficient evidence of reaching the
  base. It may remain a candidate value only after a geometry report proves its
  clearance from the base and its relationship to the claw envelope.
- A visual mesh overlap, sensor-only overlap, or arbitrary animation endpoint
  cannot terminate descent.
- If an object is not the intended target, the claw must be able to descend
  below/around it according to the approved geometry and collision policy; an
  incidental object overlap must not masquerade as base completion.
- The claw must never penetrate the floor, chamber walls, or protected machine
  barriers. Any earlier stop must report the collider pair, contact point/normal
  (or equivalent Rapier contact fact), and stop reason.
- Descending to the base must not silently move, delete, or teleport a prize.
  Prize displacement must be a Rapier response and must be recorded.
- Completion is one normalized event for the active run epoch and uses the
  existing motion-completion tolerance. Late completion from an older epoch is
  rejected as stale.

### Failure results

- `base-plane-undefined`: no explicit physical base plane or clearance policy.
- `descent-shortfall`: the claw stops above the approved base plane without a
  valid physical barrier/contact reason.
- `descent-penetration`: any claw/floor/barrier penetration or tunneling.
- `descent-stale-completion`: completion from a cancelled or old run epoch.
- `descent-parameter-conflict`: scene, asset, and physics layers disagree on
  the base or clearance; stop rather than choosing silently.

### Evidence required

1. A geometry report recording base plane, claw envelope, barriers, clearance,
   coordinate layer, and tolerance.
2. Fixed-step traces from the highest legal Y at centered, edge, corner, and
   object-adjacent X/Z fixtures.
3. For each trace: start/end pose, fixed-step index, lowest claw point,
   base-plane distance, all relevant contact pairs, contact normals/points (or
   engine-equivalent facts), object displacement, and completion reason.
4. Assertions that the base-plane distance is within the approved tolerance,
   no forbidden penetration occurs, and no early endpoint is animation-only.
5. Reset and repeated-run evidence proving the same descent fixture produces
   the same endpoint within the fixed-step repeatability tolerance.

### Stop conditions

Stop and open a contract revision if reaching the base requires changing the
world convention, travel volume, collision matrix, floor location, fixed-step
policy, or the approved claw body strategy.

---

## 5. N37 — Complete-contact / valid-capture grip contract

### Job

Prevent a claw from approving a grip beside an object or lifting an object
whose geometry is not properly contained and contacted by the claw.

### Product interpretation

“Complete contact” is treated here as **complete valid capture**, not literal
contact with every surface triangle. A valid capture must satisfy the object's
approved grip profile: containment in the capture envelope plus the required
physical contact pattern. This is measurable, robust across mesh tessellation,
and prevents a sensor sphere from authorizing a side grab.

For the current single-prize fixture, the **recommended provisional profile** is:
This is a proposed tightening of the existing A-24 sensor-contact rule, not an
approved product decision. It becomes binding only after the packet is accepted
and the corresponding versioned contract revision is recorded.

- the prize reference center/approved grip point is inside the claw capture
  envelope by the configured margin;
- the prize intersects the sensor **and** has physical solver contact with all
  required configured finger/contact regions for the profile;
- contact regions must come from distinct sides/approach directions, not
  duplicate contacts from one side;
- the prize's relevant body/center must not remain outside the capture envelope
  while the sensor happens to overlap it.

The exact profile is data, not a hidden heuristic. If the product wants a less
strict two-contact grasp—or literal all-surface contact instead—that is a
product/contract decision with new evidence, not an implementation shortcut.
Until accepted, the current A-24 behavior remains the active baseline and N37 is
not an authorization to change it silently.

### Ownership

- The object/prize asset contract owns a stable logical ID, reference point,
  canonical dimensions, and optional `gripProfile` metadata.
- `src/physics/config.ts` owns the versioned candidate collider/contact
  parameters and capture tolerances; it does not decide a win from a mesh.
- `src/physics/adapter.ts` owns physical contact observations and creates the
  carry constraint only after the evaluator approves the profile.
- The grip evaluator owns the pure acceptance predicate and its diagnostics.
- The state controller owns the resulting outcome; it does not inspect mesh
  overlap or contact pairs directly.

### Contract

A grip is approved only if all required conditions for the active object profile
are true in the same fixed-step observation window:

1. **Containment:** the approved object reference point and configured required
   volume are inside the capture envelope with the profile's margin.
2. **Sensor evidence:** the sensor intersects the intended object and identifies
   the correct logical body ID.
3. **Physical contact:** every required contact region in the profile has a
   solver-contact observation with the intended object. Sensor-only contact is
   never enough.
4. **No side-grab geometry:** the object is not merely adjacent to or outside
   the capture envelope; a visual envelope overlap cannot satisfy containment.
5. **Stability window:** the conditions persist for the approved alignment/
   settling window under fixed-step sampling; one transient edge contact cannot
   create a carry constraint.
6. **Run identity:** the observation belongs to the active run epoch and is not
   stale.

The carry constraint is created only after this predicate returns approved. Its
creation must preserve the object's current pose/offset within the attachment
contract; it cannot repair an invalid capture by snapping the object into place.

### Required negative and positive fixtures

- centered object: valid capture candidate;
- object offset toward each cardinal and diagonal edge: pass/fail according to
  the explicit capture margin;
- object fully beside the claw with only visual-envelope overlap: reject;
- object touching only the sensor: reject;
- object touching one contact region: reject;
- object with duplicate same-side contacts but a missing required side: reject;
- object properly enclosed/contacted by every required region: approve;
- two nearby objects where the sensor overlaps one and a solver contact belongs
  to another: reject;
- object that is visually intersecting but collision-group-ineligible: reject
  and report `collision-group-ineligible`.

### Failure results

- `grip-outside-envelope`: reference point or required volume outside capture
  bounds.
- `grip-sensor-only`: sensor overlap exists without required solver contacts.
- `grip-incomplete-contact`: one or more required contact regions are absent.
- `grip-wrong-body`: observations refer to a different object ID.
- `grip-unstable-contact`: conditions did not persist through the settling
  window.
- `grip-stale-observation`: contact belongs to an old run epoch.
- `grip-collider-ambiguous`: the object has no valid profile or safe collider
  mapping, so no grip may be approved.

### Evidence required

Record the object profile revision, capture envelope, object reference point,
contact-region IDs, sensor/solver observations, object body ID, fixed-step
window, and evaluator result for every positive and negative fixture. The
critical proof is a side-grab fixture that visually overlaps and/or sensor
intersects but cannot create a carry constraint.

---

## 6. N38 — Collision observability and barrier contract

### Job

Make actual claw/object/barrier collision behavior provable and distinguish it
from visual overlap, sensor intersection, and carry behavior.

### Ownership

- `src/physics/adapter.ts` owns collider registration, collision groups,
  solver contacts, intersection queries, and physics-step observations.
- `src/physics/config.ts` owns group membership/filter masks and physical
  parameters through the versioned collision/fixed-step contracts.
- `src/evidence/**` owns read-only traces and diagnostic reports.
- `src/scene/**` may render debug proxies/contact markers only; it must never
  become collision truth.

### Contract

Every registered physical body/collider has a diagnostic identity containing at
least logical body ID, collider ID, role, shape type, sensor/solver mode,
collision group, filter mask, source/profile revision, and owning run epoch.

For each required pair, the system must distinguish and report:

- **eligible + solver contact:** physical collision response is possible and a
  contact is observed;
- **eligible + no contact:** the pair is configured correctly but separated;
- **sensor intersection:** overlap is observed without solver response;
- **ineligible pair:** no contact is expected regardless of visual overlap;
- **missing registration:** a visual object has no corresponding physics body;
- **barrier response:** movement is stopped/deflected by the identified floor,
  wall, or machine barrier rather than by an animation clamp.

The claw must have explicit physical proxies for every role needed by the
interaction contract: travel/body proxy, required finger/contact proxies, and
any grip sensor. Objects must have explicit dynamic/static collider records.
The floor and chamber barriers must be physical environment records. A rendered
mesh without a corresponding required collider is a contract diagnostic, not a
silent pass.

### Evidence required

1. Registration inventory before stepping: all claw, object, floor, wall, and
   sensor colliders with shape, transform, group/filter, and sensor/solver mode.
2. Controlled pair matrix covering every allowed and forbidden pair from
   `records/contracts/collision-matrix.md`.
3. Contact traces for a claw-to-object impact, finger-to-object impact, object
   to floor, claw-to-wall, and object-to-wall cases.
4. Negative traces proving visual overlap without eligible Rapier contact does
   not approve grip or carry.
5. Debug view or machine-readable trace that correlates the visible mesh to
   the physical proxy without allowing the debug view to alter gameplay.
6. Repeatability and reset evidence: contacts, velocities, and registrations
   return to baseline on reset.

### Failure results

- `collision-registration-missing`
- `collision-group-ineligible`
- `collision-mode-mismatch`
- `collision-contact-unobserved`
- `barrier-not-physical`
- `collision-trace-inconclusive`

No implementation node may claim “collision works” from a screenshot or mesh
intersection alone.

---

## 7. N39 — Mesh-to-collider derivation policy

### Job

Define when collider settings may be derived automatically from a mesh and
when an explicit authored profile is required.

### Decision

**Automatic derivation is allowed as a bounded candidate-generation path, not
as an unconditional authority.** Mesh geometry can safely provide dimensions
and conservative primitive candidates for simple objects, but a generic mesh
cannot reliably communicate gameplay intent, concavity, grip surfaces, or
acceptable approximation error.

### Policy

1. Every collidable logical object has a stable collider profile ID. The profile
   may be authored explicitly or generated as a versioned candidate.
2. Prefer an authored profile when available. It declares body type, shape(s),
   local transforms, dimensions, sensor/solver mode, collision groups, friction,
   restitution, CCD/sleeping policy, and grip/contact regions where applicable.
3. For a mesh without an authored profile, the asset boundary may derive a
   **candidate** from validated geometry bounds and topology classification:
   - sphere/box/capsule candidates for simple convex-ish objects;
   - a conservative compound/convex candidate where the approximation is
     bounded and supported by the approved physics strategy;
   - no automatic candidate for concave, hollow, articulated, non-manifold, or
     invalid geometry unless a future contract explicitly approves it.
4. Automatic derivation must use canonicalized asset transforms, authored unit
   scale, axes, and validated dimensions. It must never infer gameplay scale
   from the rendered camera or visual overlap.
5. The candidate must record source mesh ID, geometry revision/hash, algorithm
   revision, chosen shape, dimensions, approximation/clearance error, and
   reason for fallback or rejection.
6. Candidate generation does not authorize a grip profile. Contact regions and
   capture rules remain explicit data; a bounding sphere may be a collision
   candidate but cannot by itself define a valid grasp.
7. A missing, ambiguous, or out-of-tolerance candidate blocks physical
   interaction for that object and returns `grip-collider-ambiguous` or
   `collision-registration-missing`; it may not silently fall back to visual
   overlap.
8. Any auto-generated profile promoted to runtime must pass the same collision,
   descent, grip, reset, and repeatability evidence as an authored profile.

### Ownership

- `src/assets/**` validates mesh geometry and produces/loads profile metadata or
  candidate records.
- `src/physics/config.ts` owns the approved runtime profile set and the
  versioned group/parameter policy.
- `src/physics/adapter.ts` instantiates only approved profiles and reports their
  diagnostic identities.
- `src/evidence/**` verifies candidate bounds and runtime behavior.

### Evidence required

- simple convex/box-like mesh: candidate dimensions compared with source bounds;
- rotated/scaled mesh: canonical transform and unit-scale proof;
- concave/hollow/articulated mesh: explicit rejection or authored profile;
- missing/invalid geometry: actionable block, no silent fallback;
- candidate-vs-authored comparison for contact, barrier, descent, and grip
  fixtures;
- registration inventory showing profile ID and derivation revision.

### Failure result

`collider-candidate-rejected`, `collider-profile-missing`,
`collider-approximation-out-of-tolerance`, or `collider-derivation-inconclusive`.

### Stop conditions

Stop and open a new contract if automatic derivation requires a new dependency,
concave-mesh physics, runtime mesh mutation, or a different collision-group or
body strategy.

---

## 8. N40 — Integrated verification and promotion gate

N40 runs only after N36–N39 implementation nodes complete. It must verify:

- descent reaches the base contract at all required fixtures;
- side grabs and sensor-only/partial-contact grabs are rejected;
- a properly contained multi-contact fixture creates exactly one approved carry
  constraint and carries within the existing tolerance;
- claw/object/floor/wall registration and contacts match the resolved matrix;
- visual overlap without physics contact never creates grip/carry;
- authored and auto-derived collider profiles produce the declared diagnostics;
- reset removes constraints, clears contacts/diagnostics, and restores all
  bodies and profiles;
- fixed-step repeatability remains within the existing policy;
- existing N6/N7/N34 and N31–N35 regressions remain green;
- `npm run typecheck`, `npm run lint`, `npm test`, and `npm run build` pass after
  implementation.

Required evidence artifacts are produced only after implementation begins:

- `records/evidence/n36-descent-trace.json`
- `records/evidence/n37-grip-validity.json`
- `records/evidence/n38-collision-observability.json`
- `records/evidence/n39-collider-derivation.json`
- `records/evidence/n40-integrated-physics.json`

N40 failure blocks promotion with the specific node failure result; it does not
weaken containment, collision, or descent thresholds to obtain a pass.

---

## 9. Promotion recommendation

Implement in this order:

1. N38 registration/observability first, because it proves what currently
   exists and prevents later grip/descent claims from relying on visual guesses.
2. N36 descent-to-base geometry and completion.
3. N39 collider-profile derivation policy and diagnostics.
4. N37 complete-contact grip evaluation.
5. N40 integrated deterministic and browser/visual verification.

This order is intentionally evidence-first: collision facts must be visible
before tuning descent or changing grip semantics.
