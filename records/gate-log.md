
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

## 2026-08-01T12:54:33.762Z — n1a — BLOCKED

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
  "rule": "BLOCK promotion: protected-file modification detected: docs/design/n2-approval-rev1.md, docs/design/n2-visual-design.md, docs/design/n2-visual-gate-sheet.md, docs/scene/n3-static-scene.md, fb_plan_graph.md, records/approvals/gate-2-n3-approved.md, records/evidence/n3-review-camera.png, records/evidence/n3-runtime-report.md, src/App.tsx, src/animation/pose-animation.ts, src/assets/manifest.ts, src/assets/registry.ts, src/claw/pose-adapter.ts, src/claw/rig.ts, src/evidence/n3-evidence.ts, src/evidence/n3-runtime-report.json, src/evidence/n3.test.ts, src/evidence/n4-evidence.ts, src/evidence/n4-runtime-report.json, src/evidence/n4.test.ts, src/evidence/n5-evidence.ts, src/evidence/n5.test.ts, src/physics/config.ts, src/scene/N3Canvas.tsx, src/scene/StaticScene.tsx, src/scene/config.ts, src/scene/report.ts, src/state/controller.ts, src/effects/n7-coordinator.ts, src/evidence/n6-evidence.ts, src/evidence/n6-runtime-report.json, src/evidence/n6.test.ts, src/evidence/n7-evidence.ts, src/evidence/n7.test.ts, src/physics/adapter.ts",
  "outcome": "BLOCKED",
  "checkpoint": "n1a:BLOCKED:2026-08-01T12:54:33.639Z",
  "protectedDiff": [
    "docs/design/n2-approval-rev1.md",
    "docs/design/n2-visual-design.md",
    "docs/design/n2-visual-gate-sheet.md",
    "docs/scene/n3-static-scene.md",
    "fb_plan_graph.md",
    "records/approvals/gate-2-n3-approved.md",
    "records/evidence/n3-review-camera.png",
    "records/evidence/n3-runtime-report.md",
    "src/App.tsx",
    "src/animation/pose-animation.ts",
    "src/assets/manifest.ts",
    "src/assets/registry.ts",
    "src/claw/pose-adapter.ts",
    "src/claw/rig.ts",
    "src/evidence/n3-evidence.ts",
    "src/evidence/n3-runtime-report.json",
    "src/evidence/n3.test.ts",
    "src/evidence/n4-evidence.ts",
    "src/evidence/n4-runtime-report.json",
    "src/evidence/n4.test.ts",
    "src/evidence/n5-evidence.ts",
    "src/evidence/n5.test.ts",
    "src/physics/config.ts",
    "src/scene/N3Canvas.tsx",
    "src/scene/StaticScene.tsx",
    "src/scene/config.ts",
    "src/scene/report.ts",
    "src/state/controller.ts",
    "src/effects/n7-coordinator.ts",
    "src/evidence/n6-evidence.ts",
    "src/evidence/n6-runtime-report.json",
    "src/evidence/n6.test.ts",
    "src/evidence/n7-evidence.ts",
    "src/evidence/n7.test.ts",
    "src/physics/adapter.ts"
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
  "recordedAt": "2026-08-01T12:54:33.762Z"
}
```

## 2026-08-01T13:17:25Z — n8 — BLOCKED_PENDING_N9

```json
{
  "version": 1,
  "node": "n8",
  "baseline": "gate-6-integration",
  "routingInput": {
    "node": "n8",
    "baseline": "gate-6-integration",
    "resolvedCheckout": "884038358cbc9a5de9e1487e576d4e4a214145e2",
    "baselineRefPresent": false,
    "loopType": "fan-out of goal-based nodes (parallel, independent)",
    "verifiers": ["visual", "state", "assets", "physics", "regression", "performance"],
    "requiredEvidenceArtifacts": [
      "records/evidence/n8-visual.json",
      "records/evidence/n8-state.json",
      "records/evidence/n8-assets.json",
      "records/evidence/n8-physics.json",
      "records/evidence/n8-regression.json",
      "records/evidence/n8-performance.json",
      "records/evidence/n8-rounds.json",
      "records/evidence/n8-merged.json"
    ],
    "cleanRoundsRequired": 2,
    "noNewFindingRoundsAchieved": 2,
    "proofComplete": false
  },
  "rule": "BLOCK promotion pending N9: unresolved evidence gaps and baseline precondition; no-new-finding rounds converged, but required proof is incomplete; rejected false positive was routed out",
  "outcome": "BLOCKED_PENDING_N9",
  "checkpoint": "n8:BLOCKED_PENDING_N9:2026-08-01T13:17:25Z",
  "protectedDiff": [],
  "missingEvidence": [],
  "preconditions": [
    {"id":"N8-P-001","routing":"escalate","status":"unresolved","reason":"declared gate-6-integration ref is absent"}
  ],
  "findings": [
    {"id":"N8-F-001","routing":"escalate","status":"unresolved","reason":"browser visual interaction proof unavailable"},
    {"id":"N8-F-002","routing":"reject","status":"resolved-rejected","reason":"exact-equality verifier false positive; approved tolerance passes"},
    {"id":"N8-F-003","routing":"escalate","status":"unresolved","reason":"browser FPS/frame-budget/physics-step metrics unmeasured"},
    {"id":"N8-F-004","routing":"escalate","status":"unresolved","reason":"production bundle exceeds Vite default warning size"}
  ],
  "checks": [
    {"name":"visual-verifier-rounds","passed":false,"detail":"deterministic N7/HTTP checks passed; browser structured report unavailable twice; proofComplete=false"},
    {"name":"state-verifier-rounds","passed":true,"detail":"N5/N7 plus tolerance-based all-boundary probe passed in two clean rounds"},
    {"name":"assets-verifier-rounds","passed":true,"detail":"N3/bootstrap 11 tests passed in three rounds"},
    {"name":"physics-verifier-rounds","passed":true,"detail":"N6 6 tests passed in three rounds; false-positive grip rejected"},
    {"name":"regression-verifier-rounds","passed":true,"detail":"full suite 6 files and 42 tests passed in three rounds"},
    {"name":"performance-verifier-rounds","passed":false,"detail":"build/timing passed; browser thresholds unmeasured; 3057.72 kB minified chunk warning; proofComplete=false"}
  ],
  "requiredFields": ["node","baseline","routingInput","rule","outcome","checkpoint"],
  "recordedAt": "2026-08-01T13:17:25Z"
}
```

## 2026-08-01T13:57:24.000Z — n9 — COMMITTED

```json
{
  "version": 1,
  "node": "n9",
  "baseline": "gate-1-baseline-rev1",
  "commit": "67e277c",
  "routingInput": {
    "node": "n9",
    "baseline": "gate-1-baseline-rev1",
    "checks": [
      "typecheck",
      "lint",
      "test",
      "build"
    ],
    "scenarioSet": "scenario:n9",
    "requiredEvidenceArtifacts": [],
    "requiredEvidenceFields": [
      "node",
      "baseline",
      "routingInput",
      "rule",
      "outcome",
      "checkpoint"
    ]
  },
  "rule": "commit resolves every finding in bug_fixes_needed.md; typecheck, lint, build, and 50 tests pass",
  "outcome": "COMMITTED",
  "checkpoint": "n9:COMMITTED:2026-08-01T13:57:24.000Z",
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
      "command": "npm test",
      "status": 0,
      "passed": true
    },
    {
      "name": "build",
      "command": "npm run build",
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
  "recordedAt": "2026-08-01T13:57:24.000Z"
}
```
