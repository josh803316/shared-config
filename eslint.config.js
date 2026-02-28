const {defineConfig} = require('eslint/config');
const globals = require('globals');
const js = require('@eslint/js');
const ts = require('typescript-eslint');

module.exports = defineConfig(
  // standard ESLint rules
  {
    name: 'eslint/recommended',
    ...js.configs.recommended,
  },

  // standard TS-aware rules (with type checking enabled)
  ...ts.configs.recommendedTypeChecked.map((cfg) => ({...cfg, files: ['**/*.{ts,tsx,mts,cts}']})),
  {
    name: 'typescript-eslint/parser',
    languageOptions: {
      parserOptions: {
        projectService: true,
      },
    },
  },

  // shared rules for all @josh803316 projects
  {
    name: 'shared/recommended',
    languageOptions: {
      globals: {
        ...globals.builtin,
        ...globals.browser,
        ...globals.node,
      },
    },
    linterOptions: {
      reportUnusedDisableDirectives: 'error',
    },
    rules: {
      // require braces on all `if` statements and other control structures
      curly: 'error',

      // catch subtle concurrency bugs; allow different properties of same object across async calls
      'require-atomic-updates': ['error', {allowProperties: true}],
    },
  },

  // additional rules for TypeScript files
  {
    name: 'shared/recommended/ts',
    files: ['**/*.{ts,tsx,mts,cts}'],
    rules: {
      // without this rule we lose stack traces
      '@typescript-eslint/return-await': ['error', 'always'],

      // avoid overly broad types
      '@typescript-eslint/no-restricted-types': [
        'error',
        {
          types: {
            object: 'This is not much better than `any`, please use a more specific type.',
          },
        },
      ],

      // relax for async callbacks passed to event listeners / setTimeout
      '@typescript-eslint/no-misused-promises': ['error', {checksVoidReturn: false}],

      // warn on unused vars but allow rest-sibling patterns
      '@typescript-eslint/no-unused-vars': ['warn', {ignoreRestSiblings: true}],

      // ensure switch covers all cases of enums/unions
      '@typescript-eslint/switch-exhaustiveness-check': 'error',
    },
  },

  // more relaxed rules for legacy JS files
  {
    name: 'shared/recommended/js',
    files: ['**/*.{js,jsx,mjs,cjs}'],
    rules: {
      'no-undef': 'warn',
      'no-unused-vars': ['warn', {ignoreRestSiblings: true}],
      'no-var': 'error',
      'prefer-const': 'error',
      'prefer-rest-params': 'error',
      'prefer-spread': 'error',
    },
  },
);
