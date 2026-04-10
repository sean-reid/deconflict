import { describe, it, expect } from 'vitest';
import { CHANNELS_5GHZ, DFS_CHANNELS_5GHZ } from '../src/bands/band-5ghz.js';

describe('5 GHz band', () => {
	it('has 25 channels total', () => {
		expect(CHANNELS_5GHZ).toHaveLength(25);
	});

	it('channel 36 frequency is 5180 MHz', () => {
		const ch36 = CHANNELS_5GHZ.find((c) => c.number === 36);
		expect(ch36?.frequency).toBe(5180);
	});

	it('channel 165 frequency is 5825 MHz', () => {
		const ch165 = CHANNELS_5GHZ.find((c) => c.number === 165);
		expect(ch165?.frequency).toBe(5825);
	});

	it('DFS channels are 52-64 and 100-144', () => {
		const expected = [52, 56, 60, 64, 100, 104, 108, 112, 116, 120, 124, 128, 132, 136, 140, 144];
		expect(DFS_CHANNELS_5GHZ).toEqual(expected);
	});

	it('channel 165 maxWidth is 20', () => {
		const ch165 = CHANNELS_5GHZ.find((c) => c.number === 165);
		expect(ch165?.maxWidth).toBe(20);
	});
});
