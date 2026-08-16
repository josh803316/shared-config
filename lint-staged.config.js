/** @type {import('lint-staged').Configuration} */
module.exports = {
  // TypeScript / JavaScript — lint + format + auto-fix
  '*.{ts,tsx,mts,cts,js,jsx,mjs,cjs}': ['biome check --fix --unsafe --no-errors-on-unmatched'],
  // Prose / config — format only (no lint rules apply)
  '*.{json,jsonc,md,mdx,yaml,yml,css,html,svg}': ['biome format --write --no-errors-on-unmatched'],
}
