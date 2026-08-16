#!/usr/bin/env bun

// Runs lint-staged to format/lint only staged files before committing.
// lint-staged config lives in lint-staged.config.js.
import { spawnSync } from 'child_process'

const result = spawnSync('bunx', ['lint-staged'], { stdio: 'inherit' })
// status is null when the process could not be launched at all (e.g. signal or
// command-not-found). Treat that as a failure — exiting 0 on an absent bunx would
// silently skip lint-staged on every commit.
if (result.error) {
  const message = result.error.message ?? 'unknown error'
  console.error(`pre-commit: could not run "bunx lint-staged": ${message}`)
  process.exit(1)
}
process.exit(result.status ?? 1)
