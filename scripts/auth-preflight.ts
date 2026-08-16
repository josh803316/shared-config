#!/usr/bin/env bun

/**
 * GitHub Packages auth preflight for @josh803316 packages.
 *
 * Verifies that the consuming environment can authenticate to GitHub Packages
 * before a real install/build attempts it, and reports a clear, actionable
 * error instead of a bare HTTP 401 mid-install.
 *
 * Usage:
 *   bun scripts/auth-preflight.ts               # check this package.json registry
 *   bun scripts/auth-preflight.ts --scope @josh803316   # check a specific scope
 *
 * Exit codes:
 *   0  OK — token present and authenticated (or no GH Packages scope found)
 *   1  FAIL — token missing / invalid / scoped registry unreachable
 */

import fs from 'node:fs'

const NPM_CONFIG_USERCONFIG = process.env.NPM_CONFIG_USERCONFIG ?? ''
const HOME = process.env.HOME ?? ''

// Hoisted regexes (biome: useTopLevelRegex)
const TRAILING_SLASH = /\/+$/
const PROTOCOL_PREFIX = /^https?:\/\//
const AUTH_TOKEN_INLINE = /_authToken=(.+)\s*$/
const ENV_REF = /^\$\{/
const ENV_REF_CLOSE = /\}$/
// Registry-scoped token directive: //<host>/:_authToken=<val> (host must match the registry)
const TOKEN_DIRECTIVE = /^\/\/([^/:]+)\/:?_authToken=/
// Split an .npmrc directive into its key portion (up to the first `=` or `:`)
const NPMRC_KEY = /[=:]/

/**
 * Reads and merges npm config layers with Bun-compatible precedence.
 *
 * Precedence (highest first): project `.npmrc` → `NPM_CONFIG_USERCONFIG` (if set)
 * → `$HOME/.npmrc`. A key present in an earlier layer wins; layers are applied in
 * that order so project settings override user settings. This mirrors how Bun/npm
 * resolve scope registries and tokens, instead of the previous first-nonempty-file
 * behavior that could let a user config mask (or be masked by) the project config.
 *
 * Returns a `{ lines }` structure — merged directives keyed by their raw start —
 * plus the ordered list of config files examined (for diagnostics).
 */
const readNpmrc = (): { lines: Map<string, string>; files: string[] } => {
  const paths: string[] = []
  for (const p of ['.npmrc', NPM_CONFIG_USERCONFIG, `${HOME}/.npmrc`]) {
    if (p) paths.push(p)
  }
  const lines = new Map<string, string>()
  const files: string[] = []
  for (const p of paths) {
    let content = ''
    try {
      content = fs.readFileSync(p, 'utf8')
    } catch {
      continue // missing file — skip
    }
    files.push(p)
    for (const line of content.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith(';')) continue
      const key = trimmed.split(NPMRC_KEY, 1)[0] ?? trimmed
      // Later (higher-precedence) layers are read first here, so only insert when absent.
      if (!lines.has(key)) lines.set(key, trimmed)
    }
  }
  return { lines, files }
}

const normalizeRegistry = (reg: string): string => reg.replace(TRAILING_SLASH, '')

/** Finds the token directive keyed specifically to `registry` (same host),
 *  never a generic fallback that could send another registry's token here. */
const tokenDirectiveFor = (config: Map<string, string>, registry: string): string | undefined => {
  const host = registry.replace(PROTOCOL_PREFIX, '').split('/')[0] ?? ''
  for (const v of config.values()) {
    // Match only //<host>/:_authToken= directives, not tokens for other registries.
    const m = TOKEN_DIRECTIVE.exec(v)
    if (m?.[1] === host) return v
  }
  return undefined
}

const resolveAuth = (): { registry: string; token: string; scope: string } | null => {
  const { lines } = readNpmrc()
  const scopeArg = process.argv[process.argv.indexOf('--scope') + 1]
  const scope = scopeArg ?? '@josh803316'

  const scopeLine = Array.from(lines.values()).find((line) =>
    line.trim().startsWith(`${scope}:registry=`)
  )
  if (!scopeLine) return null // no GH Packages scope configured; nothing to check

  const registry = normalizeRegistry(scopeLine.split('=')[1]?.trim() ?? '')

  const tokenLine = tokenDirectiveFor(lines, registry)
  const rawToken = tokenLine ? (AUTH_TOKEN_INLINE.exec(tokenLine)?.[1]?.trim() ?? '') : ''
  const token = rawToken.startsWith('${') ? resolveEnvVar(rawToken) : rawToken

  return { registry, token, scope }
}

const resolveEnvVar = (reference: string): string => {
  const name = reference.replace(ENV_REF, '').replace(ENV_REF_CLOSE, '')
  return process.env[name] ?? ''
}

const preflight = async (): Promise<void> => {
  const auth = resolveAuth()
  if (!auth) {
    console.info('No @josh803316 GitHub Packages registry configured — nothing to check.')
    process.exit(0)
  }

  console.info(`Registry : ${auth.registry}`)
  console.info(`Scope    : ${auth.scope}`)
  // Report presence only, never the token value, prefix, suffix, or length.
  console.info(`Token    : ${auth.token ? 'present' : 'MISSING'}`)

  if (!auth.token) {
    console.error(
      '\nNo auth token found.\n\n' +
        'Set BUN_AUTH_TOKEN (a GitHub PAT with `read:packages`) and point your .npmrc at GitHub Packages:\n\n' +
        '  export BUN_AUTH_TOKEN=ghp_…  # or put it in your CI/Vercel env\n' +
        '  # .npmrc\n' +
        `  ${auth.scope}:registry=${auth.registry}\n` +
        '  //npm.pkg.github.com/:_authToken=\${BUN_AUTH_TOKEN}\n'
    )
    process.exit(1)
  }

  // Try to actually authenticate via the npm login endpoint for the package scope.
  try {
    const res = await fetch(`${auth.registry}/-/whoami`, {
      headers: { authorization: `Bearer ${auth.token}` },
    })
    if (res.ok) {
      const whoami = (await res.json()) as { username?: string }
      console.info(`✅ Authenticated as ${whoami.username ?? '(unknown user)'} on ${auth.registry}`)
      process.exit(0)
    }
    // Any non-200 status is a failure — a 403/404/429/5xx registry/no-access means
    // the environment cannot authenticate. Only a verified username on the scope's
    // registry is green; everything else must fail loudly, not quietly pass.
    console.error(
      `\nGitHub Packages returned HTTP ${res.status} for ${auth.registry} (expected 200).\n` +
        (res.status === 401
          ? 'The token likely lacks `read:packages` or has expired. Generate a fresh classic PAT\n' +
            'with `read:packages`, or a fine-grained token scoped to the josh803316 org with\n' +
            'Packages: Read, and re-export BUN_AUTH_TOKEN.'
          : 'The token may lack `read:packages`, be scoped to the wrong org, or the registry\n' +
            'may be rate-limiting or unavailable. Check that BUN_AUTH_TOKEN is the GitHub\n' +
            'Packages token (not a plain personal token) and that the scope matches this repo.')
    )
    process.exit(1)
  } catch (err) {
    console.error(
      `\nNetwork error contacting ${auth.registry}: ${err instanceof Error ? err.message : String(err)}`
    )
    process.exit(1)
  }
}

void preflight()
