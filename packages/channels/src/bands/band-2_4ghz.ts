import type { Channel } from '../types.js';

export const CHANNELS_2_4GHZ: Channel[] = Array.from({ length: 13 }, (_, i) => {
	const num = i + 1;
	return {
		number: num,
		frequency: 2407 + num * 5,
		band: '2.4ghz',
		dfs: false,
		psc: false,
		maxWidth: 40
	};
});

export const NON_OVERLAPPING_2_4 = [1, 6, 11] as const;
