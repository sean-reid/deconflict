import type { Channel } from '../types.js';

const PSC_SET = new Set([5, 21, 37, 53, 69, 85, 101, 117, 133, 149, 165, 181, 197, 213, 229]);

const CHANNEL_NUMBERS_6GHZ: number[] = [];
for (let n = 1; n <= 233; n += 4) {
	CHANNEL_NUMBERS_6GHZ.push(n);
}

export const CHANNELS_6GHZ: Channel[] = CHANNEL_NUMBERS_6GHZ.map((num) => ({
	number: num,
	frequency: 5950 + num * 5,
	band: '6ghz',
	dfs: false,
	psc: PSC_SET.has(num),
	maxWidth: 320,
}));

export const PSC_CHANNELS_6GHZ: number[] = CHANNEL_NUMBERS_6GHZ.filter((n) => PSC_SET.has(n));
