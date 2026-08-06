/* global console, process */

/**
 * N51 (F-11) build gate. Builds an explicit player bundle with VITE_OPS=0
 * and an operator bundle with VITE_OPS=1, then asserts the ops marker is
 * absent from the former and present in the latter.
 * Exit 0 = both build-gate sides pass; non-zero = broken gate.
 */
import { execFileSync } from 'node:child_process'
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const repoRoot = process.cwd()
const MARKER = 'claw-ops-v1'
const prodOutDir = await mkdtemp(join(tmpdir(), 'claw-prod-gate-'))
const opsOutDir = await mkdtemp(join(tmpdir(), 'claw-ops-gate-'))

async function markerHits(outDir) {
  const assets = await readdir(join(outDir, 'assets'))
  const hits = []
  for (const name of assets.filter((entry) => entry.endsWith('.js'))) {
    const source = await readFile(join(outDir, 'assets', name), 'utf8')
    if (source.includes(MARKER)) hits.push(name)
  }
  return hits
}

try {
  execFileSync('npm', ['run', 'build', '--', '--outDir', prodOutDir], {
    cwd: repoRoot,
    stdio: 'inherit',
    env: { ...process.env, VITE_OPS: '0' },
  })
  const prodHits = await markerHits(prodOutDir)
  if (prodHits.length !== 0) {
    throw new Error(
      `ops-gate FAIL: marker '${MARKER}' found in player build: ${prodHits.join(', ')}`,
    )
  }
  console.log(`ops-gate PASS: marker '${MARKER}' absent from player build`)

  execFileSync('npm', ['run', 'build', '--', '--outDir', opsOutDir], {
    cwd: repoRoot,
    stdio: 'inherit',
    env: { ...process.env, VITE_OPS: '1' },
  })
  const opsHits = await markerHits(opsOutDir)
  if (opsHits.length === 0) {
    throw new Error(`ops-gate FAIL: marker '${MARKER}' absent from the ops build`)
  }
  console.log(`ops-gate PASS: marker '${MARKER}' present in ${opsHits.join(', ')}`)
} finally {
  await Promise.all([
    rm(prodOutDir, { recursive: true, force: true }),
    rm(opsOutDir, { recursive: true, force: true }),
  ])
}
