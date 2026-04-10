<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		name,
		size = 16,
		class: className = ''
	}: {
		name: string;
		size?: number;
		class?: string;
	} = $props();

	const paths: Record<string, string> = {
		cursor:
			'M4 1l10 10-4.5 1L12 16.5l-2.5 1L7 13l-3 4z',
		crosshair:
			'M8 1v3M8 12v3M1 8h3M12 8h3M8 5a3 3 0 110 6 3 3 0 010-6z',
		hand:
			'M11 1.5v5m0-5a1 1 0 112 0v7m-2-7a1 1 0 10-2 0v6m0-6a1 1 0 10-2 0v7m0-5a1 1 0 10-2 0v5a6 6 0 0012 0V6.5a1 1 0 10-2 0v1',
		play:
			'M5 3l10 5-10 5z',
		chart:
			'M3 14V8m4 6V4m4 10V6m4 8V2',
		download:
			'M8 1v9m0 0l3-3m-3 3L5 7m-3 5v1a2 2 0 002 2h8a2 2 0 002-2v-1',
		trash:
			'M3 4h10M5 4V3a1 1 0 011-1h4a1 1 0 011 1v1m2 0v9a2 2 0 01-2 2H5a2 2 0 01-2-2V4h10zM7 7v4m2-4v4',
		grid:
			'M1 1h6v6H1zm8 0h6v6H9zM1 9h6v6H1zm8 0h6v6H9z',
		radio:
			'M8 10a2 2 0 100-4 2 2 0 000 4zm-3.5-6A5.5 5.5 0 008 2.5 5.5 5.5 0 0111.5 4m-10 8A7.5 7.5 0 018 .5a7.5 7.5 0 016.5 3.5',
		link:
			'M7 11H4a3 3 0 110-6h3m2 0h3a3 3 0 110 6H9m-4-3h6',
		tag:
			'M2 2h5l7 7-5 5-7-7V2zm3 3h.01',
		plus:
			'M8 3v10M3 8h10',
		minus:
			'M3 8h10',
		file:
			'M4 1h6l4 4v9a1 1 0 01-1 1H4a1 1 0 01-1-1V2a1 1 0 011-1zm5 0v4h4',
		upload:
			'M8 10V1m0 0L5 4m3-3l3 3M2 12v1a2 2 0 002 2h8a2 2 0 002-2v-1',
		settings:
			'M8 10a2 2 0 100-4 2 2 0 000 4zm5.5-2.5l.9-.4a1 1 0 00.5-1.2l-.6-1.6a1 1 0 00-1.1-.6l-1 .2a5 5 0 00-1-.6l-.3-1A1 1 0 0010 2H8.3H6a1 1 0 00-1 .8l-.2 1a5 5 0 00-1 .6l-1-.2a1 1 0 00-1.1.6L1.1 6.4a1 1 0 00.5 1.2l.9.4a5 5 0 000 1.2l-.9.4a1 1 0 00-.5 1.2l.6 1.6a1 1 0 001.1.6l1-.2a5 5 0 001 .6l.2 1a1 1 0 001 .8H10a1 1 0 001-.8l.2-1a5 5 0 001-.6l1 .2a1 1 0 001.1-.6l.6-1.6a1 1 0 00-.5-1.2l-.9-.4a5 5 0 000-1.2z',
		keyboard:
			'M2 4h12a1 1 0 011 1v6a1 1 0 01-1 1H2a1 1 0 01-1-1V5a1 1 0 011-1zm3 6h6m-7-4h.01m3-.01h.01m3 .01h.01m3-.01h.01M4 8h.01m3-.01h.01m3 .01h.01m3-.01h.01',
		'chevron-down':
			'M4 6l4 4 4-4',
		undo:
			'M3 7l4-4M3 7l4 4M3 7h8a4 4 0 010 8H9',
		redo:
			'M13 7l-4-4m4 4l-4 4m4-4H5a4 4 0 000 8h2',
		sidebar:
			'M2 2h12a1 1 0 011 1v10a1 1 0 01-1 1H2a1 1 0 01-1-1V3a1 1 0 011-1zm8 0v12',
		help:
			'M8 15a7 7 0 110-14 7 7 0 010 14zM6.5 5.5a2 2 0 012.7-1.4c.8.3 1.3 1 1.3 1.9 0 1-1.5 1.3-1.5 2.5m0 2h.01'
	};

	const strokeIcons = new Set([
		'cursor', 'crosshair', 'hand', 'chart', 'download', 'trash',
		'grid', 'radio', 'link', 'tag', 'plus', 'minus', 'file',
		'upload', 'settings', 'keyboard', 'chevron-down', 'undo', 'redo',
		'sidebar', 'help'
	]);
</script>

<svg
	width={size}
	height={size}
	viewBox="0 0 16 16"
	fill="none"
	xmlns="http://www.w3.org/2000/svg"
	class={className}
	aria-hidden="true"
>
	{#if name === 'play'}
		<path d={paths[name] ?? ''} fill="currentColor" />
	{:else}
		<path
			d={paths[name] ?? ''}
			stroke="currentColor"
			stroke-width="1.5"
			stroke-linecap="round"
			stroke-linejoin="round"
		/>
	{/if}
</svg>
