#!/usr/bin/env bun

/**
 * Packed-tarball consumer verification.
 *
 * Regression guard for "the package published is incomplete" failures. Packs the
 * current source tree, installs that tarball into a throwaway fixture consumer,
 * then verifies that EVERY exported path and every shipped file resolves from a
 * real consumer checkout — the same way a downstream @josh803316 repo consumes it.
 *
 * Testing against the source checkout alone does not catch missing-from-tarball
 * defects, so this harness is the release gate: run it before publish.
 *
 * Usage:
 *   bun scripts/verify-package.ts          # full pack → fixture install → export check
 *
 * Exit codes: 0 = all exports + hooks resolve; non-zero = a defect was found.
 */

import { execSync, spawnSync } from 'child_process'
import fs from 'fs'
import { createRequire } from 'module'
import os from 'os'
import path from 'path'

const require = createRequire(import.meta.url)
const ROOT = path.resolve(import.meta.dirname, '..')
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'shared-config-verify-'))
const FIXTURE = path.join(TMP, 'fixture')

const SHIPPED_FILES = [
  'biome.json',
  'lint-staged.config.js',
  'tsconfig/base.json',
  'tsconfig/api.json',
  'tsconfig/bun.json',
  'tsconfig/ui.json',
  'tsconfig/node-esm.json',
  'tsconfig/node-cjs.json',
  'tsconfig/test.json',
  'tsconfig/migration.json',
  'bin/commit-msg.ts',
  'bin/pre-commit.ts',
  '.husky/commit-msg',
  '.husky/pre-commit',
  'scripts/install-husky-hooks.ts',
]

const EXPORTS = Object.entries(
  (require(path.join(ROOT, 'package.json')) as { exports: Record<string, string> }).exports
)

const failures: string[] = []
let passed = 0

// Hoisted regexes (biome: useTopLevelRegex)
const TSCONFIG_FILE = /tsconfig/
const DELEGATE_REF = /bin\/(\S+\.ts)/

/** Strips JSONC `//` comments (full-line and trailing) while respecting quoted
 *  strings, so URLs like "https://…" and `//` inside values survive. */
const stripJsonComments = (src: string): string => {
  let out = ''
  let inString = false
  for (let i = 0; i < src.length; i++) {
    const c = src[i] as string
    const next = src[i + 1]
    if (inString) {
      out += c
      if (c === '\\') {
        out += next ?? ''
        i++
      } else if (c === '"') {
        inString = false
      }
      continue
    }
    if (c === '"') {
      inString = true
      out += c
      continue
    }
    if (c === '/' && next === '/') {
      while (i < src.length && src[i] !== '\n') i++
      if (i < src.length) out += '\n'
      continue
    }
    out += c
  }
  return out
}

const pkgDir = (): string => path.join(FIXTURE, 'node_modules', '@josh803316', 'shared-config')

const step = (msg: string): void => {
  console.info(`\n── ${msg} ──`)
}

const pass = (msg: string): void => {
  passed++
  console.info(`  ✅ ${msg}`)
}

const fail = (msg: string): void => {
  failures.push(msg)
  console.error(`  ❌ ${msg}`)
}

const main = (): void => {
  step('1/4  Pack the package')
  const packOut = execSync(`bun pm pack --destination "${TMP}"`, { cwd: ROOT, encoding: 'utf8' })
  // The tarball path is the line ending in .tgz (pack prints it last, but the
  // `prepare`/husky hook may interleave output, so scan for it explicitly).
  const tarballPath = packOut
    .split('\n')
    .map((l) => l.trim())
    .find((l) => l.endsWith('.tgz'))
  if (!tarballPath) {
    console.error(`no .tgz path found in pack output:\n${packOut}`)
    process.exit(1)
  }
  if (!fs.existsSync(tarballPath)) {
    console.error(`pack output not found at ${tarballPath}\n${packOut}`)
    process.exit(1)
  }
  pass(`packed ${path.basename(tarballPath)}`)

  step('2/4  Install tarball into a fixture consumer')
  fs.mkdirSync(FIXTURE, { recursive: true })
  // Track the tarball as a file: dependency so bun installs the exact packed
  // artifact (not a registry fetch), just like a real consumer would resolve it.
  fs.writeFileSync(
    path.join(FIXTURE, 'package.json'),
    JSON.stringify({
      name: 'fixture',
      version: '0.0.0',
      private: true,
      devDependencies: {
        '@josh803316/shared-config': `file:${tarballPath}`,
        typescript: '^7.0.2',
      },
    })
  )
  execSync('bun install --registry=https://registry.npmjs.org 2>&1', {
    cwd: FIXTURE,
    stdio: 'inherit',
    encoding: 'utf8',
  })
  const installed = pkgDir()
  if (!fs.existsSync(installed)) {
    fail('package did not install into fixture')
    finish()
    return
  }
  pass('tarball installed into fixture')

  step('3/4  Verify shipped files exist in the tarball install')
  for (const file of SHIPPED_FILES) {
    if (fs.existsSync(path.join(installed, file))) pass(`shipped ${file}`)
    else fail(`missing from tarball: ${file}`)
  }

  step('4/4  Resolve every exports entry from the fixture')
  for (const [key, rel] of EXPORTS) {
    const target = path.join(installed, rel)
    if (!fs.existsSync(target)) {
      fail(`export "${key}" → ${rel} MISSING`)
      continue
    }
    // JSON tsconfigs (under tsconfig/) are JSONC with // comments — require() cannot
    // read them, but tsc can. Resolve them as tsconfigs: run the fixture's real
    // TypeScript compiler with --showConfig so invalid compiler options and
    // unresolved `extends` chains are caught, not just checked for shape. Non-tsconfig
    // exports (biome.json, lint-staged.config.js) load normally via require().
    const isTsconfig = TSCONFIG_FILE.test(rel)
    if (isTsconfig) {
      // Fast shape pre-check (JSONC comment-stripped) before invoking the compiler.
      try {
        const raw = fs.readFileSync(target, 'utf8')
        const parsed = JSON.parse(stripJsonComments(raw)) as {
          extends?: string
          compilerOptions?: object
        }
        if (!('extends' in parsed || 'compilerOptions' in parsed || 'references' in parsed)) {
          fail(`export ${key} → ${rel} does not look like a tsconfig`)
          continue
        }
      } catch (err) {
        fail(`export ${key} → ${rel} invalid JSONC: ${String(err)}`)
        continue
      }
      // Full compiler validation: tsc --showConfig resolves `extends` and all
      // compilerOptions, exiting non-zero on invalid options or a broken chain.
      const tscBin = path.join(FIXTURE, 'node_modules', '.bin', 'tsc')
      const compilerRun = spawnSync(tscBin, ['--showConfig', '--project', target, '--noEmit'], {
        cwd: FIXTURE,
        encoding: 'utf8',
      })
      if (compilerRun.status === 0) {
        pass(`export ${key} → ${rel} compiles via tsc --showConfig`)
      } else {
        fail(
          `export ${key} → ${rel} compiler validation FAILED (exit ${String(compilerRun.status)}):\n` +
            `${(compilerRun.stderr || compilerRun.stdout || '').trim().slice(0, 400)}`
        )
      }
      continue
    }
    // Non-tsconfig must load via require()
    try {
      require(target)
      pass(`export ${key} → ${rel} resolves + loads`)
    } catch (err) {
      fail(`export ${key} → ${rel} FAILED to load: ${String(err)}`)
    }
  }

  step('Hook targets sanity check')
  const commitHook = path.join(installed, '.husky', 'commit-msg')
  const preCommitHook = path.join(installed, '.husky', 'pre-commit')

  // (1) Resolution: each shipped hook must compute its package root from its own
  // location and reach the delegate bin/*.ts. Simulate the hook's root math from
  // the installed location and confirm the delegate exists there.
  for (const hook of [commitHook, preCommitHook]) {
    const body = fs.readFileSync(hook, 'utf8')
    const delegateName = DELEGATE_REF.exec(body)?.[1]
    const resolvedRoot = path.dirname(path.dirname(hook)) // .husky/<x> → package root
    if (delegateName && fs.existsSync(path.join(resolvedRoot, 'bin', delegateName ?? ''))) {
      pass(`${path.basename(hook)} resolves ${delegateName} at its own package root`)
    } else {
      fail(`${path.basename(hook)} does not resolve a shipped bin/*.ts delegate`)
    }
  }

  // (2) Runtime: execute the shipped commit-msg hook for real in the fixture with
  // a valid conventional message. This exercises the full bin/commit-msg.ts path —
  // resolution, arg passing, and validation — catching the "broken consumer commit"
  // class of defect that forced --no-verify.
  const validMsg = path.join(FIXTURE, 'good-commit.txt')
  fs.writeFileSync(validMsg, 'feat: verify hook end to end\n')
  const commitRun = execSync(`sh "${commitHook}" "${validMsg}"`, {
    cwd: FIXTURE,
    encoding: 'utf8',
  })
  pass(
    `shipped commit-msg hook executes bin/commit-msg.ts in a consumer (${commitRun.trim().split('\n').pop()})`
  )

  // (3) Runtime: execute the shipped pre-commit hook in the fixture and assert a
  // non-zero exit when its delegate cannot run. This proves the hook (a) actually
  // invokes bin/pre-commit.ts (not just resolves it) and (b) propagates failure —
  // covering the bin/pre-commit.ts `status:null → silent success` bug.
  const bareDir = path.join(FIXTURE, 'no-lint-staged')
  fs.mkdirSync(bareDir, { recursive: true })
  fs.writeFileSync(
    path.join(bareDir, 'package.json'),
    JSON.stringify({ name: 'no-lint-staged', version: '0.0.0', private: true })
  )
  const failRun = spawnSync('sh', [preCommitHook], {
    cwd: bareDir, // a consumer without lint-staged → bunx lint-staged must fail
    encoding: 'utf8',
  })
  if (failRun.status !== null && failRun.status !== 0) {
    pass(
      `shipped pre-commit hook invokes its delegate and propagates non-zero exit (got ${failRun.status})`
    )
  } else {
    fail(
      `shipped pre-commit hook did NOT propagate failure (exit ${String(failRun.status)}, error: ${String(failRun.error ?? 'none')}) — the status:null→0 bug is live`
    )
  }

  finish()
}

const finish = (): void => {
  console.info(`\n${passed} checks passed, ${failures.length} failed.`)
  try {
    fs.rmSync(TMP, { recursive: true, force: true })
  } catch {
    // best-effort tmp cleanup
  }
  if (failures.length > 0) {
    console.error(`\nPACKAGE VERIFICATION FAILED:\n${failures.map((f) => `  - ${f}`).join('\n')}`)
    process.exit(1)
  }
  console.info('\n✅ Packed package is complete and resolvable.')
}

void main()
