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
	'#5b9bff', // 36  — bright blue
	'#7b8cff', // 40  — periwinkle
	'#9b7dff', // 44  — lavender
	'#b06eff', // 48  — violet
	'#c75fff', // 52  — purple
	'#a55bdb', // 56  — plum
	'#8b6cd8', // 60  — iris
	'#6b7dd5', // 64  — slate blue
	'#4bc6e0', // 100 — sky
	'#3dbde0', // 104 — cyan
	'#5eaff0', // 108 — azure
	'#7ea1f0', // 112 — cornflower
	'#40d8e0', // 116 — aqua
	'#60cce0', // 120 — teal-cyan
	'#80c0f0', // 124 — light blue
	'#56b4e8', // 128 — steel blue
	'#7eb8f8', // 132 — soft blue
	'#9fb0f8', // 136 — periwinkle light
	'#bfa8f8', // 140 — lilac
	'#dfa0f8', // 144 — orchid
	'#8090ff', // 149 — royal
	'#a080ff', // 153 — amethyst
	'#c070ff', // 157 — magenta-purple
	'#e060ff', // 161 — fuchsia
	'#50c8ff'  // 165 — electric blue
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

export function channelColor(_channelNumber: number, _band: Band): string {
	return '#00d4ff';
}
