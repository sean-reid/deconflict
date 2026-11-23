import { sveltekit } from '@sveltejs/kit/vite';
import { viteStaticCopy } from 'vite-plugin-static-copy';
import { defineConfig } from 'vitest/config';

// Image decoders pdf.js loads at runtime (CCITT/JBIG2 and JPEG2000 scans, ICC colour profiles).
// Served at /pdfjs/wasm/ in dev and build; passed to pdf.js as `wasmUrl`. The scripting
// engine (quickjs-eval.*) is deliberately not copied.
const PDFJS_WASM_FILES = ['jbig2.wasm', 'openjpeg.wasm', 'qcms_bg.wasm'];

export default defineConfig({
	plugins: [
		sveltekit(),
		viteStaticCopy({
			targets: PDFJS_WASM_FILES.map((file) => ({
				src: `node_modules/pdfjs-dist/wasm/${file}`,
				dest: 'pdfjs/wasm',
				rename: { stripBase: true }
			}))
		})
	],
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
