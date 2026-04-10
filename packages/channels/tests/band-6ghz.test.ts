import { describe, it, expect } from 'vitest';
import { CHANNELS_6GHZ, PSC_CHANNELS_6GHZ } from '../src/bands/band-6ghz.js';

describe('6 GHz band', () => {
	it('channel 1 frequency is 5955 MHz', () => {
		const ch1 = CHANNELS_6GHZ.find((c) => c.number === 1);
		expect(ch1?.frequency).toBe(5955);
	});

	it('PSC channels include 5, 21, 37', () => {
		expect(PSC_CHANNELS_6GHZ).toContain(5);
		expect(PSC_CHANNELS_6GHZ).toContain(21);
		expect(PSC_CHANNELS_6GHZ).toContain(37);
	});

	it('all channels have dfs=false', () => {
		for (const ch of CHANNELS_6GHZ) {
			expect(ch.dfs).toBe(false);
		}
	});

	it('has 59 channels at 20 MHz spacing', () => {
		expect(CHANNELS_6GHZ).toHaveLength(59);
	});
});
