#!/usr/bin/env node
/**
 * Profile matrix: prove the bundle installs and composes in every shipped DSH
 * profile, not only in the Web GUI. Each run uses a throwaway DSH_HOME, so the
 * user's real harness is never touched.
 *
 *   node scripts/test-profiles.mjs                 # web, headless, sdk, acp
 *   node scripts/test-profiles.mjs --keep          # keep temp homes for inspection
 *   DSH_BIN=/path/to/dsh node scripts/test-profiles.mjs
 */
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const DSH = process.env.DSH_BIN || 'dsh'
const KEEP = process.argv.includes('--keep')
const TEMPLATES = ['web', 'headless', 'sdk', 'acp']
const ROW = 'openrouter-explorer-free'

function run(args, env) {
  return execFileSync(DSH, args, {
    cwd: REPO,
    env: { ...process.env, ...env },
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 180_000,
  })
}

function check(template) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), `dsh-orx-${template}-`))
  const profile = `${template}-orx-test`
  const env = { DSH_HOME: home }
  const steps = []
  try {
    run(['--profile', profile, '--from-default-profile', template, '--dump-config'], env)
    steps.push('profile created')
    run(['plugin', '--profile', profile, 'add', REPO], env)
    steps.push('bundle installed')
    const config = run(['--profile', profile, '--dump-config'], env)
    if (!config.includes(ROW)) throw new Error(`row "${ROW}" is missing from the composed config`)
    steps.push('row composed')
    return { template, ok: true, steps }
  } catch (error) {
    const detail = String(error?.stderr || error?.message || error).trim().split('\n').slice(-4).join(' | ')
    return { template, ok: false, steps, error: detail }
  } finally {
    if (!KEEP) fs.rmSync(home, { recursive: true, force: true })
    else console.log(`  kept: ${home}`)
  }
}

console.log(`OpenRouter Explorer Free — profile matrix (dsh: ${DSH})\n`)
const results = TEMPLATES.map(check)
for (const result of results) {
  console.log(`${result.ok ? 'PASS' : 'FAIL'}  ${result.template.padEnd(9)} ${result.steps.join(' → ')}${result.error ? `\n      ${result.error}` : ''}`)
}
const failed = results.filter((result) => !result.ok)
console.log(`\n${results.length - failed.length}/${results.length} profiles passed`)
process.exit(failed.length === 0 ? 0 : 1)
