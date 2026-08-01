# Claw Machine 3D — Freebuff Desktop Human Execution Plan

> A human-led, gate-based plan for building the greenfield claw-machine application at `/home/eli/Documents/coding_proj/claw_app` with Freebuff Desktop.

## Operating model

The human is the product owner, architect, and promotion gate. Freebuff Desktop is the bounded implementation workforce: agents can investigate, implement, test, and report, but the human decides what is approved, merged, reverted, or escalated.

The project must follow the approved charter at `/home/eli/.obsidian/EehnOS/wiki/Claw Machine App Project Charter.md`. Do not ask one agent to build the entire game. Break work into bounded nodes with explicit ownership, allowed files, evidence, and promotion gates.

Freebuff Desktop is used as the local coordination environment. Use one primary workspace for the official project state and separate workspaces for isolated investigations, reviews, and non-overlapping implementation tasks.

> **Core rule:** Agents may propose and implement bounded changes; the human controls architecture, scope, and promotion.

## 1. Human working system

### Primary workspace

Keep one primary Freebuff Desktop workspace for:

- The current approved application state
- Human review and integration
- Running the complete verification suite
- Recording decisions and evidence
- Creating the next baseline

Only work promoted in this workspace becomes the official project state.

### Parallel workspaces

Use additional workspaces for:

- Independent investigations
- Read-only reviews
- Design alternatives
- Asset inspection
- Test planning
- Performance analysis
- Implementation tasks with non-overlapping file ownership

Do not let multiple agents edit the same subsystem simultaneously. Separate workspaces reduce collisions, but they do not eliminate merge conflicts or architectural conflicts.

**Safe parallel work:** design review, state-machine test design, asset inspection, and charter review.

**Unsafe parallel work:** multiple agents editing the same claw hierarchy, asset loader, or physics representation.

## 2. Recurring development loop

Run this loop for every meaningful task:

```text
Choose one bounded task
        ↓
Record the current baseline
        ↓
Give Freebuff a narrow task contract
        ↓
Agent investigates and implements
        ↓
Agent runs required proof
        ↓
Human inspects the diff and application
        ↓
Independent verification
        ↓
Keep, revert, or escalate
        ↓
Create a new baseline
```

Never give an agent only “build the claw machine.” Give it one observable behavior, such as “implement the static claw hierarchy and open/closed visual poses without adding physics.”

## 3. Phase 0 — Bootstrap the project

**Goal:** Establish a trustworthy foundation before adding gameplay.

Target directory:

```text
/home/eli/Documents/coding_proj/claw_app
```

The directory is currently empty and is not yet a Git repository.

### Human decisions

Decide and record:

- Package manager and lockfile
- Git workflow and baseline policy
- Browser and device targets
- Initial performance expectations
- TypeScript and scaffold choices
- Exact dependency versions
- Development, build, typecheck, lint, format, and test commands
- Initial asset, evidence, and evaluation directories

Do not let an agent silently choose these through trial and error.

### Bootstrap prompt

```text
You are the bootstrap node for the Claw Machine 3D project.

Inspect /home/eli/Documents/coding_proj/claw_app before changing anything.

Establish the smallest runnable React application using the approved provisional stack:
Three.js, React Three Fiber, Rapier, Zustand, GSAP, and optionally ScrollTrigger.

Do not implement gameplay, claw physics, prize logic, scoring, or visual polish.

First report:
1. Proposed package manager
2. Proposed scaffold
3. Dependency compatibility concerns
4. Proposed commands
5. Proposed directory structure
6. Proposed browser and device assumptions
7. Decisions requiring human approval

Do not create files until the human approves the bootstrap decisions.
```

### Gate 0 — Greenfield baseline

Gate 0 passes only when:

- Git is initialized intentionally.
- The package manager and lockfile are recorded.
- The application starts.
- The production build works.
- Typechecking works.
- Linting and formatting are defined.
- The minimal scene renders in the browser.
- Chosen dependencies and versions are recorded.
- No gameplay has been added prematurely.
- An intentional baseline revision exists.

The human must open the running application and confirm that it renders before approving Gate 0.

## 4. Phase 1 — Establish contracts

**Goal:** Prevent rendering, animation, state, and physics from fighting over the same values.

Record an architecture decision document defining:

| Concern                              | Authority                         |
| ------------------------------------ | --------------------------------- |
| Scene composition and visual objects | R3F / Three.js                    |
| Dynamic body position and collision  | Rapier                            |
| Game state and player intent         | Zustand plus the state controller |
| Presentation transitions             | GSAP                              |
| Scroll-driven marketing effects      | ScrollTrigger                     |
| Promotion and verification           | Human plus deterministic checks   |

The most important decision is one authoritative writer for each category of truth.

### Contract prompt

```text
Create the implementation contracts for the Claw Machine 3D project.

Define:
1. Scene hierarchy
2. Claw hierarchy
3. State-machine states and transitions
4. Authority boundaries
5. Asset-loading contract
6. Transform layers
7. Rapier physics layers
8. Reset behavior
9. Verification scenarios
10. Protected files and subsystem ownership

Do not implement gameplay yet.

Stop and list every unresolved architecture decision requiring human approval.
```

### Human approval decisions

Explicitly approve:

- Whether the first claw is kinematic, dynamic, or hybrid
- Whether fingers are visual-only or physics-enabled
- How a successful grip is represented
- How a failed grip behaves
- How prizes reset after failure
- What counts as a win
- Whether randomness is allowed
- Whether ScrollTrigger is necessary

Recommended first choice:

- Kinematic claw movement
- Deterministic visual finger articulation
- Rapier for prize and environment physics
- One prize for the first interaction test
- Deterministic success and failure scenarios before randomness

## 5. Phase 2 — Build the static scene

**Goal:** Make the machine and claw correct while completely stationary. Do not add physics yet.

### Work sequence

1. Create the machine frame.
2. Create or import the claw.
3. Establish the scene hierarchy.
4. Establish camera and lighting.
5. Place the claw in its home position.
6. Document every moving part and pivot.
7. Verify model loading and transforms.
8. Test refresh, remount, and reset behavior.

### Static-scene prompt

```text
Implement only the static Claw Machine 3D scene.

Objective:
The machine and claw render in the correct hierarchy, scale, orientation, and home position after refresh and remount.

Allowed:
Static scene, camera, lights, materials, and claw visual hierarchy.

Protected:
Rapier physics, Zustand game state, input handling, prize logic, scoring, and GSAP gameplay animation.

Required proof:
- Development server
- Production build
- Typecheck
- Refresh test
- Remount test
- Screenshot from the agreed review camera
- Transform and hierarchy report

Stop if the result requires physics or changes the authority model.
```

### Gate 2 — Static scene

Pass only when:

- The claw looks correct from agreed camera angles.
- Parts have correct parent-child relationships.
- The machine does not shift after reload.
- The claw does not duplicate after remount.
- Scale and orientation remain stable.
- The human approves the design.

Reject “technically rendered” if the claw design is visibly wrong.

## 6. Phase 3 — Stabilize claw articulation

**Goal:** Make the claw open and close correctly without physics.

Required named poses:

- Home
- Raised
- Lowered
- Open
- Closed
- Reset

Each pose must be reproducible from a known baseline.

### Articulation prompt

```text
Implement only deterministic claw articulation.

Objective:
The claw transitions between named open, closed, raised, lowered, and reset poses without transform drift.

Allowed:
Claw rig and pose adapter only.

Protected:
Rapier configuration, prize objects, scoring, asset-loader architecture, and game-state redesign.

Required proof:
- Open pose
- Closed pose
- Raised pose
- Lowered pose
- Reset pose
- Repeated open/close cycles
- Interrupted cycle
- Refresh and remount
- Evidence showing no cumulative transform drift

Use explicit target poses. Do not implement inverse transforms as the reset strategy.
```

### Gate 3 — Articulation

Pass only when:

- Fingers rotate around correct pivots.
- Open and closed poses are visually acceptable.
- Repeated cycles produce the same result.
- Reset restores the exact baseline.
- The rig does not depend on hidden frame-rate behavior.
- Visual animation does not decide game state.

## 7. Phase 4 — Build the logical state machine

**Goal:** Separate player commands, logical state, visual motion, and physics observations.

Recommended initial flow:

```text
booting
  → ready
  → aiming
  → lowering
  → aligning
  → gripping
  → lifting
  → returning
  → releasing
  → result
  → reset
  → ready
```

An error state must be reachable from every state.

### State-machine prompt

```text
Implement the typed claw-machine state controller.

Objective:
Valid commands produce legal transitions, invalid commands are rejected or ignored, and reset works from every state.

Allowed:
State-controller logic, Zustand store fields, command definitions, transition tests.

Protected:
Claw geometry, asset loading, Rapier configuration, visual design, and presentation animation.

Required proof:
- Legal transition tests
- Illegal command tests
- Reset from every state
- Interrupted action tests
- Repeated identical input sequence
- Error-state test
- Evidence of the complete transition sequence

The state controller must be the only authority that promotes logical state.
```

### Gate 4 — State machine

Pass only when:

- Every state has documented entry and exit conditions.
- Illegal transitions cannot occur.
- Input commands do not directly mutate physics.
- Animation callbacks do not independently promote state.
- Reset works from every state.
- Repeated input produces the same logical transition sequence.

## 8. Phase 5 — Add Rapier incrementally

**Goal:** Add physical interaction without destabilizing the rest of the system.

Start with:

- One claw
- One prize
- One machine environment
- One successful placement
- One unsuccessful placement
- One reset path

### Physics scenario order

1. **Idle stability:** Resting objects do not drift or jitter beyond agreed tolerance.
2. **Claw travel:** The kinematic claw stays within its legal range.
3. **Single-prize contact:** Known placement produces consistent contact.
4. **Successful carry:** Favorable placement produces the expected carry behavior.
5. **Failed carry:** Unfavorable placement produces documented failure behavior.
6. **Reset:** Interrupted action restores logical and physical baseline.
7. **Repeated run:** Identical inputs produce recorded, explainable differences.

### Rapier prompt

```text
Implement only the first Rapier interaction scenario: one claw and one prize.

Objective:
The kinematic claw can approach one known prize, produce a distinguishable contact result, and reset both logical and physical state.

Allowed:
Rapier adapter, physics configuration for the minimal scenario, and one evaluation scene.

Protected:
Claw visual hierarchy, state-machine definitions, asset-loader architecture, scoring, and unrelated presentation logic.

Required proof:
- Idle stability
- Claw travel
- Contact without visual-overlap false positives
- Successful carry or documented controlled attachment
- Failed carry
- Reset
- Repeated run
- Physics logs or recorded evidence

Do not change the physics strategy without escalating to the human.
```

### Gate 5 — Physics

Pass only when:

- The Rapier adapter owns physics stepping.
- Dynamic bodies are not continuously overwritten by animation code.
- Contact is distinguishable from visual overlap.
- Physics parameters are documented.
- Successful and failed scenarios are reproducible.
- Reset restores bodies and logical state.
- The change does not break articulation or asset behavior.

## 9. Phase 6 — Integrate approved subsystems

Integrate only after the static scene, articulation, state machine, and minimal physics scenario pass independently.

### Integration prompt

```text
Integrate the already-approved scene, claw rig, state controller, and Rapier adapter.

Do not redesign any subsystem.

Verify:
1. State commands produce the correct claw behavior.
2. The physics body and rendered claw remain synchronized.
3. Grip outcomes return to the state controller.
4. Reset restores visual, logical, and physical state.
5. GSAP does not move authoritative physics bodies.
6. Bootstrap and subsystem checks still pass.

If two subsystems disagree about ownership, stop and report the conflict instead of adding a workaround.
```

### Gate 6 — Integration

Pass only when:

- Visual, state, and physics systems agree.
- No value has competing writers.
- Reset works across all layers.
- No approved subsystem was silently redesigned.
- The complete application still builds and runs.

## 10. Phase 7 — Independent verification

Use separate Freebuff workspaces for independent review lenses.

### Visual verifier

> Try to disprove that the machine and claw match the approved design. Check proportions, hierarchy, pivots, lighting, and camera views.

### State verifier

> Try illegal commands, interruptions, rapid inputs, repeated cycles, refreshes, and resets. Find any path that produces an undocumented state.

### Asset verifier

> Reload and remount every asset. Look for duplicate objects, transform drift, inconsistent scale, incorrect parentage, and silent loading failures.

### Physics verifier

> Try to create jitter, tunneling, false-positive grips, unstable carries, collision failures, and non-reproducible resets.

### Performance verifier

> Test the representative scene, not an empty scene. Look for frame instability, long-session degradation, asset cost, and physics cost.

### Human merge decision

Promote only when:

- Deterministic checks pass.
- Required evidence exists.
- Reviewers attempted to disprove the result.
- No protected boundary was violated.
- Scope was not expanded.
- Known limitations are recorded.

A review document alone is not proof.

## 11. Agent management rules

### Every task packet must include

- Task name
- Objective
- Current baseline
- Hypothesis
- Allowed files
- Protected systems
- Required commands
- Required browser scenario
- Required evidence
- Stop conditions
- Keep/revert/escalate decision

### Human review checklist

- [ ] Only allowed files changed
- [ ] Requested behavior was addressed without scope expansion
- [ ] Required checks actually ran
- [ ] Human can reproduce the claimed result
- [ ] Browser behavior matches the report
- [ ] Authority boundaries are preserved
- [ ] No hidden magic numbers were introduced
- [ ] Limitations are recorded
- [ ] A reversible baseline can be created

### Stop the agent immediately when

- The contract is unclear.
- It proposes changing two authority boundaries.
- It needs a new major dependency.
- It cannot reproduce the failure.
- It changes unrelated files.
- It repeatedly retries the same failed hypothesis.
- Visual evidence and test results disagree.
- It claims success without running proof.

## 12. Durable project records

Once Phase 0 establishes the repository structure, maintain records for:

- Architecture decisions
- Task packets
- Scenario definitions
- Verification results
- Failed hypotheses
- Known limitations
- Human approvals
- Baseline revisions
- Release-readiness status

For every meaningful change preserve:

- Objective
- Baseline and parent revision
- Hypothesis
- Allowed and protected files
- Files changed
- Commands and scenarios run
- Screenshots, recordings, logs, or traces
- Known failures
- Reviewer findings
- Keep, revert, blocked, or escalated decision
- Next recommended experiment
- Timestamp and agent identity

A failed experiment remains documented after its code is reverted. This prevents Freebuff from rediscovering the same unsuccessful approach.

## 13. Recommended first month

### Session 1 — Bootstrap

- Inspect the empty directory.
- Choose the package manager.
- Scaffold the application.
- Establish commands.
- Create the first baseline.

### Session 2 — Contracts

- Define ownership.
- Define the state machine.
- Define the claw hierarchy.
- Decide the grip strategy.
- Approve Gate 1.

### Sessions 3–4 — Static scene

- Build the machine.
- Build or import the claw.
- Stabilize transforms.
- Approve the visual design.

### Sessions 5–6 — Articulation

- Implement named poses.
- Test open/close.
- Test reset and interruption.
- Approve Gate 3.

### Sessions 7–8 — State

- Implement commands and transitions.
- Add replayable transition tests.
- Approve Gate 4.

### Sessions 9–12 — Physics

- Add one prize.
- Test contact.
- Test carry and failure.
- Test reset.
- Approve Gate 5.

### Remaining sessions — Integration and verification

- Combine approved systems.
- Run independent verification.
- Fix one finding at a time.
- Promote only after a clean verification round.

## 14. Definition of Version 1 complete

Version 1 is complete only when:

- [ ] Git baseline, commands, package versions, browsers, and devices are recorded.
- [ ] Static scene passes visual and asset-loading review.
- [ ] Claw hierarchy and pivots are documented.
- [ ] Open, closed, raised, lowered, and reset poses are stable.
- [ ] State machine has legal transitions and recovery behavior.
- [ ] Minimal Rapier scenarios pass defined invariants.
- [ ] Reset restores scene, prizes, and logical state.
- [ ] Independent verification attempted to disprove the implementation.
- [ ] No critical or high-severity failure remains unclassified.
- [ ] Known limitations and unproven behaviors are recorded.

## Immediate next action

Start with this prompt in the primary Freebuff Desktop workspace:

```text
Start Phase 0 for the Claw Machine 3D project at /home/eli/Documents/coding_proj/claw_app.

Inspect the empty directory first. Do not install packages, initialize Git, or create files yet.

Return a bootstrap decision proposal covering the package manager, scaffold, dependency compatibility, commands, directory structure, browser/device assumptions, and decisions requiring human approval.

Do not implement gameplay or physics. Stop after the proposal.
```

**Do not build the claw until Gate 0 and Gate 1 are approved.**
