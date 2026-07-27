import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

// Plugins
import stylistic from '@stylistic/eslint-plugin';
import autofix from 'eslint-plugin-autofix';
import importPlugin from 'eslint-plugin-import';
import solidPlugin from 'eslint-plugin-solid';

export default tseslint.config(
	// Base ESLint configurations
	eslint.configs.recommended,

	// TypeScript configurations
	tseslint.configs.recommended,
	tseslint.configs.recommendedTypeChecked,

	// ✅ Typed TypeScript files (with full type information)
	{
		files: ['**/src/**/*.{ts,tsx}', 'scripts/**/*.mts'],

		languageOptions: {
			parserOptions: {
				parser: '@typescript-eslint/parser',
				project: ['./tsconfig.json', './tsconfig.scripts.json'],
				tsconfigRootDir: process.cwd(),
				ecmaVersion: 2020,
				sourceType: 'module',
				ecmaFeatures: {
					impliedStrict: true,
					jsx: true
				},
				jsxPragma: 'solid'
			},
		},

		plugins: {
			'@stylistic': stylistic,
			'autofix': autofix,
			'import': importPlugin,
			'solid': solidPlugin
		},

		settings: {
			'import/parsers': {
				'@typescript-eslint/parser': ['.ts', '.tsx']
			}
		},

		rules: {
			/* ────────────────────────────── SOLID RULES ────────────────────────────── */
			'solid/reactivity': 'warn',
			'solid/no-destructure': 'warn',
			'solid/jsx-no-undef': 'error',
			'solid/self-closing-comp': 'warn',
			'solid/no-react-specific-props': 'error',

			/* ────────────────────────────── GENERAL RULES ────────────────────────────── */
			'no-console': 'warn',
			'no-debugger': 'warn',
			'no-alert': 'warn',
			'no-tabs': ['warn', { allowIndentationTabs: true }],

			/* ────────────────────────────── IMPORT RULES ────────────────────────────── */
			'import/no-extraneous-dependencies': ['error', { devDependencies: true }],
			'import/order': ['warn'],
			'import/no-self-import': ['error'],
			'import/no-cycle': ['error'],
			'import/no-unresolved': ['off'],
			'import/prefer-default-export': 'off',

			/* ────────────────────────────── TYPESCRIPT RULES ────────────────────────────── */
			'@typescript-eslint/explicit-function-return-type': ['error'],
			'@typescript-eslint/no-explicit-any': 'error',
			'@typescript-eslint/no-unused-vars': 'warn',
			'@typescript-eslint/no-use-before-define': 'off',
			'@typescript-eslint/ban-ts-comment': 'off',
			'@typescript-eslint/lines-between-class-members': 'off',
			'@typescript-eslint/no-unsafe-argument': 'off',
			'@typescript-eslint/no-unsafe-assignment': 'off',
			'@typescript-eslint/no-unsafe-member-access': 'off',
			'@typescript-eslint/await-thenable': 'warn',
			'@typescript-eslint/naming-convention': [
				'warn',
				{
					selector: 'enum',
					format: ['UPPER_CASE']
				}
			],

			/* ────────────────────────────── STYLISTIC RULES ────────────────────────────── */
			'@stylistic/type-annotation-spacing': [
				'warn',
				{
					before: false,
					after: true,
					overrides: { arrow: 'ignore' }
				}
			],
			'@stylistic/arrow-spacing': ['warn', { before: true, after: true }],
			'@stylistic/member-delimiter-style': [
				'warn',
				{
					multiline: { delimiter: 'semi', requireLast: true },
					singleline: { delimiter: 'semi', requireLast: false }
				}
			],

			/* ────────────────────────────── AUTOFIX RULES ────────────────────────────── */
			'autofix/newline-before-return': 'warn',
			'autofix/one-var-declaration-per-line': ['warn', 'always'],
			'autofix/no-plusplus': 'warn',
			'autofix/quotes': ['warn', 'single'],
			'autofix/semi': ['warn', 'always'],
			'autofix/object-curly-spacing': ['warn', 'always'],
			'autofix/comma-dangle': ['warn', { functions: 'never', objects: 'never' }],
			'autofix/comma-spacing': ['warn', { before: false, after: true }],
			'autofix/comma-style': 'warn',
			'autofix/computed-property-spacing': ['warn', 'never'],
			'autofix/no-multi-spaces': 'warn',
			'autofix/no-whitespace-before-property': 'warn',
			'autofix/space-before-blocks': 'warn',
			'autofix/space-infix-ops': 'warn',
			'autofix/function-call-argument-newline': ['warn', 'consistent'],
			'autofix/func-call-spacing': ['warn', 'never'],
			'autofix/space-before-function-paren': [
				'warn',
				{
					anonymous: 'never',
					named: 'never',
					asyncArrow: 'always'
				}
			],
			'autofix/padded-blocks': ['warn', { blocks: 'never' }],
			'autofix/no-multiple-empty-lines': ['warn', { max: 2 }],
			'autofix/dot-location': ['warn', 'property'],
			'autofix/eqeqeq': ['warn', 'always'],

			/* ────────────────────────────── PADDING RULES ────────────────────────────── */
			'padding-line-between-statements': [
				'warn',
				{ blankLine: 'always', prev: '*', next: 'if' },
				{ blankLine: 'always', prev: '*', next: 'case' },
				{ blankLine: 'always', prev: '*', next: 'continue' },
				{ blankLine: 'always', prev: '*', next: 'debugger' },
				{ blankLine: 'always', prev: '*', next: 'for' },
				{ blankLine: 'always', prev: '*', next: 'switch' },
				{ blankLine: 'always', prev: '*', next: 'throw' },
				{ blankLine: 'always', prev: '*', next: 'try' },
				{ blankLine: 'always', prev: '*', next: 'while' }
			]
		},
	},

	// ✅ App sources only. Build scripts resolve their own paths with import.meta.url legitimately;
	// components must not. The ban is stated in AGENTS.md, configuration.md and
	// widget-best-practices.md but nothing enforced it, and the flagship wayfinding example
	// drifted into violating it. A runtime-built URL is also invisible to the visual-review
	// fingerprint, which walks import statements, so a packaged asset could change without
	// staling the accepted review.
	{
		files: ['**/src/**/*.{ts,tsx}'],
		rules: {
			'no-restricted-syntax': [
				'error',
				{
					selector: 'NewExpression[callee.name="URL"] MemberExpression[object.type="MetaProperty"][property.name="url"]',
					message: 'Import packaged media statically instead of building the URL with new URL(..., import.meta.url). A static import is rewritten by the bundler and is visible to the visual-review fingerprint; a runtime-built URL is neither.'
				}
			]
		}
	},

	// ✅ Override for non-TypeScript / config files
	{
		files: ['**/*.js', '**/*.cjs', '**/*.mjs'],
		rules: {
			'@typescript-eslint/await-thenable': 'off',
			'@typescript-eslint/no-floating-promises': 'off',
			'@typescript-eslint/no-misused-promises': 'off',
			'@typescript-eslint/no-unsafe-assignment': 'off',
			'@typescript-eslint/no-unsafe-call': 'off',
			'@typescript-eslint/no-unsafe-member-access': 'off',
			'@typescript-eslint/no-unsafe-return': 'off',
		},
	},

	// ✅ Ignored files and folders
	{
		ignores: [
			'node_modules',
			'dist',
			'src/**/vendor/**',
			'build_tools',
			'project-builder-utilities',
			'src/editor-assets/',
			'env.d.ts',
			'eslint.config.mjs',
			'vite.config.mts',
			'.stylelintrc.mjs',
			'stylelintrc-order-rules.mjs',
		],
	}
);
