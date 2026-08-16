# AGENTS.md — @josh803316/shared-config

This repo is the **base configuration package** for all `@josh803316/*` TypeScript projects.
It exports: tsconfig profiles, biome.json, lint-staged config, and husky hooks.

## Stack

- **Runtime**: Bun 1.3.x — use `bun` for all scripts, installs, and test runs
- **TypeScript**: 7.0.x — the Go-native compiler (10× faster, type-stripping by default)
- **Linter/Formatter**: Biome 2.5.x — one tool for lint + format + import organization
- **Git hooks**: Husky 9 + lint-staged

## What this repo exports (and who uses it)

| Export | Used by |
|--------|---------|
| `tsconfig/base.json` | all TS projects |
| `tsconfig/api.json` | ribeye-public-api (Bun+Elysia+Drizzle) |
| `tsconfig/bun.json` | shared-ci-workflows, scripts |
| `tsconfig/ui.json` | flank-20 (React+Vite), ribeye-public-ui |
| `tsconfig/node-esm.json` | shared-config itself, published npm packages |
| `tsconfig/test.json` | shared-test-automation (Playwright+Vitest) |
| `biome.json` | all repos via `extends` |
| `lint-staged.config.js` | all repos via postinstall hook |

## Commands

```bash
bun install           # install deps
bun run lint          # biome check .
bun run format        # biome format --write .
bun run typecheck     # tsc --noEmit
```

## Scripting and automation

Prefer **Bun** and **TypeScript** for scripts, CI glue, string/JSON transforms, and one-off repo
tasks (for example `bun run path/to/script.ts`).

Avoid **Python**, **Perl**, and similar for new work unless the environment truly cannot run Bun.
Prefer extending existing TypeScript tooling in this repo over parallel utilities in other languages.

## Toolchain rules (STRICT — do not deviate)

- **Package manager**: `bun install` only. Never `npm install`, `yarn`, or `pnpm`.
- **Scripts**: TypeScript with Bun (`bun run script.ts`). No Python, Perl, or bash for new work.
- **No barrel files**: Do not create `index.ts` that re-exports other modules. Import directly.
  Biome `noBarrelFile` will warn on them. API projects should set it to `"error"`.
- **No `any`**: Use `unknown` when type is unclear. Suppress with `// biome-ignore` only with comment.
- **No `console.log`** in committed code: Use structured logging (pino) in APIs. In scripts, prefer
  `console.info` with context. Biome `noConsole` will warn.
- **`import type`**: All type-only imports must use `import type { ... }`. Biome `useImportType` enforces this.
- **No enums**: TypeScript 7 era — use `as const` objects or string unions instead of `enum`.
  `erasableSyntaxOnly: true` in api.json and bun.json makes enums a type error in new repos.
  Not in base.json so legacy repos (ribeye-api, cortanha-core) can adopt at their own pace.
- **No namespace syntax**: Use ES modules only (`import`/`export`).
- **No parameter properties**: `constructor(private x: string)` is not erasable. Use explicit `this.x = x`.

## tsconfig profile selection guide

| Project type | Extend |
|---|---|
| Bun+Elysia API | `@josh803316/shared-config/tsconfig/api.json` |
| React+Vite UI | `@josh803316/shared-config/tsconfig/ui.json` |
| Bun scripts / CI tools | `@josh803316/shared-config/tsconfig/bun.json` |
| Published npm package (Node ESM) | `@josh803316/shared-config/tsconfig/node-esm.json` |
| Playwright / test automation | `@josh803316/shared-config/tsconfig/test.json` |

## PR hygiene

- Commit messages: Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`, `refactor:`)
- PRs touching config files: explain WHY in the PR description, not just what changed
- PRs should be small and focused — one concern per PR
- After changing a tsconfig or biome.json: run `bun run typecheck` and `bun run lint` to verify

## What NOT to do

- Do not add `skipLibCheck: false` — it breaks typebox/elysia version-skew compatibility
- Do not add `noEmit: false` to base.json — Bun/Vite are the emitters, not tsc
- Do not add `experimentalDecorators: true` — Elysia uses builder pattern, not decorators
- Do not change `verbatimModuleSyntax: false` — required for correct `import type` enforcement
- Do not add `allowSyntheticDefaultImports` explicitly — implied by the module settings
- Do not add ESLint — Biome replaces both ESLint and Prettier in this stack
- Do not run `biome check --fix` mid-edit in hooks — use `biome format --write` in hooks only;
  run `biome check --fix` manually or via `bun run lint`
