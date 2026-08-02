/* global console, process */

import { access, appendFile, mkdir } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { readFileSync, realpathSync } from 'node:fs'
import { execFileSync, spawnSync } from 'node:child_process'
import { dirname, isAbsolute, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm'
const gateLogPath = join(repoRoot, 'records', 'gate-log.md')
const defaultBaseline = 'opt-baseline-2'
const defaultChecks = ['typecheck', 'lint', 'test', 'build']
const defaultScenarioScript = 'scenario:n1a'
// Gate-owned output is the only records/ exception to the implementation allowlist.
// fb_plan_graph.md was archived to docs/archive/m1/ on 2026-08-02; the gate no longer pins it.
const baselineUntrackedManifest = []
const defaultEvidenceArtifacts = [
  'records/approvals/gate-1-baseline-rev1.md',
  'records/contracts/attachment-primitive.md',
  'records/contracts/collision-matrix.md',
  'records/contracts/fixed-step-policy.md',
  'records/contracts/performance-thresholds.md',
]
const defaultRequiredFields = [
  'node',
  'baseline',
  'routingInput',
  'rule',
  'outcome',
  'checkpoint',
]
const repoRootRealPath = realpathSync(repoRoot)

const args = process.argv.slice(2)
const node = (args.find((arg) => !arg.startsWith('--')) ?? '').toLowerCase()
const dryRun = args.includes('--dry-run') || process.env.GATE_DRY_RUN === '1'
const syntheticProtectedFile =
  valueAfter('--synthetic-protected-file') ??
  process.env.GATE_SYNTHETIC_PROTECTED_FILE ??
  ''

if (!node) {
  console.error('Usage: npm run gate:<node> [-- --dry-run]')
  process.exitCode = 2
} else {
  await runGate()
}

function valueAfter(flag) {
  const index = args.indexOf(flag)
  return index >= 0 ? args[index + 1] : undefined
}

async function runGate() {
  const requestedBaseline = process.env.GATE_BASELINE ?? defaultBaseline
  const baseline = defaultBaseline
  const baselineUntracked = baselineUntrackedManifest
  const startedAt = new Date().toISOString()
  const checkResults = []
  let checks = defaultChecks
  let scenarioScript = defaultScenarioScript
  let evidenceArtifacts = defaultEvidenceArtifacts
  let requiredFields = defaultRequiredFields
  let failureReason = ''
  let protectedDiff = []
  let missingEvidence = []

  try {
    if (requestedBaseline !== baseline) {
      throw new Error(
        `baseline is fixed at ${baseline}; received ${requestedBaseline}`,
      )
    }
    checks = parseRequiredList(process.env.GATE_CHECKS, defaultChecks, 'checks')
    scenarioScript = process.env.GATE_SCENARIO_SCRIPT || defaultScenarioScript
    if (scenarioScript !== `scenario:${node}`) {
      throw new Error(
        `scenario script must be scenario:${node}; received ${scenarioScript}`,
      )
    }
    evidenceArtifacts = parseRequiredList(
      process.env.GATE_REQUIRED_ARTIFACTS,
      defaultEvidenceArtifacts,
      'evidence artifacts',
    )
    requiredFields = parseRequiredList(
      process.env.GATE_REQUIRED_FIELDS,
      defaultRequiredFields,
      'evidence fields',
    )
    assertBaseline(baseline)

    protectedDiff = findProtectedDiff(
      baseline,
      syntheticProtectedFile,
      baselineUntracked,
    )
    if (protectedDiff.length > 0) {
      failureReason = `protected-file modification detected: ${protectedDiff.join(', ')}`
    }

    missingEvidence = await missingEvidenceFiles(evidenceArtifacts)
    if (!failureReason && missingEvidence.length > 0) {
      failureReason = `missing required evidence artifacts: ${missingEvidence.join(', ')}`
    }

    if (!failureReason && !dryRun) {
      for (const script of checks) {
        const result = runNpmScript(script)
        checkResults.push(result)
        if (result.status !== 0) {
          failureReason = `${script} failed with exit code ${result.status}`
          break
        }
      }

      if (!failureReason) {
        const result = runNpmScript(scenarioScript, 'scenario-set')
        checkResults.push(result)
        if (result.status !== 0) {
          failureReason = `${scenarioScript} scenario set failed with exit code ${result.status}`
        }
      }
    }
  } catch (error) {
    failureReason = error instanceof Error ? error.message : String(error)
  }

  const routingInput = {
    node,
    baseline,
    requestedBaseline,
    checks,
    scenarioSet: scenarioScript,
    baselineUntracked,
    requiredEvidenceArtifacts: evidenceArtifacts,
    requiredEvidenceFields: requiredFields,
    dryRun,
  }
  const passed = !failureReason
  const outcome = dryRun
    ? passed
      ? 'DRY_RUN_PASS'
      : 'BLOCKED'
    : passed
      ? 'PASS'
      : 'BLOCKED'
  const record = {
    version: 1,
    node,
    baseline,
    routingInput,
    rule: passed
      ? 'all required gate rules passed; gate-log.md is gate-owned output'
      : `BLOCK promotion: ${failureReason}`,
    outcome,
    checkpoint: `${node}:${outcome}:${startedAt}`,
    protectedDiff,
    missingEvidence,
    checks: checkResults,
    requiredFields,
    recordedAt: new Date().toISOString(),
  }
  const missingFields = requiredFields.filter(
    (field) => record[field] === undefined || record[field] === '',
  )
  if (!failureReason && missingFields.length > 0) {
    failureReason = `missing required evidence fields: ${missingFields.join(', ')}`
    record.rule = `BLOCK promotion: ${failureReason}`
    record.outcome = 'BLOCKED'
  }
  record.checkpoint = `${node}:${record.outcome}:${startedAt}`

  try {
    await writeRecord(record)
  } catch (error) {
    console.error(
      `Unable to write ${relative(repoRoot, gateLogPath)}:`,
      error instanceof Error ? error.message : String(error),
    )
    process.exitCode = 1
    return
  }

  console.log(`Gate ${node}: ${record.outcome}`)
  if (failureReason) {
    console.error(`Promotion blocked: ${failureReason}`)
    process.exitCode = 1
  } else if (dryRun) {
    console.log('Dry run only; no promotion was attempted.')
  }
}

function parseList(value, fallback) {
  if (!value) return [...fallback]
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

function parseRequiredList(value, required, label) {
  const parsed = parseList(value, required)
  const missing = required.filter((item) => !parsed.includes(item))
  if (missing.length > 0) {
    throw new Error(`required ${label} omitted: ${missing.join(', ')}`)
  }
  return parsed
}

function assertBaseline(baseline) {
  git(['rev-parse', '--verify', `${baseline}^{commit}`])
}

function findProtectedDiff(baseline, syntheticPath, baselineUntracked) {
  const changedPaths = [
    ...git(['diff', '--name-only', baseline, '--']).split('\n'),
    ...git(['diff', '--cached', '--name-only', baseline, '--']).split('\n'),
  ]
    .map((path) => path.trim())
    .filter(Boolean)
  const violations = changedPaths.filter((path) => !isAllowedPath(path))
  const untrackedPaths = git([
    'status',
    '--porcelain=v1',
    '--untracked-files=all',
  ])
    .split('\n')
    .filter((line) => line.startsWith('?? '))
    .map((line) => line.slice(3).trim())
    .filter(Boolean)

  for (const path of untrackedPaths) {
    const baselineEntry = baselineUntracked.find((entry) => entry.path === path)
    if (baselineEntry) {
      if (sha256(join(repoRoot, path)) !== baselineEntry.sha256) {
        violations.push(`${path} (baseline hash mismatch)`)
      }
    } else if (!isAllowedPath(path)) {
      violations.push(path)
    }
  }
  for (const entry of baselineUntracked) {
    if (
      !untrackedPaths.includes(entry.path) &&
      !changedPaths.includes(entry.path)
    ) {
      violations.push(`${entry.path} (baseline file missing)`)
    }
  }

  if (syntheticPath) violations.push(syntheticPath)

  if (changedPaths.includes('package.json')) {
    const baselinePackage = JSON.parse(
      git(['show', `${baseline}:package.json`]),
    )
    const currentPackage = JSON.parse(readText(join(repoRoot, 'package.json')))
    if (withoutScripts(baselinePackage) !== withoutScripts(currentPackage)) {
      violations.push('package.json (outside scripts block)')
    }
  }

  return [...new Set(violations)]
}

function sha256(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex')
}

function isAllowedPath(path) {
  return (
    path === 'package.json' ||
    path === 'records/gate-log.md' ||
    /^scripts\/gate[^/]*\.mjs$/.test(path)
  )
}

function withoutScripts(packageJson) {
  const copy = { ...packageJson }
  delete copy.scripts
  return JSON.stringify(stableJson(copy))
}

function stableJson(value) {
  if (Array.isArray(value)) return value.map(stableJson)
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, stableJson(entry)]),
    )
  }
  return value
}

function git(argumentsList) {
  return execFileSync('git', argumentsList, {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim()
}

function readText(path) {
  return readFileSync(path, 'utf8')
}

async function missingEvidenceFiles(paths) {
  const missing = []
  for (const path of paths) {
    const absolutePath = resolve(repoRoot, path)
    if (!isWithinRepo(absolutePath)) {
      missing.push(`${path} (outside repository)`)
      continue
    }
    try {
      await access(absolutePath)
      const resolvedPath = realpathSync(absolutePath)
      if (!isWithinRepo(resolvedPath)) {
        missing.push(`${path} (outside repository)`)
        continue
      }
      if (readFileSync(resolvedPath, 'utf8').trim().length === 0) {
        missing.push(`${path} (empty)`)
      }
    } catch {
      missing.push(path)
    }
  }
  return missing
}

function isWithinRepo(path) {
  const relativePath = relative(repoRootRealPath, path)
  return (
    relativePath === '' ||
    (!relativePath.startsWith('..') && !isAbsolute(relativePath))
  )
}

function runNpmScript(script, label = script) {
  console.log(`\n[gate] npm run ${script}`)
  const result = spawnSync(npmCommand, ['run', script], {
    cwd: repoRoot,
    env: process.env,
    stdio: 'inherit',
  })
  const status = result.status ?? 1
  return {
    name: label,
    command: `npm run ${script}`,
    status,
    passed: status === 0,
  }
}

async function writeRecord(record) {
  await mkdir(join(repoRoot, 'records'), { recursive: true })
  const markdown = [
    `\n## ${record.recordedAt} — ${record.node} — ${record.outcome}`,
    '',
    '```json',
    JSON.stringify(record, null, 2),
    '```',
    '',
  ].join('\n')
  await appendFile(gateLogPath, markdown, 'utf8')
}
