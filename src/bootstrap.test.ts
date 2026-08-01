import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import pkg from '../package.json'

const scripts: Record<string, string> = pkg.scripts

const requiredScripts = [
  'dev',
  'build',
  'typecheck',
  'lint',
  'format',
  'format:check',
  'test',
  'test:watch',
  'preview',
]

describe('Gate 0 baseline contracts', () => {
  it('defines the required npm scripts', () => {
    for (const script of requiredScripts) {
      expect(scripts[script], `missing script: ${script}`).toBeTruthy()
    }
  })

  it('records a lockfile', () => {
    const lockfile = readFileSync(
      join(import.meta.dirname, '../package-lock.json'),
      'utf-8',
    )
    expect(lockfile).toContain('lockfileVersion')
  })

  it('pins every dependency to an exact version', () => {
    const allDeps = { ...pkg.dependencies, ...pkg.devDependencies }
    for (const [name, version] of Object.entries(allDeps)) {
      expect(
        version,
        `dependency "${name}" is not exact-pinned: ${version}`,
      ).toMatch(/^\d+\.\d+\.\d+$/)
    }
  })
})
