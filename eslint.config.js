/**
 * Lint rules for the app. TypeScript 7 ships no JavaScript API, so the
 * type-aware typescript-eslint stack can't run here; files are parsed with
 * Babel instead (syntax only – `tsc -b` remains the type check, including
 * unused locals and parameters).
 *
 * Shared accessibility and token rules retain the baseline presentation.
 */
import babelParser from '@babel/eslint-parser'
import jsxA11y from 'eslint-plugin-jsx-a11y'
import reactHooks from 'eslint-plugin-react-hooks'

const RAW_BUTTON = 'tars/raw-button: use a primitive from src/ui (Button, IconButton, …) instead of a hand-styled button.'
const ARBITRARY = 'tars/arbitrary-token: use a design token (type role, radius, layer or motion token) instead of an arbitrary value.'

const rawButton = [
  { selector: "JSXOpeningElement[name.name='button']", message: RAW_BUTTON },
  { selector: "JSXOpeningElement[name.object.name='motion'][name.property.name='button']", message: RAW_BUTTON },
  { selector: "JSXAttribute[name.name='role'][value.value='button']", message: RAW_BUTTON },
]

const ARBITRARY_CLASS = String.raw`(^|\s)([a-z-]+:)*(text-\[[0-9.]+(px|rem|em|cqw)\]|rounded(-[a-z]{1,2})?-\[|z-\[|duration-\[)`
const arbitraryToken = [
  { selector: `Literal[value=/${ARBITRARY_CLASS}/]`, message: ARBITRARY },
  { selector: `TemplateElement[value.raw=/${ARBITRARY_CLASS}/]`, message: ARBITRARY },
  {
    selector: "JSXAttribute[name.name=/^(transition|animate|initial|exit|whileTap|whileHover|whileDrag)$/] Property[key.name=/^(duration|delay|stiffness|damping|mass)$/] > Literal",
    message: ARBITRARY,
  },
]

export default [
  { ignores: ['dist/**', 'node_modules/**', 'android/**', 'ios/**', 'public/**', 'tools/atlas-build/**', 'tools/browser/**', 'tools/cloudflare/**', 'coverage/**'] },
  {
    files: ['src/**/*.{ts,tsx}', 'tools/news/**/*.ts', 'functions/**/*.ts', 'vite.config.ts'],
    languageOptions: {
      parser: babelParser,
      parserOptions: {
        requireConfigFile: false,
        sourceType: 'module',
        babelOptions: { babelrc: false, configFile: false, parserOpts: { plugins: ['typescript', 'jsx'] } },
      },
    },
    plugins: { 'react-hooks': reactHooks, 'jsx-a11y': jsxA11y },
    linterOptions: { reportUnusedDisableDirectives: 'warn' },
    rules: {
      // Correctness that the type checker does not cover.
      'no-debugger': 'error',
      'no-dupe-keys': 'error',
      'no-duplicate-case': 'error',
      'no-unreachable': 'error',
      'no-unsafe-finally': 'error',
      'no-constant-binary-expression': 'error',
      'no-self-assign': 'error',
      'no-sparse-arrays': 'error',
      'use-isnan': 'error',
      'valid-typeof': 'error',
      eqeqeq: ['error', 'smart'],

      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',

      ...Object.fromEntries(Object.keys(jsxA11y.flatConfigs.recommended.rules).map((rule) => [rule, 'warn'])),
      // Focus is managed by the dialog layer (ui/Sheet.tsx puts focus where `data-autofocus` or `autoFocus` says).
      'jsx-a11y/no-autofocus': 'off',
      // Deprecated in the plugin; label-has-associated-control covers it.
      'jsx-a11y/label-has-for': 'off',
    },
  },
  {
    // The primitives themselves are where buttons and values are defined.
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/ui/**', 'src/**/*.test.ts'],
    rules: { 'no-restricted-syntax': ['warn', ...rawButton, ...arbitraryToken] },
  },
  {
    // The map renderer sets cartographic sizes and gesture timings of its own.
    files: ['src/features/atlas/AtlasMap.tsx', 'src/features/atlas/labels.ts', 'src/features/atlas/symbols.tsx', 'src/features/atlas/living.tsx', 'src/features/atlas/camera.ts'],
    rules: { 'no-restricted-syntax': ['warn', ...rawButton] },
  },
]
