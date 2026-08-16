# @josh803316/shared-config

Shared compiler, linter, and formatter configurations for all `@josh803316` TypeScript/JS projects.

## What this package ships

| Export | Purpose |
|---|---|
| `biome.json` | Biome linter + formatter (opinionated rule set) |
| `lint-staged.config.js` | lint-staged preset (TS/JS → `biome check`; prose → `biome format`) |
| `tsconfig/base.json` | Composition-neutral strict base — **no** emit/module assumptions |
| `tsconfig/api.json` | Bun + Elysia server API (strict, DOM lib, type-check only) |
| `tsconfig/bun.json` | Pure Bun scripts / CLI tools (type-check only) |
| `tsconfig/ui.json` | React / Vite browser UI (DOM + DOM.Iterable, type-check only) |
| `tsconfig/node-esm.json` | Node ESM package that emits `.js` + `.d.ts` |
| `tsconfig/node-cjs.json` | Node CommonJS package that emits (TypeScript-7 safe) |
| `tsconfig/migration.json` | Incremental-strictness profile for mature/legacy adopters |
| `tsconfig/test.json` | Playwright/Vitest test automation |
| `tsconfig.node.json` | Legacy alias of `node-cjs.json` (kept for back-compat) |
| `.husky/commit-msg` | Conventional-commit validator (shipped delegate) |
| `.husky/pre-commit` | Pre-commit hook → lint-staged (shipped delegate) |

Every path in the table is verified against the **packed** tarball by
`bun run test` (`scripts/verify-package.ts`) before release.

## Installation

```bash
bun add -D @josh803316/shared-config
```

> This package is published to **GitHub Packages** (intentional — it is private).
> Consumers must authenticate; see [Authentication](#authentication-github-packages).

Git hooks are installed automatically via the `postinstall` script. To force-reinstall or update stale hooks:

```bash
bun node_modules/@josh803316/shared-config/scripts/install-husky-hooks.ts --force
```

## Authentication (GitHub Packages)

`@josh803316` packages are private and published to GitHub Packages. Every
environment that installs them — local, GitHub Actions, Vercel — needs a
package-read token exposed under a **single, consistent** variable:

```
BUN_AUTH_TOKEN   # a GitHub PAT with `read:packages` scope
```

`.npmrc` (already present in this repo and copied by consumers):

```ini
@josh803316:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${BUN_AUTH_TOKEN}
```

Run the built-in preflight to validate a given environment before a build attempts it:

```bash
bun node_modules/@josh803316/shared-config/scripts/auth-preflight.ts   # from a consumer
bun run preflight:auth                                                  # from inside this repo
```

### GitHub Actions

```yaml
- uses: actions/checkout@v4
- uses: oven-sh/setup-bun@v2
- env:
    BUN_AUTH_TOKEN: ${{ secrets.BUN_AUTH_TOKEN }}
  run: bun install --frozen-lockfile
```

### Vercel

Add `BUN_AUTH_TOKEN` as a Project/Environment variable (the same value used in
GitHub Actions). Vercel reads `.npmrc` at install time; the `${BUN_AUTH_TOKEN}`
reference resolves against the env. For preview/canonical branches, select the
appropriate scope (Production / Preview / Development).

If you see an HTTP 401 mid-install, it means `BUN_AUTH_TOKEN` is missing,
expired, or lacks `read:packages` — run the auth preflight for a precise message.

## Usage

### TypeScript

Extend the appropriate preset in your project's `tsconfig.json`:

```jsonc
// Bun + Elysia API
{ "extends": "@josh803316/shared-config/tsconfig/api.json" }

// Bun script / CLI
{ "extends": "@josh803316/shared-config/tsconfig/bun.json" }

// React / Vite UI
{ "extends": "@josh803316/shared-config/tsconfig/ui.json" }

// Node ESM package (emits JS + .d.ts)
{ "extends": "@josh803316/shared-config/tsconfig/node-esm.json" }

// Node CommonJS package (emits)
{ "extends": "@josh803316/shared-config/tsconfig/node-cjs.json" }

// Legacy / mature codebase adopting strictness incrementally
{ "extends": "@josh803316/shared-config/tsconfig/migration.json" }
```

Most projects add project-specific `include`/`exclude` on top:

```jsonc
{
  "extends": "@josh803316/shared-config/tsconfig/ui.json",
  "compilerOptions": {
    "baseUrl": ".",
    "paths": { "@/*": ["src/*"] }
  },
  "include": ["src", "vite.config.ts"]
}
```

#### Choosing between `api` / `bun` / `ui` / `migration`

- **`api` / `bun` / `ui`** are full-strict, type-check-only profiles. Use for
  projects that compile with Bun or Vite (real emitters) and only need `tsc` for
  type checking.
- **`node-esm` / `node-cjs`** turn on emission (`.js` + `.d.ts`). Use only for
  packages actually published and consumed by Node.
- **`migration`** is the on-ramp for mature projects — it keeps all **safety**
  checks (`strict`, `noUncheckedIndexedAccess`, …) but defers **cleanup** rules
  (`noUnusedLocals`, `noImplicitReturns`, `verbatimModuleSyntax`). Migrate to a
  full-strict profile once the cleanup debt is cleared.

`base.json` is intentionally composition-neutral: it carries **no**
`noEmit`, `allowImportingTsExtensions`, `verbatimModuleSyntax`, or
module-resolution settings, so an emitting consumer can layer `noEmit: false` /
`declaration: true` without fighting defaults. Only extend `base.json` directly if
you want to control emission yourself.

#### TypeScript peer range

`typescript` is a **peer dependency** (`>=5.9.0`), so this package works across
the ecosystem's TypeScript 5.9 / 6 / 7. Consumers pin their own TypeScript;
mixing with `typescript-eslint` (which does not yet support TS7) is safe because
shared-config no longer forces a TS major transitively.

### Biome

```jsonc
// biome.json
{
  "extends": ["@josh803316/shared-config/biome.json"]
}
```

### lint-staged

```js
// lint-staged.config.js
module.exports = require('@josh803316/shared-config/lint-staged.config.js')
```

Or spread / override individual globs:

```js
const base = require('@josh803316/shared-config/lint-staged.config.js')
module.exports = {
  ...base,
  '*.prisma': ['prisma format'],
}
```

### Git hooks (husky)

The `postinstall` script writes thin delegating hooks into your project's
`.husky/` directory. They resolve to the shipped `bin/*.ts` inside the installed
package by an absolute `node_modules` path, so normal commits work — no
`--no-verify` required.

```bash
# List shipped hooks: commit-msg (conventional commit), pre-commit (lint-staged)
git commit                          # runs both automatically
```

## Commit message format

```
type[(scope)][!]: subject

# Types: feat | fix | perf | chore | docs | refactor | security | style | test
# Breaking change: add ! after type or scope

feat: add campaign budget alerts
fix(#2901): handle null session in VAST proxy
feat!: drop Node 18 support
```

The `commit-msg` hook validates this automatically and prompts you to pick a
type interactively if the message is missing one.

## Development

```bash
bun install
bun run lint          # biome check .
bun run format        # biome format --write .
bun run typecheck     # tsc --noEmit
bun run test          # pack → fixture-install → verify every export + shipped hook
bun run preflight:auth  # validate GitHub Packages auth in this environment
```

## Publishing

Releases are handled by the
[shared-ci-workflows](https://github.com/josh803316/shared-ci-workflows)
semantic-release workflow on every push to `main`, publishing to GitHub Packages.

Before releasing, `bun run test` must pass — it catches the "published package is
incomplete" class of defect (missing files, unresolvable exports, broken hook
delegation) that a source-only test never sees.
