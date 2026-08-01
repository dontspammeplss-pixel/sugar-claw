
## 2026-08-01T09:33:33.900Z — n1a — BLOCKED

```json
{
  "version": 1,
  "node": "n1a",
  "baseline": "gate-1-baseline-rev1",
  "routingInput": {
    "node": "n1a",
    "baseline": "gate-1-baseline-rev1",
    "checks": [
      "typecheck",
      "lint",
      "test",
      "build"
    ],
    "scenarioSet": "scenario:n1a",
    "baselineUntracked": [
      "fb_plan_graph.md"
    ],
    "requiredEvidenceArtifacts": [
      "records/approvals/gate-1-baseline-rev1.md",
      "records/contracts/attachment-primitive.md",
      "records/contracts/collision-matrix.md",
      "records/contracts/fixed-step-policy.md",
      "records/contracts/performance-thresholds.md"
    ],
    "dryRun": true
  },
  "rule": "BLOCK promotion: protected-file modification detected: src/synthetic-protected.ts, package.json (outside scripts block)",
  "outcome": "BLOCKED",
  "checkpoint": "n1a:BLOCKED:2026-08-01T09:33:33.811Z",
  "protectedDiff": [
    "src/synthetic-protected.ts",
    "package.json (outside scripts block)"
  ],
  "missingEvidence": [],
  "checks": [],
  "recordedAt": "2026-08-01T09:33:33.900Z"
}
```

## 2026-08-01T09:38:23.594Z — n1a — BLOCKED

```json
{
  "version": 1,
  "node": "n1a",
  "baseline": "gate-1-baseline-rev1",
  "routingInput": {
    "node": "n1a",
    "baseline": "gate-1-baseline-rev1",
    "checks": [
      "typecheck",
      "lint",
      "test",
      "build"
    ],
    "scenarioSet": "scenario:n1a",
    "baselineUntracked": [],
    "requiredEvidenceArtifacts": [
      "records/approvals/gate-1-baseline-rev1.md",
      "records/contracts/attachment-primitive.md",
      "records/contracts/collision-matrix.md",
      "records/contracts/fixed-step-policy.md",
      "records/contracts/performance-thresholds.md"
    ],
    "requiredEvidenceFields": [
      "node",
      "baseline",
      "routingInput",
      "rule",
      "outcome",
      "checkpoint"
    ],
    "dryRun": true
  },
  "rule": "BLOCK promotion: protected-file modification detected: fb_plan_graph.md, src/synthetic-protected.ts",
  "outcome": "BLOCKED",
  "checkpoint": "n1a:BLOCKED:2026-08-01T09:38:23.482Z",
  "protectedDiff": [
    "fb_plan_graph.md",
    "src/synthetic-protected.ts"
  ],
  "missingEvidence": [],
  "checks": [],
  "requiredFields": [
    "node",
    "baseline",
    "routingInput",
    "rule",
    "outcome",
    "checkpoint"
  ],
  "recordedAt": "2026-08-01T09:38:23.594Z"
}
```

## 2026-08-01T09:39:07.549Z — n1a — PASS

```json
{
  "version": 1,
  "node": "n1a",
  "baseline": "gate-1-baseline-rev1",
  "routingInput": {
    "node": "n1a",
    "baseline": "gate-1-baseline-rev1",
    "checks": [
      "typecheck",
      "lint",
      "test",
      "build"
    ],
    "scenarioSet": "scenario:n1a",
    "baselineUntracked": [
      "fb_plan_graph.md"
    ],
    "requiredEvidenceArtifacts": [
      "records/approvals/gate-1-baseline-rev1.md",
      "records/contracts/attachment-primitive.md",
      "records/contracts/collision-matrix.md",
      "records/contracts/fixed-step-policy.md",
      "records/contracts/performance-thresholds.md"
    ],
    "requiredEvidenceFields": [
      "node",
      "baseline",
      "routingInput",
      "rule",
      "outcome",
      "checkpoint"
    ],
    "dryRun": false
  },
  "rule": "all required gate rules passed",
  "outcome": "PASS",
  "checkpoint": "n1a:PASS:2026-08-01T09:38:25.328Z",
  "protectedDiff": [],
  "missingEvidence": [],
  "checks": [
    {
      "name": "typecheck",
      "command": "npm run typecheck",
      "status": 0,
      "passed": true
    },
    {
      "name": "lint",
      "command": "npm run lint",
      "status": 0,
      "passed": true
    },
    {
      "name": "test",
      "command": "npm run test",
      "status": 0,
      "passed": true
    },
    {
      "name": "build",
      "command": "npm run build",
      "status": 0,
      "passed": true
    },
    {
      "name": "scenario-set",
      "command": "npm run scenario:n1a",
      "status": 0,
      "passed": true
    }
  ],
  "requiredFields": [
    "node",
    "baseline",
    "routingInput",
    "rule",
    "outcome",
    "checkpoint"
  ],
  "recordedAt": "2026-08-01T09:39:07.549Z"
}
```

## 2026-08-01T09:40:50.844Z — n1a — BLOCKED

```json
{
  "version": 1,
  "node": "n1a",
  "baseline": "gate-1-baseline-rev1",
  "routingInput": {
    "node": "n1a",
    "baseline": "gate-1-baseline-rev1",
    "checks": [
      "typecheck",
      "lint",
      "test",
      "build"
    ],
    "scenarioSet": "scenario:n1a",
    "baselineUntracked": [],
    "requiredEvidenceArtifacts": [
      "records/approvals/gate-1-baseline-rev1.md",
      "records/contracts/attachment-primitive.md",
      "records/contracts/collision-matrix.md",
      "records/contracts/fixed-step-policy.md",
      "records/contracts/performance-thresholds.md"
    ],
    "requiredEvidenceFields": [
      "node",
      "baseline",
      "routingInput",
      "rule",
      "outcome",
      "checkpoint"
    ],
    "dryRun": true
  },
  "rule": "BLOCK promotion: protected-file modification detected: fb_plan_graph.md, src/synthetic-proof.ts",
  "outcome": "BLOCKED",
  "checkpoint": "n1a:BLOCKED:2026-08-01T09:40:50.747Z",
  "protectedDiff": [
    "fb_plan_graph.md",
    "src/synthetic-proof.ts"
  ],
  "missingEvidence": [],
  "checks": [],
  "requiredFields": [
    "node",
    "baseline",
    "routingInput",
    "rule",
    "outcome",
    "checkpoint"
  ],
  "recordedAt": "2026-08-01T09:40:50.844Z"
}
```

## 2026-08-01T09:44:02.203Z — n1a — BLOCKED

```json
{
  "version": 1,
  "node": "n1a",
  "baseline": "gate-1-baseline-rev1",
  "routingInput": {
    "node": "n1a",
    "baseline": "gate-1-baseline-rev1",
    "checks": [
      "typecheck",
      "lint",
      "test",
      "build"
    ],
    "scenarioSet": "scenario:n1a",
    "baselineUntracked": [
      "fb_plan_graph.md"
    ],
    "requiredEvidenceArtifacts": [
      "records/approvals/gate-1-baseline-rev1.md",
      "records/contracts/attachment-primitive.md",
      "records/contracts/collision-matrix.md",
      "records/contracts/fixed-step-policy.md",
      "records/contracts/performance-thresholds.md"
    ],
    "requiredEvidenceFields": [
      "node",
      "baseline",
      "routingInput",
      "rule",
      "outcome",
      "checkpoint"
    ],
    "dryRun": true
  },
  "rule": "BLOCK promotion: protected-file modification detected: src/synthetic-proof.ts",
  "outcome": "BLOCKED",
  "checkpoint": "n1a:BLOCKED:2026-08-01T09:44:02.127Z",
  "protectedDiff": [
    "src/synthetic-proof.ts"
  ],
  "missingEvidence": [],
  "checks": [],
  "requiredFields": [
    "node",
    "baseline",
    "routingInput",
    "rule",
    "outcome",
    "checkpoint"
  ],
  "recordedAt": "2026-08-01T09:44:02.203Z"
}
```

## 2026-08-01T09:46:57.294Z — n1a — PASS

```json
{
  "version": 1,
  "node": "n1a",
  "baseline": "gate-1-baseline-rev1",
  "routingInput": {
    "node": "n1a",
    "baseline": "gate-1-baseline-rev1",
    "checks": [
      "typecheck",
      "lint",
      "test",
      "build"
    ],
    "scenarioSet": "scenario:n1a",
    "baselineUntracked": [
      {
        "path": "fb_plan_graph.md",
        "sha256": "4f6b82406d32808cbc34d8ef23bdd4e0727c9bde9565bdddc0c0b1fd22d60dfc"
      }
    ],
    "requiredEvidenceArtifacts": [
      "records/approvals/gate-1-baseline-rev1.md",
      "records/contracts/attachment-primitive.md",
      "records/contracts/collision-matrix.md",
      "records/contracts/fixed-step-policy.md",
      "records/contracts/performance-thresholds.md"
    ],
    "requiredEvidenceFields": [
      "node",
      "baseline",
      "routingInput",
      "rule",
      "outcome",
      "checkpoint"
    ],
    "dryRun": false
  },
  "rule": "all required gate rules passed",
  "outcome": "PASS",
  "checkpoint": "n1a:PASS:2026-08-01T09:46:14.685Z",
  "protectedDiff": [],
  "missingEvidence": [],
  "checks": [
    {
      "name": "typecheck",
      "command": "npm run typecheck",
      "status": 0,
      "passed": true
    },
    {
      "name": "lint",
      "command": "npm run lint",
      "status": 0,
      "passed": true
    },
    {
      "name": "test",
      "command": "npm run test",
      "status": 0,
      "passed": true
    },
    {
      "name": "build",
      "command": "npm run build",
      "status": 0,
      "passed": true
    },
    {
      "name": "scenario-set",
      "command": "npm run scenario:n1a",
      "status": 0,
      "passed": true
    }
  ],
  "requiredFields": [
    "node",
    "baseline",
    "routingInput",
    "rule",
    "outcome",
    "checkpoint"
  ],
  "recordedAt": "2026-08-01T09:46:57.294Z"
}
```

## 2026-08-01T09:46:59.188Z — n1a — BLOCKED

```json
{
  "version": 1,
  "node": "n1a",
  "baseline": "gate-1-baseline-rev1",
  "routingInput": {
    "node": "n1a",
    "baseline": "gate-1-baseline-rev1",
    "checks": [
      "typecheck",
      "lint",
      "test",
      "build"
    ],
    "scenarioSet": "scenario:n1a",
    "baselineUntracked": [
      {
        "path": "fb_plan_graph.md",
        "sha256": "4f6b82406d32808cbc34d8ef23bdd4e0727c9bde9565bdddc0c0b1fd22d60dfc"
      }
    ],
    "requiredEvidenceArtifacts": [
      "records/approvals/gate-1-baseline-rev1.md",
      "records/contracts/attachment-primitive.md",
      "records/contracts/collision-matrix.md",
      "records/contracts/fixed-step-policy.md",
      "records/contracts/performance-thresholds.md"
    ],
    "requiredEvidenceFields": [
      "node",
      "baseline",
      "routingInput",
      "rule",
      "outcome",
      "checkpoint"
    ],
    "dryRun": true
  },
  "rule": "BLOCK promotion: protected-file modification detected: src/synthetic-proof.ts",
  "outcome": "BLOCKED",
  "checkpoint": "n1a:BLOCKED:2026-08-01T09:46:59.102Z",
  "protectedDiff": [
    "src/synthetic-proof.ts"
  ],
  "missingEvidence": [],
  "checks": [],
  "requiredFields": [
    "node",
    "baseline",
    "routingInput",
    "rule",
    "outcome",
    "checkpoint"
  ],
  "recordedAt": "2026-08-01T09:46:59.188Z"
}
```

## 2026-08-01T09:49:38.962Z — n1a — PASS

```json
{
  "version": 1,
  "node": "n1a",
  "baseline": "gate-1-baseline-rev1",
  "routingInput": {
    "node": "n1a",
    "baseline": "gate-1-baseline-rev1",
    "checks": [
      "typecheck",
      "lint",
      "test",
      "build"
    ],
    "scenarioSet": "scenario:n1a",
    "baselineUntracked": [
      {
        "path": "fb_plan_graph.md",
        "sha256": "4f6b82406d32808cbc34d8ef23bdd4e0727c9bde9565bdddc0c0b1fd22d60dfc"
      }
    ],
    "requiredEvidenceArtifacts": [
      "records/approvals/gate-1-baseline-rev1.md",
      "records/contracts/attachment-primitive.md",
      "records/contracts/collision-matrix.md",
      "records/contracts/fixed-step-policy.md",
      "records/contracts/performance-thresholds.md"
    ],
    "requiredEvidenceFields": [
      "node",
      "baseline",
      "routingInput",
      "rule",
      "outcome",
      "checkpoint"
    ],
    "dryRun": false
  },
  "rule": "all required gate rules passed; gate-log.md is gate-owned output",
  "outcome": "PASS",
  "checkpoint": "n1a:PASS:2026-08-01T09:48:57.000Z",
  "protectedDiff": [],
  "missingEvidence": [],
  "checks": [
    {
      "name": "typecheck",
      "command": "npm run typecheck",
      "status": 0,
      "passed": true
    },
    {
      "name": "lint",
      "command": "npm run lint",
      "status": 0,
      "passed": true
    },
    {
      "name": "test",
      "command": "npm run test",
      "status": 0,
      "passed": true
    },
    {
      "name": "build",
      "command": "npm run build",
      "status": 0,
      "passed": true
    },
    {
      "name": "scenario-set",
      "command": "npm run scenario:n1a",
      "status": 0,
      "passed": true
    }
  ],
  "requiredFields": [
    "node",
    "baseline",
    "routingInput",
    "rule",
    "outcome",
    "checkpoint"
  ],
  "recordedAt": "2026-08-01T09:49:38.962Z"
}
```

## 2026-08-01T09:49:40.902Z — n1a — BLOCKED

```json
{
  "version": 1,
  "node": "n1a",
  "baseline": "gate-1-baseline-rev1",
  "routingInput": {
    "node": "n1a",
    "baseline": "gate-1-baseline-rev1",
    "checks": [
      "typecheck",
      "lint",
      "test",
      "build"
    ],
    "scenarioSet": "scenario:n1a",
    "baselineUntracked": [
      {
        "path": "fb_plan_graph.md",
        "sha256": "4f6b82406d32808cbc34d8ef23bdd4e0727c9bde9565bdddc0c0b1fd22d60dfc"
      }
    ],
    "requiredEvidenceArtifacts": [
      "records/approvals/gate-1-baseline-rev1.md",
      "records/contracts/attachment-primitive.md",
      "records/contracts/collision-matrix.md",
      "records/contracts/fixed-step-policy.md",
      "records/contracts/performance-thresholds.md"
    ],
    "requiredEvidenceFields": [
      "node",
      "baseline",
      "routingInput",
      "rule",
      "outcome",
      "checkpoint"
    ],
    "dryRun": true
  },
  "rule": "BLOCK promotion: protected-file modification detected: src/synthetic-proof.ts",
  "outcome": "BLOCKED",
  "checkpoint": "n1a:BLOCKED:2026-08-01T09:49:40.817Z",
  "protectedDiff": [
    "src/synthetic-proof.ts"
  ],
  "missingEvidence": [],
  "checks": [],
  "requiredFields": [
    "node",
    "baseline",
    "routingInput",
    "rule",
    "outcome",
    "checkpoint"
  ],
  "recordedAt": "2026-08-01T09:49:40.902Z"
}
```

## 2026-08-01T09:52:09.499Z — n1a — PASS

```json
{
  "version": 1,
  "node": "n1a",
  "baseline": "gate-1-baseline-rev1",
  "routingInput": {
    "node": "n1a",
    "baseline": "gate-1-baseline-rev1",
    "requestedBaseline": "gate-1-baseline-rev1",
    "checks": [
      "typecheck",
      "lint",
      "test",
      "build"
    ],
    "scenarioSet": "scenario:n1a",
    "baselineUntracked": [
      {
        "path": "fb_plan_graph.md",
        "sha256": "4f6b82406d32808cbc34d8ef23bdd4e0727c9bde9565bdddc0c0b1fd22d60dfc"
      }
    ],
    "requiredEvidenceArtifacts": [
      "records/approvals/gate-1-baseline-rev1.md",
      "records/contracts/attachment-primitive.md",
      "records/contracts/collision-matrix.md",
      "records/contracts/fixed-step-policy.md",
      "records/contracts/performance-thresholds.md"
    ],
    "requiredEvidenceFields": [
      "node",
      "baseline",
      "routingInput",
      "rule",
      "outcome",
      "checkpoint"
    ],
    "dryRun": false
  },
  "rule": "all required gate rules passed; gate-log.md is gate-owned output",
  "outcome": "PASS",
  "checkpoint": "n1a:PASS:2026-08-01T09:51:27.553Z",
  "protectedDiff": [],
  "missingEvidence": [],
  "checks": [
    {
      "name": "typecheck",
      "command": "npm run typecheck",
      "status": 0,
      "passed": true
    },
    {
      "name": "lint",
      "command": "npm run lint",
      "status": 0,
      "passed": true
    },
    {
      "name": "test",
      "command": "npm run test",
      "status": 0,
      "passed": true
    },
    {
      "name": "build",
      "command": "npm run build",
      "status": 0,
      "passed": true
    },
    {
      "name": "scenario-set",
      "command": "npm run scenario:n1a",
      "status": 0,
      "passed": true
    }
  ],
  "requiredFields": [
    "node",
    "baseline",
    "routingInput",
    "rule",
    "outcome",
    "checkpoint"
  ],
  "recordedAt": "2026-08-01T09:52:09.499Z"
}
```

## 2026-08-01T09:52:11.417Z — n1a — BLOCKED

```json
{
  "version": 1,
  "node": "n1a",
  "baseline": "gate-1-baseline-rev1",
  "routingInput": {
    "node": "n1a",
    "baseline": "gate-1-baseline-rev1",
    "requestedBaseline": "gate-1-baseline-rev1",
    "checks": [
      "typecheck",
      "lint",
      "test",
      "build"
    ],
    "scenarioSet": "scenario:n1a",
    "baselineUntracked": [
      {
        "path": "fb_plan_graph.md",
        "sha256": "4f6b82406d32808cbc34d8ef23bdd4e0727c9bde9565bdddc0c0b1fd22d60dfc"
      }
    ],
    "requiredEvidenceArtifacts": [
      "records/approvals/gate-1-baseline-rev1.md",
      "records/contracts/attachment-primitive.md",
      "records/contracts/collision-matrix.md",
      "records/contracts/fixed-step-policy.md",
      "records/contracts/performance-thresholds.md"
    ],
    "requiredEvidenceFields": [
      "node",
      "baseline",
      "routingInput",
      "rule",
      "outcome",
      "checkpoint"
    ],
    "dryRun": true
  },
  "rule": "BLOCK promotion: protected-file modification detected: src/synthetic-proof.ts",
  "outcome": "BLOCKED",
  "checkpoint": "n1a:BLOCKED:2026-08-01T09:52:11.308Z",
  "protectedDiff": [
    "src/synthetic-proof.ts"
  ],
  "missingEvidence": [],
  "checks": [],
  "requiredFields": [
    "node",
    "baseline",
    "routingInput",
    "rule",
    "outcome",
    "checkpoint"
  ],
  "recordedAt": "2026-08-01T09:52:11.417Z"
}
```

## 2026-08-01T09:53:25.011Z — n1a — BLOCKED

```json
{
  "version": 1,
  "node": "n1a",
  "baseline": "gate-1-baseline-rev1",
  "routingInput": {
    "node": "n1a",
    "baseline": "gate-1-baseline-rev1",
    "requestedBaseline": "gate-1-baseline-rev1",
    "checks": [
      "typecheck",
      "lint",
      "test",
      "build"
    ],
    "scenarioSet": "scenario:n1a",
    "baselineUntracked": [
      {
        "path": "fb_plan_graph.md",
        "sha256": "4f6b82406d32808cbc34d8ef23bdd4e0727c9bde9565bdddc0c0b1fd22d60dfc"
      }
    ],
    "requiredEvidenceArtifacts": [
      "records/approvals/gate-1-baseline-rev1.md",
      "records/contracts/attachment-primitive.md",
      "records/contracts/collision-matrix.md",
      "records/contracts/fixed-step-policy.md",
      "records/contracts/performance-thresholds.md"
    ],
    "requiredEvidenceFields": [
      "node",
      "baseline",
      "routingInput",
      "rule",
      "outcome",
      "checkpoint"
    ],
    "dryRun": false
  },
  "rule": "BLOCK promotion: missing required evidence fields: checkpoint",
  "outcome": "BLOCKED",
  "checkpoint": "n1a:BLOCKED:2026-08-01T09:52:42.002Z",
  "protectedDiff": [],
  "missingEvidence": [],
  "checks": [
    {
      "name": "typecheck",
      "command": "npm run typecheck",
      "status": 0,
      "passed": true
    },
    {
      "name": "lint",
      "command": "npm run lint",
      "status": 0,
      "passed": true
    },
    {
      "name": "test",
      "command": "npm run test",
      "status": 0,
      "passed": true
    },
    {
      "name": "build",
      "command": "npm run build",
      "status": 0,
      "passed": true
    },
    {
      "name": "scenario-set",
      "command": "npm run scenario:n1a",
      "status": 0,
      "passed": true
    }
  ],
  "requiredFields": [
    "node",
    "baseline",
    "routingInput",
    "rule",
    "outcome",
    "checkpoint"
  ],
  "recordedAt": "2026-08-01T09:53:25.011Z"
}
```

## 2026-08-01T09:53:26.977Z — n1a — BLOCKED

```json
{
  "version": 1,
  "node": "n1a",
  "baseline": "gate-1-baseline-rev1",
  "routingInput": {
    "node": "n1a",
    "baseline": "gate-1-baseline-rev1",
    "requestedBaseline": "gate-1-baseline-rev1",
    "checks": [
      "typecheck",
      "lint",
      "test",
      "build"
    ],
    "scenarioSet": "scenario:n1a",
    "baselineUntracked": [
      {
        "path": "fb_plan_graph.md",
        "sha256": "4f6b82406d32808cbc34d8ef23bdd4e0727c9bde9565bdddc0c0b1fd22d60dfc"
      }
    ],
    "requiredEvidenceArtifacts": [
      "records/approvals/gate-1-baseline-rev1.md",
      "records/contracts/attachment-primitive.md",
      "records/contracts/collision-matrix.md",
      "records/contracts/fixed-step-policy.md",
      "records/contracts/performance-thresholds.md"
    ],
    "requiredEvidenceFields": [
      "node",
      "baseline",
      "routingInput",
      "rule",
      "outcome",
      "checkpoint"
    ],
    "dryRun": true
  },
  "rule": "BLOCK promotion: protected-file modification detected: src/synthetic-proof.ts",
  "outcome": "BLOCKED",
  "checkpoint": "n1a:BLOCKED:2026-08-01T09:53:26.876Z",
  "protectedDiff": [
    "src/synthetic-proof.ts"
  ],
  "missingEvidence": [],
  "checks": [],
  "requiredFields": [
    "node",
    "baseline",
    "routingInput",
    "rule",
    "outcome",
    "checkpoint"
  ],
  "recordedAt": "2026-08-01T09:53:26.977Z"
}
```

## 2026-08-01T09:56:07.926Z — n1a — PASS

```json
{
  "version": 1,
  "node": "n1a",
  "baseline": "gate-1-baseline-rev1",
  "routingInput": {
    "node": "n1a",
    "baseline": "gate-1-baseline-rev1",
    "requestedBaseline": "gate-1-baseline-rev1",
    "checks": [
      "typecheck",
      "lint",
      "test",
      "build"
    ],
    "scenarioSet": "scenario:n1a",
    "baselineUntracked": [
      {
        "path": "fb_plan_graph.md",
        "sha256": "4f6b82406d32808cbc34d8ef23bdd4e0727c9bde9565bdddc0c0b1fd22d60dfc"
      }
    ],
    "requiredEvidenceArtifacts": [
      "records/approvals/gate-1-baseline-rev1.md",
      "records/contracts/attachment-primitive.md",
      "records/contracts/collision-matrix.md",
      "records/contracts/fixed-step-policy.md",
      "records/contracts/performance-thresholds.md"
    ],
    "requiredEvidenceFields": [
      "node",
      "baseline",
      "routingInput",
      "rule",
      "outcome",
      "checkpoint"
    ],
    "dryRun": false
  },
  "rule": "all required gate rules passed; gate-log.md is gate-owned output",
  "outcome": "PASS",
  "checkpoint": "n1a:PASS:2026-08-01T09:55:26.338Z",
  "protectedDiff": [],
  "missingEvidence": [],
  "checks": [
    {
      "name": "typecheck",
      "command": "npm run typecheck",
      "status": 0,
      "passed": true
    },
    {
      "name": "lint",
      "command": "npm run lint",
      "status": 0,
      "passed": true
    },
    {
      "name": "test",
      "command": "npm run test",
      "status": 0,
      "passed": true
    },
    {
      "name": "build",
      "command": "npm run build",
      "status": 0,
      "passed": true
    },
    {
      "name": "scenario-set",
      "command": "npm run scenario:n1a",
      "status": 0,
      "passed": true
    }
  ],
  "requiredFields": [
    "node",
    "baseline",
    "routingInput",
    "rule",
    "outcome",
    "checkpoint"
  ],
  "recordedAt": "2026-08-01T09:56:07.926Z"
}
```

## 2026-08-01T09:56:09.794Z — n1a — BLOCKED

```json
{
  "version": 1,
  "node": "n1a",
  "baseline": "gate-1-baseline-rev1",
  "routingInput": {
    "node": "n1a",
    "baseline": "gate-1-baseline-rev1",
    "requestedBaseline": "gate-1-baseline-rev1",
    "checks": [
      "typecheck",
      "lint",
      "test",
      "build"
    ],
    "scenarioSet": "scenario:n1a",
    "baselineUntracked": [
      {
        "path": "fb_plan_graph.md",
        "sha256": "4f6b82406d32808cbc34d8ef23bdd4e0727c9bde9565bdddc0c0b1fd22d60dfc"
      }
    ],
    "requiredEvidenceArtifacts": [
      "records/approvals/gate-1-baseline-rev1.md",
      "records/contracts/attachment-primitive.md",
      "records/contracts/collision-matrix.md",
      "records/contracts/fixed-step-policy.md",
      "records/contracts/performance-thresholds.md"
    ],
    "requiredEvidenceFields": [
      "node",
      "baseline",
      "routingInput",
      "rule",
      "outcome",
      "checkpoint"
    ],
    "dryRun": true
  },
  "rule": "BLOCK promotion: protected-file modification detected: src/synthetic-proof.ts",
  "outcome": "BLOCKED",
  "checkpoint": "n1a:BLOCKED:2026-08-01T09:56:09.692Z",
  "protectedDiff": [
    "src/synthetic-proof.ts"
  ],
  "missingEvidence": [],
  "checks": [],
  "requiredFields": [
    "node",
    "baseline",
    "routingInput",
    "rule",
    "outcome",
    "checkpoint"
  ],
  "recordedAt": "2026-08-01T09:56:09.794Z"
}
```

## 2026-08-01T10:06:05.564Z — n1a — PASS

```json
{
  "version": 1,
  "node": "n1a",
  "baseline": "gate-1-baseline-rev1",
  "routingInput": {
    "node": "n1a",
    "baseline": "gate-1-baseline-rev1",
    "requestedBaseline": "gate-1-baseline-rev1",
    "checks": [
      "typecheck",
      "lint",
      "test",
      "build"
    ],
    "scenarioSet": "scenario:n1a",
    "baselineUntracked": [
      {
        "path": "fb_plan_graph.md",
        "sha256": "4f6b82406d32808cbc34d8ef23bdd4e0727c9bde9565bdddc0c0b1fd22d60dfc"
      }
    ],
    "requiredEvidenceArtifacts": [
      "records/approvals/gate-1-baseline-rev1.md",
      "records/contracts/attachment-primitive.md",
      "records/contracts/collision-matrix.md",
      "records/contracts/fixed-step-policy.md",
      "records/contracts/performance-thresholds.md"
    ],
    "requiredEvidenceFields": [
      "node",
      "baseline",
      "routingInput",
      "rule",
      "outcome",
      "checkpoint"
    ],
    "dryRun": false
  },
  "rule": "all required gate rules passed; gate-log.md is gate-owned output",
  "outcome": "PASS",
  "checkpoint": "n1a:PASS:2026-08-01T10:05:46.557Z",
  "protectedDiff": [],
  "missingEvidence": [],
  "checks": [
    {
      "name": "typecheck",
      "command": "npm run typecheck",
      "status": 0,
      "passed": true
    },
    {
      "name": "lint",
      "command": "npm run lint",
      "status": 0,
      "passed": true
    },
    {
      "name": "test",
      "command": "npm run test",
      "status": 0,
      "passed": true
    },
    {
      "name": "build",
      "command": "npm run build",
      "status": 0,
      "passed": true
    },
    {
      "name": "scenario-set",
      "command": "npm run scenario:n1a",
      "status": 0,
      "passed": true
    }
  ],
  "requiredFields": [
    "node",
    "baseline",
    "routingInput",
    "rule",
    "outcome",
    "checkpoint"
  ],
  "recordedAt": "2026-08-01T10:06:05.564Z"
}
```
