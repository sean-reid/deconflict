import type { Band } from './types.js';

const COLORS_2_4: Record<number, string> = {
	1: '#ff6b6b',
	2: '#e8816e',
	3: '#d19771',
	4: '#baad74',
	5: '#a3c377',
	6: '#4ecdc4',
	7: '#5fc5a8',
	8: '#70bd8c',
	9: '#a3c877',
	10: '#d1d772',
	11: '#ffe66d',
	12: '#f0c65a',
	13: '#e1a647'
};

const CHANNELS_5_ORDERED = [
	36, 40, 44, 48, 52, 56, 60, 64, 100, 104, 108, 112, 116, 120, 124, 128, 132, 136, 140, 144, 149,
	153, 157, 161, 165
];

const HUES_5GHZ = [
	'#ff6b6b', // 36
	'#ffa502', // 40
	'#ffe66d', // 44
	'#7bed9f', // 48
	'#70a1ff', // 52
	'#5352ed', // 56
	'#a55eea', // 60
	'#ff6348', // 64
	'#2ed573', // 100
	'#1e90ff', // 104
	'#ffa07a', // 108
	'#e056fd', // 112
	'#00d2d3', // 116
	'#ff9ff3', // 120
	'#f368e0', // 124
	'#48dbfb', // 128
	'#ff9f43', // 132
	'#badc58', // 136
	'#7158e2', // 140
	'#3ae374', // 144
	'#ff4757', // 149
	'#eccc68', // 153
	'#18dcff', // 157
	'#cd84f1', // 161
	'#17c0eb'  // 165
];

const COLORS_5: Map<number, string> = new Map(
	CHANNELS_5_ORDERED.map((ch, i) => [ch, HUES_5GHZ[i]!])
);

const HUES_6GHZ = [
	'#e74c3c',
	'#e67e22',
	'#f1c40f',
	'#2ecc71',
	'#1abc9c',
	'#3498db',
	'#9b59b6',
	'#e91e63',
	'#00bcd4',
	'#8bc34a',
	'#ff9800',
	'#795548'
];

export function channelColor(channelNumber: number, band: Band): string {
	switch (band) {
		case '2.4ghz':
			return COLORS_2_4[channelNumber] ?? '#cccccc';
		case '5ghz':
			return COLORS_5.get(channelNumber) ?? '#cccccc';
		case '6ghz': {
			const index = Math.floor((channelNumber - 1) / 4);
			return HUES_6GHZ[index % HUES_6GHZ.length]!;
		}
	}
}
