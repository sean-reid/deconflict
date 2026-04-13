import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	plugins: [sveltekit()],
	test: {
		include: ['src/**/*.test.ts'],
		passWithNoTests: true
	},
	worker: {
		format: 'es'
	},
	server: {
		fs: {
			// Allow access to monorepo packages (solver worker lives outside apps/web)
			allow: ['../..']
		}
	}
});
