# @josh803316/shared-config

Shared TypeScript, ESLint, Prettier, and commit-hook configs for all `@josh803316` projects.

Designed to be consumed by: `lll-experience`, `elysia-playground`, `how-ad-tech-works`.

## Installation

```sh
bun add -D @josh803316/shared-config
```

After install you can remove `typescript`, `typescript-eslint`, `eslint`, and `prettier` from your own
`package.json` — this package re-exports consistent versions of all of them.

Add the following to your `package.json`:

```json
{
  "scripts": {
    "prepare": "husky",
    "fmt": "prettier -wu",
    "compile": "tsc",
    "lint": "eslint .",
    "lint:summary": "bun run lint -- -f summary",
    "lint:inspect": "eslint-config-inspector"
  },
  "trustedDependencies": ["@josh803316/shared-config", "esbuild", "sharp"]
}
```

## Configs

### TypeScript (`tsconfig.json`)

For modern runtimes (Bun, TSX) or bundlers (Vite, ESBuild):

```json
{
  "extends": "@josh803316/shared-config/tsconfig.json",
  "exclude": ["dist/"]
}
```

For Node.js (tsc output or ts-node):

```json
{
  "extends": "@josh803316/shared-config/tsconfig.node.json",
  "exclude": ["dist/"]
}
```

### ESLint (`eslint.config.js`)

```js
import sharedConfig from '@josh803316/shared-config/eslint.config.js';

export default [
  ...sharedConfig,
  {ignores: ['dist/']},
  {
    // project-specific overrides
    rules: {},
  },
];
```

### Prettier (`prettier.config.js`)

```js
import prettier from '@josh803316/shared-config/prettier.config.js';

export default prettier;
```

### lint-staged (`lint-staged.config.js`)

```js
import lintStaged from '@josh803316/shared-config/lint-staged.config.js';

export default lintStaged;
```

## Commit Message Format

This package enforces [Conventional Commits](https://www.conventionalcommits.org/).

**Format:** `type: subject`

| Type | Purpose |
|------|---------|
| `feat` | New feature |
| `fix` | Bug fix |
| `perf` | Performance improvement |
| `chore` | Maintenance (deps, config, tooling) |
| `docs` | Documentation only |
| `refactor` | Code restructure without behaviour change |
| `security` | Security fix |
| `style` | Formatting, whitespace |
| `test` | Adding or updating tests |

Breaking changes: append `!` after the type → `feat!: remove deprecated API`

If your commit message is missing or has an invalid type, the hook will interactively prompt you to pick one.
