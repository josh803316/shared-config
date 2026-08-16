#!/usr/bin/env bun

/**
 * Installs (or updates) shared git hooks from @josh803316/shared-config into the
 * consuming project's .husky directory.
 *
 * Behaviour:
 *   - Creates missing hooks automatically.
 *   - Overwrites stale hooks whose content no longer matches the expected delegate line.
 *   - Pass --force to unconditionally overwrite all hooks.
 *
 * Usage:
 *   bun scripts/install-husky-hooks.ts           # install / update changed hooks
 *   bun scripts/install-husky-hooks.ts --force   # force-overwrite all hooks
 */

import fs from 'fs'
import path from 'path'

const FORCE = process.argv.includes('--force')

const getProjectRoot = (): string => process.env.INIT_CWD ?? process.cwd()

const getSharedConfigPath = (): string =>
  path.join(getProjectRoot(), 'node_modules', '@josh803316', 'shared-config')

const buildHookContent = (hook: string): string =>
  `#!/bin/sh\nnode_modules/@josh803316/shared-config/.husky/${hook} "$@"\n`

/** Returns true when the file needs to be (re)written. */
const needsWrite = (filePath: string, _expectedContent: string): boolean => {
  if (!fs.existsSync(filePath)) return true
  if (FORCE) return true
  // Overwrite if the delegating line is missing (e.g. stale hook from a previous version)
  const existing = fs.readFileSync(filePath, 'utf8')
  return !existing.includes('node_modules/@josh803316/shared-config/.husky/')
}

const writeHook = (filePath: string, content: string): void => {
  const existed = fs.existsSync(filePath)
  fs.writeFileSync(filePath, content, { mode: 0o755 })
  console.log(
    existed ? `  Updated  ${path.basename(filePath)}` : `  Created  ${path.basename(filePath)}`
  )
}

const getHookNames = (huskyDir: string): string[] => {
  try {
    return fs
      .readdirSync(huskyDir)
      .filter((f) => !f.startsWith('.') && !f.startsWith('_'))
      .filter((f) => fs.statSync(path.join(huskyDir, f)).isFile())
  } catch (error) {
    console.error(
      `Error reading .husky directory: ${error instanceof Error ? error.message : String(error)}`
    )
    return []
  }
}

const main = (): void => {
  const projectRoot = getProjectRoot()
  const sharedConfigPath = getSharedConfigPath()
  const targetDir = path.join(projectRoot, '.husky')

  console.log('\nInstalling husky hooks from @josh803316/shared-config…')
  console.log(`  Project root : ${projectRoot}`)
  console.log(`  Force mode   : ${FORCE ? 'yes' : 'no'}\n`)

  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true })
  }

  const sharedHuskyDir = path.join(sharedConfigPath, '.husky')
  const hooks = getHookNames(sharedHuskyDir)

  if (hooks.length === 0) {
    console.warn('  No hooks found in shared-config — nothing to install.')
    return
  }

  let written = 0
  let skipped = 0

  for (const hook of hooks) {
    const dest = path.join(targetDir, hook)
    const content = buildHookContent(hook)
    if (needsWrite(dest, content)) {
      writeHook(dest, content)
      written++
    } else {
      console.log(`  Skipped  ${hook} (already up-to-date)`)
      skipped++
    }
  }

  console.log(`\nDone. ${written} written, ${skipped} skipped.\n`)
}

main()
