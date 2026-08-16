# @josh803316/shared-config

Shared compiler, linter, and formatter configurations for all `@josh803316` TypeScript/JS projects.

Includes:

| Config | Purpose |
|---|---|
| `biome.json` | Biome linter + formatter (opinionated rule set) |
| `tsconfig/base.json` | Strict ESNext base — bundler module resolution |
| `tsconfig/ui.json` | Browser / React UI projects (DOM + DOM.Iterable libs) |
| `tsconfig/api.json` | Server-side API projects (strict, no DOM) |
| `tsconfig/bun.json` | Pure Bun scripts / CLI tools (bun-types) |
| `tsconfig/node-esm.json` | Node.js ESM packages that emit `.js` + `.d.ts` |
| `tsconfig.node.json` | Legacy Node.js CommonJS projects |
| `lint-staged.config.js` | lint-staged preset (TS/JS → biome check; prose → biome format) |
| `bin/commit-msg.ts` | Conventional-commit message validator with interactive repair |
| `bin/pre-commit.ts` | Pre-commit hook (runs lint-staged) |

## Installation

```bash
bun add -D @josh803316/shared-config
```

Git hooks are installed automatically via the `postinstall` script. To force-reinstall or update stale hooks:

```bash
bun node_modules/@josh803316/shared-config/scripts/install-husky-hooks.ts --force
```

## Usage

### TypeScript

Extend the appropriate preset in your project's `tsconfig.json`:

```jsonc
// UI / React app
{ "extends": "@josh803316/shared-config/tsconfig/ui.json" }

// Node API
{ "extends": "@josh803316/shared-config/tsconfig/api.json" }

// Bun script / CLI
{ "extends": "@josh803316/shared-config/tsconfig/bun.json" }

// Node ESM package (emits JS + .d.ts)
{ "extends": "@josh803316/shared-config/tsconfig/node-esm.json" }
```

Most projects should add project-specific `include`/`exclude` arrays on top:

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

The `postinstall` script writes thin delegating hooks into your project's `.husky/` directory. Nothing to configure — just commit.

If you need to re-run manually:

```bash
bun scripts/install-husky-hooks.ts          # installs / updates stale hooks
bun scripts/install-husky-hooks.ts --force  # force-overwrites all hooks
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

The `commit-msg` hook validates this automatically and prompts you to pick a type interactively if the message is missing one.

## Publishing

Releases are handled by the [shared-ci-workflows](https://github.com/josh803316/shared-ci-workflows) semantic-release workflow on every push to `main`.
