import eslint from '@typescript-eslint/eslint-plugin';
import parser from '@typescript-eslint/parser';
import sveltePlugin from 'eslint-plugin-svelte';
import prettier from 'eslint-config-prettier';

/** @type {import('eslint').Linter.Config[]} */
export default [
	{
		ignores: ['**/dist/**', '**/build/**', '**/.svelte-kit/**', '**/node_modules/**']
	},
	{
		files: ['**/*.ts'],
		languageOptions: {
			parser,
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
			'@typescript-eslint/consistent-type-imports': 'error',
			'no-console': ['warn', { allow: ['warn', 'error'] }]
		}
	},
	...sveltePlugin.configs['flat/recommended'],
	prettier,
	...sveltePlugin.configs['flat/prettier']
];
