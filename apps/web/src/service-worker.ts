/// <reference types="@sveltejs/kit" />
/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />

import { build, files, version } from '$service-worker';

const CACHE_NAME = `deconflict-${version}`;

// App shell and static assets to precache
const ASSETS = [...build, ...files];

self.addEventListener('install', (event: ExtendableEvent) => {
	event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)));
});

self.addEventListener('activate', (event: ExtendableEvent) => {
	event.waitUntil(
		caches
			.keys()
			.then((keys) =>
				Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
			)
	);
});

self.addEventListener('fetch', (event: FetchEvent) => {
	if (event.request.method !== 'GET') return;

	const url = new URL(event.request.url);

	// Cache-first for app assets (they have hashed filenames)
	if (ASSETS.includes(url.pathname)) {
		event.respondWith(
			caches.match(event.request).then((cached) => {
				return cached || fetch(event.request);
			})
		);
		return;
	}

	// Network-first for everything else (fonts, etc.)
	event.respondWith(
		fetch(event.request)
			.then((response) => {
				// Cache successful font responses
				if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
					const clone = response.clone();
					caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
				}
				return response;
			})
			.catch(() => {
				return caches.match(event.request).then((cached) => {
					return cached || new Response('Offline', { status: 503 });
				});
			})
	);
});
