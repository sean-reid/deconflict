import eslint from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import sveltePlugin from 'eslint-plugin-svelte';
import svelteParser from 'svelte-eslint-parser';
import prettier from 'eslint-config-prettier';

/** @type {import('eslint').Linter.Config[]} */
export default [
	{
		ignores: [
			'**/dist/**',
			'**/build/**',
			'**/.svelte-kit/**',
			'**/node_modules/**',
			'**/service-worker.ts'
		]
	},
	{
		files: ['**/*.ts'],
		ignores: ['**/*.svelte.ts'],
		languageOptions: {
			parser: tsParser,
			parserOptions: {
				projectService: true
			}
		},
		plugins: {
			'@typescript-eslint': eslint
		},
		rules: {
			'@typescript-eslint/no-unused-vars': [
				'error',
				{ argsIgnorePattern: '^_', varsIgnorePattern: '^_' }
			],
			'@typescript-eslint/no-explicit-any': 'warn',
			'no-console': ['warn', { allow: ['warn', 'error'] }]
		}
	},
	{
		files: ['**/*.svelte'],
		languageOptions: {
			parser: svelteParser,
			parserOptions: {
				parser: tsParser
			}
		},
		plugins: {
			svelte: sveltePlugin
		}
	},
	{
		files: ['**/*.svelte.ts'],
		languageOptions: {
			parser: svelteParser,
			parserOptions: {
				parser: tsParser
			}
		}
	},
	prettier
];
