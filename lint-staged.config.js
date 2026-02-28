module.exports = {
  '*.{ts,tsx,mts,cts,js,jsx,mjs,cjs}': ['prettier -wu', 'eslint --fix'],
  '*.{json,md,yaml,yml,css,html}': ['prettier -wu'],
};
