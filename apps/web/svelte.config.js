import adapter from '@sveltejs/adapter-static';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	kit: {
		adapter: adapter({
			fallback: '200.html'
		}),
		alias: {
			$components: 'src/lib/components',
			$state: 'src/lib/state',
			$canvas: 'src/lib/canvas'
		}
	}
};

export default config;
