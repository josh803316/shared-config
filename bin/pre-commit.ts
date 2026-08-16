#!/usr/bin/env bun

// Runs lint-staged to format/lint only staged files before committing.
// lint-staged config lives in lint-staged.config.js.
import { spawnSync } from 'child_process'

const result = spawnSync('bunx', ['lint-staged'], { stdio: 'inherit' })
process.exit(result.status ?? 0)
