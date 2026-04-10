import { describe, it, expect } from 'vitest';
import { CHANNELS_2_4GHZ, NON_OVERLAPPING_2_4 } from '../src/bands/band-2_4ghz.js';

describe('2.4 GHz band', () => {
	it('has 13 channels', () => {
		expect(CHANNELS_2_4GHZ).toHaveLength(13);
	});

	it('channel 1 frequency is 2412 MHz', () => {
		const ch1 = CHANNELS_2_4GHZ.find((c) => c.number === 1);
		expect(ch1?.frequency).toBe(2412);
	});

	it('channel 6 frequency is 2437 MHz', () => {
		const ch6 = CHANNELS_2_4GHZ.find((c) => c.number === 6);
		expect(ch6?.frequency).toBe(2437);
	});

	it('channel 11 frequency is 2462 MHz', () => {
		const ch11 = CHANNELS_2_4GHZ.find((c) => c.number === 11);
		expect(ch11?.frequency).toBe(2462);
	});

	it('non-overlapping set is [1, 6, 11]', () => {
		expect([...NON_OVERLAPPING_2_4]).toEqual([1, 6, 11]);
	});

	it('all channels have band=2.4ghz and dfs=false', () => {
		for (const ch of CHANNELS_2_4GHZ) {
			expect(ch.band).toBe('2.4ghz');
			expect(ch.dfs).toBe(false);
		}
	});
});
